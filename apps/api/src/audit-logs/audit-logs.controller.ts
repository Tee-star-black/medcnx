import { Controller, Get, UseGuards } from '@nestjs/common';
import { GetCurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import type { CurrentUser } from '../auth/types/current-user.type';
import { AuditLogsService } from './audit-logs.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @RequirePermissions('employees:read')
  @Get()
  findAll(@GetCurrentUser() user: CurrentUser) {
    return this.auditLogsService.findAll(user);
  }
}
