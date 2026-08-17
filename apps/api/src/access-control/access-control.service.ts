import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, UserStatus } from '@prisma/client';

import type { CurrentUser } from '../auth/types/current-user.type';
import { PrismaService } from '../database/prisma.service';
import { CreateCustomRoleDto } from './dto/create-custom-role.dto';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

@Injectable()
export class AccessControlService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(user: CurrentUser) {
    const [users, roles, permissions] = await Promise.all([
      this.prisma.user.findMany({
        where: { organisationId: user.organisationId },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        select: this.userSelect(),
      }),
      this.prisma.role.findMany({
        where: { organisationId: user.organisationId },
        orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          description: true,
          isSystem: true,
          _count: { select: { userRoles: true } },
          rolePermissions: {
            select: { permissionId: true },
          },
        },
      }),
      this.prisma.permission.findMany({
        orderBy: { key: 'asc' },
        select: {
          id: true,
          key: true,
          description: true,
        },
      }),
    ]);

    return {
      users,
      roles: roles.map((role) => ({
        id: role.id,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        userCount: role._count.userRoles,
        permissionIds: role.rolePermissions.map((item) => item.permissionId),
      })),
      permissions,
    };
  }

  async updateUserRoles(
    actor: CurrentUser,
    targetUserId: string,
    dto: UpdateUserRolesDto,
  ) {
    const target = await this.prisma.user.findFirst({
      where: {
        id: targetUserId,
        organisationId: actor.organisationId,
      },
      select: {
        id: true,
        email: true,
        userRoles: {
          select: { role: { select: { id: true, name: true } } },
        },
      },
    });

    if (!target) throw new NotFoundException('User not found.');

    const roles = await this.prisma.role.findMany({
      where: {
        id: { in: dto.roleIds },
        organisationId: actor.organisationId,
      },
      select: { id: true, name: true },
    });

    if (roles.length !== dto.roleIds.length) {
      throw new BadRequestException(
        'One or more selected roles do not belong to this organisation.',
      );
    }

    const previousRoles = target.userRoles.map((item) => item.role.name);
    const nextRoles = roles.map((role) => role.name);

    if (
      previousRoles.includes('ORG_ADMIN') &&
      !nextRoles.includes('ORG_ADMIN')
    ) {
      await this.assertAnotherActiveAdministrator(
        actor.organisationId,
        target.id,
      );
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.userRole.deleteMany({
        where: { userId: target.id },
      });
      await transaction.userRole.createMany({
        data: dto.roleIds.map((roleId) => ({ userId: target.id, roleId })),
      });
      await transaction.auditLog.create({
        data: {
          organisationId: actor.organisationId,
          actorUserId: actor.id,
          action: AuditAction.UPDATE,
          entity: 'UserAccess',
          entityId: target.id,
          message: `Roles updated for ${target.email}.`,
          metadata: { previousRoles, nextRoles },
        },
      });
    });

    return this.getUser(actor.organisationId, target.id);
  }

  async updateUserStatus(
    actor: CurrentUser,
    targetUserId: string,
    dto: UpdateUserStatusDto,
  ) {
    if (actor.id === targetUserId && dto.status !== 'ACTIVE') {
      throw new ForbiddenException(
        'You cannot suspend or disable your own account.',
      );
    }

    const target = await this.prisma.user.findFirst({
      where: { id: targetUserId, organisationId: actor.organisationId },
      select: {
        id: true,
        email: true,
        status: true,
        userRoles: { select: { role: { select: { name: true } } } },
      },
    });

    if (!target) throw new NotFoundException('User not found.');

    if (
      target.userRoles.some((item) => item.role.name === 'ORG_ADMIN') &&
      dto.status !== 'ACTIVE'
    ) {
      await this.assertAnotherActiveAdministrator(
        actor.organisationId,
        target.id,
      );
    }

    const updated = await this.prisma.$transaction(async (transaction) => {
      const result = await transaction.user.update({
        where: { id: target.id },
        data: { status: dto.status },
        select: this.userSelect(),
      });
      if (dto.status !== 'ACTIVE') {
        await transaction.authSession.updateMany({
          where: { userId: target.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      await transaction.auditLog.create({
        data: {
          organisationId: actor.organisationId,
          actorUserId: actor.id,
          action: AuditAction.UPDATE,
          entity: 'UserStatus',
          entityId: target.id,
          message: `${target.email} changed from ${target.status} to ${dto.status}.`,
          metadata: { previousStatus: target.status, nextStatus: dto.status },
        },
      });
      return result;
    });

    return updated;
  }

  async createCustomRole(actor: CurrentUser, dto: CreateCustomRoleDto) {
    await this.assertPermissionsManageable(actor, dto.permissionIds);
    const name = this.normaliseRoleName(dto.name);

    const existing = await this.prisma.role.findFirst({
      where: { organisationId: actor.organisationId, name },
      select: { id: true },
    });
    if (existing)
      throw new ConflictException('A role with this name already exists.');

    return this.prisma.$transaction(async (transaction) => {
      const role = await transaction.role.create({
        data: {
          organisationId: actor.organisationId,
          name,
          description: dto.description?.trim() || null,
          isSystem: false,
        },
      });
      await transaction.rolePermission.createMany({
        data: dto.permissionIds.map((permissionId) => ({
          roleId: role.id,
          permissionId,
        })),
      });
      await transaction.auditLog.create({
        data: {
          organisationId: actor.organisationId,
          actorUserId: actor.id,
          action: AuditAction.CREATE,
          entity: 'Role',
          entityId: role.id,
          message: `Custom role ${name} created.`,
          metadata: { permissionIds: dto.permissionIds },
        },
      });
      return role;
    });
  }

  async updateRolePermissions(
    actor: CurrentUser,
    roleId: string,
    dto: UpdateRolePermissionsDto,
  ) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, organisationId: actor.organisationId },
      select: {
        id: true,
        name: true,
        isSystem: true,
        rolePermissions: { select: { permissionId: true } },
      },
    });
    if (!role) throw new NotFoundException('Role not found.');
    if (role.isSystem) {
      throw new ForbiddenException(
        'System role permissions are protected. Create a custom role instead.',
      );
    }

    await this.assertPermissionsManageable(actor, dto.permissionIds);
    const previousPermissionIds = role.rolePermissions.map(
      (item) => item.permissionId,
    );

    await this.prisma.$transaction(async (transaction) => {
      await transaction.rolePermission.deleteMany({
        where: { roleId: role.id },
      });
      await transaction.rolePermission.createMany({
        data: dto.permissionIds.map((permissionId) => ({
          roleId: role.id,
          permissionId,
        })),
      });
      await transaction.auditLog.create({
        data: {
          organisationId: actor.organisationId,
          actorUserId: actor.id,
          action: AuditAction.UPDATE,
          entity: 'RolePermissions',
          entityId: role.id,
          message: `Permissions updated for custom role ${role.name}.`,
          metadata: {
            previousPermissionIds,
            nextPermissionIds: dto.permissionIds,
          },
        },
      });
    });

    return { success: true };
  }

  private async getUser(organisationId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organisationId },
      select: this.userSelect(),
    });
    if (!user) throw new NotFoundException('User not found.');
    return user;
  }

  private async assertPermissionsManageable(
    actor: CurrentUser,
    permissionIds: string[],
  ) {
    const permissions = await this.prisma.permission.findMany({
      where: { id: { in: permissionIds } },
      select: { id: true, key: true },
    });
    if (permissions.length !== permissionIds.length) {
      throw new BadRequestException('One or more permissions are invalid.');
    }
    const prohibited = permissions.filter(
      (permission) => !actor.permissions.includes(permission.key),
    );
    if (prohibited.length) {
      throw new ForbiddenException(
        `You cannot grant permissions you do not hold: ${prohibited
          .map((permission) => permission.key)
          .join(', ')}.`,
      );
    }
  }

  private async assertAnotherActiveAdministrator(
    organisationId: string,
    excludedUserId: string,
  ) {
    const count = await this.prisma.user.count({
      where: {
        organisationId,
        id: { not: excludedUserId },
        status: UserStatus.ACTIVE,
        userRoles: { some: { role: { name: 'ORG_ADMIN' } } },
      },
    });
    if (!count) {
      throw new ForbiddenException(
        'At least one active organisation administrator must remain.',
      );
    }
  }

  private normaliseRoleName(value: string) {
    return value
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_');
  }

  private userSelect() {
    return {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      status: true,
      lastLoginAt: true,
      employeeProfile: {
        select: {
          id: true,
          employeeNumber: true,
          jobTitle: true,
          employmentStatus: true,
        },
      },
      userRoles: {
        select: {
          role: { select: { id: true, name: true, isSystem: true } },
        },
      },
    } as const;
  }
}
