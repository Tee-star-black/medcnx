import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  AuditAction,
  PayrollAuditFindingStatus,
  PayrollAuditSeverity,
  PayrollRunStatus,
} from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';

import { canTransitionPayrollStatus } from './payroll-status-transitions';

@Injectable()
export class PayrollWorkflowService {
  constructor(private readonly prisma: PrismaService) {}

  async transitionStatus(
    organisationId: string,
    payrollRunId: string,
    nextStatus: PayrollRunStatus,
    actorUserId?: string,
    note?: string,
  ) {
    const payrollRun = await this.prisma.payrollRun.findFirst({
      where: {
        id: payrollRunId,
        organisationId,
      },
      include: {
        audit: {
          include: {
            findings: true,
          },
        },
      },
    });

    if (!payrollRun) {
      throw new NotFoundException('Payroll run not found.');
    }

    if (!canTransitionPayrollStatus(payrollRun.status, nextStatus)) {
      throw new BadRequestException(
        `Payroll cannot move from ${payrollRun.status} to ${nextStatus}.`,
      );
    }

    await this.validateTransition(
      payrollRun.status,
      nextStatus,
      payrollRun.audit,
    );

    if (nextStatus === PayrollRunStatus.FINALISED) {
      const [itemCount, missingPayslipCount] = await Promise.all([
        this.prisma.payrollRunItem.count({
          where: { organisationId, payrollRunId },
        }),
        this.prisma.payrollRunItem.count({
          where: {
            organisationId,
            payrollRunId,
            payslipDocumentId: null,
          },
        }),
      ]);

      if (itemCount === 0) {
        throw new BadRequestException(
          'A payroll run with no employee items cannot be finalised.',
        );
      }

      if (missingPayslipCount > 0) {
        throw new BadRequestException(
          `Generate all payslips before finalising payroll. ${missingPayslipCount} payslip${
            missingPayslipCount === 1 ? ' is' : 's are'
          } still missing.`,
        );
      }
    }

    if (nextStatus === PayrollRunStatus.PAYMENT_PROCESSING) {
      const bankExport = await this.prisma.payrollTimelineEvent.findFirst({
        where: {
          organisationId,
          payrollRunId,
          eventType: 'PAYROLL_BANK_FILE_EXPORTED',
        },
        select: { id: true },
      });

      if (!bankExport) {
        throw new BadRequestException(
          'Generate and review the bank payment file before starting payment processing.',
        );
      }
    }

    return this.prisma.$transaction(async (transaction) => {
      const updatedPayrollRun = await transaction.payrollRun.update({
        where: {
          id: payrollRun.id,
        },
        data: {
          status: nextStatus,
          lockedAt:
            nextStatus === PayrollRunStatus.DRAFT ? null : undefined,
          lockedByUserId:
            nextStatus === PayrollRunStatus.DRAFT ? null : undefined,
          lockReason:
            nextStatus === PayrollRunStatus.DRAFT ? null : undefined,
          finalisedByUserId:
            nextStatus === PayrollRunStatus.FINALISED ? actorUserId : undefined,
          finalisedAt:
            nextStatus === PayrollRunStatus.FINALISED ? new Date() : undefined,
        },
      });

      if (nextStatus === PayrollRunStatus.FINALISED) {
        const linkedPayslips = await transaction.payrollRunItem.findMany({
          where: {
            payrollRunId,
            payslipDocumentId: { not: null },
          },
          select: { payslipDocumentId: true },
        });

        await transaction.employeeDocument.updateMany({
          where: {
            id: {
              in: linkedPayslips
                .map((item) => item.payslipDocumentId)
                .filter((id): id is string => Boolean(id)),
            },
            organisationId,
          },
          data: { visibleToEmployee: true },
        });
      }

      await transaction.payrollTimelineEvent.create({
        data: {
          organisationId,
          payrollRunId,
          actorUserId,
          eventType: this.getTimelineEventType(nextStatus),
          title: this.getTimelineTitle(nextStatus),
          message:
            note ?? `Payroll moved from ${payrollRun.status} to ${nextStatus}.`,
          metadata: {
            previousStatus: payrollRun.status,
            nextStatus,
          },
        },
      });

      await transaction.auditLog.create({
        data: {
          organisationId,
          actorUserId,
          action: AuditAction.UPDATE,
          entity: 'PayrollRun',
          entityId: payrollRunId,
          message: `Payroll status changed from ${payrollRun.status} to ${nextStatus}.`,
          metadata: {
            payrollRunId,
            previousStatus: payrollRun.status,
            nextStatus,
            note: note ?? null,
          },
        },
      });

      return updatedPayrollRun;
    });
  }

  private async validateTransition(
    currentStatus: PayrollRunStatus,
    nextStatus: PayrollRunStatus,
    audit: {
      blocked: boolean;
      findings: Array<{
        severity: PayrollAuditSeverity;
        status: PayrollAuditFindingStatus;
      }>;
    } | null,
  ): Promise<void> {
    if (nextStatus === PayrollRunStatus.HR_REVIEWED) {
      if (!audit) {
        throw new BadRequestException(
          'Payroll intelligence audit must be completed before HR review.',
        );
      }

      const unresolvedCriticalFindings = audit.findings.filter(
        (finding) =>
          finding.severity === PayrollAuditSeverity.CRITICAL &&
          finding.status !== PayrollAuditFindingStatus.RESOLVED,
      );

      if (audit.blocked || unresolvedCriticalFindings.length > 0) {
        throw new BadRequestException(
          'Critical payroll findings must be resolved before HR review.',
        );
      }
    }

    if (
      nextStatus === PayrollRunStatus.FINANCE_REVIEWED &&
      currentStatus !== PayrollRunStatus.HR_REVIEWED
    ) {
      throw new BadRequestException(
        'HR review must be completed before finance review.',
      );
    }

    if (
      nextStatus === PayrollRunStatus.PENDING_CEO_APPROVAL &&
      currentStatus !== PayrollRunStatus.FINANCE_REVIEWED
    ) {
      throw new BadRequestException(
        'Finance review must be completed before CEO approval preparation.',
      );
    }

    if (
      nextStatus === PayrollRunStatus.CEO_APPROVED &&
      currentStatus !== PayrollRunStatus.PENDING_CEO_APPROVAL
    ) {
      throw new BadRequestException(
        'Payroll must be pending CEO approval before it can be approved.',
      );
    }
  }

  private getTimelineEventType(status: PayrollRunStatus): string {
    const eventTypes: Partial<Record<PayrollRunStatus, string>> = {
      [PayrollRunStatus.CALCULATED]: 'PAYROLL_CALCULATED',
      [PayrollRunStatus.AI_AUDITED]: 'PAYROLL_INTELLIGENCE_COMPLETED',
      [PayrollRunStatus.HR_REVIEWED]: 'PAYROLL_HR_REVIEWED',
      [PayrollRunStatus.FINANCE_REVIEWED]: 'PAYROLL_FINANCE_REVIEWED',
      [PayrollRunStatus.PENDING_CEO_APPROVAL]: 'PAYROLL_SENT_FOR_CEO_APPROVAL',
      [PayrollRunStatus.CEO_APPROVED]: 'PAYROLL_CEO_APPROVED',
      [PayrollRunStatus.PAYMENT_PROCESSING]: 'PAYROLL_PAYMENT_PROCESSING',
      [PayrollRunStatus.PAID]: 'PAYROLL_PAID',
      [PayrollRunStatus.COMPLETED]: 'PAYROLL_COMPLETED',
      [PayrollRunStatus.FINALISED]: 'PAYROLL_FINALISED',
      [PayrollRunStatus.REJECTED]: 'PAYROLL_REJECTED',
      [PayrollRunStatus.CANCELLED]: 'PAYROLL_CANCELLED',
    };

    return eventTypes[status] ?? 'PAYROLL_STATUS_CHANGED';
  }

  private getTimelineTitle(status: PayrollRunStatus): string {
    const titles: Partial<Record<PayrollRunStatus, string>> = {
      [PayrollRunStatus.CALCULATED]: 'Payroll calculated',
      [PayrollRunStatus.AI_AUDITED]: 'Payroll intelligence completed',
      [PayrollRunStatus.HR_REVIEWED]: 'HR review completed',
      [PayrollRunStatus.FINANCE_REVIEWED]: 'Finance review completed',
      [PayrollRunStatus.PENDING_CEO_APPROVAL]: 'Payroll sent for CEO approval',
      [PayrollRunStatus.CEO_APPROVED]: 'CEO approval completed',
      [PayrollRunStatus.PAYMENT_PROCESSING]: 'Payment processing started',
      [PayrollRunStatus.PAID]: 'Payroll marked as paid',
      [PayrollRunStatus.COMPLETED]: 'Payroll completed',
      [PayrollRunStatus.FINALISED]: 'Payroll finalised',
      [PayrollRunStatus.REJECTED]: 'Payroll rejected',
      [PayrollRunStatus.CANCELLED]: 'Payroll cancelled',
    };

    return titles[status] ?? 'Payroll status updated';
  }
}
