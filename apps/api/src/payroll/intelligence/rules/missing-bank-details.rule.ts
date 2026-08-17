import { Injectable } from '@nestjs/common';
import { PayrollAuditSeverity } from '@prisma/client';
import { PayrollAuditContext } from '../interfaces/payroll-audit-context.interface';
import {
  PayrollAuditRule,
  PayrollAuditRuleFinding,
} from '../interfaces/payroll-audit-rule.interface';

@Injectable()
export class MissingBankDetailsRule implements PayrollAuditRule {
  readonly code = 'MISSING_BANK_DETAILS';
  readonly name = 'Missing bank details';
  readonly description = 'Detects employees without complete payment details.';

  async evaluate(
    context: PayrollAuditContext,
  ): Promise<PayrollAuditRuleFinding[]> {
    return context.payrollRun.items
      .filter((item) => {
        const profile = item.employee.compensationProfile;
        return (
          !profile?.bankName?.trim() ||
          !profile.bankAccountNumber?.trim() ||
          !profile.paymentReference?.trim()
        );
      })
      .map((item) => ({
        employeeId: item.employeeId,
        ruleCode: this.code,
        severity: PayrollAuditSeverity.CRITICAL,
        title: 'Incomplete bank details',
        description: `${item.employee.firstName} ${item.employee.lastName} cannot be paid because banking information is incomplete.`,
        currentValue: item.netPay,
        metadata: {
          payrollRunItemId: item.id,
          employeeNumber: item.employee.employeeNumber,
        },
      }));
  }
}
