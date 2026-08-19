import { BadRequestException } from '@nestjs/common';
import { EmploymentStatus } from '@prisma/client';
import { EmployeeLifecycleService } from './employee-lifecycle.service';
import { PrismaService } from '../database/prisma.service';

describe('EmployeeLifecycleService employment change effective dates', () => {
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

  function tomorrowIsoDate() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString();
  }

  function createService() {
    const prisma = {
      employee: { findFirst: jest.fn().mockResolvedValue(employee) },
      department: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'department-2',
          name: 'Clinical Operations',
        }),
      },
      $transaction: jest.fn(),
    } as unknown as PrismaService;

    return {
      service: new EmployeeLifecycleService(prisma),
      prisma,
    };
  }

  it('rejects a future-dated promotion before mutation', async () => {
    const { service, prisma } = createService();

    await expect(
      service.promoteEmployee(actor, employee.id, {
        jobTitle: 'Senior Nurse',
        effectiveDate: tomorrowIsoDate(),
        reason: 'Approved promotion.',
      }),
    ).rejects.toThrow(
      'Employment change effective date cannot be in the future until scheduled employment changes are supported.',
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a future-dated department transfer before mutation', async () => {
    const { service, prisma } = createService();

    await expect(
      service.transferEmployee(actor, employee.id, {
        departmentId: 'department-2',
        effectiveDate: tomorrowIsoDate(),
        reason: 'Approved transfer.',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a future-dated employment type change before mutation', async () => {
    const { service, prisma } = createService();

    await expect(
      service.changeEmploymentType(actor, employee.id, {
        employmentType: 'PART_TIME',
        effectiveDate: tomorrowIsoDate(),
        reason: 'Contract terms changed.',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects an employment change before the employee start date', async () => {
    const { service, prisma } = createService();

    await expect(
      service.promoteEmployee(actor, employee.id, {
        jobTitle: 'Senior Nurse',
        effectiveDate: '2025-12-31T00:00:00.000Z',
        reason: 'Invalid historical change.',
      }),
    ).rejects.toThrow(
      'Employment change effective date cannot precede the employee start date.',
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
