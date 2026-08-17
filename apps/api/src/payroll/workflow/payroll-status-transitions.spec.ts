import { PayrollRunStatus } from '@prisma/client';
import { canTransitionPayrollStatus } from './payroll-status-transitions';

describe('Payroll status transitions', () => {
  it('allows the controlled happy path', () => {
    const path: PayrollRunStatus[] = [
      PayrollRunStatus.DRAFT,
      PayrollRunStatus.CALCULATED,
      PayrollRunStatus.AI_AUDITED,
      PayrollRunStatus.HR_REVIEWED,
      PayrollRunStatus.FINANCE_REVIEWED,
      PayrollRunStatus.PENDING_CEO_APPROVAL,
      PayrollRunStatus.CEO_APPROVED,
      PayrollRunStatus.PAYMENT_PROCESSING,
      PayrollRunStatus.PAID,
      PayrollRunStatus.COMPLETED,
      PayrollRunStatus.FINALISED,
    ];

    for (let index = 0; index < path.length - 1; index += 1) {
      expect(canTransitionPayrollStatus(path[index], path[index + 1])).toBe(
        true,
      );
    }
  });

  it('prevents approval before HR and finance review', () => {
    expect(
      canTransitionPayrollStatus(
        PayrollRunStatus.CALCULATED,
        PayrollRunStatus.CEO_APPROVED,
      ),
    ).toBe(false);
  });

  it('prevents finalising an unpaid run', () => {
    expect(
      canTransitionPayrollStatus(
        PayrollRunStatus.CEO_APPROVED,
        PayrollRunStatus.FINALISED,
      ),
    ).toBe(false);
  });

  it('prevents changes after finalisation', () => {
    expect(
      canTransitionPayrollStatus(
        PayrollRunStatus.FINALISED,
        PayrollRunStatus.DRAFT,
      ),
    ).toBe(false);
  });

  it('allows a rejected payroll to be formally returned to draft', () => {
    expect(
      canTransitionPayrollStatus(
        PayrollRunStatus.REJECTED,
        PayrollRunStatus.DRAFT,
      ),
    ).toBe(true);
  });

  it.each([
    PayrollRunStatus.CALCULATED,
    PayrollRunStatus.AI_AUDITED,
    PayrollRunStatus.HR_REVIEWED,
    PayrollRunStatus.FINANCE_REVIEWED,
    PayrollRunStatus.PENDING_CEO_APPROVAL,
    PayrollRunStatus.CEO_APPROVED,
    PayrollRunStatus.PAYMENT_PROCESSING,
    PayrollRunStatus.PAID,
    PayrollRunStatus.COMPLETED,
    PayrollRunStatus.FINALISED,
  ])(
    'does not allow %s to bypass the controlled return-to-draft path',
    (status) => {
      expect(canTransitionPayrollStatus(status, PayrollRunStatus.DRAFT)).toBe(
        false,
      );
    },
  );
});
