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
import { AccessControlService } from './access-control.service';
import { CreateCustomRoleDto } from './dto/create-custom-role.dto';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('access-control')
export class AccessControlController {
  constructor(private readonly accessControlService: AccessControlService) {}

  @Get()
  @RequirePermissions('users:read')
  getOverview(@GetCurrentUser() user: CurrentUser) {
    return this.accessControlService.getOverview(user);
  }

  @Patch('users/:userId/roles')
  @RequirePermissions('users:update')
  updateUserRoles(
    @Param('userId') userId: string,
    @Body() dto: UpdateUserRolesDto,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.accessControlService.updateUserRoles(user, userId, dto);
  }

  @Patch('users/:userId/status')
  @RequirePermissions('users:disable')
  updateUserStatus(
    @Param('userId') userId: string,
    @Body() dto: UpdateUserStatusDto,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.accessControlService.updateUserStatus(user, userId, dto);
  }

  @Post('roles')
  @RequirePermissions('users:update')
  createCustomRole(
    @Body() dto: CreateCustomRoleDto,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.accessControlService.createCustomRole(user, dto);
  }

  @Patch('roles/:roleId/permissions')
  @RequirePermissions('users:update')
  updateRolePermissions(
    @Param('roleId') roleId: string,
    @Body() dto: UpdateRolePermissionsDto,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.accessControlService.updateRolePermissions(user, roleId, dto);
  }
}
