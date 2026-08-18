import { NotFoundException } from '@nestjs/common';
import { PositionHistoryService } from './position-history.service';
import { PrismaService } from '../database/prisma.service';

describe('PositionHistoryService', () => {
  const actor = {
    id: 'actor-1',
    organisationId: 'org-1',
    email: 'hr@example.test',
    firstName: 'HR',
    lastName: 'Manager',
    status: 'ACTIVE',
    roles: ['HR_MANAGER'],
    permissions: ['employees:read'],
    sessionId: 'session-1',
  };

  it('returns current and former occupants with employee details', async () => {
    const prisma = {
      position: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'position-1',
          code: 'RN-001',
          title: 'Registered Nurse',
          active: true,
        }),
      },
      employeePositionAssignment: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'assignment-current',
            employeeId: 'employee-1',
            positionId: 'position-1',
            effectiveFrom: new Date('2026-06-01T00:00:00.000Z'),
            effectiveTo: null,
            reason: 'Transferred into role.',
          },
          {
            id: 'assignment-former',
            employeeId: 'employee-2',
            positionId: 'position-1',
            effectiveFrom: new Date('2025-01-01T00:00:00.000Z'),
            effectiveTo: new Date('2026-05-31T00:00:00.000Z'),
            reason: 'Role change.',
          },
        ]),
      },
      employee: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'employee-1',
            employeeNumber: 'MED-001',
            firstName: 'Naledi',
            lastName: 'Dube',
            jobTitle: 'Registered Nurse',
            employmentStatus: 'ACTIVE',
          },
          {
            id: 'employee-2',
            employeeNumber: 'MED-002',
            firstName: 'Amina',
            lastName: 'Khan',
            jobTitle: 'Senior Registered Nurse',
            employmentStatus: 'ACTIVE',
          },
        ]),
      },
    } as unknown as PrismaService;

    const service = new PositionHistoryService(prisma);
    const result = await service.getPositionHistory(actor, 'position-1');

    expect(result.position.code).toBe('RN-001');
    expect(result.assignments).toHaveLength(2);
    expect(result.assignments[0]).toEqual(
      expect.objectContaining({
        id: 'assignment-current',
        current: true,
        employee: expect.objectContaining({ employeeNumber: 'MED-001' }),
      }),
    );
    expect(result.assignments[1]).toEqual(
      expect.objectContaining({
        id: 'assignment-former',
        current: false,
        employee: expect.objectContaining({ employeeNumber: 'MED-002' }),
      }),
    );
  });

  it('rejects history requests for positions outside the organisation', async () => {
    const prisma = {
      position: { findFirst: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;

    const service = new PositionHistoryService(prisma);

    await expect(
      service.getPositionHistory(actor, 'position-other-org'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
