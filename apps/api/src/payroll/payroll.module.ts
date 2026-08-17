import { Module } from '@nestjs/common';

import { PayrollCompensationController } from './payroll-compensation.controller';
import { PayrollCompensationService } from './payroll-compensation.service';

import { PayrollRunsController } from './payroll-runs.controller';
import { PayrollRunsService } from './payroll-runs.service';

import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';

import { PayrollIntelligenceModule } from './intelligence/payroll-intelligence.module';

import { PayrollWorkflowController } from './workflow/payroll-workflow.controller';
import { PayrollWorkflowService } from './workflow/payroll-workflow.service';
import { PayrollTimelineService } from './workflow/payroll-timeline.service';

import { PayrollApprovalController } from './approvals/payroll-approval.controller';
import { PayrollApprovalPreparationService } from './approvals/payroll-approval-preparation.service';
import { PayrollApprovalOtpService } from './approvals/payroll-approval-otp.service';
import { EmployeeSelfServiceModule } from '../employee-self-service/employee-self-service.module';

@Module({
  imports: [
    PayrollIntelligenceModule,
    EmployeeSelfServiceModule,
  ],

  controllers: [
    PayrollController,
    PayrollCompensationController,
    PayrollRunsController,
    PayrollWorkflowController,
    PayrollApprovalController,
  ],

  providers: [
    PayrollService,
    PayrollCompensationService,
    PayrollRunsService,
    PayrollWorkflowService,
    PayrollTimelineService,
    PayrollApprovalPreparationService,
    PayrollApprovalOtpService,
  ],

  exports: [
    PayrollWorkflowService,
    PayrollTimelineService,
    PayrollApprovalPreparationService,
    PayrollApprovalOtpService,
  ],
})
export class PayrollModule {}
