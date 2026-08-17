import { Injectable } from '@nestjs/common';
import { PayrollAuditSeverity } from '@prisma/client';
import { PayrollAuditContext } from '../interfaces/payroll-audit-context.interface';
import {
  PayrollAuditRule,
  PayrollAuditRuleFinding,
} from '../interfaces/payroll-audit-rule.interface';

@Injectable()
export class DuplicateEmployeePaymentRule implements PayrollAuditRule {
  readonly code = 'DUPLICATE_EMPLOYEE_PAYMENT';
  readonly name = 'Duplicate employee payment';
  readonly description = 'Detects repeated employee entries in a payroll run.';

  async evaluate(
    context: PayrollAuditContext,
  ): Promise<PayrollAuditRuleFinding[]> {
    const counts = new Map<string, number>();
    for (const item of context.payrollRun.items) {
      counts.set(item.employeeId, (counts.get(item.employeeId) ?? 0) + 1);
    }

    return context.payrollRun.items
      .filter((item) => (counts.get(item.employeeId) ?? 0) > 1)
      .map((item) => ({
        employeeId: item.employeeId,
        ruleCode: this.code,
        severity: PayrollAuditSeverity.CRITICAL,
        title: 'Duplicate employee payment',
        description: `${item.employee.firstName} ${item.employee.lastName} appears more than once in this payroll run.`,
        currentValue: item.netPay,
        metadata: { payrollRunItemId: item.id },
      }));
  }
}
