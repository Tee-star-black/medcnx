import {
  EmploymentStatus,
  JobApplicationStatus,
  Prisma,
  RecruitmentJobStatus,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { RecruitmentHiringService } from './recruitment-hiring.service';

describe('RecruitmentHiringService', () => {
  const user = {
    id: 'user-1', organisationId: 'org-1', email: 'user@example.test',
    firstName: 'HR', lastName: 'User', status: 'ACTIVE', roles: ['HR_MANAGER'],
    permissions: ['employees:update'], sessionId: 'session-1',
  };

  function transaction(completedHires = 0) {
    const application = {
      id: 'application-1', organisationId: 'org-1', jobId: 'job-1', candidateId: 'candidate-1',
      status: JobApplicationStatus.OFFER,
      candidate: { firstName: 'Test', lastName: 'Candidate', email: null, phone: null },
      job: { id: 'job-1', departmentId: 'department-1', title: 'Nurse', employmentType: 'FULL_TIME', status: RecruitmentJobStatus.OPEN },
    };
    return {
      jobApplication: {
        findFirst: jest.fn().mockResolvedValue(application),
        update: jest.fn().mockResolvedValue({ id: application.id, status: JobApplicationStatus.HIRED }),
      },
      recruitmentHireConversion: {
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(completedHires),
        create: jest.fn().mockResolvedValue({ id: 'conversion-1' }),
      },
      employee: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'employee-1', employeeNumber: 'MED-100', firstName: 'Test', lastName: 'Candidate' }),
      },
      recruitmentPositionLink: {
        findFirst: jest.fn().mockResolvedValue({ id: 'link-1', recruitmentJobId: 'job-1', positionId: 'position-1', plannedOpenings: 1 }),
      },
      position: {
        findFirst: jest.fn().mockResolvedValue({ id: 'position-1', title: 'Nurse', code: 'NUR-1', active: true }),
      },
      employeePositionAssignment: { create: jest.fn().mockResolvedValue({ id: 'assignment-1' }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      recruitmentJob: { update: jest.fn().mockResolvedValue({}) },
    };
  }

  it('checks planned openings inside a serializable transaction', async () => {
    const tx = transaction(0);
    const prisma = { $transaction: jest.fn(async (callback: any) => callback(tx)) } as unknown as PrismaService;
    const service = new RecruitmentHiringService(prisma);

    const result = await service.hireApplication(user, 'application-1', {
      employeeNumber: 'MED-100', startDate: '2026-08-01',
    });

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    expect(tx.recruitmentHireConversion.count).toHaveBeenCalled();
    expect(tx.employee.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          employmentStatus: EmploymentStatus.ACTIVE,
          startDate: new Date('2026-08-01'),
        }),
      }),
    );
    expect(tx.employeePositionAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          effectiveFrom: new Date('2026-08-01'),
        }),
      }),
    );
    expect(tx.recruitmentJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' }, data: { status: RecruitmentJobStatus.CLOSED },
    });
    expect(result.recruitmentJobClosed).toBe(true);
  });

  it('rejects a hire when the serializable count shows all openings filled', async () => {
    const tx = transaction(1);
    const prisma = { $transaction: jest.fn(async (callback: any) => callback(tx)) } as unknown as PrismaService;
    const service = new RecruitmentHiringService(prisma);

    await expect(service.hireApplication(user, 'application-1', {
      employeeNumber: 'MED-101', startDate: '2026-08-01',
    })).rejects.toThrow('planned openings');
    expect(tx.employee.create).not.toHaveBeenCalled();
  });

  it('retries a P2034 serializable conflict', async () => {
    const tx = transaction(0);
    const conflict = Object.assign(new Error('conflict'), { code: 'P2034' });
    const prisma = {
      $transaction: jest.fn().mockRejectedValueOnce(conflict).mockImplementationOnce(async (callback: any) => callback(tx)),
    } as unknown as PrismaService;
    const service = new RecruitmentHiringService(prisma);

    await service.hireApplication(user, 'application-1', {
      employeeNumber: 'MED-100', startDate: '2026-08-01',
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('rejects future start dates before opening a transaction', async () => {
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const prisma = { $transaction: jest.fn() } as unknown as PrismaService;
    const service = new RecruitmentHiringService(prisma);

    await expect(service.hireApplication(user, 'application-1', {
      employeeNumber: 'MED-102',
      startDate: tomorrow.toISOString(),
    })).rejects.toThrow('start date cannot be in the future');

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
