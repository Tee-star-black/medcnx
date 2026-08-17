import { Injectable } from '@nestjs/common';
import { PayrollAuditSeverity } from '@prisma/client';
import { PayrollAuditContext } from '../interfaces/payroll-audit-context.interface';
import {
  PayrollAuditRule,
  PayrollAuditRuleFinding,
} from '../interfaces/payroll-audit-rule.interface';

@Injectable()
export class DuplicateBankAccountRule implements PayrollAuditRule {
  readonly code = 'DUPLICATE_BANK_ACCOUNT';
  readonly name = 'Duplicate bank account';
  readonly description = 'Detects multiple employees paid into one account.';

  async evaluate(
    context: PayrollAuditContext,
  ): Promise<PayrollAuditRuleFinding[]> {
    const accounts = new Map<string, typeof context.payrollRun.items>();
    for (const item of context.payrollRun.items) {
      const account = item.employee.compensationProfile?.bankAccountNumber
        ?.replace(/\s+/g, '')
        .toLowerCase();
      if (!account) continue;
      accounts.set(account, [...(accounts.get(account) ?? []), item]);
    }

    return [...accounts.values()]
      .filter((items) => items.length > 1)
      .flatMap((items) =>
        items.map((item) => ({
          employeeId: item.employeeId,
          ruleCode: this.code,
          severity: PayrollAuditSeverity.CRITICAL,
          title: 'Duplicate bank account detected',
          description: `${item.employee.firstName} ${item.employee.lastName} shares a bank account with another employee in this payroll run.`,
          currentValue: item.netPay,
          metadata: {
            payrollRunItemId: item.id,
            matchingEmployeeIds: items.map((entry) => entry.employeeId),
          },
        })),
      );
  }
}
