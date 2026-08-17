import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { GetCurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import type { CurrentUser } from '../auth/types/current-user.type';
import { CreateProfileChangeRequestDto } from './dto/create-profile-change-request.dto';
import { ReviewProfileChangeRequestDto } from './dto/review-profile-change-request.dto';
import { EmployeeSelfServiceService } from './employee-self-service.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('employee-self-service')
export class EmployeeSelfServiceController {
  constructor(private readonly service: EmployeeSelfServiceService) {}

  @Get('profile')
  @RequirePermissions('profile:view-own')
  getProfile(@GetCurrentUser() user: CurrentUser) {
    return this.service.getProfile(user);
  }

  @Get('profile-change-requests/me')
  @RequirePermissions('profile:request-change')
  getMyRequests(@GetCurrentUser() user: CurrentUser) {
    return this.service.getMyProfileChangeRequests(user);
  }

  @Post('profile-change-requests')
  @RequirePermissions('profile:request-change')
  createRequest(
    @GetCurrentUser() user: CurrentUser,
    @Body() dto: CreateProfileChangeRequestDto,
  ) {
    return this.service.createProfileChangeRequest(user, dto);
  }

  @Patch('profile-change-requests/:id/cancel')
  @RequirePermissions('profile:request-change')
  cancelRequest(
    @GetCurrentUser() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.service.cancelProfileChangeRequest(user, id);
  }

  @Get('profile-change-requests')
  @RequirePermissions('profile:review-changes')
  getRequests(@GetCurrentUser() user: CurrentUser) {
    return this.service.getProfileChangeRequests(user);
  }

  @Patch('profile-change-requests/:id/review')
  @RequirePermissions('profile:review-changes')
  reviewRequest(
    @GetCurrentUser() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: ReviewProfileChangeRequestDto,
  ) {
    return this.service.reviewProfileChangeRequest(user, id, dto);
  }

  @Get('notifications')
  @RequirePermissions('notifications:view-own')
  getNotifications(@GetCurrentUser() user: CurrentUser) {
    return this.service.getNotifications(user);
  }

  @Patch('notifications/read-all')
  @RequirePermissions('notifications:update-own')
  markAllRead(@GetCurrentUser() user: CurrentUser) {
    return this.service.markAllNotificationsRead(user);
  }

  @Patch('notifications/:id/read')
  @RequirePermissions('notifications:update-own')
  markRead(
    @GetCurrentUser() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.service.markNotificationRead(user, id);
  }
}
