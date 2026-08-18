import { NotFoundException } from '@nestjs/common';
import { ManagerPerformanceService } from './manager-performance.service';

describe('ManagerPerformanceService', () => {
  const user = {
    id: 'user-manager',
    organisationId: 'org-1',
    roles: ['MANAGER'],
    permissions: [],
  } as any;

  function createPrismaMock() {
    return {
      employee: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      performanceReview: {
        findMany: jest.fn(),
      },
      performanceGoal: {
        findMany: jest.fn(),
      },
      performanceDevelopmentPlan: {
        findMany: jest.fn(),
      },
    };
  }

  it('scopes performance work to current direct reports and the signed-in reviewer', async () => {
    const prisma = createPrismaMock();
    prisma.employee.findFirst.mockResolvedValue({ id: 'manager-employee' });
    prisma.employee.findMany.mockResolvedValue([
      {
        id: 'employee-1',
        employeeNumber: 'E001',
        firstName: 'Ada',
        lastName: 'Moyo',
        jobTitle: 'Analyst',
      },
    ]);
    prisma.performanceReview.findMany.mockResolvedValue([]);
    prisma.performanceGoal.findMany.mockResolvedValue([]);
    prisma.performanceDevelopmentPlan.findMany.mockResolvedValue([]);

    const service = new ManagerPerformanceService(prisma as any);
    await service.getOverview(user);

    expect(prisma.performanceReview.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organisationId: 'org-1',
          reviewerUserId: 'user-manager',
          employeeId: { in: ['employee-1'] },
        }),
      }),
    );
    expect(prisma.performanceGoal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ employeeId: { in: ['employee-1'] } }),
      }),
    );
    expect(prisma.performanceDevelopmentPlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ employeeId: { in: ['employee-1'] } }),
      }),
    );
  });

  it('returns an empty overview when the manager has no current direct reports', async () => {
    const prisma = createPrismaMock();
    prisma.employee.findFirst.mockResolvedValue({ id: 'manager-employee' });
    prisma.employee.findMany.mockResolvedValue([]);

    const service = new ManagerPerformanceService(prisma as any);
    const result = await service.getOverview(user);

    expect(result.metrics).toEqual({
      assignedReviews: 0,
      overdueReviews: 0,
      activeGoals: 0,
      activeDevelopmentPlans: 0,
    });
    expect(prisma.performanceReview.findMany).not.toHaveBeenCalled();
  });

  it('rejects accounts without a linked employee profile', async () => {
    const prisma = createPrismaMock();
    prisma.employee.findFirst.mockResolvedValue(null);

    const service = new ManagerPerformanceService(prisma as any);

    await expect(service.getOverview(user)).rejects.toBeInstanceOf(NotFoundException);
  });
});
