import {
  Body,
  Controller,
  Delete,
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
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @RequirePermissions('departments:read')
  @Get()
  findAll(@GetCurrentUser() user: CurrentUser) {
    return this.departmentsService.findAll(user);
  }

  @RequirePermissions('departments:read')
  @Get(':id')
  findOne(@GetCurrentUser() user: CurrentUser, @Param('id') id: string) {
    return this.departmentsService.findOne(user, id);
  }

  @RequirePermissions('departments:create')
  @Post()
  create(
    @GetCurrentUser() user: CurrentUser,
    @Body() createDepartmentDto: CreateDepartmentDto,
  ) {
    return this.departmentsService.create(user, createDepartmentDto);
  }

  @RequirePermissions('departments:update')
  @Patch(':id')
  update(
    @GetCurrentUser() user: CurrentUser,
    @Param('id') id: string,
    @Body() updateDepartmentDto: UpdateDepartmentDto,
  ) {
    return this.departmentsService.update(user, id, updateDepartmentDto);
  }

  @RequirePermissions('departments:update')
  @Delete(':id')
  remove(@GetCurrentUser() user: CurrentUser, @Param('id') id: string) {
    return this.departmentsService.remove(user, id);
  }
}
