import { EmploymentStatus } from '@prisma/client';
import { PositionsService } from './positions.service';
import { PrismaService } from '../database/prisma.service';
import { AccessScopeService } from '../auth/access-scope.service';

describe('PositionsService', () => {
  const actor = {
    id: 'actor-1',
    organisationId: 'org-1',
    email: 'hr@example.com',
    firstName: 'HR',
    lastName: 'User',
    status: 'ACTIVE',
    roles: ['HR_MANAGER'],
    permissions: ['employees:update', 'employees:read', 'departments:update'],
    sessionId: 'session-1',
  };

  it('closes the previous assignment and creates an effective-dated replacement', async () => {
    const current = {
      id: 'assignment-1',
      organisationId: 'org-1',
      employeeId: 'employee-1',
      positionId: 'position-old',
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      effectiveTo: null,
    };
    const nextPosition = {
      id: 'position-new',
      organisationId: 'org-1',
      departmentId: 'department-1',
      code: 'SRN-001',
      title: 'Senior Registered Nurse',
      description: null,
      level: 'Senior',
      employmentCategory: 'Clinical',
      approvedHeadcount: 4,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const previousPosition = {
      ...nextPosition,
      id: 'position-old',
      code: 'RN-001',
      title: 'Registered Nurse',
    };

    const transaction = {
      employeePositionAssignment: {
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({ id: 'assignment-2' }),
      },
      employee: { update: jest.fn().mockResolvedValue({}) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };

    const prisma = {
      employee: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'employee-1',
          firstName: 'Ada',
          lastName: 'Lovelace',
          departmentId: 'department-1',
          jobTitle: 'Registered Nurse',
          employmentStatus: EmploymentStatus.ACTIVE,
        }),
      },
      position: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(nextPosition)
          .mockResolvedValueOnce(previousPosition),
      },
      employeePositionAssignment: {
        findFirst: jest.fn().mockResolvedValue(current),
      },
      $transaction: jest.fn(async (callback: any) => callback(transaction)),
    } as unknown as PrismaService;

    const accessScope = {
      assertEmployeeAccess: jest.fn().mockResolvedValue(undefined),
    } as unknown as AccessScopeService;

    const service = new PositionsService(prisma, accessScope);
    const effectiveDate = '2026-09-01T00:00:00.000Z';

    const result = await service.assignEmployee(actor, 'employee-1', {
      positionId: nextPosition.id,
      effectiveDate,
      reason: 'Approved promotion.',
    });

    expect(transaction.employeePositionAssignment.update).toHaveBeenCalledWith({
      where: { id: current.id },
      data: { effectiveTo: new Date(effectiveDate) },
    });
    expect(transaction.employeePositionAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          employeeId: 'employee-1',
          positionId: nextPosition.id,
          effectiveFrom: new Date(effectiveDate),
        }),
      }),
    );
    expect(transaction.employee.update).toHaveBeenCalledWith({
      where: { id: 'employee-1' },
      data: { jobTitle: nextPosition.title },
    });
    expect(transaction.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entity: 'EmployeeLifecycle',
          metadata: expect.objectContaining({ eventType: 'POSITION_CHANGED' }),
        }),
      }),
    );
    expect(result.position.id).toBe(nextPosition.id);
  });
});
