import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

import {
  PayrollAuditFindingStatus,
  PayrollAuditSeverity,
  PayrollRunStatus,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';

import { PayrollAuditContextService } from './payroll-audit-context.service';
import { PayrollHealthScoreService } from './payroll-health-score.service';

import {
  PayrollAuditRule,
  PayrollAuditRuleFinding,
} from './interfaces/payroll-audit-rule.interface';

import { MissingCompensationProfileRule } from './rules/missing-compensation-profile.rule';
import { NegativeNetSalaryRule } from './rules/negative-net-salary.rule';
import { TerminatedEmployeeRule } from './rules/terminated-employee.rule';
import { DuplicateBankAccountRule } from './rules/duplicate-bank-account.rule';
import { DuplicateEmployeePaymentRule } from './rules/duplicate-employee-payment.rule';
import { MissingBankDetailsRule } from './rules/missing-bank-details.rule';
import { PayrollTotalSpikeRule } from './rules/payroll-total-spike.rule';
import { UnusualOvertimeRule } from './rules/unusual-overtime.rule';

@Injectable()
export class PayrollIntelligenceService {
  private readonly rules: PayrollAuditRule[];

  constructor(
    private readonly prisma: PrismaService,
    private readonly contextService: PayrollAuditContextService,
    private readonly healthScoreService: PayrollHealthScoreService,
    private readonly missingCompensationProfileRule: MissingCompensationProfileRule,
    private readonly negativeNetSalaryRule: NegativeNetSalaryRule,
    private readonly terminatedEmployeeRule: TerminatedEmployeeRule,
    private readonly duplicateBankAccountRule: DuplicateBankAccountRule,
    private readonly duplicateEmployeePaymentRule: DuplicateEmployeePaymentRule,
    private readonly missingBankDetailsRule: MissingBankDetailsRule,
    private readonly payrollTotalSpikeRule: PayrollTotalSpikeRule,
    private readonly unusualOvertimeRule: UnusualOvertimeRule,
  ) {
    this.rules = [
      this.missingCompensationProfileRule,
      this.negativeNetSalaryRule,
      this.terminatedEmployeeRule,
      this.duplicateBankAccountRule,
      this.duplicateEmployeePaymentRule,
      this.missingBankDetailsRule,
      this.payrollTotalSpikeRule,
      this.unusualOvertimeRule,
    ];
  }

  async runAudit(
    organisationId: string,
    payrollRunId: string,
    analysedById?: string,
  ) {
    const context = await this.contextService.buildContext(
      organisationId,
      payrollRunId,
    );

    const allowedStatuses: PayrollRunStatus[] = [
      PayrollRunStatus.CALCULATED,
      PayrollRunStatus.AI_AUDITED,
    ];

    if (!allowedStatuses.includes(context.payrollRun.status)) {
      throw new BadRequestException(
        `Payroll intelligence cannot run while payroll is in ${context.payrollRun.status} status.`,
      );
    }

    const ruleResults = await Promise.all(
      this.rules.map((rule) => rule.evaluate(context)),
    );

    const findings = ruleResults.flat();

    const scoreResult =
      this.healthScoreService.calculate(findings);

    const summary = this.buildSummary(
      scoreResult.healthScore,
      scoreResult.riskLevel,
      findings,
    );

    return this.prisma.$transaction(
      async (transaction) => {
        const existingAudit =
          await transaction.payrollAudit.findUnique({
            where: {
              payrollRunId,
            },
            select: {
              id: true,
            },
          });

        if (existingAudit) {
          await transaction.payrollAuditFinding.deleteMany({
            where: {
              payrollAuditId: existingAudit.id,
            },
          });
        }

        const audit =
          await transaction.payrollAudit.upsert({
            where: {
              payrollRunId,
            },
            create: {
              organisationId,
              payrollRunId,
              healthScore: scoreResult.healthScore,
              riskLevel: scoreResult.riskLevel,
              criticalCount: scoreResult.criticalCount,
              highCount: scoreResult.highCount,
              warningCount: scoreResult.warningCount,
              infoCount: scoreResult.infoCount,
              blocked: scoreResult.blocked,
              summary,
              analysedById,
              analysedAt: new Date(),
              findings: {
                create: findings.map((finding) =>
                  this.mapFinding(
                    organisationId,
                    finding,
                  ),
                ),
              },
            },
            update: {
              healthScore: scoreResult.healthScore,
              riskLevel: scoreResult.riskLevel,
              criticalCount: scoreResult.criticalCount,
              highCount: scoreResult.highCount,
              warningCount: scoreResult.warningCount,
              infoCount: scoreResult.infoCount,
              blocked: scoreResult.blocked,
              summary,
              analysedById,
              analysedAt: new Date(),
              findings: {
                create: findings.map((finding) =>
                  this.mapFinding(
                    organisationId,
                    finding,
                  ),
                ),
              },
            },
            include: {
              findings: {
                orderBy: [
                  {
                    severity: 'desc',
                  },
                  {
                    createdAt: 'asc',
                  },
                ],
              },
            },
          });

        await transaction.payrollRun.update({
          where: {
            id: payrollRunId,
          },
          data: {
            status: PayrollRunStatus.AI_AUDITED,
            lockedAt: context.payrollRun.lockedAt ?? new Date(),
            lockedByUserId:
              context.payrollRun.lockedByUserId ?? analysedById,
            lockReason:
              context.payrollRun.lockReason ??
              'Payroll inputs locked when the intelligence review started.',
          },
        });

        await transaction.payrollTimelineEvent.create({
          data: {
            organisationId,
            payrollRunId,
            actorUserId: analysedById,
            eventType:
              'PAYROLL_INTELLIGENCE_COMPLETED',
            title:
              'Payroll intelligence audit completed',
            message: scoreResult.blocked
              ? `Payroll audit completed with a health score of ${scoreResult.healthScore}. Critical findings must be resolved before submission.`
              : `Payroll audit completed successfully with a health score of ${scoreResult.healthScore}.`,
            metadata: {
              healthScore: scoreResult.healthScore,
              riskLevel: scoreResult.riskLevel,
              blocked: scoreResult.blocked,
              totalFindings: findings.length,
              criticalCount:
                scoreResult.criticalCount,
              highCount: scoreResult.highCount,
              warningCount:
                scoreResult.warningCount,
              infoCount: scoreResult.infoCount,
            },
          },
        });

        return audit;
      },
    );
  }

  async getAudit(
    organisationId: string,
    payrollRunId: string,
  ) {
    const audit =
      await this.prisma.payrollAudit.findFirst({
        where: {
          organisationId,
          payrollRunId,
        },
        include: {
          findings: {
            include: {
              employee: {
                select: {
                  id: true,
                  employeeNumber: true,
                  firstName: true,
                  lastName: true,
                },
              },
              acknowledgedBy: {
                select: {
                  id: true,
                  email: true,
                },
              },
              resolvedBy: {
                select: {
                  id: true,
                  email: true,
                },
              },
            },
            orderBy: [
              {
                severity: 'desc',
              },
              {
                createdAt: 'asc',
              },
            ],
          },
        },
      });

    if (!audit) {
      throw new BadRequestException(
        'Payroll intelligence audit has not been completed.',
      );
    }

    return audit;
  }

  async acknowledgeFinding(
    organisationId: string,
    payrollRunId: string,
    findingId: string,
    userId: string,
    note?: string,
  ) {
    const finding =
      await this.prisma.payrollAuditFinding.findFirst({
        where: {
          id: findingId,
          organisationId,
          payrollAudit: {
            payrollRunId,
          },
        },
      });

    if (!finding) {
      throw new BadRequestException(
        'Payroll audit finding was not found.',
      );
    }

    if (
      finding.status ===
      PayrollAuditFindingStatus.RESOLVED
    ) {
      throw new BadRequestException(
        'Resolved findings cannot be acknowledged.',
      );
    }

    const existingMetadata =
      this.getJsonObject(finding.metadata);

    return this.prisma.$transaction(
      async (transaction) => {
        const updatedFinding =
          await transaction.payrollAuditFinding.update({
            where: {
              id: finding.id,
            },
            data: {
              status:
                PayrollAuditFindingStatus.ACKNOWLEDGED,
              acknowledgedById: userId,
              acknowledgedAt: new Date(),
              metadata: {
                ...existingMetadata,
                acknowledgementNote: note ?? null,
              },
            },
          });

        await transaction.payrollTimelineEvent.create({
          data: {
            organisationId,
            payrollRunId,
            actorUserId: userId,
            eventType:
              'PAYROLL_FINDING_ACKNOWLEDGED',
            title:
              'Payroll finding acknowledged',
            message: finding.title,
            metadata: {
              findingId: finding.id,
              ruleCode: finding.ruleCode,
              severity: finding.severity,
              note: note ?? null,
            },
          },
        });

        return updatedFinding;
      },
    );
  }

  async resolveFinding(
    organisationId: string,
    payrollRunId: string,
    findingId: string,
    userId: string,
    resolutionNote: string,
  ) {
    const finding =
      await this.prisma.payrollAuditFinding.findFirst({
        where: {
          id: findingId,
          organisationId,
          payrollAudit: {
            payrollRunId,
          },
        },
      });

    if (!finding) {
      throw new BadRequestException(
        'Payroll audit finding was not found.',
      );
    }

    if (
      finding.status ===
      PayrollAuditFindingStatus.RESOLVED
    ) {
      throw new BadRequestException(
        'This finding has already been resolved.',
      );
    }

    return this.prisma.$transaction(
      async (transaction) => {
        const updatedFinding =
          await transaction.payrollAuditFinding.update({
            where: {
              id: finding.id,
            },
            data: {
              status:
                PayrollAuditFindingStatus.RESOLVED,
              resolvedById: userId,
              resolvedAt: new Date(),
              resolutionNote,
            },
          });

        const openCriticalCount =
          await transaction.payrollAuditFinding.count({
            where: {
              payrollAuditId:
                finding.payrollAuditId,
              severity:
                PayrollAuditSeverity.CRITICAL,
              status: {
                not:
                  PayrollAuditFindingStatus.RESOLVED,
              },
            },
          });

        await transaction.payrollAudit.update({
          where: {
            id: finding.payrollAuditId,
          },
          data: {
            blocked: openCriticalCount > 0,
          },
        });

        await transaction.payrollTimelineEvent.create({
          data: {
            organisationId,
            payrollRunId,
            actorUserId: userId,
            eventType:
              'PAYROLL_FINDING_RESOLVED',
            title: 'Payroll finding resolved',
            message: finding.title,
            metadata: {
              findingId: finding.id,
              ruleCode: finding.ruleCode,
              severity: finding.severity,
              resolutionNote,
            },
          },
        });

        return updatedFinding;
      },
    );
  }

  private mapFinding(
    organisationId: string,
    finding: PayrollAuditRuleFinding,
  ): Prisma.PayrollAuditFindingCreateWithoutPayrollAuditInput {
    return {
      organisation: {
        connect: {
          id: organisationId,
        },
      },

      employee: finding.employeeId
        ? {
            connect: {
              id: finding.employeeId,
            },
          }
        : undefined,

      ruleCode: finding.ruleCode,
      severity: finding.severity,
      status: PayrollAuditFindingStatus.OPEN,
      title: finding.title,
      description: finding.description,

      currentValue:
        finding.currentValue === null ||
        finding.currentValue === undefined
          ? undefined
          : new Prisma.Decimal(
              finding.currentValue,
            ),

      previousValue:
        finding.previousValue === null ||
        finding.previousValue === undefined
          ? undefined
          : new Prisma.Decimal(
              finding.previousValue,
            ),

      varianceValue:
        finding.varianceValue === null ||
        finding.varianceValue === undefined
          ? undefined
          : new Prisma.Decimal(
              finding.varianceValue,
            ),

      varianceRate:
        finding.varianceRate === null ||
        finding.varianceRate === undefined
          ? undefined
          : new Prisma.Decimal(
              finding.varianceRate,
            ),

      metadata: finding.metadata,
    };
  }

  private buildSummary(
    healthScore: number,
    riskLevel: string,
    findings: PayrollAuditRuleFinding[],
  ): string {
    if (findings.length === 0) {
      return (
        'Payroll passed all active intelligence rules ' +
        `with a health score of ${healthScore}.`
      );
    }

    return (
      `Payroll intelligence identified ${findings.length} finding` +
      `${findings.length === 1 ? '' : 's'}. ` +
      `Overall risk level is ${riskLevel} ` +
      `with a health score of ${healthScore}.`
    );
  }

  private getJsonObject(
    value: Prisma.JsonValue | null,
  ): Record<string, Prisma.JsonValue> {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      return value as Record<
        string,
        Prisma.JsonValue
      >;
    }

    return {};
  }
}
