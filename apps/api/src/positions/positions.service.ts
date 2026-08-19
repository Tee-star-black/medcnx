import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  EmploymentStatus,
  RecruitmentJobStatus,
} from '@prisma/client';
import { AccessScopeService } from '../auth/access-scope.service';
import type { CurrentUser } from '../auth/types/current-user.type';
import { PrismaService } from '../database/prisma.service';
import { AssignPositionDto } from './dto/assign-position.dto';
import { CreatePositionDto } from './dto/create-position.dto';
import { CreatePositionRecruitmentJobDto } from './dto/create-position-recruitment-job.dto';
import { UpdatePositionDto } from './dto/update-position.dto';

@Injectable()
export class PositionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessScope: AccessScopeService,
  ) {}

  async findAll(user: CurrentUser) {
    const positions = await this.prisma.position.findMany({
      where: { organisationId: user.organisationId },
      orderBy: [{ active: 'desc' }, { title: 'asc' }],
    });

    const departmentIds = [
      ...new Set(positions.map((position) => position.departmentId).filter(Boolean)),
    ] as string[];

    const departments = departmentIds.length
      ? await this.prisma.department.findMany({
          where: {
            organisationId: user.organisationId,
            id: { in: departmentIds },
          },
          select: { id: true, name: true },
        })
      : [];

    const departmentById = new Map(
      departments.map((department) => [department.id, department]),
    );

    return Promise.all(
      positions.map(async (position) => {
        const currentHeadcount =
          await this.prisma.employeePositionAssignment.count({
            where: {
              organisationId: user.organisationId,
              positionId: position.id,
              effectiveTo: null,
            },
          });

        return {
          ...position,
          department: position.departmentId
            ? departmentById.get(position.departmentId) ?? null
            : null,
          currentHeadcount,
          vacancies: Math.max(position.approvedHeadcount - currentHeadcount, 0),
        };
      }),
    );
  }

  async getVacancyPlan(user: CurrentUser) {
    const positions = await this.prisma.position.findMany({
      where: {
        organisationId: user.organisationId,
        active: true,
      },
      orderBy: { title: 'asc' },
    });

    const positionIds = positions.map((position) => position.id);
    const [assignments, recruitmentLinks] = await Promise.all([
      positionIds.length
        ? this.prisma.employeePositionAssignment.findMany({
            where: {
              organisationId: user.organisationId,
              positionId: { in: positionIds },
              effectiveTo: null,
            },
            select: { positionId: true },
          })
        : [],
      positionIds.length
        ? this.prisma.recruitmentPositionLink.findMany({
            where: {
              organisationId: user.organisationId,
              positionId: { in: positionIds },
            },
          })
        : [],
    ]);

    const jobIds = recruitmentLinks.map((link) => link.recruitmentJobId);
    const [activeJobs, hireConversions] = await Promise.all([
      jobIds.length
        ? this.prisma.recruitmentJob.findMany({
            where: {
              organisationId: user.organisationId,
              id: { in: jobIds },
              status: {
                in: [RecruitmentJobStatus.OPEN, RecruitmentJobStatus.ON_HOLD],
              },
            },
            select: { id: true, status: true },
          })
        : [],
      jobIds.length
        ? this.prisma.recruitmentHireConversion.findMany({
            where: {
              organisationId: user.organisationId,
              recruitmentJobId: { in: jobIds },
            },
            select: { recruitmentJobId: true },
          })
        : [],
    ]);

    const activeJobIds = new Set(activeJobs.map((job) => job.id));
    const completedHiresByJob = new Map<string, number>();
    for (const conversion of hireConversions) {
      completedHiresByJob.set(
        conversion.recruitmentJobId,
        (completedHiresByJob.get(conversion.recruitmentJobId) ?? 0) + 1,
      );
    }

    const occupiedByPosition = new Map<string, number>();
    for (const assignment of assignments) {
      occupiedByPosition.set(
        assignment.positionId,
        (occupiedByPosition.get(assignment.positionId) ?? 0) + 1,
      );
    }

    const recruitingByPosition = new Map<string, number>();
    for (const link of recruitmentLinks) {
      if (!activeJobIds.has(link.recruitmentJobId)) continue;
      const completedHires = completedHiresByJob.get(link.recruitmentJobId) ?? 0;
      const remainingOpenings = Math.max(link.plannedOpenings - completedHires, 0);
      recruitingByPosition.set(
        link.positionId,
        (recruitingByPosition.get(link.positionId) ?? 0) + remainingOpenings,
      );
    }

    const departmentIds = [
      ...new Set(positions.map((position) => position.departmentId).filter(Boolean)),
    ] as string[];
    const departments = departmentIds.length
      ? await this.prisma.department.findMany({
          where: {
            organisationId: user.organisationId,
            id: { in: departmentIds },
          },
          select: { id: true, name: true },
        })
      : [];
    const departmentById = new Map(
      departments.map((department) => [department.id, department]),
    );

    const rows = positions.map((position) => {
      const currentHeadcount = occupiedByPosition.get(position.id) ?? 0;
      const vacancies = Math.max(position.approvedHeadcount - currentHeadcount, 0);
      const recruitingOpenings = recruitingByPosition.get(position.id) ?? 0;
      const unplannedVacancies = Math.max(vacancies - recruitingOpenings, 0);

      return {
        ...position,
        department: position.departmentId
          ? departmentById.get(position.departmentId) ?? null
          : null,
        currentHeadcount,
        vacancies,
        recruitingOpenings,
        unplannedVacancies,
        staffingStatus:
          vacancies === 0
            ? 'FULLY_STAFFED'
            : unplannedVacancies === 0
              ? 'RECRUITMENT_IN_PROGRESS'
              : 'VACANCY_UNPLANNED',
      };
    });

    return {
      totals: {
        approvedHeadcount: rows.reduce(
          (total, row) => total + row.approvedHeadcount,
          0,
        ),
        currentHeadcount: rows.reduce(
          (total, row) => total + row.currentHeadcount,
          0,
        ),
        vacancies: rows.reduce((total, row) => total + row.vacancies, 0),
        recruitingOpenings: rows.reduce(
          (total, row) => total + row.recruitingOpenings,
          0,
        ),
        unplannedVacancies: rows.reduce(
          (total, row) => total + row.unplannedVacancies,
          0,
        ),
      },
      positions: rows,
    };
  }

  async findOne(user: CurrentUser, positionId: string) {
    const position = await this.getPosition(user, positionId);
    const currentAssignments =
      await this.prisma.employeePositionAssignment.findMany({
        where: {
          organisationId: user.organisationId,
          positionId,
          effectiveTo: null,
        },
        orderBy: { effectiveFrom: 'asc' },
      });

    const employeeIds = currentAssignments.map(
      (assignment) => assignment.employeeId,
    );
    const employees = employeeIds.length
      ? await this.prisma.employee.findMany({
          where: {
            organisationId: user.organisationId,
            id: { in: employeeIds },
          },
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
            jobTitle: true,
            employmentStatus: true,
          },
        })
      : [];

    return {
      ...position,
      currentHeadcount: currentAssignments.length,
      vacancies: Math.max(
        position.approvedHeadcount - currentAssignments.length,
        0,
      ),
      employees,
    };
  }

  async create(user: CurrentUser, dto: CreatePositionDto) {
    if (dto.departmentId) {
      await this.assertDepartment(user, dto.departmentId);
    }

    const duplicate = await this.prisma.position.findFirst({
      where: {
        organisationId: user.organisationId,
        code: dto.code.trim(),
      },
    });

    if (duplicate) throw new ConflictException('Position code already exists.');

    const position = await this.prisma.position.create({
      data: {
        organisationId: user.organisationId,
        departmentId: dto.departmentId,
        code: dto.code.trim(),
        title: dto.title.trim(),
        description: dto.description?.trim(),
        level: dto.level?.trim(),
        employmentCategory: dto.employmentCategory?.trim(),
        approvedHeadcount: dto.approvedHeadcount ?? 0,
        active: dto.active ?? true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organisationId: user.organisationId,
        actorUserId: user.id,
        action: AuditAction.CREATE,
        entity: 'Position',
        entityId: position.id,
        message: `Position created: ${position.title}.`,
        metadata: {
          code: position.code,
          departmentId: position.departmentId,
          approvedHeadcount: position.approvedHeadcount,
        },
      },
    });

    return position;
  }

  async update(user: CurrentUser, positionId: string, dto: UpdatePositionDto) {
    const existing = await this.getPosition(user, positionId);

    if (dto.departmentId !== undefined && dto.departmentId !== null) {
      await this.assertDepartment(user, dto.departmentId);
    }

    if (dto.code && dto.code.trim() !== existing.code) {
      const duplicate = await this.prisma.position.findFirst({
        where: {
          organisationId: user.organisationId,
          code: dto.code.trim(),
          id: { not: positionId },
        },
      });
      if (duplicate) throw new ConflictException('Position code already exists.');
    }

    const position = await this.prisma.position.update({
      where: { id: positionId },
      data: {
        code: dto.code?.trim(),
        title: dto.title?.trim(),
        departmentId:
          dto.departmentId === undefined ? undefined : dto.departmentId,
        description: dto.description?.trim(),
        level: dto.level?.trim(),
        employmentCategory: dto.employmentCategory?.trim(),
        approvedHeadcount: dto.approvedHeadcount,
        active: dto.active,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organisationId: user.organisationId,
        actorUserId: user.id,
        action: AuditAction.UPDATE,
        entity: 'Position',
        entityId: position.id,
        message: `Position updated: ${position.title}.`,
        metadata: {
          previous: existing,
          next: position,
        },
      },
    });

    return position;
  }

  async archive(user: CurrentUser, positionId: string) {
    const position = await this.getPosition(user, positionId);
    const assigned = await this.prisma.employeePositionAssignment.count({
      where: {
        organisationId: user.organisationId,
        positionId,
        effectiveTo: null,
      },
    });

    if (assigned > 0) {
      throw new ConflictException(
        'Cannot archive a position while employees are actively assigned to it.',
      );
    }

    const openRecruitmentLinks =
      await this.prisma.recruitmentPositionLink.findMany({
        where: {
          organisationId: user.organisationId,
          positionId,
        },
        select: { recruitmentJobId: true },
      });
    const linkedJobIds = openRecruitmentLinks.map((link) => link.recruitmentJobId);
    const openRecruitment = linkedJobIds.length
      ? await this.prisma.recruitmentJob.count({
          where: {
            organisationId: user.organisationId,
            id: { in: linkedJobIds },
            status: {
              in: [RecruitmentJobStatus.OPEN, RecruitmentJobStatus.ON_HOLD],
            },
          },
        })
      : 0;

    if (openRecruitment > 0) {
      throw new ConflictException(
        'Cannot archive a position while recruitment is still open for it.',
      );
    }

    const archived = await this.prisma.position.update({
      where: { id: positionId },
      data: { active: false },
    });

    await this.prisma.auditLog.create({
      data: {
        organisationId: user.organisationId,
        actorUserId: user.id,
        action: AuditAction.UPDATE,
        entity: 'Position',
        entityId: position.id,
        message: `Position archived: ${position.title}.`,
        metadata: { active: false },
      },
    });

    return archived;
  }

  async createRecruitmentJob(
    user: CurrentUser,
    positionId: string,
    dto: CreatePositionRecruitmentJobDto,
  ) {
    const position = await this.getPosition(user, positionId);
    if (!position.active) throw new BadRequestException('Position is archived.');

    const currentHeadcount = await this.prisma.employeePositionAssignment.count({
      where: {
        organisationId: user.organisationId,
        positionId,
        effectiveTo: null,
      },
    });
    const vacancies = Math.max(position.approvedHeadcount - currentHeadcount, 0);
    if (vacancies === 0) {
      throw new ConflictException('This position has no approved vacancies.');
    }

    const existingLinks = await this.prisma.recruitmentPositionLink.findMany({
      where: {
        organisationId: user.organisationId,
        positionId,
      },
    });
    const linkedJobIds = existingLinks.map((link) => link.recruitmentJobId);
    const activeJobs = linkedJobIds.length
      ? await this.prisma.recruitmentJob.findMany({
          where: {
            organisationId: user.organisationId,
            id: { in: linkedJobIds },
            status: {
              in: [RecruitmentJobStatus.OPEN, RecruitmentJobStatus.ON_HOLD],
            },
          },
          select: { id: true },
        })
      : [];
    const activeJobIds = new Set(activeJobs.map((job) => job.id));
    const activeJobIdList = [...activeJobIds];
    const hireConversions = activeJobIdList.length
      ? await this.prisma.recruitmentHireConversion.findMany({
          where: {
            organisationId: user.organisationId,
            recruitmentJobId: { in: activeJobIdList },
          },
          select: { recruitmentJobId: true },
        })
      : [];
    const completedHiresByJob = new Map<string, number>();
    for (const conversion of hireConversions) {
      completedHiresByJob.set(
        conversion.recruitmentJobId,
        (completedHiresByJob.get(conversion.recruitmentJobId) ?? 0) + 1,
      );
    }
    const alreadyRecruiting = existingLinks
      .filter((link) => activeJobIds.has(link.recruitmentJobId))
      .reduce(
        (total, link) =>
          total +
          Math.max(
            link.plannedOpenings -
              (completedHiresByJob.get(link.recruitmentJobId) ?? 0),
            0,
          ),
        0,
      );
    const remainingVacancies = Math.max(vacancies - alreadyRecruiting, 0);
    const plannedOpenings = dto.plannedOpenings ?? 1;

    if (plannedOpenings > remainingVacancies) {
      throw new ConflictException(
        `Only ${remainingVacancies} unplanned approved vacancy${remainingVacancies === 1 ? '' : 'ies'} remain for this position.`,
      );
    }

    if (dto.reference) {
      const duplicateReference = await this.prisma.recruitmentJob.findFirst({
        where: {
          organisationId: user.organisationId,
          reference: dto.reference.trim(),
        },
        select: { id: true },
      });
      if (duplicateReference) {
        throw new ConflictException(
          'A recruitment job with this reference already exists.',
        );
      }
    }

    const openingDate = dto.openingDate ? new Date(dto.openingDate) : new Date();
    const closingDate = dto.closingDate ? new Date(dto.closingDate) : null;
    if (closingDate && closingDate < openingDate) {
      throw new BadRequestException(
        'Recruitment closing date cannot precede opening date.',
      );
    }

    const result = await this.prisma.$transaction(async (transaction) => {
      const job = await transaction.recruitmentJob.create({
        data: {
          organisationId: user.organisationId,
          departmentId: position.departmentId,
          createdByUserId: user.id,
          title: position.title,
          reference: dto.reference?.trim(),
          description: dto.description?.trim() ?? position.description,
          location: dto.location?.trim(),
          employmentType: position.employmentCategory,
          status: RecruitmentJobStatus.OPEN,
          openingDate,
          closingDate,
        },
      });

      const link = await transaction.recruitmentPositionLink.create({
        data: {
          organisationId: user.organisationId,
          recruitmentJobId: job.id,
          positionId: position.id,
          plannedOpenings,
        },
      });

      await transaction.auditLog.create({
        data: {
          organisationId: user.organisationId,
          actorUserId: user.id,
          action: AuditAction.CREATE,
          entity: 'RecruitmentPositionLink',
          entityId: link.id,
          message: `Recruitment opened for position ${position.title}.`,
          metadata: {
            positionId: position.id,
            positionCode: position.code,
            recruitmentJobId: job.id,
            plannedOpenings,
            vacanciesAtCreation: vacancies,
            alreadyRecruiting,
          },
        },
      });

      return { job, link };
    });

    return {
      ...result,
      position,
      vacancySnapshot: {
        approvedHeadcount: position.approvedHeadcount,
        currentHeadcount,
        vacancies,
        alreadyRecruiting,
        plannedOpenings,
        remainingUnplannedVacancies: remainingVacancies - plannedOpenings,
      },
    };
  }

  async assignEmployee(
    user: CurrentUser,
    employeeId: string,
    dto: AssignPositionDto,
  ) {
    await this.accessScope.assertEmployeeAccess(user, employeeId);

    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, organisationId: user.organisationId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        departmentId: true,
        jobTitle: true,
        employmentStatus: true,
        startDate: true,
      },
    });

    if (!employee) throw new NotFoundException('Employee not found.');
    if (
      employee.employmentStatus === EmploymentStatus.TERMINATED ||
      employee.employmentStatus === EmploymentStatus.RESIGNED
    ) {
      throw new BadRequestException(
        'Inactive employees cannot be assigned a position.',
      );
    }

    const position = await this.getPosition(user, dto.positionId);
    if (!position.active) throw new BadRequestException('Position is archived.');

    const effectiveDate = new Date(dto.effectiveDate);
    if (Number.isNaN(effectiveDate.getTime())) {
      throw new BadRequestException(
        'A valid position effective date is required.',
      );
    }

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    if (effectiveDate > endOfToday) {
      throw new BadRequestException(
        'Position effective date cannot be in the future until scheduled position changes are supported.',
      );
    }
    if (employee.startDate && effectiveDate < employee.startDate) {
      throw new BadRequestException(
        'Position effective date cannot precede the employee start date.',
      );
    }

    const current = await this.prisma.employeePositionAssignment.findFirst({
      where: {
        organisationId: user.organisationId,
        employeeId,
        effectiveTo: null,
      },
    });

    if (current?.positionId === position.id) {
      throw new ConflictException('Employee is already assigned to this position.');
    }
    if (current && effectiveDate < current.effectiveFrom) {
      throw new BadRequestException(
        'New position effective date cannot precede the current assignment start date.',
      );
    }

    const previousPosition = current
      ? await this.prisma.position.findFirst({
          where: {
            id: current.positionId,
            organisationId: user.organisationId,
          },
        })
      : null;
    const nextDepartmentId = position.departmentId ?? employee.departmentId;

    const assignment = await this.prisma.$transaction(async (transaction) => {
      if (current) {
        await transaction.employeePositionAssignment.update({
          where: { id: current.id },
          data: { effectiveTo: effectiveDate },
        });
      }

      const created = await transaction.employeePositionAssignment.create({
        data: {
          organisationId: user.organisationId,
          employeeId,
          positionId: position.id,
          effectiveFrom: effectiveDate,
          reason: dto.reason?.trim(),
          assignedByUserId: user.id,
        },
      });

      await transaction.employee.update({
        where: { id: employeeId },
        data: {
          jobTitle: position.title,
          ...(nextDepartmentId !== employee.departmentId
            ? { departmentId: nextDepartmentId }
            : {}),
        },
      });

      await transaction.auditLog.create({
        data: {
          organisationId: user.organisationId,
          actorUserId: user.id,
          employeeId,
          action: AuditAction.UPDATE,
          entity: 'EmployeeLifecycle',
          entityId: employeeId,
          message: `POSITION_CHANGED: ${employee.firstName} ${employee.lastName}.`,
          metadata: {
            eventType: 'POSITION_CHANGED',
            effectiveDate: effectiveDate.toISOString(),
            reason: dto.reason?.trim() ?? null,
            previousPositionId: previousPosition?.id ?? null,
            previousPositionCode: previousPosition?.code ?? null,
            previousPositionTitle:
              previousPosition?.title ?? employee.jobTitle,
            nextPositionId: position.id,
            nextPositionCode: position.code,
            nextPositionTitle: position.title,
            previousDepartmentId: employee.departmentId,
            departmentId: nextDepartmentId,
          },
        },
      });

      return created;
    });

    return {
      assignment,
      position,
      employeeDepartmentId: nextDepartmentId,
    };
  }

  async employeeHistory(user: CurrentUser, employeeId: string) {
    await this.accessScope.assertEmployeeAccess(user, employeeId);
    return this.prisma.employeePositionAssignment.findMany({
      where: {
        organisationId: user.organisationId,
        employeeId,
      },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  private async getPosition(user: CurrentUser, positionId: string) {
    const position = await this.prisma.position.findFirst({
      where: { id: positionId, organisationId: user.organisationId },
    });
    if (!position) throw new NotFoundException('Position not found.');
    return position;
  }

  private async assertDepartment(user: CurrentUser, departmentId: string) {
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, organisationId: user.organisationId },
      select: { id: true },
    });
    if (!department) throw new NotFoundException('Department not found.');
  }
}
