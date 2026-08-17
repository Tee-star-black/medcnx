import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, EmploymentStatus } from '@prisma/client';
import { AccessScopeService } from '../auth/access-scope.service';
import type { CurrentUser } from '../auth/types/current-user.type';
import { PrismaService } from '../database/prisma.service';
import { AssignPositionDto } from './dto/assign-position.dto';
import { CreatePositionDto } from './dto/create-position.dto';
import { UpdatePositionDto } from './dto/update-position.dto';

@Injectable()
export class PositionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessScope: AccessScopeService,
  ) {}

  async findAll(user: CurrentUser) {
    const positions = await this.prisma.position.findMany({
      where: { organisationId: user.organisationId },
      orderBy: [{ active: 'desc' }, { title: 'asc' }],
    });

    const departmentIds = [
      ...new Set(positions.map((position) => position.departmentId).filter(Boolean)),
    ] as string[];

    const departments = departmentIds.length
      ? await this.prisma.department.findMany({
          where: {
            organisationId: user.organisationId,
            id: { in: departmentIds },
          },
          select: { id: true, name: true },
        })
      : [];

    const departmentById = new Map(
      departments.map((department) => [department.id, department]),
    );

    return Promise.all(
      positions.map(async (position) => {
        const currentHeadcount = await this.prisma.employeePositionAssignment.count({
          where: {
            organisationId: user.organisationId,
            positionId: position.id,
            effectiveTo: null,
          },
        });

        return {
          ...position,
          department: position.departmentId
            ? departmentById.get(position.departmentId) ?? null
            : null,
          currentHeadcount,
          vacancies: Math.max(position.approvedHeadcount - currentHeadcount, 0),
        };
      }),
    );
  }

  async findOne(user: CurrentUser, positionId: string) {
    const position = await this.getPosition(user, positionId);
    const currentAssignments = await this.prisma.employeePositionAssignment.findMany({
      where: {
        organisationId: user.organisationId,
        positionId,
        effectiveTo: null,
      },
      orderBy: { effectiveFrom: 'asc' },
    });

    const employeeIds = currentAssignments.map((assignment) => assignment.employeeId);
    const employees = employeeIds.length
      ? await this.prisma.employee.findMany({
          where: {
            organisationId: user.organisationId,
            id: { in: employeeIds },
          },
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
            jobTitle: true,
            employmentStatus: true,
          },
        })
      : [];

    return {
      ...position,
      currentHeadcount: currentAssignments.length,
      vacancies: Math.max(position.approvedHeadcount - currentAssignments.length, 0),
      employees,
    };
  }

  async create(user: CurrentUser, dto: CreatePositionDto) {
    if (dto.departmentId) {
      await this.assertDepartment(user, dto.departmentId);
    }

    const duplicate = await this.prisma.position.findFirst({
      where: {
        organisationId: user.organisationId,
        code: dto.code.trim(),
      },
    });

    if (duplicate) throw new ConflictException('Position code already exists.');

    const position = await this.prisma.position.create({
      data: {
        organisationId: user.organisationId,
        departmentId: dto.departmentId,
        code: dto.code.trim(),
        title: dto.title.trim(),
        description: dto.description?.trim(),
        level: dto.level?.trim(),
        employmentCategory: dto.employmentCategory?.trim(),
        approvedHeadcount: dto.approvedHeadcount ?? 0,
        active: dto.active ?? true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organisationId: user.organisationId,
        actorUserId: user.id,
        action: AuditAction.CREATE,
        entity: 'Position',
        entityId: position.id,
        message: `Position created: ${position.title}.`,
        metadata: {
          code: position.code,
          departmentId: position.departmentId,
          approvedHeadcount: position.approvedHeadcount,
        },
      },
    });

    return position;
  }

  async update(user: CurrentUser, positionId: string, dto: UpdatePositionDto) {
    const existing = await this.getPosition(user, positionId);

    if (dto.departmentId) {
      await this.assertDepartment(user, dto.departmentId);
    }

    if (dto.code && dto.code.trim() !== existing.code) {
      const duplicate = await this.prisma.position.findFirst({
        where: {
          organisationId: user.organisationId,
          code: dto.code.trim(),
          id: { not: positionId },
        },
      });
      if (duplicate) throw new ConflictException('Position code already exists.');
    }

    const position = await this.prisma.position.update({
      where: { id: positionId },
      data: {
        code: dto.code?.trim(),
        title: dto.title?.trim(),
        departmentId: dto.departmentId,
        description: dto.description?.trim(),
        level: dto.level?.trim(),
        employmentCategory: dto.employmentCategory?.trim(),
        approvedHeadcount: dto.approvedHeadcount,
        active: dto.active,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organisationId: user.organisationId,
        actorUserId: user.id,
        action: AuditAction.UPDATE,
        entity: 'Position',
        entityId: position.id,
        message: `Position updated: ${position.title}.`,
        metadata: {
          previous: existing,
          next: position,
        },
      },
    });

    return position;
  }

  async archive(user: CurrentUser, positionId: string) {
    const position = await this.getPosition(user, positionId);
    const assigned = await this.prisma.employeePositionAssignment.count({
      where: {
        organisationId: user.organisationId,
        positionId,
        effectiveTo: null,
      },
    });

    if (assigned > 0) {
      throw new ConflictException(
        'Cannot archive a position while employees are actively assigned to it.',
      );
    }

    const archived = await this.prisma.position.update({
      where: { id: positionId },
      data: { active: false },
    });

    await this.prisma.auditLog.create({
      data: {
        organisationId: user.organisationId,
        actorUserId: user.id,
        action: AuditAction.UPDATE,
        entity: 'Position',
        entityId: position.id,
        message: `Position archived: ${position.title}.`,
        metadata: { active: false },
      },
    });

    return archived;
  }

  async assignEmployee(
    user: CurrentUser,
    employeeId: string,
    dto: AssignPositionDto,
  ) {
    await this.accessScope.assertEmployeeAccess(user, employeeId);

    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, organisationId: user.organisationId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        departmentId: true,
        jobTitle: true,
        employmentStatus: true,
      },
    });

    if (!employee) throw new NotFoundException('Employee not found.');
    if (
      employee.employmentStatus === EmploymentStatus.TERMINATED ||
      employee.employmentStatus === EmploymentStatus.RESIGNED
    ) {
      throw new BadRequestException('Inactive employees cannot be assigned a position.');
    }

    const position = await this.getPosition(user, dto.positionId);
    if (!position.active) throw new BadRequestException('Position is archived.');
    if (position.departmentId && position.departmentId !== employee.departmentId) {
      throw new BadRequestException(
        'Employee must be transferred to the position department before assignment.',
      );
    }

    const effectiveDate = new Date(dto.effectiveDate);
    if (Number.isNaN(effectiveDate.getTime())) {
      throw new BadRequestException('A valid position effective date is required.');
    }

    const current = await this.prisma.employeePositionAssignment.findFirst({
      where: {
        organisationId: user.organisationId,
        employeeId,
        effectiveTo: null,
      },
    });

    if (current?.positionId === position.id) {
      throw new ConflictException('Employee is already assigned to this position.');
    }
    if (current && effectiveDate < current.effectiveFrom) {
      throw new BadRequestException(
        'New position effective date cannot precede the current assignment start date.',
      );
    }

    const previousPosition = current
      ? await this.prisma.position.findFirst({
          where: {
            id: current.positionId,
            organisationId: user.organisationId,
          },
        })
      : null;

    const assignment = await this.prisma.$transaction(async (transaction) => {
      if (current) {
        await transaction.employeePositionAssignment.update({
          where: { id: current.id },
          data: { effectiveTo: effectiveDate },
        });
      }

      const created = await transaction.employeePositionAssignment.create({
        data: {
          organisationId: user.organisationId,
          employeeId,
          positionId: position.id,
          effectiveFrom: effectiveDate,
          reason: dto.reason?.trim(),
          assignedByUserId: user.id,
        },
      });

      await transaction.employee.update({
        where: { id: employeeId },
        data: { jobTitle: position.title },
      });

      await transaction.auditLog.create({
        data: {
          organisationId: user.organisationId,
          actorUserId: user.id,
          employeeId,
          action: AuditAction.UPDATE,
          entity: 'EmployeeLifecycle',
          entityId: employeeId,
          message: `POSITION_CHANGED: ${employee.firstName} ${employee.lastName}.`,
          metadata: {
            eventType: 'POSITION_CHANGED',
            effectiveDate: effectiveDate.toISOString(),
            reason: dto.reason?.trim() ?? null,
            previousPositionId: previousPosition?.id ?? null,
            previousPositionCode: previousPosition?.code ?? null,
            previousPositionTitle: previousPosition?.title ?? employee.jobTitle,
            nextPositionId: position.id,
            nextPositionCode: position.code,
            nextPositionTitle: position.title,
            departmentId: employee.departmentId,
          },
        },
      });

      return created;
    });

    return { assignment, position };
  }

  async employeeHistory(user: CurrentUser, employeeId: string) {
    await this.accessScope.assertEmployeeAccess(user, employeeId);
    return this.prisma.employeePositionAssignment.findMany({
      where: {
        organisationId: user.organisationId,
        employeeId,
      },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  private async getPosition(user: CurrentUser, positionId: string) {
    const position = await this.prisma.position.findFirst({
      where: { id: positionId, organisationId: user.organisationId },
    });
    if (!position) throw new NotFoundException('Position not found.');
    return position;
  }

  private async assertDepartment(user: CurrentUser, departmentId: string) {
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, organisationId: user.organisationId },
      select: { id: true },
    });
    if (!department) throw new NotFoundException('Department not found.');
  }
}
