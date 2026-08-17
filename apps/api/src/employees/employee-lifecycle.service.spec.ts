import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EmploymentStatus, UserStatus } from '@prisma/client';
import { EmployeeLifecycleService } from './employee-lifecycle.service';
import { PrismaService } from '../database/prisma.service';

describe('EmployeeLifecycleService', () => {
  const actor = {
    id: 'actor-1',
    organisationId: 'org-1',
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'User',
    status: 'ACTIVE',
    roles: ['ORG_ADMIN'],
    permissions: ['employees:update', 'employees:terminate'],
    sessionId: 'session-1',
  };

  const action = {
    effectiveDate: '2026-08-17T00:00:00.000Z',
    reason: 'Lifecycle change required by HR.',
  };

  function createService(employee: any) {
    const transaction = {
      employee: { update: jest.fn() },
      user: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      authSession: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      $executeRaw: jest.fn().mockResolvedValue(1),
    };

    transaction.employee.update.mockImplementation(({ data }: any) =>
      Promise.resolve({ ...employee, ...data }),
    );

    const prisma = {
      employee: { findFirst: jest.fn().mockResolvedValue(employee) },
      $queryRaw: jest.fn().mockResolvedValue([]),
      $transaction: jest.fn(async (callback: any) => callback(transaction)),
    } as unknown as PrismaService;

    return {
      service: new EmployeeLifecycleService(prisma),
      prisma,
      transaction,
    };
  }

  const activeEmployee = {
    id: 'employee-1',
    organisationId: 'org-1',
    userId: 'user-1',
    departmentId: 'department-1',
    managerId: 'manager-1',
    firstName: 'Ada',
    lastName: 'Lovelace',
    jobTitle: 'Nurse',
    employmentType: 'FULL_TIME',
    employmentStatus: EmploymentStatus.ACTIVE,
    endDate: null,
  };

  it('terminates an employee, disables access and records history', async () => {
    const { service, transaction } = createService(activeEmployee);

    const result = await service.terminateEmployee(
      actor,
      activeEmployee.id,
      action,
    );

    expect(transaction.employee.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: activeEmployee.id },
        data: expect.objectContaining({
          employmentStatus: EmploymentStatus.TERMINATED,
          endDate: new Date(action.effectiveDate),
        }),
      }),
    );
    expect(transaction.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: UserStatus.DISABLED } }),
    );
    expect(transaction.authSession.updateMany).toHaveBeenCalled();
    expect(transaction.$executeRaw).toHaveBeenCalled();
    expect(transaction.auditLog.create).toHaveBeenCalled();
    expect(result.message).toContain('Historical records were preserved');
  });

  it('suspends an employee and revokes active sessions', async () => {
    const { service, transaction } = createService(activeEmployee);

    await service.suspendEmployee(actor, activeEmployee.id, action);

    expect(transaction.employee.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          employmentStatus: EmploymentStatus.SUSPENDED,
        }),
      }),
    );
    expect(transaction.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: UserStatus.SUSPENDED } }),
    );
    expect(transaction.authSession.updateMany).toHaveBeenCalled();
  });

  it('reactivates a suspended employee and restores account access', async () => {
    const suspendedEmployee = {
      ...activeEmployee,
      employmentStatus: EmploymentStatus.SUSPENDED,
      endDate: null,
    };
    const { service, transaction } = createService(suspendedEmployee);

    await service.reactivateEmployee(actor, suspendedEmployee.id, action);

    expect(transaction.employee.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          employmentStatus: EmploymentStatus.ACTIVE,
          endDate: null,
        }),
      }),
    );
    expect(transaction.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: UserStatus.ACTIVE } }),
    );
  });

  it('records resignation as an inactive lifecycle transition', async () => {
    const { service, transaction } = createService(activeEmployee);

    const result = await service.resignEmployee(actor, activeEmployee.id, action);

    expect(transaction.employee.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          employmentStatus: EmploymentStatus.RESIGNED,
          endDate: new Date(action.effectiveDate),
        }),
      }),
    );
    expect(transaction.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: UserStatus.DISABLED } }),
    );
    expect(result.message).toContain('resignation');
  });

  it('rejects lifecycle changes for an employee outside the organisation', async () => {
    const { service, prisma } = createService(null);
    (prisma.employee.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      service.terminateEmployee(actor, 'missing', action),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects an invalid transition', async () => {
    const terminatedEmployee = {
      ...activeEmployee,
      employmentStatus: EmploymentStatus.TERMINATED,
      endDate: new Date(),
    };
    const { service } = createService(terminatedEmployee);

    await expect(
      service.terminateEmployee(actor, terminatedEmployee.id, action),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns employee history ordered by effective date', async () => {
    const { service, prisma } = createService(activeEmployee);
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([
      { id: 'history-1', eventType: 'HIRED' },
    ]);

    const history = await service.getHistory(actor, activeEmployee.id);

    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(history).toEqual([{ id: 'history-1', eventType: 'HIRED' }]);
  });
});
