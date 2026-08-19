import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, EmploymentStatus, UserStatus } from '@prisma/client';
import type { CurrentUser } from '../auth/types/current-user.type';
import { PrismaService } from '../database/prisma.service';
import type { EmployeeEmploymentTypeChangeDto } from './dto/employee-employment-type-change.dto';
import type { EmployeeLifecycleActionDto } from './dto/employee-lifecycle-action.dto';
import type { EmployeeManagerChangeDto } from './dto/employee-manager-change.dto';
import type { EmployeePromotionDto } from './dto/employee-promotion.dto';
import type { EmployeeTransferDto } from './dto/employee-transfer.dto';

type EmploymentHistoryEventType =
  | 'PROMOTED'
  | 'TRANSFERRED'
  | 'MANAGER_CHANGED'
  | 'EMPLOYMENT_TYPE_CHANGED'
  | 'SUSPENDED'
  | 'REACTIVATED'
  | 'RESIGNED'
  | 'TERMINATED';

type EmployeeLifecycleRecord = {
  id: string;
  organisationId: string;
  userId: string | null;
  departmentId: string | null;
  managerId: string | null;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  employmentType: string | null;
  employmentStatus: EmploymentStatus;
  startDate: Date | null;
  endDate: Date | null;
};

type EmploymentSnapshot = {
  departmentId: string | null;
  managerId: string | null;
  jobTitle: string | null;
  employmentType: string | null;
  employmentStatus: EmploymentStatus;
};

@Injectable()
export class EmployeeLifecycleService {
  constructor(private readonly prisma: PrismaService) {}

  async getHistory(user: CurrentUser, employeeId: string) {
    await this.getEmployee(user, employeeId);

    const events = await this.prisma.auditLog.findMany({
      where: {
        organisationId: user.organisationId,
        employeeId,
        OR: [
          { entity: 'Employee', action: AuditAction.CREATE },
          { entity: 'EmployeeLifecycle' },
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        action: true,
        entity: true,
        message: true,
        metadata: true,
        actorUserId: true,
        createdAt: true,
      },
    });

    return events.map((event) => {
      const metadata = (event.metadata ?? {}) as Record<string, unknown>;
      return {
        id: event.id,
        eventType:
          event.entity === 'Employee' && event.action === AuditAction.CREATE
            ? 'HIRED'
            : (metadata.eventType as string | undefined) ?? 'OTHER',
        effectiveDate:
          (metadata.effectiveDate as string | undefined) ??
          event.createdAt.toISOString(),
        reason:
          (metadata.reason as string | undefined) ??
          (event.entity === 'Employee' ? 'Employee record created' : null),
        previous: metadata.previous as Record<string, unknown> | undefined,
        next: metadata.next as Record<string, unknown> | undefined,
        previousEmploymentStatus:
          metadata.previousEmploymentStatus as string | undefined,
        nextEmploymentStatus:
          metadata.nextEmploymentStatus as string | undefined,
        departmentId: metadata.departmentId as string | undefined,
        managerId: metadata.managerId as string | undefined,
        jobTitle: metadata.jobTitle as string | undefined,
        employmentType: metadata.employmentType as string | undefined,
        changedByUserId: event.actorUserId,
        message: event.message,
        recordedAt: event.createdAt,
      };
    });
  }

  async promoteEmployee(
    user: CurrentUser,
    employeeId: string,
    dto: EmployeePromotionDto,
  ) {
    const employee = await this.getMutableEmployee(user, employeeId);
    const nextJobTitle = dto.jobTitle.trim();

    if (employee.jobTitle === nextJobTitle) {
      throw new BadRequestException('Employee already has this job title.');
    }

    return this.applyEmploymentChange(user, employee, {
      eventType: 'PROMOTED',
      effectiveDate: dto.effectiveDate,
      reason: dto.reason,
      data: { jobTitle: nextJobTitle },
      nextSnapshot: { ...this.snapshot(employee), jobTitle: nextJobTitle },
      message: `Employee promoted from ${employee.jobTitle ?? 'unspecified role'} to ${nextJobTitle}.`,
    });
  }

  async transferEmployee(
    user: CurrentUser,
    employeeId: string,
    dto: EmployeeTransferDto,
  ) {
    const employee = await this.getMutableEmployee(user, employeeId);
    const department = await this.prisma.department.findFirst({
      where: { id: dto.departmentId, organisationId: user.organisationId },
      select: { id: true, name: true },
    });

    if (!department) throw new NotFoundException('Department not found.');
    if (employee.departmentId === department.id) {
      throw new BadRequestException('Employee is already in this department.');
    }

    return this.applyEmploymentChange(user, employee, {
      eventType: 'TRANSFERRED',
      effectiveDate: dto.effectiveDate,
      reason: dto.reason,
      data: { departmentId: department.id },
      nextSnapshot: { ...this.snapshot(employee), departmentId: department.id },
      message: `Employee transferred to ${department.name}.`,
      metadata: { departmentName: department.name },
    });
  }

  async changeManager(
    user: CurrentUser,
    employeeId: string,
    dto: EmployeeManagerChangeDto,
  ) {
    const employee = await this.getMutableEmployee(user, employeeId);
    const nextManagerId = dto.managerId?.trim() || null;

    if (employee.managerId === nextManagerId) {
      throw new BadRequestException('Employee already has this manager assignment.');
    }
    if (nextManagerId === employee.id) {
      throw new BadRequestException('An employee cannot manage themselves.');
    }

    let managerName: string | null = null;
    if (nextManagerId) {
      const manager = await this.prisma.employee.findFirst({
        where: {
          id: nextManagerId,
          organisationId: user.organisationId,
          employmentStatus: { notIn: [EmploymentStatus.TERMINATED, EmploymentStatus.RESIGNED] },
        },
        select: { id: true, firstName: true, lastName: true },
      });
      if (!manager) throw new NotFoundException('Manager not found or inactive.');
      await this.assertNoManagerCycle(user.organisationId, employee.id, manager.id);
      managerName = `${manager.firstName} ${manager.lastName}`;
    }

    return this.applyEmploymentChange(user, employee, {
      eventType: 'MANAGER_CHANGED',
      effectiveDate: dto.effectiveDate,
      reason: dto.reason,
      data: { managerId: nextManagerId },
      nextSnapshot: { ...this.snapshot(employee), managerId: nextManagerId },
      message: nextManagerId
        ? `Employee manager changed to ${managerName}.`
        : 'Employee manager assignment removed.',
      metadata: { managerName },
    });
  }

  async changeEmploymentType(
    user: CurrentUser,
    employeeId: string,
    dto: EmployeeEmploymentTypeChangeDto,
  ) {
    const employee = await this.getMutableEmployee(user, employeeId);
    const nextEmploymentType = dto.employmentType.trim();

    if (employee.employmentType === nextEmploymentType) {
      throw new BadRequestException('Employee already has this employment type.');
    }

    return this.applyEmploymentChange(user, employee, {
      eventType: 'EMPLOYMENT_TYPE_CHANGED',
      effectiveDate: dto.effectiveDate,
      reason: dto.reason,
      data: { employmentType: nextEmploymentType },
      nextSnapshot: {
        ...this.snapshot(employee),
        employmentType: nextEmploymentType,
      },
      message: `Employee employment type changed from ${employee.employmentType ?? 'unspecified'} to ${nextEmploymentType}.`,
    });
  }

  terminateEmployee(
    user: CurrentUser,
    employeeId: string,
    dto: EmployeeLifecycleActionDto,
  ) {
    return this.transitionEmployee(user, employeeId, dto, {
      eventType: 'TERMINATED',
      nextStatus: EmploymentStatus.TERMINATED,
      disableLinkedUser: true,
      setEndDate: true,
      closeEmploymentStructure: true,
      allowedFrom: [
        EmploymentStatus.ACTIVE,
        EmploymentStatus.ON_LEAVE,
        EmploymentStatus.SUSPENDED,
      ],
      message: 'Employee terminated successfully. Historical records were preserved.',
    });
  }

  resignEmployee(
    user: CurrentUser,
    employeeId: string,
    dto: EmployeeLifecycleActionDto,
  ) {
    return this.transitionEmployee(user, employeeId, dto, {
      eventType: 'RESIGNED',
      nextStatus: EmploymentStatus.RESIGNED,
      disableLinkedUser: true,
      setEndDate: true,
      closeEmploymentStructure: true,
      allowedFrom: [
        EmploymentStatus.ACTIVE,
        EmploymentStatus.ON_LEAVE,
        EmploymentStatus.SUSPENDED,
      ],
      message: 'Employee resignation recorded successfully.',
    });
  }

  suspendEmployee(
    user: CurrentUser,
    employeeId: string,
    dto: EmployeeLifecycleActionDto,
  ) {
    return this.transitionEmployee(user, employeeId, dto, {
      eventType: 'SUSPENDED',
      nextStatus: EmploymentStatus.SUSPENDED,
      suspendLinkedUser: true,
      allowedFrom: [EmploymentStatus.ACTIVE, EmploymentStatus.ON_LEAVE],
      message: 'Employee suspended successfully.',
    });
  }

  reactivateEmployee(
    user: CurrentUser,
    employeeId: string,
    dto: EmployeeLifecycleActionDto,
  ) {
    return this.transitionEmployee(user, employeeId, dto, {
      eventType: 'REACTIVATED',
      nextStatus: EmploymentStatus.ACTIVE,
      reactivateLinkedUser: true,
      clearEndDate: true,
      allowedFrom: [EmploymentStatus.SUSPENDED],
      message: 'Employee reactivated successfully.',
    });
  }

  private async applyEmploymentChange(
    user: CurrentUser,
    employee: EmployeeLifecycleRecord,
    options: {
      eventType: EmploymentHistoryEventType;
      effectiveDate: string;
      reason: string;
      data: {
        jobTitle?: string;
        departmentId?: string;
        managerId?: string | null;
        employmentType?: string;
      };
      nextSnapshot: EmploymentSnapshot;
      message: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    const effectiveDate = this.parseEffectiveDate(options.effectiveDate);
    const reason = options.reason.trim();
    const previous = this.snapshot(employee);

    const updatedEmployee = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.employee.update({
        where: { id: employee.id },
        data: options.data,
      });

      await transaction.auditLog.create({
        data: {
          organisationId: user.organisationId,
          actorUserId: user.id,
          employeeId: employee.id,
          action: AuditAction.UPDATE,
          entity: 'EmployeeLifecycle',
          entityId: employee.id,
          message: options.message,
          metadata: {
            eventType: options.eventType,
            reason,
            effectiveDate: effectiveDate.toISOString(),
            previous,
            next: options.nextSnapshot,
            ...options.metadata,
          },
        },
      });

      return updated;
    });

    return { message: options.message, employee: updatedEmployee };
  }

  private async transitionEmployee(
    user: CurrentUser,
    employeeId: string,
    dto: EmployeeLifecycleActionDto,
    options: {
      eventType: EmploymentHistoryEventType;
      nextStatus: EmploymentStatus;
      allowedFrom: EmploymentStatus[];
      message: string;
      disableLinkedUser?: boolean;
      suspendLinkedUser?: boolean;
      reactivateLinkedUser?: boolean;
      setEndDate?: boolean;
      clearEndDate?: boolean;
      closeEmploymentStructure?: boolean;
    },
  ) {
    const employee = await this.getEmployee(user, employeeId);
    const effectiveDate = this.parseEffectiveDate(dto.effectiveDate);
    const reason = dto.reason.trim();

    if (!options.allowedFrom.includes(employee.employmentStatus)) {
      throw new BadRequestException(
        `Cannot transition employee from ${employee.employmentStatus} to ${options.nextStatus}.`,
      );
    }

    if (options.setEndDate) {
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);
      if (effectiveDate > endOfToday) {
        throw new BadRequestException(
          'Employment end date cannot be in the future until scheduled lifecycle changes are supported.',
        );
      }
      if (employee.startDate && effectiveDate < employee.startDate) {
        throw new BadRequestException(
          'Employment end date cannot precede the employee start date.',
        );
      }
    }

    const previous = this.snapshot(employee);
    const next = {
      ...previous,
      employmentStatus: options.nextStatus,
      ...(options.closeEmploymentStructure ? { managerId: null } : {}),
    };

    const result = await this.prisma.$transaction(async (transaction) => {
      const structureCleanup = {
        closedPositionAssignments: 0,
        closedEmployeeManagerAssignments: 0,
        detachedDirectReports: 0,
        closedDirectReportManagerAssignments: 0,
      };

      if (options.closeEmploymentStructure) {
        const [activePositionAssignments, activeManagerAssignments, directReports] =
          await Promise.all([
            transaction.employeePositionAssignment.findMany({
              where: {
                organisationId: user.organisationId,
                employeeId: employee.id,
                effectiveTo: null,
              },
              select: { id: true, effectiveFrom: true },
            }),
            transaction.employeeManagerAssignment.findMany({
              where: {
                organisationId: user.organisationId,
                employeeId: employee.id,
                effectiveTo: null,
              },
              select: { id: true, effectiveFrom: true },
            }),
            transaction.employee.findMany({
              where: {
                organisationId: user.organisationId,
                managerId: employee.id,
              },
              select: { id: true },
            }),
          ]);

        if (
          activePositionAssignments.some(
            (assignment) => assignment.effectiveFrom > effectiveDate,
          )
        ) {
          throw new BadRequestException(
            'Employment end date cannot precede an active position assignment start date.',
          );
        }
        if (
          activeManagerAssignments.some(
            (assignment) => assignment.effectiveFrom > effectiveDate,
          )
        ) {
          throw new BadRequestException(
            'Employment end date cannot precede the current manager assignment start date.',
          );
        }

        const directReportIds = directReports.map((report) => report.id);
        const directReportManagerAssignments = directReportIds.length
          ? await transaction.employeeManagerAssignment.findMany({
              where: {
                organisationId: user.organisationId,
                employeeId: { in: directReportIds },
                managerId: employee.id,
                effectiveTo: null,
              },
              select: { id: true, effectiveFrom: true },
            })
          : [];

        if (
          directReportManagerAssignments.some(
            (assignment) => assignment.effectiveFrom > effectiveDate,
          )
        ) {
          throw new BadRequestException(
            'Employment end date cannot precede a direct report manager assignment start date.',
          );
        }

        if (activePositionAssignments.length) {
          const closed = await transaction.employeePositionAssignment.updateMany({
            where: {
              id: { in: activePositionAssignments.map((assignment) => assignment.id) },
            },
            data: { effectiveTo: effectiveDate },
          });
          structureCleanup.closedPositionAssignments = closed.count;
        }

        if (activeManagerAssignments.length) {
          const closed = await transaction.employeeManagerAssignment.updateMany({
            where: {
              id: { in: activeManagerAssignments.map((assignment) => assignment.id) },
            },
            data: { effectiveTo: effectiveDate },
          });
          structureCleanup.closedEmployeeManagerAssignments = closed.count;
        }

        if (directReportManagerAssignments.length) {
          const closed = await transaction.employeeManagerAssignment.updateMany({
            where: {
              id: {
                in: directReportManagerAssignments.map((assignment) => assignment.id),
              },
            },
            data: { effectiveTo: effectiveDate },
          });
          structureCleanup.closedDirectReportManagerAssignments = closed.count;
        }

        if (directReportIds.length) {
          const detached = await transaction.employee.updateMany({
            where: {
              organisationId: user.organisationId,
              id: { in: directReportIds },
              managerId: employee.id,
            },
            data: { managerId: null },
          });
          structureCleanup.detachedDirectReports = detached.count;
        }
      }

      const updated = await transaction.employee.update({
        where: { id: employee.id },
        data: {
          employmentStatus: options.nextStatus,
          ...(options.setEndDate ? { endDate: effectiveDate } : {}),
          ...(options.clearEndDate ? { endDate: null } : {}),
          ...(options.closeEmploymentStructure ? { managerId: null } : {}),
        },
      });

      if (employee.userId) {
        if (options.disableLinkedUser) {
          await transaction.user.updateMany({
            where: { id: employee.userId, organisationId: user.organisationId },
            data: { status: UserStatus.DISABLED },
          });
        } else if (options.suspendLinkedUser) {
          await transaction.user.updateMany({
            where: { id: employee.userId, organisationId: user.organisationId },
            data: { status: UserStatus.SUSPENDED },
          });
        } else if (options.reactivateLinkedUser) {
          await transaction.user.updateMany({
            where: { id: employee.userId, organisationId: user.organisationId },
            data: { status: UserStatus.ACTIVE },
          });
        }

        if (options.disableLinkedUser || options.suspendLinkedUser) {
          await transaction.authSession.updateMany({
            where: { userId: employee.userId, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
      }

      await transaction.auditLog.create({
        data: {
          organisationId: user.organisationId,
          actorUserId: user.id,
          employeeId: employee.id,
          action: AuditAction.UPDATE,
          entity: 'EmployeeLifecycle',
          entityId: employee.id,
          message: `${options.eventType}: ${employee.firstName} ${employee.lastName}.`,
          metadata: {
            eventType: options.eventType,
            reason,
            effectiveDate: effectiveDate.toISOString(),
            previous,
            next,
            previousEmploymentStatus: employee.employmentStatus,
            nextEmploymentStatus: options.nextStatus,
            departmentId: employee.departmentId,
            managerId: employee.managerId,
            jobTitle: employee.jobTitle,
            employmentType: employee.employmentType,
            linkedUserId: employee.userId,
            ...(options.closeEmploymentStructure ? { structureCleanup } : {}),
          },
        },
      });

      return { updated, structureCleanup };
    });

    return {
      message: options.message,
      employee: result.updated,
    };
  }

  private async getMutableEmployee(user: CurrentUser, employeeId: string) {
    const employee = await this.getEmployee(user, employeeId);
    if (
      employee.employmentStatus === EmploymentStatus.TERMINATED ||
      employee.employmentStatus === EmploymentStatus.RESIGNED
    ) {
      throw new BadRequestException('Inactive employees cannot receive employment changes.');
    }
    return employee;
  }

  private async assertNoManagerCycle(
    organisationId: string,
    employeeId: string,
    proposedManagerId: string,
  ) {
    let currentManagerId: string | null = proposedManagerId;
    const visited = new Set<string>();

    while (currentManagerId) {
      if (currentManagerId === employeeId) {
        throw new BadRequestException('Manager assignment would create a reporting cycle.');
      }
      if (visited.has(currentManagerId)) {
        throw new BadRequestException('Existing manager hierarchy contains a reporting cycle.');
      }
      visited.add(currentManagerId);

      const currentManager = await this.prisma.employee.findFirst({
        where: { id: currentManagerId, organisationId },
        select: { managerId: true },
      });
      if (!currentManager) throw new NotFoundException('Manager not found.');
      currentManagerId = currentManager.managerId;
    }
  }

  private snapshot(employee: EmployeeLifecycleRecord): EmploymentSnapshot {
    return {
      departmentId: employee.departmentId,
      managerId: employee.managerId,
      jobTitle: employee.jobTitle,
      employmentType: employee.employmentType,
      employmentStatus: employee.employmentStatus,
    };
  }

  private async getEmployee(
    user: CurrentUser,
    employeeId: string,
  ): Promise<EmployeeLifecycleRecord> {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, organisationId: user.organisationId },
      select: {
        id: true,
        organisationId: true,
        userId: true,
        departmentId: true,
        managerId: true,
        firstName: true,
        lastName: true,
        jobTitle: true,
        employmentType: true,
        employmentStatus: true,
        startDate: true,
        endDate: true,
      },
    });

    if (!employee) throw new NotFoundException('Employee not found.');
    return employee;
  }

  private parseEffectiveDate(value: string) {
    const effectiveDate = new Date(value);
    if (Number.isNaN(effectiveDate.getTime())) {
      throw new BadRequestException('A valid lifecycle effective date is required.');
    }
    return effectiveDate;
  }
}
