import { Injectable, NotFoundException } from '@nestjs/common';
import type { CurrentUser } from '../auth/types/current-user.type';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class PositionHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getPositionHistory(user: CurrentUser, positionId: string) {
    const position = await this.prisma.position.findFirst({
      where: {
        id: positionId,
        organisationId: user.organisationId,
      },
      select: {
        id: true,
        code: true,
        title: true,
        active: true,
      },
    });

    if (!position) {
      throw new NotFoundException('Position not found.');
    }

    const assignments = await this.prisma.employeePositionAssignment.findMany({
      where: {
        organisationId: user.organisationId,
        positionId,
      },
      orderBy: [
        { effectiveTo: 'asc' },
        { effectiveFrom: 'desc' },
      ],
    });

    const employeeIds = [...new Set(assignments.map((assignment) => assignment.employeeId))];
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

    const employeeById = new Map(employees.map((employee) => [employee.id, employee]));

    return {
      position,
      assignments: assignments.map((assignment) => ({
        ...assignment,
        employee: employeeById.get(assignment.employeeId) ?? null,
        current: assignment.effectiveTo === null,
      })),
    };
  }
}
