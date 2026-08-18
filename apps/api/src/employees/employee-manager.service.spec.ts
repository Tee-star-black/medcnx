import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EmploymentStatus } from '@prisma/client';
import { EmployeeManagerService } from './employee-manager.service';
import { PrismaService } from '../database/prisma.service';

describe('EmployeeManagerService', () => {
  const user = {
    id: 'user-hr',
    organisationId: 'org-1',
    email: 'hr@example.test',
    firstName: 'HR',
    lastName: 'Manager',
    status: 'ACTIVE',
    roles: ['HR_MANAGER'],
    permissions: ['employees:update', 'employees:read'],
    sessionId: 'session-1',
  };

  it('resolves manager context from the employee linked to the current user', async () => {
    const currentEmployee = {
      id: 'manager-employee',
      organisationId: 'org-1',
      employeeNumber: 'EMP-010',
      firstName: 'HR',
      lastName: 'Manager',
      jobTitle: 'Team Lead',
      managerId: null,
      employmentStatus: EmploymentStatus.ACTIVE,
    };
    const directReport = {
      id: 'employee-1',
      employeeNumber: 'EMP-011',
      firstName: 'Naledi',
      lastName: 'Dube',
      jobTitle: 'Nurse',
      employmentStatus: EmploymentStatus.ACTIVE,
      departmentId: 'dept-1',
    };
    const prisma = {
      employee: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({ id: currentEmployee.id })
          .mockResolvedValueOnce(currentEmployee),
        findMany: jest
          .fn()
          .mockResolvedValueOnce([directReport])
          .mockResolvedValueOnce([]),
      },
      employeeManagerAssignment: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as unknown as PrismaService;

    const service = new EmployeeManagerService(prisma);
    const result = await service.getMyContext(user);

    expect((prisma.employee.findFirst as jest.Mock).mock.calls[0][0]).toEqual({
      where: { organisationId: user.organisationId, userId: user.id },
      select: { id: true },
    });
    expect(result.employee.id).toBe(currentEmployee.id);
    expect(result.directReports).toEqual([directReport]);
  });

  it('rejects self context when the user has no linked employee profile', async () => {
    const prisma = {
      employee: { findFirst: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;

    const service = new EmployeeManagerService(prisma);

    await expect(service.getMyContext(user)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('closes the previous manager assignment and creates a new effective-dated assignment', async () => {
    const employee = {
      id: 'employee-1',
      organisationId: 'org-1',
      employeeNumber: 'EMP-001',
      firstName: 'Naledi',
      lastName: 'Dube',
      jobTitle: 'Nurse',
      managerId: 'manager-old',
      employmentStatus: EmploymentStatus.ACTIVE,
    };
    const transaction = {
      employeeManagerAssignment: {
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({ id: 'manager-assignment-2' }),
      },
      employee: {
        update: jest.fn().mockResolvedValue({ ...employee, managerId: 'manager-new' }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      employee: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(employee)
          .mockResolvedValueOnce({ id: 'manager-new', firstName: 'Amina', lastName: 'Khan' })
          .mockResolvedValueOnce({ managerId: null }),
      },
      employeeManagerAssignment: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'manager-assignment-1',
          effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
          effectiveTo: null,
        }),
      },
      $transaction: jest.fn(async (callback: any) => callback(transaction)),
    } as unknown as PrismaService;

    const service = new EmployeeManagerService(prisma);
    const result = await service.changeManager(user, employee.id, {
      managerId: 'manager-new',
      effectiveDate: '2026-09-01T00:00:00.000Z',
      reason: 'Approved reporting line change.',
    });

    expect(transaction.employeeManagerAssignment.update).toHaveBeenCalledWith({
      where: { id: 'manager-assignment-1' },
      data: { effectiveTo: new Date('2026-09-01T00:00:00.000Z') },
    });
    expect(transaction.employeeManagerAssignment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        employeeId: employee.id,
        managerId: 'manager-new',
        assignedByUserId: user.id,
      }),
    });
    expect(transaction.employee.update).toHaveBeenCalledWith({
      where: { id: employee.id },
      data: { managerId: 'manager-new' },
    });
    expect(transaction.auditLog.create).toHaveBeenCalled();
    expect(result.employee.managerId).toBe('manager-new');
  });

  it('rejects self-management', async () => {
    const prisma = {
      employee: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'employee-1',
          organisationId: 'org-1',
          managerId: null,
          employmentStatus: EmploymentStatus.ACTIVE,
        }),
      },
    } as unknown as PrismaService;

    const service = new EmployeeManagerService(prisma);

    await expect(
      service.changeManager(user, 'employee-1', {
        managerId: 'employee-1',
        effectiveDate: '2026-09-01T00:00:00.000Z',
        reason: 'Invalid self assignment.',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a manager cycle', async () => {
    const prisma = {
      employee: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'employee-1',
            organisationId: 'org-1',
            managerId: null,
            employmentStatus: EmploymentStatus.ACTIVE,
          })
          .mockResolvedValueOnce({ id: 'manager-1', firstName: 'M', lastName: 'One' })
          .mockResolvedValueOnce({ managerId: 'employee-1' }),
      },
    } as unknown as PrismaService;

    const service = new EmployeeManagerService(prisma);

    await expect(
      service.changeManager(user, 'employee-1', {
        managerId: 'manager-1',
        effectiveDate: '2026-09-01T00:00:00.000Z',
        reason: 'Invalid cycle.',
      }),
    ).rejects.toThrow('reporting cycle');
  });
});
