import {
  JobApplicationStatus,
  RecruitmentJobStatus,
} from '@prisma/client';
import { RecruitmentHiringService } from './recruitment-hiring.service';
import { PrismaService } from '../database/prisma.service';

describe('RecruitmentHiringService guardrails', () => {
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

  const dto = {
    employeeNumber: 'MED-200',
    startDate: '2026-09-01',
  };

  it('rejects hiring before the application reaches OFFER', async () => {
    const prisma = {
      jobApplication: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'application-1',
          organisationId: 'org-1',
          jobId: 'job-1',
          candidateId: 'candidate-1',
          status: JobApplicationStatus.INTERVIEW,
          candidate: { firstName: 'Naledi', lastName: 'Dube' },
          job: { status: RecruitmentJobStatus.OPEN },
        }),
      },
    } as unknown as PrismaService;

    const service = new RecruitmentHiringService(prisma);

    await expect(
      service.hireApplication(user, 'application-1', dto),
    ).rejects.toThrow('Only applications in OFFER status can be hired.');
  });

  it('rejects hiring while the recruitment job is on hold', async () => {
    const prisma = {
      jobApplication: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'application-1',
          organisationId: 'org-1',
          jobId: 'job-1',
          candidateId: 'candidate-1',
          status: JobApplicationStatus.OFFER,
          candidate: { firstName: 'Naledi', lastName: 'Dube' },
          job: { status: RecruitmentJobStatus.ON_HOLD },
        }),
      },
    } as unknown as PrismaService;

    const service = new RecruitmentHiringService(prisma);

    await expect(
      service.hireApplication(user, 'application-1', dto),
    ).rejects.toThrow('Only open recruitment jobs can accept hires.');
  });
});
