import { BadRequestException } from '@nestjs/common';
import {
  JobApplicationStatus,
  RecruitmentJobStatus,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { RecruitmentService } from './recruitment.service';

describe('RecruitmentService application guards', () => {
  const user = {
    id: 'user-hr',
    organisationId: 'org-1',
    email: 'hr@example.test',
    firstName: 'HR',
    lastName: 'Manager',
    status: 'ACTIVE',
    roles: ['HR_MANAGER'],
    permissions: ['recruitment:read', 'recruitment:manage'],
    sessionId: 'session-1',
  };

  it('rejects creating an application against a non-open job', async () => {
    const prisma = {
      recruitmentJob: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'job-1',
          title: 'Nurse',
          status: RecruitmentJobStatus.CLOSED,
        }),
      },
      candidate: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'candidate-1',
          firstName: 'Naledi',
          lastName: 'Dube',
        }),
      },
      jobApplication: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
    } as unknown as PrismaService;

    const service = new RecruitmentService(prisma);

    await expect(
      service.createApplication(user, {
        jobId: 'job-1',
        candidateId: 'candidate-1',
      }),
    ).rejects.toThrow('open recruitment jobs');

    expect(prisma.jobApplication.findFirst).not.toHaveBeenCalled();
    expect(prisma.jobApplication.create).not.toHaveBeenCalled();
  });

  it('rejects invalid stage jumps', async () => {
    const prisma = {
      jobApplication: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'application-1',
          status: JobApplicationStatus.APPLIED,
        }),
        update: jest.fn(),
      },
    } as unknown as PrismaService;

    const service = new RecruitmentService(prisma);

    await expect(
      service.updateApplicationStatus(user, 'application-1', {
        status: JobApplicationStatus.OFFER,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.jobApplication.update).not.toHaveBeenCalled();
  });

  it('rejects direct HIRED transitions outside the conversion workflow', async () => {
    const prisma = {
      jobApplication: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'application-1',
          status: JobApplicationStatus.OFFER,
        }),
        update: jest.fn(),
      },
    } as unknown as PrismaService;

    const service = new RecruitmentService(prisma);

    await expect(
      service.updateApplicationStatus(user, 'application-1', {
        status: JobApplicationStatus.HIRED,
      }),
    ).rejects.toThrow('dedicated hire conversion workflow');

    expect(prisma.jobApplication.update).not.toHaveBeenCalled();
  });

  it('automatically timestamps interview transitions', async () => {
    const update = jest.fn().mockImplementation(({ data }) => ({
      id: 'application-1',
      status: data.status,
      interviewDate: data.interviewDate,
    }));
    const prisma = {
      jobApplication: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'application-1',
          status: JobApplicationStatus.SCREENING,
        }),
        update,
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    } as unknown as PrismaService;

    const service = new RecruitmentService(prisma);
    await service.updateApplicationStatus(user, 'application-1', {
      status: JobApplicationStatus.INTERVIEW,
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: JobApplicationStatus.INTERVIEW,
          interviewDate: expect.any(Date),
        }),
      }),
    );
  });

  it('automatically timestamps offer transitions', async () => {
    const update = jest.fn().mockImplementation(({ data }) => ({
      id: 'application-1',
      status: data.status,
      offerDate: data.offerDate,
    }));
    const prisma = {
      jobApplication: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'application-1',
          status: JobApplicationStatus.INTERVIEW,
        }),
        update,
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    } as unknown as PrismaService;

    const service = new RecruitmentService(prisma);
    await service.updateApplicationStatus(user, 'application-1', {
      status: JobApplicationStatus.OFFER,
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: JobApplicationStatus.OFFER,
          offerDate: expect.any(Date),
        }),
      }),
    );
  });

  it('keeps terminal application states terminal', async () => {
    const prisma = {
      jobApplication: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'application-1',
          status: JobApplicationStatus.REJECTED,
        }),
        update: jest.fn(),
      },
    } as unknown as PrismaService;

    const service = new RecruitmentService(prisma);

    await expect(
      service.updateApplicationStatus(user, 'application-1', {
        status: JobApplicationStatus.SCREENING,
      }),
    ).rejects.toThrow('cannot move');

    expect(prisma.jobApplication.update).not.toHaveBeenCalled();
  });
});
