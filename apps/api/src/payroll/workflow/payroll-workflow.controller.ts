import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PayrollRunStatus } from '@prisma/client';

import { GetCurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import type { CurrentUser } from '../../auth/types/current-user.type';

import { PAYROLL_PERMISSIONS } from '../payroll.permissions';
import { PayrollReviewDto } from './dto/payroll-review.dto';
import { ReturnPayrollToDraftDto } from './dto/return-payroll-to-draft.dto';
import { PayrollTimelineService } from './payroll-timeline.service';
import { PayrollWorkflowService } from './payroll-workflow.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('payroll/runs/:payrollRunId/workflow')
export class PayrollWorkflowController {
  constructor(
    private readonly payrollWorkflowService: PayrollWorkflowService,
    private readonly payrollTimelineService: PayrollTimelineService,
  ) {}

  @Post('hr-review')
  @RequirePermissions(PAYROLL_PERMISSIONS.HR_REVIEW)
  completeHrReview(
    @Param('payrollRunId') payrollRunId: string,
    @Body() dto: PayrollReviewDto,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.payrollWorkflowService.transitionStatus(
      user.organisationId,
      payrollRunId,
      PayrollRunStatus.HR_REVIEWED,
      user.id,
      dto.note ?? 'HR review completed.',
    );
  }

  @Post('finance-review')
  @RequirePermissions(PAYROLL_PERMISSIONS.FINANCE_REVIEW)
  completeFinanceReview(
    @Param('payrollRunId') payrollRunId: string,
    @Body() dto: PayrollReviewDto,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.payrollWorkflowService.transitionStatus(
      user.organisationId,
      payrollRunId,
      PayrollRunStatus.FINANCE_REVIEWED,
      user.id,
      dto.note ?? 'Finance review completed.',
    );
  }

  @Post('submit-for-ceo-approval')
  @RequirePermissions(PAYROLL_PERMISSIONS.SUBMIT)
  submitForCeoApproval(
    @Param('payrollRunId') payrollRunId: string,
    @Body() dto: PayrollReviewDto,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.payrollWorkflowService.transitionStatus(
      user.organisationId,
      payrollRunId,
      PayrollRunStatus.PENDING_CEO_APPROVAL,
      user.id,
      dto.note ?? 'Payroll submitted for CEO approval.',
    );
  }

  @Post('reject')
  @RequirePermissions(PAYROLL_PERMISSIONS.REJECT)
  rejectPayroll(
    @Param('payrollRunId') payrollRunId: string,
    @Body() dto: PayrollReviewDto,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.payrollWorkflowService.transitionStatus(
      user.organisationId,
      payrollRunId,
      PayrollRunStatus.REJECTED,
      user.id,
      dto.note ?? 'Payroll rejected.',
    );
  }

  @Post('return-to-draft')
  @RequirePermissions(PAYROLL_PERMISSIONS.REOPEN)
  returnPayrollToDraft(
    @Param('payrollRunId') payrollRunId: string,
    @Body() dto: ReturnPayrollToDraftDto,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.payrollWorkflowService.transitionStatus(
      user.organisationId,
      payrollRunId,
      PayrollRunStatus.DRAFT,
      user.id,
      dto.reason,
    );
  }

  @Post('start-payment-processing')
  @RequirePermissions(PAYROLL_PERMISSIONS.FINALISE)
  startPaymentProcessing(
    @Param('payrollRunId') payrollRunId: string,
    @Body() dto: PayrollReviewDto,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.payrollWorkflowService.transitionStatus(
      user.organisationId,
      payrollRunId,
      PayrollRunStatus.PAYMENT_PROCESSING,
      user.id,
      dto.note ?? 'Payroll payment processing started.',
    );
  }

  @Post('mark-paid')
  @RequirePermissions(PAYROLL_PERMISSIONS.FINALISE)
  markPaid(
    @Param('payrollRunId') payrollRunId: string,
    @Body() dto: PayrollReviewDto,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.payrollWorkflowService.transitionStatus(
      user.organisationId,
      payrollRunId,
      PayrollRunStatus.PAID,
      user.id,
      dto.note ?? 'Employee payments confirmed.',
    );
  }

  @Post('complete')
  @RequirePermissions(PAYROLL_PERMISSIONS.FINALISE)
  completePayroll(
    @Param('payrollRunId') payrollRunId: string,
    @Body() dto: PayrollReviewDto,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.payrollWorkflowService.transitionStatus(
      user.organisationId,
      payrollRunId,
      PayrollRunStatus.COMPLETED,
      user.id,
      dto.note ?? 'Payroll payment checks completed.',
    );
  }

  @Post('finalise')
  @RequirePermissions(PAYROLL_PERMISSIONS.FINALISE)
  finalisePayroll(
    @Param('payrollRunId') payrollRunId: string,
    @Body() dto: PayrollReviewDto,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.payrollWorkflowService.transitionStatus(
      user.organisationId,
      payrollRunId,
      PayrollRunStatus.FINALISED,
      user.id,
      dto.note ?? 'Payroll run finalised and locked.',
    );
  }

  @Get('timeline')
  @RequirePermissions(PAYROLL_PERMISSIONS.READ)
  getTimeline(
    @Param('payrollRunId') payrollRunId: string,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.payrollTimelineService.getTimeline(
      user.organisationId,
      payrollRunId,
    );
  }
}
