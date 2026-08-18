import { ConflictException } from '@nestjs/common';
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

  it('creates a recruitment job from an approved position vacancy transactionally', async () => {
    const position = {
      id: 'position-1',
      organisationId: 'org-1',
      departmentId: 'department-1',
      code: 'RN-001',
      title: 'Registered Nurse',
      description: 'Clinical nursing position.',
      level: 'Professional',
      employmentCategory: 'FULL_TIME',
      approvedHeadcount: 4,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const transaction = {
      recruitmentJob: {
        create: jest.fn().mockResolvedValue({
          id: 'job-1',
          title: position.title,
          status: 'OPEN',
        }),
      },
      recruitmentPositionLink: {
        create: jest.fn().mockResolvedValue({
          id: 'link-1',
          recruitmentJobId: 'job-1',
          positionId: position.id,
          plannedOpenings: 2,
        }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      position: { findFirst: jest.fn().mockResolvedValue(position) },
      employeePositionAssignment: { count: jest.fn().mockResolvedValue(2) },
      recruitmentPositionLink: { findMany: jest.fn().mockResolvedValue([]) },
      recruitmentJob: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      recruitmentHireConversion: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn(async (callback: any) => callback(transaction)),
    } as unknown as PrismaService;
    const accessScope = {} as AccessScopeService;
    const service = new PositionsService(prisma, accessScope);

    const result = await service.createRecruitmentJob(actor, position.id, {
      reference: 'VAC-RN-001',
      plannedOpenings: 2,
      openingDate: '2026-09-01T00:00:00.000Z',
      closingDate: '2026-09-30T00:00:00.000Z',
    });

    expect(transaction.recruitmentJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          departmentId: position.departmentId,
          title: position.title,
          employmentType: position.employmentCategory,
        }),
      }),
    );
    expect(transaction.recruitmentPositionLink.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        recruitmentJobId: 'job-1',
        positionId: position.id,
        plannedOpenings: 2,
      }),
    });
    expect(transaction.auditLog.create).toHaveBeenCalled();
    expect(result.vacancySnapshot.remainingUnplannedVacancies).toBe(0);
  });

  it('reconciles completed hires when calculating active recruiting openings', async () => {
    const position = {
      id: 'position-1',
      organisationId: 'org-1',
      departmentId: 'department-1',
      code: 'RN-001',
      title: 'Registered Nurse',
      description: null,
      level: null,
      employmentCategory: 'FULL_TIME',
      approvedHeadcount: 4,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const prisma = {
      position: { findMany: jest.fn().mockResolvedValue([position]) },
      employeePositionAssignment: {
        findMany: jest.fn().mockResolvedValue([
          { positionId: position.id },
          { positionId: position.id },
          { positionId: position.id },
        ]),
      },
      recruitmentPositionLink: {
        findMany: jest.fn().mockResolvedValue([
          {
            recruitmentJobId: 'job-existing',
            positionId: position.id,
            plannedOpenings: 2,
          },
        ]),
      },
      recruitmentJob: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'job-existing', status: 'OPEN' },
        ]),
      },
      recruitmentHireConversion: {
        findMany: jest.fn().mockResolvedValue([
          { recruitmentJobId: 'job-existing' },
        ]),
      },
      department: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'department-1', name: 'Clinical Services' },
        ]),
      },
    } as unknown as PrismaService;

    const service = new PositionsService(prisma, {} as AccessScopeService);
    const plan = await service.getVacancyPlan(actor);

    expect(plan.positions[0]).toEqual(
      expect.objectContaining({
        currentHeadcount: 3,
        vacancies: 1,
        recruitingOpenings: 1,
        unplannedVacancies: 0,
        staffingStatus: 'RECRUITMENT_IN_PROGRESS',
      }),
    );
    expect(plan.totals.recruitingOpenings).toBe(1);
  });

  it('uses only unfilled active recruitment openings when checking new recruitment capacity', async () => {
    const position = {
      id: 'position-1',
      organisationId: 'org-1',
      departmentId: 'department-1',
      code: 'RN-001',
      title: 'Registered Nurse',
      description: null,
      level: null,
      employmentCategory: 'FULL_TIME',
      approvedHeadcount: 5,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const transaction = {
      recruitmentJob: {
        create: jest.fn().mockResolvedValue({ id: 'job-new', status: 'OPEN' }),
      },
      recruitmentPositionLink: {
        create: jest.fn().mockResolvedValue({ id: 'link-new' }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      position: { findFirst: jest.fn().mockResolvedValue(position) },
      employeePositionAssignment: { count: jest.fn().mockResolvedValue(3) },
      recruitmentPositionLink: {
        findMany: jest.fn().mockResolvedValue([
          {
            recruitmentJobId: 'job-existing',
            positionId: position.id,
            plannedOpenings: 2,
          },
        ]),
      },
      recruitmentJob: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'job-existing', status: 'OPEN' },
        ]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      recruitmentHireConversion: {
        findMany: jest.fn().mockResolvedValue([
          { recruitmentJobId: 'job-existing' },
        ]),
      },
      $transaction: jest.fn(async (callback: any) => callback(transaction)),
    } as unknown as PrismaService;

    const service = new PositionsService(prisma, {} as AccessScopeService);
    const result = await service.createRecruitmentJob(actor, position.id, {
      reference: 'VAC-RN-002',
      plannedOpenings: 1,
    });

    expect(result.vacancySnapshot.alreadyRecruiting).toBe(1);
    expect(result.vacancySnapshot.remainingUnplannedVacancies).toBe(0);
  });

  it('rejects recruitment beyond remaining approved vacancies', async () => {
    const position = {
      id: 'position-1',
      organisationId: 'org-1',
      departmentId: 'department-1',
      code: 'RN-001',
      title: 'Registered Nurse',
      description: null,
      level: null,
      employmentCategory: 'FULL_TIME',
      approvedHeadcount: 4,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const prisma = {
      position: { findFirst: jest.fn().mockResolvedValue(position) },
      employeePositionAssignment: { count: jest.fn().mockResolvedValue(2) },
      recruitmentPositionLink: {
        findMany: jest.fn().mockResolvedValue([
          {
            recruitmentJobId: 'job-existing',
            positionId: position.id,
            plannedOpenings: 1,
          },
        ]),
      },
      recruitmentJob: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'job-existing', status: 'OPEN' },
        ]),
      },
      recruitmentHireConversion: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const service = new PositionsService(prisma, {} as AccessScopeService);

    await expect(
      service.createRecruitmentJob(actor, position.id, {
        plannedOpenings: 2,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
