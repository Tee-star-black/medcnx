import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { PayrollAuditContext } from './interfaces/payroll-audit-context.interface';

@Injectable()
export class PayrollAuditContextService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async buildContext(
    organisationId: string,
    payrollRunId: string,
  ): Promise<PayrollAuditContext> {
    const payrollRun = await this.prisma.payrollRun.findFirst({
      where: {
        id: payrollRunId,
        organisationId,
      },
      include: {
        items: {
          include: {
            employee: {
              include: {
                compensationProfile: true,
              },
            },
          },
        },
      },
    });

    if (!payrollRun) {
      throw new NotFoundException('Payroll run not found.');
    }

    const previousPayrollRun =
      await this.prisma.payrollRun.findFirst({
        where: {
          organisationId,
          id: {
            not: payrollRun.id,
          },
          OR: [
            {
              periodYear: {
                lt: payrollRun.periodYear,
              },
            },
            {
              periodYear: payrollRun.periodYear,
              periodMonth: {
                lt: payrollRun.periodMonth,
              },
            },
          ],
          status: {
            in: [
              'PAID',
              'COMPLETED',
              'FINALISED',
            ],
          },
        },
        include: {
          items: true,
        },
        orderBy: [
          {
            periodYear: 'desc',
          },
          {
            periodMonth: 'desc',
          },
        ],
      });

    return {
      organisationId,
      payrollRun,
      previousPayrollRun,
      generatedAt: new Date(),
    };
  }
}
