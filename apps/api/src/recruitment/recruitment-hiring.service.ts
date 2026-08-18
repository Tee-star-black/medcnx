import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  JobApplicationStatus,
  Prisma,
  RecruitmentJobStatus,
} from '@prisma/client';
import type { EmployeePositionAssignment } from '@prisma/client';
import type { CurrentUser } from '../auth/types/current-user.type';
import { PrismaService } from '../database/prisma.service';
import { HireApplicationDto } from './dto/hire-application.dto';

const SERIALIZABLE_RETRY_LIMIT = 3;

@Injectable()
export class RecruitmentHiringService {
  constructor(private readonly prisma: PrismaService) {}

  async hireApplication(
    user: CurrentUser,
    applicationId: string,
    dto: HireApplicationDto,
  ) {
    const employeeNumber = dto.employeeNumber.trim();
    const startDate = new Date(dto.startDate);

    if (!employeeNumber) {
      throw new BadRequestException('Employee number is required.');
    }
    if (Number.isNaN(startDate.getTime())) {
      throw new BadRequestException('A valid employee start date is required.');
    }

    const reason = dto.reason?.trim() || 'Hired from recruitment workflow.';

    for (let attempt = 1; attempt <= SERIALIZABLE_RETRY_LIMIT; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (transaction) => {
            const application = await transaction.jobApplication.findFirst({
              where: {
                id: applicationId,
                organisationId: user.organisationId,
              },
              include: {
                candidate: true,
                job: true,
              },
            });

            if (!application) {
              throw new NotFoundException('Job application not found.');
            }
            if (application.status !== JobApplicationStatus.OFFER) {
              throw new BadRequestException(
                'Only applications in OFFER status can be hired.',
              );
            }
            if (application.job.status !== RecruitmentJobStatus.OPEN) {
              throw new BadRequestException(
                'Only open recruitment jobs can accept hires.',
              );
            }

            const existingConversion =
              await transaction.recruitmentHireConversion.findFirst({
                where: {
                  organisationId: user.organisationId,
                  applicationId,
                },
              });
            if (existingConversion) {
              throw new ConflictException('This application has already been hired.');
            }

            const duplicateEmployeeNumber = await transaction.employee.findFirst({
              where: {
                organisationId: user.organisationId,
                employeeNumber,
              },
              select: { id: true },
            });
            if (duplicateEmployeeNumber) {
              throw new ConflictException('Employee number already exists.');
            }

            const positionLink =
              await transaction.recruitmentPositionLink.findFirst({
                where: {
                  organisationId: user.organisationId,
                  recruitmentJobId: application.jobId,
                },
              });

            const position = positionLink
              ? await transaction.position.findFirst({
                  where: {
                    id: positionLink.positionId,
                    organisationId: user.organisationId,
                    active: true,
                  },
                })
              : null;

            if (positionLink && !position) {
              throw new ConflictException(
                'The recruitment job is linked to a position that is no longer active.',
              );
            }

            const completedHires = positionLink
              ? await transaction.recruitmentHireConversion.count({
                  where: {
                    organisationId: user.organisationId,
                    recruitmentJobId: application.jobId,
                  },
                })
              : 0;

            if (positionLink && completedHires >= positionLink.plannedOpenings) {
              throw new ConflictException(
                'All planned openings for this recruitment job have already been filled.',
              );
            }

            const employee = await transaction.employee.create({
              data: {
                organisationId: user.organisationId,
                departmentId: application.job.departmentId,
                employeeNumber,
                firstName: application.candidate.firstName,
                lastName: application.candidate.lastName,
                email: application.candidate.email,
                phone: application.candidate.phone,
                jobTitle: position?.title ?? application.job.title,
                employmentType:
                  dto.employmentType?.trim() || application.job.employmentType,
                startDate,
              },
            });

            let assignment: EmployeePositionAssignment | null = null;
            if (position) {
              assignment = await transaction.employeePositionAssignment.create({
                data: {
                  organisationId: user.organisationId,
                  employeeId: employee.id,
                  positionId: position.id,
                  effectiveFrom: startDate,
                  reason,
                  assignedByUserId: user.id,
                },
              });
            }

            const updatedApplication = await transaction.jobApplication.update({
              where: { id: application.id },
              data: {
                status: JobApplicationStatus.HIRED,
                decisionDate: new Date(),
              },
            });

            const conversion = await transaction.recruitmentHireConversion.create({
              data: {
                organisationId: user.organisationId,
                applicationId: application.id,
                candidateId: application.candidateId,
                employeeId: employee.id,
                positionId: position?.id ?? null,
                recruitmentJobId: application.jobId,
                convertedByUserId: user.id,
              },
            });

            await transaction.auditLog.create({
              data: {
                organisationId: user.organisationId,
                actorUserId: user.id,
                employeeId: employee.id,
                action: AuditAction.CREATE,
                entity: 'Employee',
                entityId: employee.id,
                message: `Employee hired from recruitment: ${employee.firstName} ${employee.lastName}.`,
                metadata: {
                  eventType: 'HIRED',
                  applicationId: application.id,
                  candidateId: application.candidateId,
                  recruitmentJobId: application.jobId,
                  positionId: position?.id ?? null,
                  positionCode: position?.code ?? null,
                  employeeNumber: employee.employeeNumber,
                  effectiveDate: startDate.toISOString(),
                },
              },
            });

            await transaction.auditLog.create({
              data: {
                organisationId: user.organisationId,
                actorUserId: user.id,
                employeeId: employee.id,
                action: AuditAction.UPDATE,
                entity: 'JobApplication',
                entityId: application.id,
                message: 'Application converted to employee.',
                metadata: {
                  previousStatus: application.status,
                  nextStatus: JobApplicationStatus.HIRED,
                  employeeId: employee.id,
                  positionId: position?.id ?? null,
                },
              },
            });

            let recruitmentJobClosed = false;
            if (positionLink && completedHires + 1 >= positionLink.plannedOpenings) {
              await transaction.recruitmentJob.update({
                where: { id: application.jobId },
                data: { status: RecruitmentJobStatus.CLOSED },
              });
              recruitmentJobClosed = true;
            }

            return {
              message: 'Candidate hired and converted to an employee.',
              employee,
              assignment,
              application: updatedApplication,
              conversion,
              recruitmentJobClosed,
              position,
            };
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          },
        );
      } catch (error: unknown) {
        if (this.isSerializableConflict(error) && attempt < SERIALIZABLE_RETRY_LIMIT) {
          continue;
        }
        if (this.isSerializableConflict(error)) {
          throw new ConflictException(
            'The recruitment job changed while this hire was being processed. Refresh and try again.',
          );
        }
        throw error;
      }
    }

    throw new ConflictException(
      'The recruitment job changed while this hire was being processed. Refresh and try again.',
    );
  }

  private isSerializableConflict(error: unknown) {
    return Boolean(
      error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code?: string }).code === 'P2034',
    );
  }
}
