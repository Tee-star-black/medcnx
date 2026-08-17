import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { GetCurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import type { CurrentUser } from '../../auth/types/current-user.type';

import { PAYROLL_PERMISSIONS } from '../payroll.permissions';
import { AcknowledgeFindingDto } from './dto/acknowledge-finding.dto';
import { ResolveFindingDto } from './dto/resolve-finding.dto';
import { PayrollIntelligenceService } from './payroll-intelligence.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('payroll/runs/:payrollRunId/intelligence')
export class PayrollIntelligenceController {
  constructor(
    private readonly payrollIntelligenceService: PayrollIntelligenceService,
  ) {}

  @Post('run')
  @RequirePermissions(PAYROLL_PERMISSIONS.RUN_AUDIT)
  runAudit(
    @Param('payrollRunId') payrollRunId: string,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.payrollIntelligenceService.runAudit(
      user.organisationId,
      payrollRunId,
      user.id,
    );
  }

  @Get()
  @RequirePermissions(PAYROLL_PERMISSIONS.VIEW_FINDINGS)
  getAudit(
    @Param('payrollRunId') payrollRunId: string,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.payrollIntelligenceService.getAudit(
      user.organisationId,
      payrollRunId,
    );
  }

  @Patch('findings/:findingId/acknowledge')
  @RequirePermissions(PAYROLL_PERMISSIONS.RESOLVE_FINDINGS)
  acknowledgeFinding(
    @Param('payrollRunId') payrollRunId: string,
    @Param('findingId') findingId: string,
    @Body() dto: AcknowledgeFindingDto,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.payrollIntelligenceService.acknowledgeFinding(
      user.organisationId,
      payrollRunId,
      findingId,
      user.id,
      dto.note,
    );
  }

  @Patch('findings/:findingId/resolve')
  @RequirePermissions(PAYROLL_PERMISSIONS.RESOLVE_FINDINGS)
  resolveFinding(
    @Param('payrollRunId') payrollRunId: string,
    @Param('findingId') findingId: string,
    @Body() dto: ResolveFindingDto,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.payrollIntelligenceService.resolveFinding(
      user.organisationId,
      payrollRunId,
      findingId,
      user.id,
      dto.resolutionNote,
    );
  }
}
