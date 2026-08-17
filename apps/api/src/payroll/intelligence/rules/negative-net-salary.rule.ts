import {
  Injectable,
} from '@nestjs/common';

import {
  PayrollAuditSeverity,
} from '@prisma/client';

import {
  PayrollAuditRule,
  PayrollAuditRuleFinding,
} from '../interfaces/payroll-audit-rule.interface';

import {
  PayrollAuditContext,
} from '../interfaces/payroll-audit-context.interface';

@Injectable()
export class NegativeNetSalaryRule
  implements PayrollAuditRule
{
  readonly code = 'NEGATIVE_NET_SALARY';

  readonly name = 'Negative net salary';

  readonly description =
    'Detects employees whose payroll calculation resulted in a negative net salary.';

  async evaluate(
    context: PayrollAuditContext,
  ): Promise<PayrollAuditRuleFinding[]> {
    return context.payrollRun.items
      .filter(
        (item) => item.netPay.lessThan(0),
      )
      .map((item) => ({
        employeeId: item.employeeId,
        ruleCode: this.code,
        severity: PayrollAuditSeverity.CRITICAL,
        title: 'Negative net salary',
        description:
          `${item.employee.firstName} ${item.employee.lastName} ` +
          `has a negative net salary of R${item.netPay.toFixed(2)}.`,
        currentValue: item.netPay,
        metadata: {
          payrollRunItemId: item.id,
          grossPay: item.grossPay.toFixed(2),
          totalDeductions:
            item.totalDeductions.toFixed(2),
        },
      }));
  }
}
