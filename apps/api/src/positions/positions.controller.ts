import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { GetCurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import type { CurrentUser } from '../auth/types/current-user.type';
import { AssignPositionDto } from './dto/assign-position.dto';
import { CreatePositionDto } from './dto/create-position.dto';
import { CreatePositionRecruitmentJobDto } from './dto/create-position-recruitment-job.dto';
import { UpdatePositionDto } from './dto/update-position.dto';
import { PositionHistoryService } from './position-history.service';
import { PositionsService } from './positions.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('positions')
export class PositionsController {
  constructor(
    private readonly positionsService: PositionsService,
    private readonly positionHistoryService: PositionHistoryService,
  ) {}

  @RequirePermissions('departments:read')
  @Get()
  findAll(@GetCurrentUser() user: CurrentUser) {
    return this.positionsService.findAll(user);
  }

  @RequirePermissions('departments:read')
  @Get('vacancy-plan')
  getVacancyPlan(@GetCurrentUser() user: CurrentUser) {
    return this.positionsService.getVacancyPlan(user);
  }

  @RequirePermissions('employees:read')
  @Get('assignments/:employeeId')
  employeeHistory(
    @GetCurrentUser() user: CurrentUser,
    @Param('employeeId') employeeId: string,
  ) {
    return this.positionsService.employeeHistory(user, employeeId);
  }

  @RequirePermissions('employees:update')
  @Post('assignments/:employeeId')
  assignEmployee(
    @GetCurrentUser() user: CurrentUser,
    @Param('employeeId') employeeId: string,
    @Body() dto: AssignPositionDto,
  ) {
    return this.positionsService.assignEmployee(user, employeeId, dto);
  }

  @RequirePermissions('employees:read')
  @Get(':id/history')
  positionHistory(
    @GetCurrentUser() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.positionHistoryService.getPositionHistory(user, id);
  }

  @RequirePermissions('departments:read')
  @Get(':id')
  findOne(@GetCurrentUser() user: CurrentUser, @Param('id') id: string) {
    return this.positionsService.findOne(user, id);
  }

  @RequirePermissions('departments:update')
  @Post()
  create(
    @GetCurrentUser() user: CurrentUser,
    @Body() dto: CreatePositionDto,
  ) {
    return this.positionsService.create(user, dto);
  }

  @RequirePermissions('employees:update')
  @Post(':id/recruitment-job')
  createRecruitmentJob(
    @GetCurrentUser() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: CreatePositionRecruitmentJobDto,
  ) {
    return this.positionsService.createRecruitmentJob(user, id, dto);
  }

  @RequirePermissions('departments:update')
  @Patch(':id')
  update(
    @GetCurrentUser() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdatePositionDto,
  ) {
    return this.positionsService.update(user, id, dto);
  }

  @RequirePermissions('departments:update')
  @Post(':id/archive')
  archive(@GetCurrentUser() user: CurrentUser, @Param('id') id: string) {
    return this.positionsService.archive(user, id);
  }
}
