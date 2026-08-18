import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EmploymentStatus, LeaveStatus, LeaveType } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { EmployeeNotificationService } from '../employee-self-service/employee-notification.service';
import { ManagerLeaveService } from './manager-leave.service';

describe('ManagerLeaveService', () => {
  const user = {
    id: 'manager-user',
    organisationId: 'org-1',
    email: 'manager@example.test',
    firstName: 'Amina',
    lastName: 'Khan',
    status: 'ACTIVE',
    roles: ['MANAGER'],
    permissions: [],
    sessionId: 'session-1',
  };

  const pendingRequest = {
    id: 'leave-1',
    organisationId: 'org-1',
    employeeId: 'employee-1',
    leaveType: LeaveType.ANNUAL,
    status: LeaveStatus.PENDING,
    startDate: new Date('2026-09-01T00:00:00.000Z'),
    endDate: new Date('2026-09-03T00:00:00.000Z'),
    totalDays: 3,
    reason: 'Family trip',
    approvedByUserId: null,
    approvedAt: null,
    rejectionNote: null,
    createdAt: new Date('2026-08-18T00:00:00.000Z'),
    updatedAt: new Date('2026-08-18T00:00:00.000Z'),
  };

  function createService(prisma: Record<string, unknown>) {
    const notifications = {
      notifyEmployee: jest.fn().mockResolvedValue(null),
    } as unknown as EmployeeNotificationService;

    return {
      service: new ManagerLeaveService(
        prisma as unknown as PrismaService,
        notifications,
      ),
      notifications,
    };
  }

  it('lists pending leave only for current direct reports', async () => {
    const prisma = {
      employee: {
        findFirst: jest.fn().mockResolvedValue({ id: 'manager-employee' }),
      },
      leaveRequest: {
        findMany: jest.fn().mockResolvedValue([pendingRequest]),
      },
    };
    const { service } = createService(prisma);

    const result = await service.findPendingForMyTeam(user);

    expect(prisma.leaveRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organisationId: user.organisationId,
          status: LeaveStatus.PENDING,
          employee: expect.objectContaining({
            managerId: 'manager-employee',
            employmentStatus: {
              notIn: [EmploymentStatus.TERMINATED, EmploymentStatus.RESIGNED],
            },
          }),
        }),
      }),
    );
    expect(result).toEqual([pendingRequest]);
  });

  it('approves a pending request for a current direct report', async () => {
    const transaction = {
      leaveRequest: {
        update: jest.fn().mockResolvedValue({
          ...pendingRequest,
          status: LeaveStatus.APPROVED,
        }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      employee: {
        findFirst: jest.fn().mockResolvedValue({ id: 'manager-employee' }),
      },
      leaveRequest: {
        findFirst: jest.fn().mockResolvedValue(pendingRequest),
      },
      $transaction: jest.fn(async (callback: any) => callback(transaction)),
    };
    const { service, notifications } = createService(prisma);

    const result = await service.approve(user, pendingRequest.id);

    expect(transaction.leaveRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: pendingRequest.id },
        data: expect.objectContaining({
          status: LeaveStatus.APPROVED,
          approvedByUserId: user.id,
        }),
      }),
    );
    expect(transaction.auditLog.create).toHaveBeenCalled();
    expect(notifications.notifyEmployee).toHaveBeenCalledWith(
      expect.objectContaining({ employeeId: pendingRequest.employeeId }),
    );
    expect(result.status).toBe(LeaveStatus.APPROVED);
  });

  it('requires a rejection reason', async () => {
    const prisma = {
      employee: {
        findFirst: jest.fn().mockResolvedValue({ id: 'manager-employee' }),
      },
      leaveRequest: {
        findFirst: jest.fn().mockResolvedValue(pendingRequest),
      },
    };
    const { service } = createService(prisma);

    await expect(
      service.reject(user, pendingRequest.id, { rejectionNote: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects access to leave outside the manager reporting line', async () => {
    const prisma = {
      employee: {
        findFirst: jest.fn().mockResolvedValue({ id: 'manager-employee' }),
      },
      leaveRequest: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const { service } = createService(prisma);

    await expect(service.approve(user, 'leave-other-team')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
