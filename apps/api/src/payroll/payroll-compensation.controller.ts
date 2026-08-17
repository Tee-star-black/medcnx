import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';

import { GetCurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import type { CurrentUser } from '../auth/types/current-user.type';

import { UpsertCompensationProfileDto } from './dto/upsert-compensation-profile.dto';
import { PayrollCompensationService } from './payroll-compensation.service';
import { PAYROLL_PERMISSIONS } from './payroll.permissions';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('payroll/employees')
export class PayrollCompensationController {
  constructor(
    private readonly payrollCompensationService: PayrollCompensationService,
  ) {}

  @RequirePermissions(PAYROLL_PERMISSIONS.COMPENSATION_READ)
  @Get(':employeeId/compensation')
  getCompensationProfile(
    @GetCurrentUser() user: CurrentUser,
    @Param('employeeId') employeeId: string,
  ) {
    return this.payrollCompensationService.getCompensationProfile(
      user,
      employeeId,
    );
  }

  @RequirePermissions(PAYROLL_PERMISSIONS.COMPENSATION_UPDATE)
  @Patch(':employeeId/compensation')
  updateCompensationProfile(
    @GetCurrentUser() user: CurrentUser,
    @Param('employeeId') employeeId: string,
    @Body() dto: UpsertCompensationProfileDto,
  ) {
    return this.payrollCompensationService.upsertCompensationProfile(
      user,
      employeeId,
      dto,
    );
  }
}
