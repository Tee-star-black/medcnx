import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AccessScopeService } from '../auth/access-scope.service';
import { PrismaService } from '../database/prisma.service';
import { PositionsService } from './positions.service';

describe('PositionsService approved headcount updates', () => {
  const actor = {
    id: 'actor-1',
    organisationId: 'org-1',
    email: 'hr@example.com',
    firstName: 'HR',
    lastName: 'User',
    status: 'ACTIVE',
    roles: ['HR_MANAGER'],
    permissions: ['positions:update'],
    sessionId: 'session-1',
  };

  const existingPosition = {
    id: 'position-1',
    organisationId: 'org-1',
    departmentId: 'department-1',
    code: 'RN-001',
    title: 'Registered Nurse',
    description: null,
    level: 'Professional',
    employmentCategory: 'FULL_TIME',
    approvedHeadcount: 5,
    active: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  function fixture(activeAssignments: number) {
    const updatedPosition = {
      ...existingPosition,
      approvedHeadcount: activeAssignments,
      updatedAt: new Date('2026-08-21T00:00:00.000Z'),
    };

    const transaction = {
      position: {
        findFirst: jest.fn().mockResolvedValue(existingPosition),
        update: jest.fn().mockResolvedValue(updatedPosition),
      },
      employeePositionAssignment: {
        count: jest.fn().mockResolvedValue(activeAssignments),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    const prisma = {
      $transaction: jest.fn(async (callback: any) => callback(transaction)),
      department: {
        findFirst: jest.fn().mockResolvedValue({ id: 'department-1' }),
      },
    } as unknown as PrismaService;

    const accessScope = {} as AccessScopeService;

    return {
      service: new PositionsService(prisma, accessScope),
      prisma,
      transaction,
      updatedPosition,
    };
  }

  it('rejects lowering approved headcount below active assignments', async () => {
    const { service, transaction } = fixture(4);

    await expect(
      service.update(actor, existingPosition.id, { approvedHeadcount: 3 }),
    ).rejects.toThrow(ConflictException);

    await expect(
      service.update(actor, existingPosition.id, { approvedHeadcount: 3 }),
    ).rejects.toThrow(
      'Approved headcount cannot be lower than the 4 active assignments currently occupying this position.',
    );

    expect(transaction.position.update).not.toHaveBeenCalled();
    expect(transaction.auditLog.create).not.toHaveBeenCalled();
  });

  it('allows approved headcount to equal active assignments', async () => {
    const { service, prisma, transaction, updatedPosition } = fixture(4);

    const result = await service.update(actor, existingPosition.id, {
      approvedHeadcount: 4,
    });

    expect(result).toEqual(updatedPosition);
    expect(transaction.employeePositionAssignment.count).toHaveBeenCalledWith({
      where: {
        organisationId: actor.organisationId,
        positionId: existingPosition.id,
        effectiveTo: null,
      },
    });
    expect(transaction.position.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: existingPosition.id },
        data: expect.objectContaining({ approvedHeadcount: 4 }),
      }),
    );
    expect(transaction.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entity: 'Position',
          metadata: expect.objectContaining({
            activeAssignmentsAtUpdate: 4,
          }),
        }),
      }),
    );
    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }),
    );
  });

  it('retries a serializable conflict before completing the headcount update', async () => {
    const { service, prisma, transaction } = fixture(3);
    const transactionMock = prisma.$transaction as jest.Mock;

    transactionMock
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockImplementationOnce(async (callback: any) => callback(transaction));

    const result = await service.update(actor, existingPosition.id, {
      approvedHeadcount: 3,
    });

    expect(transactionMock).toHaveBeenCalledTimes(2);
    expect(result.approvedHeadcount).toBe(3);
  });
});
