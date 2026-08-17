import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  PerformanceCycleStatus,
  PerformanceReviewStatus,
  Prisma,
} from '@prisma/client';
import type { CurrentUser } from '../auth/types/current-user.type';
import { PrismaService } from '../database/prisma.service';
import {
  AcknowledgePerformanceReviewDto,
  AssignPerformanceReviewDto,
  CreateCompetencyDto,
  CreateDevelopmentPlanDto,
  CreatePerformanceCycleDto,
  CreatePerformanceGoalDto,
  CreatePerformanceTemplateDto,
  FinalisePerformanceReviewDto,
  SavePerformanceReviewDto,
  UpdateDevelopmentPlanDto,
  UpdatePerformanceGoalDto,
} from './dto/performance.dto';

@Injectable()
export class PerformanceService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(user: CurrentUser) {
    const now = new Date();
    const inThirtyDays = new Date(now);
    inThirtyDays.setDate(inThirtyDays.getDate() + 30);
    const [
      activeCycles,
      pendingReviews,
      overdueReviews,
      goalsDueSoon,
      overdueGoals,
      developmentPlans,
      recentReviews,
    ] = await Promise.all([
      this.prisma.performanceCycle.count({
        where: { organisationId: user.organisationId, status: 'ACTIVE' },
      }),
      this.prisma.performanceReview.count({
        where: {
          organisationId: user.organisationId,
          status: { in: ['ASSIGNED', 'IN_PROGRESS', 'SUBMITTED'] },
        },
      }),
      this.prisma.performanceReview.count({
        where: {
          organisationId: user.organisationId,
          cycle: { dueDate: { lt: now } },
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
      }),
      this.prisma.performanceGoal.count({
        where: {
          organisationId: user.organisationId,
          targetDate: { gte: now, lte: inThirtyDays },
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
      }),
      this.prisma.performanceGoal.count({
        where: {
          organisationId: user.organisationId,
          targetDate: { lt: now },
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
      }),
      this.prisma.performanceDevelopmentPlan.count({
        where: {
          organisationId: user.organisationId,
          status: { in: ['PLANNED', 'IN_PROGRESS'] },
        },
      }),
      this.prisma.performanceReview.findMany({
        where: { organisationId: user.organisationId },
        include: {
          employee: {
            select: {
              id: true,
              employeeNumber: true,
              firstName: true,
              lastName: true,
              jobTitle: true,
            },
          },
          cycle: { select: { name: true, dueDate: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 8,
      }),
    ]);
    return {
      activeCycles,
      pendingReviews,
      overdueReviews,
      goalsDueSoon,
      overdueGoals,
      developmentPlans,
      recentReviews,
    };
  }

  listTemplates(user: CurrentUser) {
    return this.prisma.performanceTemplate.findMany({
      where: { organisationId: user.organisationId },
      include: { _count: { select: { cycles: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createTemplate(user: CurrentUser, dto: CreatePerformanceTemplateDto) {
    const template = await this.prisma.performanceTemplate.create({
      data: {
        organisationId: user.organisationId,
        name: dto.name.trim(),
        description: dto.description?.trim(),
        type: dto.type,
        status: dto.status ?? 'ACTIVE',
        anonymous: dto.anonymous ?? false,
        questions: dto.questions as unknown as Prisma.InputJsonValue,
        createdByUserId: user.id,
      },
    });
    await this.audit(user, AuditAction.CREATE, 'PerformanceTemplate', template.id,
      'Performance assessment template created.');
    return template;
  }

  listCycles(user: CurrentUser) {
    return this.prisma.performanceCycle.findMany({
      where: { organisationId: user.organisationId },
      include: {
        template: true,
        _count: { select: { reviews: true } },
      },
      orderBy: { dueDate: 'desc' },
    });
  }

  async createCycle(user: CurrentUser, dto: CreatePerformanceCycleDto) {
    const startDate = new Date(dto.startDate);
    const dueDate = new Date(dto.dueDate);
    if (dueDate <= startDate)
      throw new BadRequestException('The due date must be after the start date.');
    const template = await this.prisma.performanceTemplate.findFirst({
      where: {
        id: dto.templateId,
        organisationId: user.organisationId,
        status: 'ACTIVE',
      },
    });
    if (!template) throw new NotFoundException('Active assessment template not found.');
    const cycle = await this.prisma.performanceCycle.create({
      data: {
        organisationId: user.organisationId,
        templateId: template.id,
        name: dto.name.trim(),
        description: dto.description?.trim(),
        startDate,
        dueDate,
        status: startDate <= new Date() ? 'ACTIVE' : 'SCHEDULED',
        launchedAt: startDate <= new Date() ? new Date() : null,
        createdByUserId: user.id,
      },
    });
    await this.audit(user, AuditAction.CREATE, 'PerformanceCycle', cycle.id,
      'Performance review cycle created.');
    return cycle;
  }

  async assignReview(
    user: CurrentUser,
    cycleId: string,
    dto: AssignPerformanceReviewDto,
  ) {
    const [cycle, employee, reviewer] = await Promise.all([
      this.prisma.performanceCycle.findFirst({
        where: { id: cycleId, organisationId: user.organisationId },
        include: { template: true },
      }),
      this.prisma.employee.findFirst({
        where: { id: dto.employeeId, organisationId: user.organisationId },
      }),
      this.prisma.user.findFirst({
        where: { id: dto.reviewerUserId, organisationId: user.organisationId },
        include: { employeeProfile: true },
      }),
    ]);
    if (!cycle) throw new NotFoundException('Performance cycle not found.');
    if (!employee) throw new NotFoundException('Employee not found.');
    if (!reviewer) throw new NotFoundException('Reviewer not found.');
    const review = await this.prisma.performanceReview.upsert({
      where: {
        cycleId_employeeId_reviewerUserId_reviewerType: {
          cycleId,
          employeeId: employee.id,
          reviewerUserId: reviewer.id,
          reviewerType: dto.reviewerType,
        },
      },
      update: {
        confidential: dto.confidential ?? cycle.template.anonymous,
        status: 'ASSIGNED',
      },
      create: {
        organisationId: user.organisationId,
        cycleId,
        employeeId: employee.id,
        reviewerUserId: reviewer.id,
        reviewerEmployeeId: reviewer.employeeProfile?.id,
        reviewerType: dto.reviewerType,
        confidential: dto.confidential ?? cycle.template.anonymous,
      },
      include: { employee: true, cycle: true },
    });
    await this.notifyUser(
      user.organisationId,
      reviewer.id,
      'Performance review assigned',
      `You have been asked to complete ${cycle.name} for ${employee.firstName} ${employee.lastName}.`,
      `/employee/performance?reviewId=${review.id}`,
    );
    await this.audit(user, AuditAction.CREATE, 'PerformanceReview', review.id,
      'Performance reviewer assigned.', {
        employeeId: employee.id,
        reviewerType: dto.reviewerType,
      });
    return review;
  }

  listReviews(user: CurrentUser, employeeId?: string, cycleId?: string) {
    return this.prisma.performanceReview.findMany({
      where: {
        organisationId: user.organisationId,
        ...(employeeId ? { employeeId } : {}),
        ...(cycleId ? { cycleId } : {}),
      },
      include: this.reviewInclude(),
      orderBy: { updatedAt: 'desc' },
    });
  }

  myAssignments(user: CurrentUser) {
    return this.prisma.performanceReview.findMany({
      where: {
        organisationId: user.organisationId,
        reviewerUserId: user.id,
      },
      include: this.reviewInclude(),
      orderBy: [{ status: 'asc' }, { cycle: { dueDate: 'asc' } }],
    });
  }

  async getReview(user: CurrentUser, id: string, allowOrganisationView = false) {
    const review = await this.prisma.performanceReview.findFirst({
      where: { id, organisationId: user.organisationId },
      include: this.reviewInclude(),
    });
    if (!review) throw new NotFoundException('Performance review not found.');
    if (!allowOrganisationView && review.reviewerUserId !== user.id)
      throw new ForbiddenException('This review is assigned to another reviewer.');
    return review;
  }

  async saveReview(user: CurrentUser, id: string, dto: SavePerformanceReviewDto) {
    const review = await this.getReview(user, id);
    if (['COMPLETED', 'CANCELLED'].includes(review.status))
      throw new BadRequestException('This review can no longer be edited.');
    const updated = await this.prisma.performanceReview.update({
      where: { id },
      data: {
        answers: dto.answers as Prisma.InputJsonValue,
        overallScore: dto.overallScore,
        strengths: dto.strengths?.trim(),
        developmentAreas: dto.developmentAreas?.trim(),
        status: 'IN_PROGRESS',
      },
    });
    await this.audit(user, AuditAction.UPDATE, 'PerformanceReview', id,
      'Performance review draft saved.');
    return updated;
  }

  async submitReview(user: CurrentUser, id: string, dto: SavePerformanceReviewDto) {
    const review = await this.getReview(user, id);
    const questions = review.cycle.template.questions as unknown as Array<{
      id: string;
      required?: boolean;
    }>;
    const missing = questions
      .filter((question) => question.required && !dto.answers[question.id])
      .map((question) => question.id);
    if (missing.length)
      throw new BadRequestException(`Complete required questions: ${missing.join(', ')}.`);
    const updated = await this.prisma.performanceReview.update({
      where: { id },
      data: {
        answers: dto.answers as Prisma.InputJsonValue,
        overallScore: dto.overallScore,
        strengths: dto.strengths?.trim(),
        developmentAreas: dto.developmentAreas?.trim(),
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
    });
    await this.notifyPerformanceManagers(
      user.organisationId,
      'Performance review submitted',
      `${review.employee.firstName} ${review.employee.lastName}'s assigned review has been submitted.`,
      `/dashboard/performance/reviews/${id}`,
    );
    await this.audit(user, AuditAction.UPDATE, 'PerformanceReview', id,
      'Performance review submitted.');
    return updated;
  }

  async finaliseReview(
    user: CurrentUser,
    id: string,
    dto: FinalisePerformanceReviewDto,
  ) {
    const review = await this.getReview(user, id, true);
    if (review.status !== PerformanceReviewStatus.SUBMITTED)
      throw new BadRequestException('Only a submitted review can be finalised.');
    const updated = await this.prisma.performanceReview.update({
      where: { id },
      data: {
        managerSummary: dto.managerSummary.trim(),
        finalOutcome: dto.finalOutcome.trim(),
        finalisedByUserId: user.id,
        finalisedAt: new Date(),
        status: 'AWAITING_ACKNOWLEDGEMENT',
      },
    });
    if (review.employee.userId) {
      await this.notifyUser(
        user.organisationId,
        review.employee.userId,
        'Performance review ready',
        'Your completed performance review is ready for your acknowledgement.',
        `/employee/performance?reviewId=${id}`,
      );
    }
    await this.audit(user, AuditAction.APPROVE, 'PerformanceReview', id,
      'Performance review finalised.');
    return updated;
  }

  async acknowledge(user: CurrentUser, id: string, dto: AcknowledgePerformanceReviewDto) {
    const employee = await this.prisma.employee.findFirst({
      where: { userId: user.id, organisationId: user.organisationId },
    });
    if (!employee) throw new NotFoundException('Employee profile not found.');
    const review = await this.prisma.performanceReview.findFirst({
      where: {
        id,
        organisationId: user.organisationId,
        employeeId: employee.id,
        status: 'AWAITING_ACKNOWLEDGEMENT',
      },
    });
    if (!review)
      throw new NotFoundException('Review awaiting your acknowledgement not found.');
    const updated = await this.prisma.performanceReview.update({
      where: { id },
      data: {
        employeeAcknowledgedAt: new Date(),
        employeeComments: dto.employeeComments?.trim(),
        status: 'COMPLETED',
      },
    });
    await this.audit(user, AuditAction.APPROVE, 'PerformanceReview', id,
      'Employee acknowledged performance review.');
    return updated;
  }

  async employeeSummary(user: CurrentUser, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, organisationId: user.organisationId },
      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        lastName: true,
        jobTitle: true,
        department: { select: { name: true } },
      },
    });
    if (!employee) throw new NotFoundException('Employee not found.');
    const [reviews, goals, developmentPlans] = await Promise.all([
      this.prisma.performanceReview.findMany({
        where: {
          organisationId: user.organisationId,
          employeeId,
          status: { in: ['AWAITING_ACKNOWLEDGEMENT', 'COMPLETED'] },
        },
        include: { cycle: { include: { template: true } } },
        orderBy: { finalisedAt: 'desc' },
      }),
      this.prisma.performanceGoal.findMany({
        where: { organisationId: user.organisationId, employeeId },
        orderBy: { targetDate: 'asc' },
      }),
      this.prisma.performanceDevelopmentPlan.findMany({
        where: { organisationId: user.organisationId, employeeId },
        orderBy: { targetDate: 'asc' },
      }),
    ]);
    return { employee, reviews, goals, developmentPlans };
  }

  async myPerformance(user: CurrentUser) {
    const employee = await this.prisma.employee.findFirst({
      where: { userId: user.id, organisationId: user.organisationId },
    });
    if (!employee) throw new NotFoundException('Employee profile not found.');
    const summary = await this.employeeSummary(user, employee.id);
    return {
      ...summary,
      assignments: await this.myAssignments(user),
    };
  }

  listGoals(user: CurrentUser, employeeId?: string) {
    return this.prisma.performanceGoal.findMany({
      where: {
        organisationId: user.organisationId,
        ...(employeeId ? { employeeId } : {}),
      },
      include: { employee: true },
      orderBy: { targetDate: 'asc' },
    });
  }

  async createGoal(user: CurrentUser, dto: CreatePerformanceGoalDto) {
    await this.assertEmployee(user, dto.employeeId);
    const goal = await this.prisma.performanceGoal.create({
      data: {
        organisationId: user.organisationId,
        employeeId: dto.employeeId,
        reviewId: dto.reviewId,
        title: dto.title.trim(),
        description: dto.description?.trim(),
        successMeasure: dto.successMeasure?.trim(),
        priority: dto.priority ?? 'MEDIUM',
        targetDate: new Date(dto.targetDate),
        createdByUserId: user.id,
      },
    });
    await this.audit(user, AuditAction.CREATE, 'PerformanceGoal', goal.id,
      'Performance goal created.');
    return goal;
  }

  async updateGoal(user: CurrentUser, id: string, dto: UpdatePerformanceGoalDto) {
    const goal = await this.prisma.performanceGoal.findFirst({
      where: { id, organisationId: user.organisationId },
    });
    if (!goal) throw new NotFoundException('Performance goal not found.');
    return this.prisma.performanceGoal.update({
      where: { id },
      data: {
        ...dto,
        completedAt: dto.status === 'COMPLETED' ? new Date() : undefined,
      },
    });
  }

  listDevelopmentPlans(user: CurrentUser, employeeId?: string) {
    return this.prisma.performanceDevelopmentPlan.findMany({
      where: {
        organisationId: user.organisationId,
        ...(employeeId ? { employeeId } : {}),
      },
      include: { employee: true },
      orderBy: { targetDate: 'asc' },
    });
  }

  async createDevelopmentPlan(user: CurrentUser, dto: CreateDevelopmentPlanDto) {
    await this.assertEmployee(user, dto.employeeId);
    const plan = await this.prisma.performanceDevelopmentPlan.create({
      data: {
        organisationId: user.organisationId,
        employeeId: dto.employeeId,
        reviewId: dto.reviewId,
        title: dto.title.trim(),
        developmentNeed: dto.developmentNeed.trim(),
        actionPlan: dto.actionPlan.trim(),
        supportRequired: dto.supportRequired?.trim(),
        targetDate: new Date(dto.targetDate),
        createdByUserId: user.id,
      },
    });
    await this.audit(user, AuditAction.CREATE, 'PerformanceDevelopmentPlan', plan.id,
      'Development plan created.');
    return plan;
  }

  async updateDevelopmentPlan(
    user: CurrentUser,
    id: string,
    dto: UpdateDevelopmentPlanDto,
  ) {
    const plan = await this.prisma.performanceDevelopmentPlan.findFirst({
      where: { id, organisationId: user.organisationId },
    });
    if (!plan) throw new NotFoundException('Development plan not found.');
    return this.prisma.performanceDevelopmentPlan.update({
      where: { id },
      data: {
        ...dto,
        completedAt: dto.status === 'COMPLETED' ? new Date() : undefined,
      },
    });
  }

  listCompetencies(user: CurrentUser) {
    return this.prisma.performanceCompetency.findMany({
      where: { organisationId: user.organisationId },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  createCompetency(user: CurrentUser, dto: CreateCompetencyDto) {
    return this.prisma.performanceCompetency.create({
      data: {
        organisationId: user.organisationId,
        name: dto.name.trim(),
        description: dto.description?.trim(),
        category: dto.category.trim(),
        behaviouralIndicators:
          (dto.behaviouralIndicators ?? []) as Prisma.InputJsonValue,
        createdByUserId: user.id,
      },
    });
  }

  private async assertEmployee(user: CurrentUser, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, organisationId: user.organisationId },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException('Employee not found.');
  }

  private reviewInclude() {
    return {
      employee: {
        select: {
          id: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
          jobTitle: true,
          userId: true,
          department: { select: { name: true } },
        },
      },
      reviewerUser: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      cycle: { include: { template: true } },
      goals: true,
      developmentPlans: true,
    } as const;
  }

  private notifyUser(
    organisationId: string,
    userId: string,
    title: string,
    message: string,
    href: string,
  ) {
    return this.prisma.employeeNotification.create({
      data: {
        organisationId,
        userId,
        category: 'PERFORMANCE',
        title,
        message,
        href,
      },
    });
  }

  private async notifyPerformanceManagers(
    organisationId: string,
    title: string,
    message: string,
    href: string,
  ) {
    const users = await this.prisma.user.findMany({
      where: {
        organisationId,
        userRoles: {
          some: {
            role: {
              rolePermissions: {
                some: { permission: { key: 'performance:finalise' } },
              },
            },
          },
        },
      },
      select: { id: true },
    });
    await this.prisma.employeeNotification.createMany({
      data: users.map((item) => ({
        organisationId,
        userId: item.id,
        category: 'PERFORMANCE' as const,
        title,
        message,
        href,
      })),
      skipDuplicates: true,
    });
  }

  private audit(
    user: CurrentUser,
    action: AuditAction,
    entity: string,
    entityId: string,
    message: string,
    metadata?: Record<string, unknown>,
  ) {
    return this.prisma.auditLog.create({
      data: {
        organisationId: user.organisationId,
        actorUserId: user.id,
        action,
        entity,
        entityId,
        message,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  }
}
