import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  JobApplicationStatus,
  RecruitmentJobStatus,
} from '@prisma/client';
import type { CurrentUser } from '../auth/types/current-user.type';
import { PrismaService } from '../database/prisma.service';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import { CreateJobApplicationDto } from './dto/create-job-application.dto';
import { CreateRecruitmentJobDto } from './dto/create-recruitment-job.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';

function clean(value?: string | null) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

function toDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  return Number(value);
}

const allowedApplicationTransitions: Record<
  JobApplicationStatus,
  readonly JobApplicationStatus[]
> = {
  [JobApplicationStatus.APPLIED]: [
    JobApplicationStatus.SCREENING,
    JobApplicationStatus.REJECTED,
    JobApplicationStatus.WITHDRAWN,
  ],
  [JobApplicationStatus.SCREENING]: [
    JobApplicationStatus.INTERVIEW,
    JobApplicationStatus.REJECTED,
    JobApplicationStatus.WITHDRAWN,
  ],
  [JobApplicationStatus.INTERVIEW]: [
    JobApplicationStatus.OFFER,
    JobApplicationStatus.REJECTED,
    JobApplicationStatus.WITHDRAWN,
  ],
  [JobApplicationStatus.OFFER]: [
    JobApplicationStatus.REJECTED,
    JobApplicationStatus.WITHDRAWN,
  ],
  [JobApplicationStatus.HIRED]: [],
  [JobApplicationStatus.REJECTED]: [],
  [JobApplicationStatus.WITHDRAWN]: [],
};

@Injectable()
export class RecruitmentService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(user: CurrentUser) {
    const [
      totalJobs,
      openJobs,
      candidates,
      applications,
      screeningApplications,
      interviewApplications,
      offerApplications,
      hiredApplications,
    ] = await Promise.all([
      this.prisma.recruitmentJob.count({
        where: { organisationId: user.organisationId },
      }),
      this.prisma.recruitmentJob.count({
        where: {
          organisationId: user.organisationId,
          status: RecruitmentJobStatus.OPEN,
        },
      }),
      this.prisma.candidate.count({
        where: { organisationId: user.organisationId },
      }),
      this.prisma.jobApplication.count({
        where: { organisationId: user.organisationId },
      }),
      this.prisma.jobApplication.count({
        where: {
          organisationId: user.organisationId,
          status: JobApplicationStatus.SCREENING,
        },
      }),
      this.prisma.jobApplication.count({
        where: {
          organisationId: user.organisationId,
          status: JobApplicationStatus.INTERVIEW,
        },
      }),
      this.prisma.jobApplication.count({
        where: {
          organisationId: user.organisationId,
          status: JobApplicationStatus.OFFER,
        },
      }),
      this.prisma.jobApplication.count({
        where: {
          organisationId: user.organisationId,
          status: JobApplicationStatus.HIRED,
        },
      }),
    ]);

    const recentApplications = await this.prisma.jobApplication.findMany({
      where: {
        organisationId: user.organisationId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 8,
      include: {
        job: {
          select: {
            id: true,
            title: true,
            reference: true,
          },
        },
        candidate: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            currentRole: true,
          },
        },
      },
    });

    return {
      totals: {
        totalJobs,
        openJobs,
        candidates,
        applications,
        screeningApplications,
        interviewApplications,
        offerApplications,
        hiredApplications,
      },
      recentApplications: recentApplications.map((application) =>
        this.mapApplication(application),
      ),
    };
  }

  async listJobs(user: CurrentUser) {
    const jobs = await this.prisma.recruitmentJob.findMany({
      where: {
        organisationId: user.organisationId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        department: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        _count: {
          select: {
            applications: true,
          },
        },
      },
    });

    return jobs.map((job) => this.mapJob(job));
  }

  async createJob(user: CurrentUser, dto: CreateRecruitmentJobDto) {
    const title = clean(dto.title);

    if (!title) {
      throw new BadRequestException('Job title is required.');
    }

    if (dto.departmentId) {
      const department = await this.prisma.department.findFirst({
        where: {
          id: dto.departmentId,
          organisationId: user.organisationId,
        },
        select: {
          id: true,
        },
      });

      if (!department) {
        throw new NotFoundException('Department not found.');
      }
    }

    if (dto.reference) {
      const existingReference = await this.prisma.recruitmentJob.findFirst({
        where: {
          organisationId: user.organisationId,
          reference: dto.reference,
        },
        select: {
          id: true,
        },
      });

      if (existingReference) {
        throw new BadRequestException(
          'A recruitment job with this reference already exists.',
        );
      }
    }

    const job = await this.prisma.recruitmentJob.create({
      data: {
        organisationId: user.organisationId,
        departmentId: clean(dto.departmentId),
        createdByUserId: user.id,
        title,
        reference: clean(dto.reference),
        description: clean(dto.description),
        location: clean(dto.location),
        employmentType: clean(dto.employmentType),
        status: (dto.status as RecruitmentJobStatus) ?? RecruitmentJobStatus.OPEN,
        openingDate: toDate(dto.openingDate),
        closingDate: toDate(dto.closingDate),
      },
      include: {
        department: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        _count: {
          select: {
            applications: true,
          },
        },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organisationId: user.organisationId,
        actorUserId: user.id,
        action: AuditAction.CREATE,
        entity: 'RecruitmentJob',
        entityId: job.id,
        message: 'Recruitment job created.',
        metadata: {
          jobId: job.id,
          title: job.title,
          reference: job.reference,
          status: job.status,
        },
      },
    });

    return {
      message: 'Recruitment job created.',
      job: this.mapJob(job),
    };
  }

  async listCandidates(user: CurrentUser) {
    const candidates = await this.prisma.candidate.findMany({
      where: {
        organisationId: user.organisationId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        _count: {
          select: {
            applications: true,
          },
        },
      },
    });

    return candidates.map((candidate) => this.mapCandidate(candidate));
  }

  async createCandidate(user: CurrentUser, dto: CreateCandidateDto) {
    const firstName = clean(dto.firstName);
    const lastName = clean(dto.lastName);

    if (!firstName || !lastName) {
      throw new BadRequestException('Candidate first name and last name are required.');
    }

    const candidate = await this.prisma.candidate.create({
      data: {
        organisationId: user.organisationId,
        createdByUserId: user.id,
        firstName,
        lastName,
        email: clean(dto.email),
        phone: clean(dto.phone),
        currentCompany: clean(dto.currentCompany),
        currentRole: clean(dto.currentRole),
        location: clean(dto.location),
        source: clean(dto.source),
        notes: clean(dto.notes),
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        _count: {
          select: {
            applications: true,
          },
        },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organisationId: user.organisationId,
        actorUserId: user.id,
        action: AuditAction.CREATE,
        entity: 'Candidate',
        entityId: candidate.id,
        message: 'Candidate created.',
        metadata: {
          candidateId: candidate.id,
          candidateName: `${candidate.firstName} ${candidate.lastName}`,
          email: candidate.email,
        },
      },
    });

    return {
      message: 'Candidate created.',
      candidate: this.mapCandidate(candidate),
    };
  }

  async listApplications(user: CurrentUser) {
    const applications = await this.prisma.jobApplication.findMany({
      where: {
        organisationId: user.organisationId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            reference: true,
            status: true,
          },
        },
        candidate: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            currentRole: true,
          },
        },
      },
    });

    return applications.map((application) => this.mapApplication(application));
  }

  async createApplication(user: CurrentUser, dto: CreateJobApplicationDto) {
    const [job, candidate] = await Promise.all([
      this.prisma.recruitmentJob.findFirst({
        where: {
          id: dto.jobId,
          organisationId: user.organisationId,
        },
        select: {
          id: true,
          title: true,
          status: true,
        },
      }),
      this.prisma.candidate.findFirst({
        where: {
          id: dto.candidateId,
          organisationId: user.organisationId,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      }),
    ]);

    if (!job) {
      throw new NotFoundException('Recruitment job not found.');
    }
    if (job.status !== RecruitmentJobStatus.OPEN) {
      throw new BadRequestException(
        'Applications can only be added to open recruitment jobs.',
      );
    }

    if (!candidate) {
      throw new NotFoundException('Candidate not found.');
    }

    const existing = await this.prisma.jobApplication.findFirst({
      where: {
        organisationId: user.organisationId,
        jobId: dto.jobId,
        candidateId: dto.candidateId,
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      throw new BadRequestException(
        'This candidate has already been added to this job.',
      );
    }

    const application = await this.prisma.jobApplication.create({
      data: {
        organisationId: user.organisationId,
        jobId: dto.jobId,
        candidateId: dto.candidateId,
        expectedSalary: dto.expectedSalary,
        rating: dto.rating,
        notes: clean(dto.notes),
      },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            reference: true,
            status: true,
          },
        },
        candidate: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            currentRole: true,
          },
        },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organisationId: user.organisationId,
        actorUserId: user.id,
        action: AuditAction.CREATE,
        entity: 'JobApplication',
        entityId: application.id,
        message: 'Job application created.',
        metadata: {
          applicationId: application.id,
          jobId: dto.jobId,
          candidateId: dto.candidateId,
        },
      },
    });

    return {
      message: 'Job application created.',
      application: this.mapApplication(application),
    };
  }

  async updateApplicationStatus(
    user: CurrentUser,
    applicationId: string,
    dto: UpdateApplicationStatusDto,
  ) {
    const application = await this.prisma.jobApplication.findFirst({
      where: {
        id: applicationId,
        organisationId: user.organisationId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!application) {
      throw new NotFoundException('Job application not found.');
    }

    const nextStatus = dto.status as JobApplicationStatus;
    if (nextStatus === JobApplicationStatus.HIRED) {
      throw new BadRequestException(
        'Applications can only be marked HIRED through the hire conversion workflow.',
      );
    }

    const allowedTransitions = allowedApplicationTransitions[application.status];
    if (!allowedTransitions.includes(nextStatus)) {
      throw new BadRequestException(
        `Application cannot move from ${application.status} to ${nextStatus}.`,
      );
    }

    const now = new Date();
    const interviewDate =
      dto.interviewDate !== undefined
        ? toDate(dto.interviewDate)
        : nextStatus === JobApplicationStatus.INTERVIEW
          ? now
          : undefined;
    const offerDate =
      dto.offerDate !== undefined
        ? toDate(dto.offerDate)
        : nextStatus === JobApplicationStatus.OFFER
          ? now
          : undefined;

    if (dto.interviewDate !== undefined && !interviewDate) {
      throw new BadRequestException('A valid interview date is required.');
    }
    if (dto.offerDate !== undefined && !offerDate) {
      throw new BadRequestException('A valid offer date is required.');
    }

    const updatedApplication = await this.prisma.jobApplication.update({
      where: { id: application.id },
      data: {
        status: nextStatus,
        interviewDate,
        offerDate,
        decisionDate:
          nextStatus === JobApplicationStatus.REJECTED ||
          nextStatus === JobApplicationStatus.WITHDRAWN
            ? now
            : undefined,
        expectedSalary:
          dto.expectedSalary === undefined ? undefined : dto.expectedSalary,
        rating: dto.rating === undefined ? undefined : dto.rating,
        notes: dto.notes === undefined ? undefined : clean(dto.notes),
      },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            reference: true,
            status: true,
          },
        },
        candidate: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            currentRole: true,
          },
        },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organisationId: user.organisationId,
        actorUserId: user.id,
        action: AuditAction.UPDATE,
        entity: 'JobApplication',
        entityId: application.id,
        message: 'Job application status updated.',
        metadata: {
          applicationId: application.id,
          previousStatus: application.status,
          nextStatus,
        },
      },
    });

    return {
      message: 'Application status updated.',
      application: this.mapApplication(updatedApplication),
    };
  }

  private mapJob(job: any) {
    return {
      id: job.id,
      organisationId: job.organisationId,
      departmentId: job.departmentId,
      createdByUserId: job.createdByUserId,
      title: job.title,
      reference: job.reference,
      description: job.description,
      location: job.location,
      employmentType: job.employmentType,
      status: job.status,
      openingDate: job.openingDate,
      closingDate: job.closingDate,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      department: job.department ?? null,
      createdBy: job.createdBy ?? null,
      applicationCount: job._count?.applications ?? 0,
    };
  }

  private mapCandidate(candidate: any) {
    return {
      id: candidate.id,
      organisationId: candidate.organisationId,
      createdByUserId: candidate.createdByUserId,
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      email: candidate.email,
      phone: candidate.phone,
      currentCompany: candidate.currentCompany,
      currentRole: candidate.currentRole,
      location: candidate.location,
      source: candidate.source,
      notes: candidate.notes,
      createdAt: candidate.createdAt,
      updatedAt: candidate.updatedAt,
      createdBy: candidate.createdBy ?? null,
      applicationCount: candidate._count?.applications ?? 0,
    };
  }

  private mapApplication(application: any) {
    return {
      id: application.id,
      organisationId: application.organisationId,
      jobId: application.jobId,
      candidateId: application.candidateId,
      status: application.status,
      appliedAt: application.appliedAt,
      interviewDate: application.interviewDate,
      offerDate: application.offerDate,
      decisionDate: application.decisionDate,
      expectedSalary: toNumber(application.expectedSalary),
      rating: application.rating,
      notes: application.notes,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
      job: application.job ?? null,
      candidate: application.candidate ?? null,
    };
  }
}
