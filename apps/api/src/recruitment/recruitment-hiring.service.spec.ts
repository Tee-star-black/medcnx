import {
  EmploymentStatus,
  JobApplicationStatus,
  RecruitmentJobStatus,
} from '@prisma/client';
import { RecruitmentHiringService } from './recruitment-hiring.service';
import { PrismaService } from '../database/prisma.service';

describe('RecruitmentHiringService', () => {
  const user = {
    id: 'user-hr',
    organisationId: 'org-1',
    email: 'hr@example.test',
    firstName: 'HR',
    lastName: 'Manager',
    status: 'ACTIVE',
    roles: ['HR_MANAGER'],
    permissions: ['employees:update'],
    sessionId: 'session-1',
  };

  it('converts a hired application to an employee and closes a fully filled recruitment job', async () => {
    const application = {
      id: 'application-1',
      organisationId: 'org-1',
      jobId: 'job-1',
      candidateId: 'candidate-1',
      status: JobApplicationStatus.OFFER,
      candidate: {
        id: 'candidate-1',
        firstName: 'Naledi',
        lastName: 'Dube',
        email: 'naledi@example.test',
        phone: '0123456789',
      },
      job: {
        id: 'job-1',
        departmentId: 'department-1',
        title: 'Senior Registered Nurse',
        employmentType: 'FULL_TIME',
        status: RecruitmentJobStatus.OPEN,
      },
    };
    const position = {
      id: 'position-1',
      organisationId: 'org-1',
      departmentId: 'department-1',
      code: 'SRN-001',
      title: 'Senior Registered Nurse',
      active: true,
    };
    const positionLink = {
      id: 'link-1',
      organisationId: 'org-1',
      recruitmentJobId: 'job-1',
      positionId: 'position-1',
      plannedOpenings: 1,
    };
    const employee = {
      id: 'employee-1',
      organisationId: 'org-1',
      employeeNumber: 'MED-100',
      firstName: 'Naledi',
      lastName: 'Dube',
      employmentStatus: EmploymentStatus.ACTIVE,
    };

    const transaction = {
      employee: { create: jest.fn().mockResolvedValue(employee) },
      employeePositionAssignment: {
        create: jest.fn().mockResolvedValue({ id: 'assignment-1' }),
      },
      jobApplication: {
        update: jest.fn().mockResolvedValue({
          id: 'application-1',
          status: JobApplicationStatus.HIRED,
        }),
      },
      recruitmentHireConversion: {
        create: jest.fn().mockResolvedValue({ id: 'conversion-1' }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      recruitmentJob: { update: jest.fn().mockResolvedValue({}) },
    };

    const prisma = {
      jobApplication: { findFirst: jest.fn().mockResolvedValue(application) },
      recruitmentHireConversion: {
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
      },
      employee: { findFirst: jest.fn().mockResolvedValue(null) },
      recruitmentPositionLink: {
        findFirst: jest.fn().mockResolvedValue(positionLink),
      },
      position: { findFirst: jest.fn().mockResolvedValue(position) },
      $transaction: jest.fn(async (callback: any) => callback(transaction)),
    } as unknown as PrismaService;

    const service = new RecruitmentHiringService(prisma);
    const result = await service.hireApplication(user, 'application-1', {
      employeeNumber: 'MED-100',
      startDate: '2026-09-01',
      employmentType: 'FULL_TIME',
      reason: 'Offer accepted.',
    });

    expect(transaction.employee.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          employeeNumber: 'MED-100',
          departmentId: 'department-1',
          jobTitle: position.title,
        }),
      }),
    );
    expect(transaction.employeePositionAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          employeeId: employee.id,
          positionId: position.id,
        }),
      }),
    );
    expect(transaction.recruitmentHireConversion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          applicationId: application.id,
          employeeId: employee.id,
          positionId: position.id,
        }),
      }),
    );
    expect(transaction.jobApplication.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: JobApplicationStatus.HIRED }),
      }),
    );
    expect(transaction.recruitmentJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { status: RecruitmentJobStatus.CLOSED },
    });
    expect(transaction.auditLog.create).toHaveBeenCalledTimes(2);
    expect(result.recruitmentJobClosed).toBe(true);
  });

  it('rejects a second conversion of the same application', async () => {
    const prisma = {
      jobApplication: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'application-1',
          organisationId: 'org-1',
          jobId: 'job-1',
          candidateId: 'candidate-1',
          status: JobApplicationStatus.OFFER,
          candidate: { firstName: 'Naledi', lastName: 'Dube' },
          job: { status: RecruitmentJobStatus.OPEN },
        }),
      },
      recruitmentHireConversion: {
        findFirst: jest.fn().mockResolvedValue({ id: 'conversion-existing' }),
      },
    } as unknown as PrismaService;

    const service = new RecruitmentHiringService(prisma);

    await expect(
      service.hireApplication(user, 'application-1', {
        employeeNumber: 'MED-100',
        startDate: '2026-09-01',
      }),
    ).rejects.toThrow('already been hired');
  });
});
