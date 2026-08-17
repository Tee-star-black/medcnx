import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';

import { GetCurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import type { CurrentUser } from '../auth/types/current-user.type';

import { CreatePayrollRunDto } from './dto/create-payroll-run.dto';
import { UpdatePayrollRunItemInputsDto } from './dto/update-payroll-run-item-inputs.dto';
import { PAYROLL_PERMISSIONS } from './payroll.permissions';
import { PayrollRunsService } from './payroll-runs.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('payroll/runs')
export class PayrollRunsController {
  constructor(private readonly payrollRunsService: PayrollRunsService) {}

  @RequirePermissions(PAYROLL_PERMISSIONS.READ)
  @Get()
  listPayrollRuns(@GetCurrentUser() user: CurrentUser) {
    return this.payrollRunsService.listPayrollRuns(user);
  }

  @RequirePermissions(PAYROLL_PERMISSIONS.CREATE)
  @Post()
  createPayrollRun(
    @GetCurrentUser() user: CurrentUser,
    @Body() dto: CreatePayrollRunDto,
  ) {
    return this.payrollRunsService.createPayrollRun(user, dto);
  }

  @RequirePermissions(PAYROLL_PERMISSIONS.EXPORT)
  @Get(':payrollRunId/export')
  async exportPayrollRegister(
    @GetCurrentUser() user: CurrentUser,
    @Param('payrollRunId') payrollRunId: string,
    @Res() response: Response,
  ) {
    const exportFile = await this.payrollRunsService.exportPayrollRegister(
      user,
      payrollRunId,
    );

    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${exportFile.fileName}"`,
    );
    response.send(exportFile.content);
  }

  @RequirePermissions(PAYROLL_PERMISSIONS.READ)
  @Get(':payrollRunId')
  getPayrollRun(
    @GetCurrentUser() user: CurrentUser,
    @Param('payrollRunId') payrollRunId: string,
  ) {
    return this.payrollRunsService.getPayrollRun(user, payrollRunId);
  }

  @RequirePermissions(PAYROLL_PERMISSIONS.CALCULATE)
  @Post(':payrollRunId/calculate')
  calculatePayrollRun(
    @GetCurrentUser() user: CurrentUser,
    @Param('payrollRunId') payrollRunId: string,
  ) {
    return this.payrollRunsService.calculatePayrollRun(user, payrollRunId);
  }

  @RequirePermissions(PAYROLL_PERMISSIONS.UPDATE_INPUTS)
  @Patch(':payrollRunId/items/:payrollRunItemId/inputs')
  updatePayrollRunItemInputs(
    @GetCurrentUser() user: CurrentUser,
    @Param('payrollRunId') payrollRunId: string,
    @Param('payrollRunItemId') payrollRunItemId: string,
    @Body() dto: UpdatePayrollRunItemInputsDto,
  ) {
    return this.payrollRunsService.updatePayrollRunItemInputs(
      user,
      payrollRunId,
      payrollRunItemId,
      dto,
    );
  }

  @RequirePermissions(PAYROLL_PERMISSIONS.PAYSLIPS_GENERATE)
  @Post(':payrollRunId/generate-payslips')
  generatePayrollRunPayslips(
    @GetCurrentUser() user: CurrentUser,
    @Param('payrollRunId') payrollRunId: string,
  ) {
    return this.payrollRunsService.generatePayrollRunPayslips(
      user,
      payrollRunId,
    );
  }

  @RequirePermissions(PAYROLL_PERMISSIONS.EXPORT_BANK_FILE)
  @Post(':payrollRunId/bank-export')
  async exportBankPaymentFile(
    @GetCurrentUser() user: CurrentUser,
    @Param('payrollRunId') payrollRunId: string,
    @Res() response: Response,
  ) {
    const exportFile = await this.payrollRunsService.exportBankPaymentFile(
      user,
      payrollRunId,
    );

    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${exportFile.fileName}"`,
    );
    response.send(exportFile.content);
  }

  @RequirePermissions(PAYROLL_PERMISSIONS.FINALISE)
  @Patch(':payrollRunId/finalise')
  finalisePayrollRun(
    @GetCurrentUser() user: CurrentUser,
    @Param('payrollRunId') payrollRunId: string,
  ) {
    return this.payrollRunsService.finalisePayrollRun(user, payrollRunId);
  }

  @RequirePermissions(PAYROLL_PERMISSIONS.REJECT)
  @Patch(':payrollRunId/cancel')
  cancelPayrollRun(
    @GetCurrentUser() user: CurrentUser,
    @Param('payrollRunId') payrollRunId: string,
  ) {
    return this.payrollRunsService.cancelPayrollRun(user, payrollRunId);
  }

  @RequirePermissions(PAYROLL_PERMISSIONS.DELETE_DRAFT)
  @Delete(':payrollRunId')
  deletePayrollRun(
    @GetCurrentUser() user: CurrentUser,
    @Param('payrollRunId') payrollRunId: string,
  ) {
    return this.payrollRunsService.deletePayrollRun(user, payrollRunId);
  }
}
