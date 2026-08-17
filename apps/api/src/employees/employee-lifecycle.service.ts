import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, EmploymentStatus, UserStatus } from '@prisma/client';
import type { CurrentUser } from '../auth/types/current-user.type';
import { PrismaService } from '../database/prisma.service';
import type { EmployeeLifecycleActionDto } from './dto/employee-lifecycle-action.dto';

type EmploymentHistoryEventType =
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
  endDate: Date | null;
};

@Injectable()
export class EmployeeLifecycleService {
  constructor(private readonly prisma: PrismaService) {}

  async getHistory(user: CurrentUser, employeeId: string) {
    await this.getEmployee(user, employeeId);

    return this.prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT
        "id",
        "organisationId",
        "employeeId",
        "eventType",
        "effectiveDate",
        "reason",
        "previousDepartmentId",
        "nextDepartmentId",
        "previousManagerId",
        "nextManagerId",
        "previousJobTitle",
        "nextJobTitle",
        "previousEmploymentType",
        "nextEmploymentType",
        "previousEmploymentStatus",
        "nextEmploymentStatus",
        "changedByUserId",
        "metadata",
        "createdAt"
      FROM "employee_employment_history"
      WHERE "organisationId" = ${user.organisationId}
        AND "employeeId" = ${employeeId}
      ORDER BY "effectiveDate" DESC, "createdAt" DESC
    `;
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

    const updatedEmployee = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.employee.update({
        where: { id: employee.id },
        data: {
          employmentStatus: options.nextStatus,
          ...(options.setEndDate ? { endDate: effectiveDate } : {}),
          ...(options.clearEndDate ? { endDate: null } : {}),
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

      await transaction.$executeRaw`
        INSERT INTO "employee_employment_history" (
          "organisationId",
          "employeeId",
          "eventType",
          "effectiveDate",
          "reason",
          "previousDepartmentId",
          "nextDepartmentId",
          "previousManagerId",
          "nextManagerId",
          "previousJobTitle",
          "nextJobTitle",
          "previousEmploymentType",
          "nextEmploymentType",
          "previousEmploymentStatus",
          "nextEmploymentStatus",
          "changedByUserId",
          "metadata"
        ) VALUES (
          ${user.organisationId},
          ${employee.id},
          ${options.eventType},
          ${effectiveDate},
          ${reason},
          ${employee.departmentId},
          ${employee.departmentId},
          ${employee.managerId},
          ${employee.managerId},
          ${employee.jobTitle},
          ${employee.jobTitle},
          ${employee.employmentType},
          ${employee.employmentType},
          ${employee.employmentStatus}::text,
          ${options.nextStatus}::text,
          ${user.id},
          ${JSON.stringify({ linkedUserId: employee.userId })}::jsonb
        )
      `;

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
            previousEmploymentStatus: employee.employmentStatus,
            nextEmploymentStatus: options.nextStatus,
            linkedUserId: employee.userId,
          },
        },
      });

      return updated;
    });

    return {
      message: options.message,
      employee: updatedEmployee,
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
