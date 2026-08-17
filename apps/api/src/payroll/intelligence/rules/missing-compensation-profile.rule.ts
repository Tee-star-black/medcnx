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
export class MissingCompensationProfileRule
  implements PayrollAuditRule
{
  readonly code = 'MISSING_COMPENSATION_PROFILE';

  readonly name = 'Missing compensation profile';

  readonly description =
    'Detects employees included in payroll without an active compensation profile.';

  async evaluate(
    context: PayrollAuditContext,
  ): Promise<PayrollAuditRuleFinding[]> {
    return context.payrollRun.items
      .filter(
        (item) =>
          !item.employee.compensationProfile,
      )
      .map((item) => ({
        employeeId: item.employeeId,
        ruleCode: this.code,
        severity: PayrollAuditSeverity.CRITICAL,
        title: 'Missing compensation profile',
        description:
          `${item.employee.firstName} ${item.employee.lastName} ` +
          'is included in payroll but does not have a compensation profile.',
        metadata: {
          payrollRunItemId: item.id,
          employeeNumber:
            item.employee.employeeNumber,
        },
      }));
  }
}
