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
    };

    transaction.employee.update.mockImplementation(({ data }: any) =>
      Promise.resolve({ ...employee, ...data }),
    );

    const prisma = {
      employee: { findFirst: jest.fn().mockResolvedValue(employee) },
      department: { findFirst: jest.fn() },
      auditLog: { findMany: jest.fn().mockResolvedValue([]) },
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

  it('records a promotion with before and after employment snapshots', async () => {
    const { service, transaction } = createService(activeEmployee);

    await service.promoteEmployee(actor, activeEmployee.id, {
      ...action,
      jobTitle: 'Senior Nurse',
    });

    expect(transaction.employee.update).toHaveBeenCalledWith({
      where: { id: activeEmployee.id },
      data: { jobTitle: 'Senior Nurse' },
    });
    expect(transaction.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entity: 'EmployeeLifecycle',
          metadata: expect.objectContaining({
            eventType: 'PROMOTED',
            previous: expect.objectContaining({ jobTitle: 'Nurse' }),
            next: expect.objectContaining({ jobTitle: 'Senior Nurse' }),
          }),
        }),
      }),
    );
  });

  it('records a department transfer only to a department in the organisation', async () => {
    const { service, prisma, transaction } = createService(activeEmployee);
    (prisma.department.findFirst as jest.Mock).mockResolvedValue({
      id: 'department-2',
      name: 'Clinical Operations',
    });

    await service.transferEmployee(actor, activeEmployee.id, {
      ...action,
      departmentId: 'department-2',
    });

    expect(transaction.employee.update).toHaveBeenCalledWith({
      where: { id: activeEmployee.id },
      data: { departmentId: 'department-2' },
    });
    expect(transaction.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({ eventType: 'TRANSFERRED' }),
        }),
      }),
    );
  });

  it('rejects a transfer to an unknown department', async () => {
    const { service, prisma } = createService(activeEmployee);
    (prisma.department.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      service.transferEmployee(actor, activeEmployee.id, {
        ...action,
        departmentId: 'department-missing',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('changes employment type with immutable before and after values', async () => {
    const { service, transaction } = createService(activeEmployee);

    await service.changeEmploymentType(actor, activeEmployee.id, {
      ...action,
      employmentType: 'PART_TIME',
    });

    expect(transaction.employee.update).toHaveBeenCalledWith({
      where: { id: activeEmployee.id },
      data: { employmentType: 'PART_TIME' },
    });
    expect(transaction.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            eventType: 'EMPLOYMENT_TYPE_CHANGED',
            previous: expect.objectContaining({ employmentType: 'FULL_TIME' }),
            next: expect.objectContaining({ employmentType: 'PART_TIME' }),
          }),
        }),
      }),
    );
  });

  it('rejects self-management assignments', async () => {
    const { service } = createService(activeEmployee);

    await expect(
      service.changeManager(actor, activeEmployee.id, {
        ...action,
        managerId: activeEmployee.id,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a manager assignment that creates a reporting cycle', async () => {
    const { service, prisma } = createService(activeEmployee);
    const employeeFindFirst = prisma.employee.findFirst as jest.Mock;
    employeeFindFirst
      .mockResolvedValueOnce(activeEmployee)
      .mockResolvedValueOnce({
        id: 'report-1',
        firstName: 'Direct',
        lastName: 'Report',
      })
      .mockResolvedValueOnce({ managerId: activeEmployee.id });

    await expect(
      service.changeManager(actor, activeEmployee.id, {
        ...action,
        managerId: 'report-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('records a valid manager change', async () => {
    const { service, prisma, transaction } = createService(activeEmployee);
    const employeeFindFirst = prisma.employee.findFirst as jest.Mock;
    employeeFindFirst
      .mockResolvedValueOnce(activeEmployee)
      .mockResolvedValueOnce({
        id: 'manager-2',
        firstName: 'Grace',
        lastName: 'Hopper',
      })
      .mockResolvedValueOnce({ managerId: null });

    await service.changeManager(actor, activeEmployee.id, {
      ...action,
      managerId: 'manager-2',
    });

    expect(transaction.employee.update).toHaveBeenCalledWith({
      where: { id: activeEmployee.id },
      data: { managerId: 'manager-2' },
    });
    expect(transaction.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({ eventType: 'MANAGER_CHANGED' }),
        }),
      }),
    );
  });

  it('rejects employment changes for inactive employees', async () => {
    const resignedEmployee = {
      ...activeEmployee,
      employmentStatus: EmploymentStatus.RESIGNED,
    };
    const { service } = createService(resignedEmployee);

    await expect(
      service.promoteEmployee(actor, resignedEmployee.id, {
        ...action,
        jobTitle: 'Senior Nurse',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

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
    expect(transaction.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entity: 'EmployeeLifecycle',
          metadata: expect.objectContaining({ eventType: 'TERMINATED' }),
        }),
      }),
    );
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

  it('projects employee history from the immutable audit ledger', async () => {
    const { service, prisma } = createService(activeEmployee);
    (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'history-1',
        action: 'CREATE',
        entity: 'Employee',
        message: 'Employee created.',
        metadata: null,
        actorUserId: 'actor-1',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        id: 'history-2',
        action: 'UPDATE',
        entity: 'EmployeeLifecycle',
        message: 'Employee promoted.',
        metadata: {
          eventType: 'PROMOTED',
          effectiveDate: '2026-06-01T00:00:00.000Z',
          reason: 'Promotion approved.',
          previous: { jobTitle: 'Nurse' },
          next: { jobTitle: 'Senior Nurse' },
        },
        actorUserId: 'actor-1',
        createdAt: new Date('2026-05-20T00:00:00.000Z'),
      },
    ]);

    const history = await service.getHistory(actor, activeEmployee.id);

    expect(prisma.auditLog.findMany).toHaveBeenCalled();
    expect(history[0]).toEqual(
      expect.objectContaining({
        eventType: 'HIRED',
        reason: 'Employee record created',
      }),
    );
    expect(history[1]).toEqual(
      expect.objectContaining({
        eventType: 'PROMOTED',
        previous: { jobTitle: 'Nurse' },
        next: { jobTitle: 'Senior Nurse' },
      }),
    );
  });
});
