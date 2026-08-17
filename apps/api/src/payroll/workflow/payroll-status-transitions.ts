import { PayrollRunStatus } from '@prisma/client';

export const PAYROLL_STATUS_TRANSITIONS: Record<
  PayrollRunStatus,
  PayrollRunStatus[]
> = {
  [PayrollRunStatus.DRAFT]: [
    PayrollRunStatus.CALCULATED,
    PayrollRunStatus.CANCELLED,
  ],

  [PayrollRunStatus.CALCULATED]: [
    PayrollRunStatus.AI_AUDITED,
    PayrollRunStatus.REJECTED,
    PayrollRunStatus.CANCELLED,
  ],

  [PayrollRunStatus.AI_AUDITED]: [
    PayrollRunStatus.HR_REVIEWED,
    PayrollRunStatus.REJECTED,
  ],

  [PayrollRunStatus.HR_REVIEWED]: [
    PayrollRunStatus.FINANCE_REVIEWED,
    PayrollRunStatus.REJECTED,
  ],

  [PayrollRunStatus.FINANCE_REVIEWED]: [
    PayrollRunStatus.PENDING_CEO_APPROVAL,
    PayrollRunStatus.REJECTED,
  ],

  [PayrollRunStatus.PENDING_CEO_APPROVAL]: [
    PayrollRunStatus.CEO_APPROVED,
    PayrollRunStatus.REJECTED,
  ],

  [PayrollRunStatus.CEO_APPROVED]: [
    PayrollRunStatus.PAYMENT_PROCESSING,
    PayrollRunStatus.REJECTED,
  ],

  [PayrollRunStatus.PAYMENT_PROCESSING]: [
    PayrollRunStatus.PAID,
    PayrollRunStatus.REJECTED,
  ],

  [PayrollRunStatus.PAID]: [
    PayrollRunStatus.COMPLETED,
  ],

  [PayrollRunStatus.COMPLETED]: [
    PayrollRunStatus.FINALISED,
  ],

  [PayrollRunStatus.FINALISED]: [],

  [PayrollRunStatus.REJECTED]: [
    PayrollRunStatus.DRAFT,
    PayrollRunStatus.CANCELLED,
  ],

  [PayrollRunStatus.CANCELLED]: [],
};

export function canTransitionPayrollStatus(
  currentStatus: PayrollRunStatus,
  nextStatus: PayrollRunStatus,
): boolean {
  return PAYROLL_STATUS_TRANSITIONS[currentStatus].includes(
    nextStatus,
  );
}
