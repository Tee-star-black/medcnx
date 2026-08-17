import { Injectable } from '@nestjs/common';
import type { CurrentUser } from '../auth/types/current-user.type';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: CurrentUser) {
    return this.prisma.auditLog.findMany({
      where: {
        organisationId: user.organisationId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
      include: {
        actor: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        employee: {
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
            email: true,
            jobTitle: true,
          },
        },
      },
    });
  }
}
