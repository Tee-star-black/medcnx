import {
  Injectable,
} from '@nestjs/common';

import {
  EmploymentStatus,
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
export class TerminatedEmployeeRule
  implements PayrollAuditRule
{
  readonly code = 'TERMINATED_EMPLOYEE_INCLUDED';

  readonly name = 'Terminated employee included';

  readonly description =
    'Detects employees included in payroll after termination.';

  async evaluate(
    context: PayrollAuditContext,
  ): Promise<PayrollAuditRuleFinding[]> {
    return context.payrollRun.items
      .filter(
        (item) =>
          item.employee.employmentStatus ===
          EmploymentStatus.TERMINATED,
      )
      .map((item) => ({
        employeeId: item.employeeId,
        ruleCode: this.code,
        severity: PayrollAuditSeverity.CRITICAL,
        title: 'Terminated employee included',
        description:
          `${item.employee.firstName} ${item.employee.lastName} ` +
          'is marked as terminated but is included in this payroll run.',
        currentValue: item.netPay,
        metadata: {
          payrollRunItemId: item.id,
          employeeNumber:
            item.employee.employeeNumber,
          employmentStatus:
            item.employee.employmentStatus,
          terminationDate:
            item.employee.endDate?.toISOString() ??
            null,
        },
      }));
  }
}
