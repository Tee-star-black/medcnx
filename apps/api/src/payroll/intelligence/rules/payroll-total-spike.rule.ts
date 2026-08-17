import { Injectable } from '@nestjs/common';
import { PayrollAuditSeverity } from '@prisma/client';
import { PayrollAuditContext } from '../interfaces/payroll-audit-context.interface';
import {
  PayrollAuditRule,
  PayrollAuditRuleFinding,
} from '../interfaces/payroll-audit-rule.interface';

@Injectable()
export class PayrollTotalSpikeRule implements PayrollAuditRule {
  readonly code = 'PAYROLL_TOTAL_SPIKE';
  readonly name = 'Payroll total spike';
  readonly description =
    'Detects a gross-payroll increase above 25% and R10,000.';

  async evaluate(
    context: PayrollAuditContext,
  ): Promise<PayrollAuditRuleFinding[]> {
    const previous = context.previousPayrollRun?.totalGrossPay.toNumber() ?? 0;
    const current = context.payrollRun.totalGrossPay.toNumber();
    if (previous <= 0) return [];

    const variance = current - previous;
    const varianceRate = variance / previous;
    if (variance <= 10000 || varianceRate <= 0.25) return [];

    return [
      {
        ruleCode: this.code,
        severity: PayrollAuditSeverity.HIGH,
        title: 'Payroll total increased significantly',
        description: `Gross payroll increased by R${variance.toFixed(2)} (${(
          varianceRate * 100
        ).toFixed(1)}%) compared with the previous completed run.`,
        currentValue: current,
        previousValue: previous,
        varianceValue: variance,
        varianceRate,
      },
    ];
  }
}
