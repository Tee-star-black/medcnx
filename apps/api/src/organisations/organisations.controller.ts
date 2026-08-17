import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { GetCurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import type { CurrentUser } from '../auth/types/current-user.type';
import { UpdateOrganisationDto } from './dto/update-organisation.dto';
import { OrganisationsService } from './organisations.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('organisations')
export class OrganisationsController {
  constructor(private readonly organisationsService: OrganisationsService) {}

  @RequirePermissions('organisation:read')
  @Get()
  findAll(@GetCurrentUser() user: CurrentUser) {
    return this.organisationsService.findAllForUser(user);
  }

  @RequirePermissions('organisation:read')
  @Get('me')
  findCurrent(@GetCurrentUser() user: CurrentUser) {
    return this.organisationsService.findCurrentForUser(user);
  }

  @RequirePermissions('organisation:update')
  @Patch('me')
  updateCurrent(
    @GetCurrentUser() user: CurrentUser,
    @Body() dto: UpdateOrganisationDto,
  ) {
    return this.organisationsService.updateCurrentForUser(user, dto);
  }
}
