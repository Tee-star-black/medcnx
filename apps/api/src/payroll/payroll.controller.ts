import { Body, Controller, Post, UseGuards } from '@nestjs/common';

import { GetCurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import type { CurrentUser } from '../auth/types/current-user.type';

import { CalculatePayslipDto } from './dto/calculate-payslip.dto';
import { GeneratePayslipDto } from './dto/generate-payslip.dto';
import { PAYROLL_PERMISSIONS } from './payroll.permissions';
import { PayrollService } from './payroll.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('payroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @RequirePermissions(PAYROLL_PERMISSIONS.CALCULATE)
  @Post('calculate-payslip')
  calculatePayslip(
    @GetCurrentUser() user: CurrentUser,
    @Body() dto: CalculatePayslipDto,
  ) {
    return this.payrollService.calculatePayslip(user, dto);
  }

  @RequirePermissions(PAYROLL_PERMISSIONS.PAYSLIPS_GENERATE)
  @Post('generate-payslip')
  generatePayslip(
    @GetCurrentUser() user: CurrentUser,
    @Body() dto: GeneratePayslipDto,
  ) {
    return this.payrollService.generatePayslip(user, dto);
  }

  @RequirePermissions(PAYROLL_PERMISSIONS.PAYSLIPS_GENERATE)
  @Post('generate-payslip/save')
  savePayslip(
    @GetCurrentUser() user: CurrentUser,
    @Body() dto: GeneratePayslipDto,
  ) {
    return this.payrollService.savePayslip(user, dto);
  }
}
