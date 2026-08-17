import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { GetCurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import type { CurrentUser } from '../auth/types/current-user.type';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import { CreateJobApplicationDto } from './dto/create-job-application.dto';
import { CreateRecruitmentJobDto } from './dto/create-recruitment-job.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';
import { RecruitmentService } from './recruitment.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('recruitment')
export class RecruitmentController {
  constructor(private readonly recruitmentService: RecruitmentService) {}

  @RequirePermissions('employees:read')
  @Get()
  getOverview(@GetCurrentUser() user: CurrentUser) {
    return this.recruitmentService.getOverview(user);
  }

  @RequirePermissions('employees:read')
  @Get('jobs')
  listJobs(@GetCurrentUser() user: CurrentUser) {
    return this.recruitmentService.listJobs(user);
  }

  @RequirePermissions('employees:update')
  @Post('jobs')
  createJob(
    @GetCurrentUser() user: CurrentUser,
    @Body() dto: CreateRecruitmentJobDto,
  ) {
    return this.recruitmentService.createJob(user, dto);
  }

  @RequirePermissions('employees:read')
  @Get('candidates')
  listCandidates(@GetCurrentUser() user: CurrentUser) {
    return this.recruitmentService.listCandidates(user);
  }

  @RequirePermissions('employees:update')
  @Post('candidates')
  createCandidate(
    @GetCurrentUser() user: CurrentUser,
    @Body() dto: CreateCandidateDto,
  ) {
    return this.recruitmentService.createCandidate(user, dto);
  }

  @RequirePermissions('employees:read')
  @Get('applications')
  listApplications(@GetCurrentUser() user: CurrentUser) {
    return this.recruitmentService.listApplications(user);
  }

  @RequirePermissions('employees:update')
  @Post('applications')
  createApplication(
    @GetCurrentUser() user: CurrentUser,
    @Body() dto: CreateJobApplicationDto,
  ) {
    return this.recruitmentService.createApplication(user, dto);
  }

  @RequirePermissions('employees:update')
  @Patch('applications/:applicationId/status')
  updateApplicationStatus(
    @GetCurrentUser() user: CurrentUser,
    @Param('applicationId') applicationId: string,
    @Body() dto: UpdateApplicationStatusDto,
  ) {
    return this.recruitmentService.updateApplicationStatus(
      user,
      applicationId,
      dto,
    );
  }
}
