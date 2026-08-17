import { Injectable } from '@nestjs/common';
import { PayrollAuditSeverity } from '@prisma/client';
import { PayrollAuditContext } from '../interfaces/payroll-audit-context.interface';
import {
  PayrollAuditRule,
  PayrollAuditRuleFinding,
} from '../interfaces/payroll-audit-rule.interface';

@Injectable()
export class UnusualOvertimeRule implements PayrollAuditRule {
  readonly code = 'UNUSUAL_OVERTIME';
  readonly name = 'Unusual overtime';
  readonly description =
    'Detects overtime above 25% of basic salary or R5,000.';

  async evaluate(
    context: PayrollAuditContext,
  ): Promise<PayrollAuditRuleFinding[]> {
    return context.payrollRun.items
      .filter((item) => {
        const threshold = Math.max(item.basicSalary.toNumber() * 0.25, 5000);
        return item.overtime.toNumber() > threshold;
      })
      .map((item) => ({
        employeeId: item.employeeId,
        ruleCode: this.code,
        severity: PayrollAuditSeverity.HIGH,
        title: 'Unusual overtime cost',
        description: `${item.employee.firstName} ${item.employee.lastName} has overtime of R${item.overtime.toFixed(2)}, above the expected threshold.`,
        currentValue: item.overtime,
        varianceRate:
          item.basicSalary.toNumber() > 0
            ? item.overtime.toNumber() / item.basicSalary.toNumber()
            : null,
        metadata: {
          payrollRunItemId: item.id,
          basicSalary: item.basicSalary.toFixed(2),
        },
      }));
  }
}
