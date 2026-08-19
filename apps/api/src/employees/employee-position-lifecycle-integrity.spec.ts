import { BadRequestException } from '@nestjs/common';
import { EmploymentStatus } from '@prisma/client';
import { AccessScopeService } from '../auth/access-scope.service';
import { PrismaService } from '../database/prisma.service';
import { PositionsService } from '../positions/positions.service';
import { EmployeeLifecycleService } from './employee-lifecycle.service';

describe('employee position lifecycle integrity', () => {
  const actor = {
    id: 'actor-1',
    organisationId: 'org-1',
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'User',
    status: 'ACTIVE',
    roles: ['ORG_ADMIN'],
    permissions: ['employees:update', 'departments:read'],
    sessionId: 'session-1',
  };

  const employee = {
    id: 'employee-1',
    organisationId: 'org-1',
    userId: 'user-1',
    departmentId: 'department-1',
    managerId: null,
    firstName: 'Ada',
    lastName: 'Lovelace',
    jobTitle: 'Nurse',
    employmentType: 'FULL_TIME',
    employmentStatus: EmploymentStatus.ACTIVE,
    startDate: new Date('2026-01-01T00:00:00.000Z'),
    endDate: null,
  };

  function createPositionService() {
    const currentAssignment = {
      id: 'assignment-1',
      organisationId: 'org-1',
      employeeId: employee.id,
      positionId: 'position-1',
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      effectiveTo: null,
    };
    const previousPosition = {
      id: 'position-1',
      organisationId: 'org-1',
      departmentId: 'department-1',
      code: 'NURSE',
      title: 'Nurse',
      approvedHeadcount: 10,
      active: true,
    };
    const destinationPosition = {
      id: 'position-2',
      organisationId: 'org-1',
      departmentId: 'department-2',
      code: 'SNURSE',
      title: 'Senior Nurse',
      approvedHeadcount: 5,
      active: true,
    };

    const transaction = {
      employeePositionAssignment: {
        findFirst: jest.fn().mockResolvedValue(currentAssignment),
        count: jest.fn().mockResolvedValue(2),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({
          ...currentAssignment,
          id: 'assignment-2',
          positionId: destinationPosition.id,
        }),
      },
      employee: {
        findFirst: jest.fn().mockResolvedValue(employee),
        update: jest.fn().mockResolvedValue({}),
      },
      position: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(destinationPosition)
          .mockResolvedValueOnce(previousPosition),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };

    const prisma = {
      $transaction: jest.fn(async (callback: any) => callback(transaction)),
    } as unknown as PrismaService;

    const accessScope = {
      assertEmployeeAccess: jest.fn().mockResolvedValue(undefined),
    } as unknown as AccessScopeService;

    return {
      service: new PositionsService(prisma, accessScope),
      prisma,
      transaction,
      destinationPosition,
    };
  }

  it('atomically aligns job title and department to the destination position', async () => {
    const { service, transaction, destinationPosition } = createPositionService();

    await service.assignEmployee(actor, employee.id, {
      positionId: destinationPosition.id,
      effectiveDate: '2026-08-19T00:00:00.000Z',
      reason: 'Approved promotion and transfer.',
    });

    expect(transaction.employee.update).toHaveBeenCalledWith({
      where: { id: employee.id },
      data: {
        jobTitle: destinationPosition.title,
        departmentId: destinationPosition.departmentId,
      },
    });
    expect(transaction.employeePositionAssignment.update).toHaveBeenCalled();
    expect(transaction.employeePositionAssignment.create).toHaveBeenCalled();
    expect(transaction.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            eventType: 'POSITION_CHANGED',
            previousDepartmentId: 'department-1',
            departmentId: 'department-2',
            approvedHeadcount: 5,
            currentHeadcountBefore: 2,
            currentHeadcountAfter: 3,
          }),
        }),
      }),
    );
  });

  it('rejects a future position change before opening a transaction', async () => {
    const { service, prisma, destinationPosition } = createPositionService();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    await expect(
      service.assignEmployee(actor, employee.id, {
        positionId: destinationPosition.id,
        effectiveDate: tomorrow.toISOString(),
        reason: 'Future move.',
      }),
    ).rejects.toThrow(
      'Position effective date cannot be in the future until scheduled position changes are supported.',
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  function createLifecycleService() {
    const prisma = {
      employee: { findFirst: jest.fn().mockResolvedValue(employee) },
      employeePositionAssignment: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'assignment-1',
          positionId: 'position-1',
        }),
      },
      department: { findFirst: jest.fn() },
      $transaction: jest.fn(),
    } as unknown as PrismaService;

    return {
      service: new EmployeeLifecycleService(prisma),
      prisma,
    };
  }

  it('blocks raw promotion when the employee has an active position assignment', async () => {
    const { service, prisma } = createLifecycleService();

    await expect(
      service.promoteEmployee(actor, employee.id, {
        jobTitle: 'Senior Nurse',
        effectiveDate: '2026-08-19T00:00:00.000Z',
        reason: 'Approved promotion.',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('blocks raw department transfer when the employee has an active position assignment', async () => {
    const { service, prisma } = createLifecycleService();

    await expect(
      service.transferEmployee(actor, employee.id, {
        departmentId: 'department-2',
        effectiveDate: '2026-08-19T00:00:00.000Z',
        reason: 'Approved transfer.',
      }),
    ).rejects.toThrow(
      'Department transfer must use the position assignment workflow while the employee has an active position assignment.',
    );

    expect(prisma.department.findFirst).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
