import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';

import { PayrollIntelligenceController } from './payroll-intelligence.controller';
import { PayrollAuditContextService } from './payroll-audit-context.service';
import { PayrollHealthScoreService } from './payroll-health-score.service';
import { PayrollIntelligenceService } from './payroll-intelligence.service';

import { MissingCompensationProfileRule } from './rules/missing-compensation-profile.rule';
import { NegativeNetSalaryRule } from './rules/negative-net-salary.rule';
import { TerminatedEmployeeRule } from './rules/terminated-employee.rule';
import { DuplicateBankAccountRule } from './rules/duplicate-bank-account.rule';
import { DuplicateEmployeePaymentRule } from './rules/duplicate-employee-payment.rule';
import { MissingBankDetailsRule } from './rules/missing-bank-details.rule';
import { PayrollTotalSpikeRule } from './rules/payroll-total-spike.rule';
import { UnusualOvertimeRule } from './rules/unusual-overtime.rule';

@Module({
  imports: [DatabaseModule],

  controllers: [
    PayrollIntelligenceController,
  ],

  providers: [
    PayrollIntelligenceService,
    PayrollAuditContextService,
    PayrollHealthScoreService,
    MissingCompensationProfileRule,
    NegativeNetSalaryRule,
    TerminatedEmployeeRule,
    DuplicateBankAccountRule,
    DuplicateEmployeePaymentRule,
    MissingBankDetailsRule,
    PayrollTotalSpikeRule,
    UnusualOvertimeRule,
  ],

  exports: [
    PayrollIntelligenceService,
  ],
})
export class PayrollIntelligenceModule {}
