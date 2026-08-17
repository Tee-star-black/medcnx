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
    permissions: ['employees:update'],
    sessionId: 'session-1',
  };

  function createService(employee: any) {
    const transaction = {
      employee: { update: jest.fn().mockResolvedValue({ ...employee, employmentStatus: EmploymentStatus.TERMINATED }) },
      user: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      authSession: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };

    const prisma = {
      employee: { findFirst: jest.fn().mockResolvedValue(employee) },
      $transaction: jest.fn(async (callback: any) => callback(transaction)),
    } as unknown as PrismaService;

    return {
      service: new EmployeeLifecycleService(prisma),
      prisma,
      transaction,
    };
  }

  it('terminates an employee without deleting historical records', async () => {
    const employee = {
      id: 'employee-1',
      organisationId: 'org-1',
      userId: 'user-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      employmentStatus: EmploymentStatus.ACTIVE,
      endDate: null,
    };
    const { service, transaction } = createService(employee);

    const result = await service.terminateEmployee(actor, employee.id);

    expect(transaction.employee.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: employee.id },
        data: expect.objectContaining({ employmentStatus: EmploymentStatus.TERMINATED }),
      }),
    );
    expect(transaction.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: UserStatus.DISABLED } }),
    );
    expect(transaction.authSession.updateMany).toHaveBeenCalled();
    expect(transaction.auditLog.create).toHaveBeenCalled();
    expect(result.message).toContain('Historical records were preserved');
  });

  it('rejects termination for an employee outside the organisation', async () => {
    const { service, prisma } = createService(null);
    (prisma.employee.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(service.terminateEmployee(actor, 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects already inactive employees', async () => {
    const employee = {
      id: 'employee-1',
      organisationId: 'org-1',
      userId: null,
      firstName: 'Ada',
      lastName: 'Lovelace',
      employmentStatus: EmploymentStatus.TERMINATED,
      endDate: new Date(),
    };
    const { service } = createService(employee);

    await expect(service.terminateEmployee(actor, employee.id)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
