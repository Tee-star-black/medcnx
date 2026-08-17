import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { GetCurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import type { CurrentUser } from '../../auth/types/current-user.type';

import { PAYROLL_PERMISSIONS } from '../payroll.permissions';
import { PayrollApprovalOtpService } from './payroll-approval-otp.service';
import { PayrollApprovalPreparationService } from './payroll-approval-preparation.service';
import { PrepareCeoApprovalDto } from './prepare-ceo-approval.dto';
import { RequestCeoApprovalOtpDto } from './request-ceo-approval-otp.dto';
import { VerifyCeoApprovalOtpDto } from './verify-ceo-approval-otp.dto';

interface RequestMetadata {
  ip?: string;

  headers: {
    [key: string]: string | string[] | undefined;
  };
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('payroll/runs/:payrollRunId/approvals')
export class PayrollApprovalController {
  constructor(
    private readonly payrollApprovalPreparationService: PayrollApprovalPreparationService,
    private readonly payrollApprovalOtpService: PayrollApprovalOtpService,
  ) {}

  @Post('ceo/prepare')
  @RequirePermissions(PAYROLL_PERMISSIONS.SUBMIT)
  prepareCeoApproval(
    @Param('payrollRunId') payrollRunId: string,
    @Body() dto: PrepareCeoApprovalDto,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.payrollApprovalPreparationService.prepareCeoApproval(
      user.organisationId,
      payrollRunId,
      user.id,
      dto.approverUserId,
      dto.requestNote,
    );
  }

  @Get('ceo/approvers')
  @RequirePermissions(PAYROLL_PERMISSIONS.SUBMIT)
  listCeoApprovers(@GetCurrentUser() user: CurrentUser) {
    return this.payrollApprovalPreparationService.listCeoApprovers(
      user.organisationId,
      user.id,
    );
  }

  @Get('ceo')
  @RequirePermissions(PAYROLL_PERMISSIONS.READ)
  getCeoApproval(
    @Param('payrollRunId') payrollRunId: string,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.payrollApprovalPreparationService.getCeoApproval(
      user.organisationId,
      payrollRunId,
    );
  }

  @Post('ceo/otp/request')
  @RequirePermissions(PAYROLL_PERMISSIONS.APPROVE)
  requestCeoApprovalOtp(
    @Param('payrollRunId') payrollRunId: string,
    @Body() dto: RequestCeoApprovalOtpDto,
    @Req() request: RequestMetadata,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.payrollApprovalOtpService.requestCeoApprovalOtp(
      user.organisationId,
      payrollRunId,
      user.id,
      {
        ipAddress: this.getIpAddress(request),
        userAgent: this.getUserAgent(request),
      },
      dto.note,
    );
  }

  @Post('ceo/otp/verify')
  @RequirePermissions(PAYROLL_PERMISSIONS.APPROVE)
  verifyCeoApprovalOtp(
    @Param('payrollRunId') payrollRunId: string,
    @Body() dto: VerifyCeoApprovalOtpDto,
    @Req() request: RequestMetadata,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.payrollApprovalOtpService.verifyCeoApprovalOtp(
      user.organisationId,
      payrollRunId,
      user.id,
      dto.challengeId,
      dto.code,
      {
        ipAddress: this.getIpAddress(request),
        userAgent: this.getUserAgent(request),
      },
      dto.decisionNote,
    );
  }

  private getIpAddress(request: RequestMetadata): string | undefined {
    const forwardedFor = request.headers['x-forwarded-for'];

    if (typeof forwardedFor === 'string') {
      return forwardedFor.split(',')[0]?.trim();
    }

    if (Array.isArray(forwardedFor)) {
      return forwardedFor[0];
    }

    return request.ip;
  }

  private getUserAgent(request: RequestMetadata): string | undefined {
    const userAgent = request.headers['user-agent'];

    if (Array.isArray(userAgent)) {
      return userAgent[0];
    }

    return userAgent;
  }
}
