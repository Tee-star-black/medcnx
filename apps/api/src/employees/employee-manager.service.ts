import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, EmploymentStatus } from '@prisma/client';
import type { CurrentUser } from '../auth/types/current-user.type';
import { PrismaService } from '../database/prisma.service';
import type { EmployeeManagerChangeDto } from './dto/employee-manager-change.dto';

@Injectable()
export class EmployeeManagerService {
  constructor(private readonly prisma: PrismaService) {}

  async getContext(user: CurrentUser, employeeId: string) {
    const employee = await this.getEmployee(user, employeeId);

    const [manager, directReports, history] = await Promise.all([
      employee.managerId
        ? this.prisma.employee.findFirst({
            where: {
              id: employee.managerId,
              organisationId: user.organisationId,
            },
            select: this.employeeSummarySelect(),
          })
        : null,
      this.prisma.employee.findMany({
        where: {
          organisationId: user.organisationId,
          managerId: employee.id,
          employmentStatus: {
            notIn: [EmploymentStatus.TERMINATED, EmploymentStatus.RESIGNED],
          },
        },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        select: this.employeeSummarySelect(),
      }),
      this.prisma.employeeManagerAssignment.findMany({
        where: {
          organisationId: user.organisationId,
          employeeId: employee.id,
        },
        orderBy: { effectiveFrom: 'desc' },
      }),
    ]);

    const managerIds = [...new Set(history.map((item) => item.managerId).filter(Boolean))] as string[];
    const historicalManagers = managerIds.length
      ? await this.prisma.employee.findMany({
          where: {
            organisationId: user.organisationId,
            id: { in: managerIds },
          },
          select: this.employeeSummarySelect(),
        })
      : [];
    const managerById = new Map(historicalManagers.map((item) => [item.id, item]));

    return {
      employee: {
        id: employee.id,
        employeeNumber: employee.employeeNumber,
        firstName: employee.firstName,
        lastName: employee.lastName,
        jobTitle: employee.jobTitle,
        managerId: employee.managerId,
      },
      manager,
      directReports,
      history: history.map((item) => ({
        ...item,
        manager: item.managerId ? managerById.get(item.managerId) ?? null : null,
      })),
    };
  }

  async changeManager(
    user: CurrentUser,
    employeeId: string,
    dto: EmployeeManagerChangeDto,
  ) {
    const employee = await this.getMutableEmployee(user, employeeId);
    const nextManagerId = dto.managerId?.trim() || null;
    const effectiveDate = new Date(dto.effectiveDate);
    const reason = dto.reason.trim();

    if (Number.isNaN(effectiveDate.getTime())) {
      throw new BadRequestException('A valid manager effective date is required.');
    }
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
          employmentStatus: {
            notIn: [EmploymentStatus.TERMINATED, EmploymentStatus.RESIGNED],
          },
        },
        select: { id: true, firstName: true, lastName: true },
      });
      if (!manager) throw new NotFoundException('Manager not found or inactive.');
      await this.assertNoManagerCycle(user.organisationId, employee.id, manager.id);
      managerName = `${manager.firstName} ${manager.lastName}`;
    }

    const currentAssignment = await this.prisma.employeeManagerAssignment.findFirst({
      where: {
        organisationId: user.organisationId,
        employeeId: employee.id,
        effectiveTo: null,
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (currentAssignment && effectiveDate < currentAssignment.effectiveFrom) {
      throw new BadRequestException(
        'Manager effective date cannot precede the current assignment start date.',
      );
    }

    const message = nextManagerId
      ? `Employee manager changed to ${managerName}.`
      : 'Employee manager assignment removed.';

    const result = await this.prisma.$transaction(async (transaction) => {
      if (currentAssignment) {
        await transaction.employeeManagerAssignment.update({
          where: { id: currentAssignment.id },
          data: { effectiveTo: effectiveDate },
        });
      }

      const assignment = await transaction.employeeManagerAssignment.create({
        data: {
          organisationId: user.organisationId,
          employeeId: employee.id,
          managerId: nextManagerId,
          effectiveFrom: effectiveDate,
          reason,
          assignedByUserId: user.id,
        },
      });

      const updatedEmployee = await transaction.employee.update({
        where: { id: employee.id },
        data: { managerId: nextManagerId },
      });

      await transaction.auditLog.create({
        data: {
          organisationId: user.organisationId,
          actorUserId: user.id,
          employeeId: employee.id,
          action: AuditAction.UPDATE,
          entity: 'EmployeeLifecycle',
          entityId: employee.id,
          message,
          metadata: {
            eventType: 'MANAGER_CHANGED',
            reason,
            effectiveDate: effectiveDate.toISOString(),
            previousManagerId: employee.managerId,
            nextManagerId,
            managerName,
            managerAssignmentId: assignment.id,
          },
        },
      });

      return { assignment, employee: updatedEmployee };
    });

    return { message, ...result };
  }

  private async getMutableEmployee(user: CurrentUser, employeeId: string) {
    const employee = await this.getEmployee(user, employeeId);
    if (
      employee.employmentStatus === EmploymentStatus.TERMINATED ||
      employee.employmentStatus === EmploymentStatus.RESIGNED
    ) {
      throw new BadRequestException('Inactive employees cannot receive manager changes.');
    }
    return employee;
  }

  private async getEmployee(user: CurrentUser, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, organisationId: user.organisationId },
    });
    if (!employee) throw new NotFoundException('Employee not found.');
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

      const manager = await this.prisma.employee.findFirst({
        where: { id: currentManagerId, organisationId },
        select: { managerId: true },
      });
      if (!manager) throw new NotFoundException('Manager not found.');
      currentManagerId = manager.managerId;
    }
  }

  private employeeSummarySelect() {
    return {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      jobTitle: true,
      employmentStatus: true,
      departmentId: true,
    } as const;
  }
}
