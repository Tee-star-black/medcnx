import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';

interface CreatePayrollTimelineEventInput {
  organisationId: string;
  payrollRunId: string;
  actorUserId?: string;
  eventType: string;
  title: string;
  message?: string;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class PayrollTimelineService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async createEvent(
    input: CreatePayrollTimelineEventInput,
  ) {
    return this.prisma.payrollTimelineEvent.create({
      data: {
        organisationId: input.organisationId,
        payrollRunId: input.payrollRunId,
        actorUserId: input.actorUserId,
        eventType: input.eventType,
        title: input.title,
        message: input.message,
        metadata: input.metadata,
      },
    });
  }

  async getTimeline(
    organisationId: string,
    payrollRunId: string,
  ) {
    return this.prisma.payrollTimelineEvent.findMany({
      where: {
        organisationId,
        payrollRunId,
      },
      include: {
        actor: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }
}
