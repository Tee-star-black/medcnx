import { Injectable, NotFoundException } from '@nestjs/common';
import { EmploymentStatus } from '@prisma/client';
import type { CurrentUser } from '../auth/types/current-user.type';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ManagerPerformanceService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(user: CurrentUser) {
    const manager = await this.prisma.employee.findFirst({
      where: {
        organisationId: user.organisationId,
        userId: user.id,
      },
      select: { id: true },
    });

    if (!manager) {
      throw new NotFoundException('No employee profile is linked to the current user.');
    }

    const directReports = await this.prisma.employee.findMany({
      where: {
        organisationId: user.organisationId,
        managerId: manager.id,
        employmentStatus: {
          notIn: [EmploymentStatus.TERMINATED, EmploymentStatus.RESIGNED],
        },
      },
      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        lastName: true,
        jobTitle: true,
      },
    });

    const directReportIds = directReports.map((employee) => employee.id);

    if (directReportIds.length === 0) {
      return {
        metrics: {
          assignedReviews: 0,
          overdueReviews: 0,
          activeGoals: 0,
          activeDevelopmentPlans: 0,
        },
        reviews: [],
        goals: [],
        developmentPlans: [],
      };
    }

    const now = new Date();

    const [reviews, goals, developmentPlans] = await Promise.all([
      this.prisma.performanceReview.findMany({
        where: {
          organisationId: user.organisationId,
          reviewerUserId: user.id,
          employeeId: { in: directReportIds },
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
        select: {
          id: true,
          employeeId: true,
          status: true,
          reviewerType: true,
          updatedAt: true,
          employee: {
            select: {
              id: true,
              employeeNumber: true,
              firstName: true,
              lastName: true,
              jobTitle: true,
            },
          },
          cycle: {
            select: {
              id: true,
              name: true,
              dueDate: true,
            },
          },
        },
        orderBy: { cycle: { dueDate: 'asc' } },
      }),
      this.prisma.performanceGoal.findMany({
        where: {
          organisationId: user.organisationId,
          employeeId: { in: directReportIds },
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
        select: {
          id: true,
          employeeId: true,
          title: true,
          status: true,
          priority: true,
          progress: true,
          targetDate: true,
          employee: {
            select: {
              id: true,
              employeeNumber: true,
              firstName: true,
              lastName: true,
              jobTitle: true,
            },
          },
        },
        orderBy: { targetDate: 'asc' },
        take: 20,
      }),
      this.prisma.performanceDevelopmentPlan.findMany({
        where: {
          organisationId: user.organisationId,
          employeeId: { in: directReportIds },
          status: { in: ['PLANNED', 'IN_PROGRESS'] },
        },
        select: {
          id: true,
          employeeId: true,
          title: true,
          status: true,
          targetDate: true,
          employee: {
            select: {
              id: true,
              employeeNumber: true,
              firstName: true,
              lastName: true,
              jobTitle: true,
            },
          },
        },
        orderBy: { targetDate: 'asc' },
        take: 20,
      }),
    ]);

    return {
      metrics: {
        assignedReviews: reviews.length,
        overdueReviews: reviews.filter((review) => review.cycle.dueDate < now).length,
        activeGoals: goals.length,
        activeDevelopmentPlans: developmentPlans.length,
      },
      reviews,
      goals,
      developmentPlans,
    };
  }
}
