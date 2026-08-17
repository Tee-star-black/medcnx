import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, EmploymentStatus, UserStatus } from '@prisma/client';
import type { CurrentUser } from '../auth/types/current-user.type';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class EmployeeLifecycleService {
  constructor(private readonly prisma: PrismaService) {}

  async terminateEmployee(user: CurrentUser, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, organisationId: user.organisationId },
      select: {
        id: true,
        organisationId: true,
        userId: true,
        firstName: true,
        lastName: true,
        employmentStatus: true,
        endDate: true,
      },
    });

    if (!employee) throw new NotFoundException('Employee not found.');

    if (
      employee.employmentStatus === EmploymentStatus.TERMINATED ||
      employee.employmentStatus === EmploymentStatus.RESIGNED
    ) {
      throw new BadRequestException('Employee is already inactive.');
    }

    const effectiveEndDate = new Date();

    const updatedEmployee = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.employee.update({
        where: { id: employee.id },
        data: {
          employmentStatus: EmploymentStatus.TERMINATED,
          endDate: employee.endDate ?? effectiveEndDate,
        },
      });

      if (employee.userId) {
        await transaction.user.updateMany({
          where: { id: employee.userId, organisationId: user.organisationId },
          data: { status: UserStatus.DISABLED },
        });
        await transaction.authSession.updateMany({
          where: { userId: employee.userId, revokedAt: null },
          data: { revokedAt: effectiveEndDate },
        });
      }

      await transaction.auditLog.create({
        data: {
          organisationId: user.organisationId,
          actorUserId: user.id,
          employeeId: employee.id,
          action: AuditAction.UPDATE,
          entity: 'EmployeeLifecycle',
          entityId: employee.id,
          message: `Employee ${employee.firstName} ${employee.lastName} terminated and historical records preserved.`,
          metadata: {
            previousEmploymentStatus: employee.employmentStatus,
            nextEmploymentStatus: EmploymentStatus.TERMINATED,
            linkedUserDisabled: Boolean(employee.userId),
            sessionsRevoked: Boolean(employee.userId),
            effectiveEndDate: (employee.endDate ?? effectiveEndDate).toISOString(),
          },
        },
      });

      return updated;
    });

    return {
      message: 'Employee terminated successfully. Historical records were preserved.',
      employee: updatedEmployee,
    };
  }
}
