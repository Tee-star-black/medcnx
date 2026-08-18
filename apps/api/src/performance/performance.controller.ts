import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { GetCurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import type { CurrentUser } from '../auth/types/current-user.type';
import {
  AcknowledgePerformanceReviewDto,
  AssignPerformanceReviewDto,
  CreateCompetencyDto,
  CreateDevelopmentPlanDto,
  CreatePerformanceCycleDto,
  CreatePerformanceGoalDto,
  CreatePerformanceTemplateDto,
  FinalisePerformanceReviewDto,
  SavePerformanceReviewDto,
  UpdateDevelopmentPlanDto,
  UpdatePerformanceGoalDto,
} from './dto/performance.dto';
import { ManagerPerformanceService } from './manager-performance.service';
import { PERFORMANCE_PERMISSIONS as P } from './performance.permissions';
import { PerformanceService } from './performance.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('performance')
export class PerformanceController {
  constructor(
    private readonly performance: PerformanceService,
    private readonly managerPerformance: ManagerPerformanceService,
  ) {}

  @Get('manager/overview')
  managerOverview(@GetCurrentUser() user: CurrentUser) {
    return this.managerPerformance.getOverview(user);
  }

  @Get('dashboard')
  @RequirePermissions(P.READ)
  dashboard(@GetCurrentUser() user: CurrentUser) {
    return this.performance.dashboard(user);
  }

  @Get('templates')
  @RequirePermissions(P.READ)
  templates(@GetCurrentUser() user: CurrentUser) {
    return this.performance.listTemplates(user);
  }

  @Post('templates')
  @RequirePermissions(P.MANAGE)
  createTemplate(
    @GetCurrentUser() user: CurrentUser,
    @Body() dto: CreatePerformanceTemplateDto,
  ) {
    return this.performance.createTemplate(user, dto);
  }

  @Get('cycles')
  @RequirePermissions(P.READ)
  cycles(@GetCurrentUser() user: CurrentUser) {
    return this.performance.listCycles(user);
  }

  @Post('cycles')
  @RequirePermissions(P.MANAGE)
  createCycle(
    @GetCurrentUser() user: CurrentUser,
    @Body() dto: CreatePerformanceCycleDto,
  ) {
    return this.performance.createCycle(user, dto);
  }

  @Post('cycles/:cycleId/reviews')
  @RequirePermissions(P.ASSIGN)
  assign(
    @GetCurrentUser() user: CurrentUser,
    @Param('cycleId') cycleId: string,
    @Body() dto: AssignPerformanceReviewDto,
  ) {
    return this.performance.assignReview(user, cycleId, dto);
  }

  @Get('reviews')
  @RequirePermissions(P.READ)
  reviews(
    @GetCurrentUser() user: CurrentUser,
    @Query('employeeId') employeeId?: string,
    @Query('cycleId') cycleId?: string,
  ) {
    return this.performance.listReviews(user, employeeId, cycleId);
  }

  @Get('reviews/:id')
  @RequirePermissions(P.READ)
  review(
    @GetCurrentUser() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.performance.getReview(user, id, true);
  }

  @Get('my')
  @RequirePermissions(P.VIEW_OWN)
  my(@GetCurrentUser() user: CurrentUser) {
    return this.performance.myPerformance(user);
  }

  @Get('my/assignments')
  @RequirePermissions(P.REVIEW_ASSIGNED)
  assignments(@GetCurrentUser() user: CurrentUser) {
    return this.performance.myAssignments(user);
  }

  @Get('my/reviews/:id')
  @RequirePermissions(P.REVIEW_ASSIGNED)
  assignedReview(
    @GetCurrentUser() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.performance.getReview(user, id);
  }

  @Patch('my/reviews/:id')
  @RequirePermissions(P.REVIEW_ASSIGNED)
  save(
    @GetCurrentUser() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: SavePerformanceReviewDto,
  ) {
    return this.performance.saveReview(user, id, dto);
  }

  @Post('my/reviews/:id/submit')
  @RequirePermissions(P.REVIEW_ASSIGNED)
  submit(
    @GetCurrentUser() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: SavePerformanceReviewDto,
  ) {
    return this.performance.submitReview(user, id, dto);
  }

  @Post('reviews/:id/finalise')
  @RequirePermissions(P.FINALISE)
  finalise(
    @GetCurrentUser() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: FinalisePerformanceReviewDto,
  ) {
    return this.performance.finaliseReview(user, id, dto);
  }

  @Post('my/reviews/:id/acknowledge')
  @RequirePermissions(P.ACKNOWLEDGE_OWN)
  acknowledge(
    @GetCurrentUser() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: AcknowledgePerformanceReviewDto,
  ) {
    return this.performance.acknowledge(user, id, dto);
  }

  @Get('employees/:employeeId')
  @RequirePermissions(P.READ)
  employee(
    @GetCurrentUser() user: CurrentUser,
    @Param('employeeId') employeeId: string,
  ) {
    return this.performance.employeeSummary(user, employeeId);
  }

  @Get('goals')
  @RequirePermissions(P.READ)
  goals(
    @GetCurrentUser() user: CurrentUser,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.performance.listGoals(user, employeeId);
  }

  @Post('goals')
  @RequirePermissions(P.MANAGE_GOALS)
  createGoal(
    @GetCurrentUser() user: CurrentUser,
    @Body() dto: CreatePerformanceGoalDto,
  ) {
    return this.performance.createGoal(user, dto);
  }

  @Patch('goals/:id')
  @RequirePermissions(P.MANAGE_GOALS)
  updateGoal(
    @GetCurrentUser() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdatePerformanceGoalDto,
  ) {
    return this.performance.updateGoal(user, id, dto);
  }

  @Get('development-plans')
  @RequirePermissions(P.READ)
  plans(
    @GetCurrentUser() user: CurrentUser,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.performance.listDevelopmentPlans(user, employeeId);
  }

  @Post('development-plans')
  @RequirePermissions(P.MANAGE_GOALS)
  createPlan(
    @GetCurrentUser() user: CurrentUser,
    @Body() dto: CreateDevelopmentPlanDto,
  ) {
    return this.performance.createDevelopmentPlan(user, dto);
  }

  @Patch('development-plans/:id')
  @RequirePermissions(P.MANAGE_GOALS)
  updatePlan(
    @GetCurrentUser() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdateDevelopmentPlanDto,
  ) {
    return this.performance.updateDevelopmentPlan(user, id, dto);
  }

  @Get('competencies')
  @RequirePermissions(P.READ)
  competencies(@GetCurrentUser() user: CurrentUser) {
    return this.performance.listCompetencies(user);
  }

  @Post('competencies')
  @RequirePermissions(P.MANAGE)
  createCompetency(
    @GetCurrentUser() user: CurrentUser,
    @Body() dto: CreateCompetencyDto,
  ) {
    return this.performance.createCompetency(user, dto);
  }
}
