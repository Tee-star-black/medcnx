import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  EmployeeNotificationCategory,
  EmploymentStatus,
  LeaveStatus,
} from '@prisma/client';
import type { CurrentUser } from '../auth/types/current-user.type';
import { PrismaService } from '../database/prisma.service';
import { EmployeeNotificationService } from '../employee-self-service/employee-notification.service';
import type { RejectLeaveRequestDto } from './dto/reject-leave-request.dto';

@Injectable()
export class ManagerLeaveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: EmployeeNotificationService,
  ) {}

  async findPendingForMyTeam(user: CurrentUser) {
    const manager = await this.getLinkedManager(user);

    return this.prisma.leaveRequest.findMany({
      where: {
        organisationId: user.organisationId,
        status: LeaveStatus.PENDING,
        employee: {
          managerId: manager.id,
          employmentStatus: {
            notIn: [EmploymentStatus.TERMINATED, EmploymentStatus.RESIGNED],
          },
        },
      },
      orderBy: [{ startDate: 'asc' }, { createdAt: 'asc' }],
      include: this.leaveRequestInclude(),
    });
  }

  async approve(user: CurrentUser, leaveRequestId: string) {
    const existing = await this.getPendingDirectReportRequest(user, leaveRequestId);

    const leaveRequest = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.leaveRequest.update({
        where: { id: existing.id },
        data: {
          status: LeaveStatus.APPROVED,
          approvedByUserId: user.id,
          approvedAt: new Date(),
          rejectionNote: null,
        },
        include: this.leaveRequestInclude(),
      });

      await transaction.auditLog.create({
        data: {
          organisationId: user.organisationId,
          actorUserId: user.id,
          employeeId: existing.employeeId,
          action: AuditAction.APPROVE,
          entity: 'LeaveRequest',
          entityId: existing.id,
          message: 'Manager approved direct report leave request.',
          metadata: {
            managerScoped: true,
            leaveType: existing.leaveType,
            startDate: existing.startDate,
            endDate: existing.endDate,
            totalDays: existing.totalDays,
          },
        },
      });

      return updated;
    });

    await this.notifications.notifyEmployee({
      organisationId: user.organisationId,
      employeeId: existing.employeeId,
      category: EmployeeNotificationCategory.LEAVE,
      title: 'Leave request approved',
      message: 'Your leave request has been approved by your manager.',
      href: '/employee/leave',
    });

    return leaveRequest;
  }

  async reject(
    user: CurrentUser,
    leaveRequestId: string,
    dto: RejectLeaveRequestDto,
  ) {
    const existing = await this.getPendingDirectReportRequest(user, leaveRequestId);
    const rejectionNote = dto.rejectionNote?.trim();

    if (!rejectionNote) {
      throw new BadRequestException('A rejection reason is required.');
    }

    const leaveRequest = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.leaveRequest.update({
        where: { id: existing.id },
        data: {
          status: LeaveStatus.REJECTED,
          approvedByUserId: user.id,
          approvedAt: new Date(),
          rejectionNote,
        },
        include: this.leaveRequestInclude(),
      });

      await transaction.auditLog.create({
        data: {
          organisationId: user.organisationId,
          actorUserId: user.id,
          employeeId: existing.employeeId,
          action: AuditAction.REJECT,
          entity: 'LeaveRequest',
          entityId: existing.id,
          message: 'Manager rejected direct report leave request.',
          metadata: {
            managerScoped: true,
            rejectionNote,
            leaveType: existing.leaveType,
            startDate: existing.startDate,
            endDate: existing.endDate,
            totalDays: existing.totalDays,
          },
        },
      });

      return updated;
    });

    await this.notifications.notifyEmployee({
      organisationId: user.organisationId,
      employeeId: existing.employeeId,
      category: EmployeeNotificationCategory.LEAVE,
      title: 'Leave request rejected',
      message: `Your leave request was rejected by your manager. ${rejectionNote}`,
      href: '/employee/leave',
    });

    return leaveRequest;
  }

  private async getPendingDirectReportRequest(
    user: CurrentUser,
    leaveRequestId: string,
  ) {
    const manager = await this.getLinkedManager(user);

    const leaveRequest = await this.prisma.leaveRequest.findFirst({
      where: {
        id: leaveRequestId,
        organisationId: user.organisationId,
        employee: {
          managerId: manager.id,
          employmentStatus: {
            notIn: [EmploymentStatus.TERMINATED, EmploymentStatus.RESIGNED],
          },
        },
      },
    });

    if (!leaveRequest) {
      throw new NotFoundException('Direct report leave request not found.');
    }

    if (leaveRequest.status !== LeaveStatus.PENDING) {
      throw new BadRequestException(
        'Only pending direct report leave requests can be actioned.',
      );
    }

    return leaveRequest;
  }

  private async getLinkedManager(user: CurrentUser) {
    const manager = await this.prisma.employee.findFirst({
      where: {
        organisationId: user.organisationId,
        userId: user.id,
        employmentStatus: {
          notIn: [EmploymentStatus.TERMINATED, EmploymentStatus.RESIGNED],
        },
      },
      select: { id: true },
    });

    if (!manager) {
      throw new NotFoundException(
        'No active employee profile is linked to the current user.',
      );
    }

    return manager;
  }

  private leaveRequestInclude() {
    return {
      documents: {
        select: {
          id: true,
          originalName: true,
          mimeType: true,
          sizeBytes: true,
        },
      },
      employee: {
        select: {
          id: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
          email: true,
          jobTitle: true,
          employmentStatus: true,
          department: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      approvedBy: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    } as const;
  }
}
