import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AttendanceCorrectionStatus } from '@prisma/client';
import type { Response } from 'express';
import { GetCurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import type { CurrentUser } from '../auth/types/current-user.type';
import { AttendanceService } from './attendance.service';
import { ATTENDANCE_PERMISSIONS } from './attendance.permissions';
import { CreateAttendanceCorrectionDto } from './dto/create-attendance-correction.dto';
import { ReviewAttendanceCorrectionDto } from './dto/review-attendance-correction.dto';
import { ManagerAttendanceService } from './manager-attendance.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly managerAttendanceService: ManagerAttendanceService,
  ) {}

  @RequirePermissions(ATTENDANCE_PERMISSIONS.VIEW_ORGANISATION)
  @Get()
  findAll(
    @GetCurrentUser() user: CurrentUser,
    @Query('date') date?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('employeeId') employeeId?: string,
    @Query('departmentId') departmentId?: string,
    @Query('status') status?: string,
  ) {
    return this.attendanceService.findAll(user, {
      date,
      dateFrom,
      dateTo,
      employeeId,
      departmentId,
      status,
    });
  }

  @Get('me')
  @RequirePermissions(ATTENDANCE_PERMISSIONS.VIEW_OWN)
  findMyAttendance(@GetCurrentUser() user: CurrentUser) {
    return this.attendanceService.findMyAttendance(user);
  }

  @Get('me/today')
  @RequirePermissions(ATTENDANCE_PERMISSIONS.VIEW_OWN)
  findMyTodayAttendance(@GetCurrentUser() user: CurrentUser) {
    return this.attendanceService.findMyTodayAttendance(user);
  }

  @Post('clock-in')
  @RequirePermissions(ATTENDANCE_PERMISSIONS.CLOCK_IN)
  clockIn(@GetCurrentUser() user: CurrentUser, @Body('notes') notes?: string) {
    return this.attendanceService.clockIn(user, notes);
  }

  @Post('clock-out')
  @RequirePermissions(ATTENDANCE_PERMISSIONS.CLOCK_OUT)
  clockOut(@GetCurrentUser() user: CurrentUser, @Body('notes') notes?: string) {
    return this.attendanceService.clockOut(user, notes);
  }

  @Get('me/corrections')
  @RequirePermissions(ATTENDANCE_PERMISSIONS.REQUEST_CORRECTION)
  findMyCorrections(@GetCurrentUser() user: CurrentUser) {
    return this.attendanceService.findMyCorrections(user);
  }

  @Post('me/corrections')
  @RequirePermissions(ATTENDANCE_PERMISSIONS.REQUEST_CORRECTION)
  requestCorrection(
    @GetCurrentUser() user: CurrentUser,
    @Body() dto: CreateAttendanceCorrectionDto,
  ) {
    return this.attendanceService.requestCorrection(user, dto);
  }

  @Patch('me/corrections/:correctionId/cancel')
  @RequirePermissions(ATTENDANCE_PERMISSIONS.REQUEST_CORRECTION)
  cancelCorrection(
    @GetCurrentUser() user: CurrentUser,
    @Param('correctionId') correctionId: string,
  ) {
    return this.attendanceService.cancelCorrection(user, correctionId);
  }

  @Get('manager/exceptions')
  findManagerExceptions(
    @GetCurrentUser() user: CurrentUser,
    @Query('days') days?: string,
  ) {
    const parsedDays = days ? Number(days) : 14;
    return this.managerAttendanceService.findExceptions(user, parsedDays);
  }

  @Get('corrections')
  @RequirePermissions(ATTENDANCE_PERMISSIONS.REVIEW_CORRECTIONS)
  findCorrections(
    @GetCurrentUser() user: CurrentUser,
    @Query('status') status?: AttendanceCorrectionStatus,
  ) {
    return this.attendanceService.findCorrections(user, status);
  }

  @Post('corrections/:correctionId/approve')
  @RequirePermissions(ATTENDANCE_PERMISSIONS.REVIEW_CORRECTIONS)
  approveCorrection(
    @GetCurrentUser() user: CurrentUser,
    @Param('correctionId') correctionId: string,
    @Body() dto: ReviewAttendanceCorrectionDto,
  ) {
    return this.attendanceService.reviewCorrection(
      user,
      correctionId,
      'APPROVED',
      dto.comments,
    );
  }

  @Post('corrections/:correctionId/reject')
  @RequirePermissions(ATTENDANCE_PERMISSIONS.REVIEW_CORRECTIONS)
  rejectCorrection(
    @GetCurrentUser() user: CurrentUser,
    @Param('correctionId') correctionId: string,
    @Body() dto: ReviewAttendanceCorrectionDto,
  ) {
    return this.attendanceService.reviewCorrection(
      user,
      correctionId,
      'REJECTED',
      dto.comments,
    );
  }

  @Get('summary')
  @RequirePermissions(ATTENDANCE_PERMISSIONS.VIEW_ORGANISATION)
  getSummary(
    @GetCurrentUser() user: CurrentUser,
    @Query('date') date?: string,
  ) {
    return this.attendanceService.getDashboardSummary(user, date);
  }

  @Get('report/export')
  @RequirePermissions(ATTENDANCE_PERMISSIONS.EXPORT)
  async exportReport(
    @GetCurrentUser() user: CurrentUser,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Res() response: Response,
  ) {
    const report = await this.attendanceService.exportAttendanceReport(
      user,
      dateFrom,
      dateTo,
    );
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${report.fileName}"`,
    );
    response.send(report.content);
  }
}
