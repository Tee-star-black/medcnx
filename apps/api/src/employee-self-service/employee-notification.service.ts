import { Injectable, Logger } from '@nestjs/common';
import { EmployeeNotificationCategory } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

type EmployeeNotificationInput = {
  organisationId: string;
  employeeId: string;
  category: EmployeeNotificationCategory;
  title: string;
  message: string;
  href?: string;
};

@Injectable()
export class EmployeeNotificationService {
  private readonly logger = new Logger(EmployeeNotificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async notifyEmployee(input: EmployeeNotificationInput) {
    try {
      const employee = await this.prisma.employee.findFirst({
        where: {
          id: input.employeeId,
          organisationId: input.organisationId,
        },
        select: { userId: true },
      });

      if (!employee?.userId) {
        return null;
      }

      return await this.prisma.employeeNotification.create({
        data: {
          organisationId: input.organisationId,
          userId: employee.userId,
          category: input.category,
          title: input.title,
          message: input.message,
          href: input.href,
        },
      });
    } catch (error) {
      this.logger.error(
        `Could not create employee notification for ${input.employeeId}.`,
        error instanceof Error ? error.stack : undefined,
      );
      return null;
    }
  }
}
