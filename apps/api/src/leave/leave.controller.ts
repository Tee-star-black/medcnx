import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { GetCurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import type { CurrentUser } from '../auth/types/current-user.type';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { CreateMyLeaveRequestDto } from './dto/create-my-leave-request.dto';
import { RejectLeaveRequestDto } from './dto/reject-leave-request.dto';
import { UpdateLeaveRequestDto } from './dto/update-leave-request.dto';
import { LeaveService } from './leave.service';

const leaveDocumentsPath = join(process.cwd(), 'uploads', 'leave-documents');

if (!existsSync(leaveDocumentsPath)) {
  mkdirSync(leaveDocumentsPath, { recursive: true });
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('leave')
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  @RequirePermissions('leave:read')
  @Get()
  findAll(@GetCurrentUser() user: CurrentUser) {
    return this.leaveService.findAll(user);
  }

  /*
   * Employee self-service routes.
   * These are the routes the frontend should use going forward.
   */

  @Get('my-requests')
  findMyRequests(@GetCurrentUser() user: CurrentUser) {
    return this.leaveService.findMyLeave(user);
  }

  @Post('my-requests')
  createMyRequest(
    @GetCurrentUser() user: CurrentUser,
    @Body() dto: CreateMyLeaveRequestDto,
  ) {
    return this.leaveService.createMyLeave(user, dto);
  }

  @Post('my-requests/with-document')
  @UseInterceptors(
    FileInterceptor('document', {
      storage: diskStorage({
        destination: leaveDocumentsPath,
        filename: (_request, file, callback) => {
          const uniqueName = `${randomUUID()}${extname(file.originalname)}`;
          callback(null, uniqueName);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  createMyRequestWithDocument(
    @GetCurrentUser() user: CurrentUser,
    @Body() dto: CreateMyLeaveRequestDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.leaveService.createMyLeaveWithDocument(user, dto, file);
  }

  /*
   * Legacy employee routes.
   * Kept for compatibility, but frontend should use /my-requests.
   */

  @Get('me')
  findMyLeave(@GetCurrentUser() user: CurrentUser) {
    return this.leaveService.findMyLeave(user);
  }

  @Post('me')
  createMyLeave(
    @GetCurrentUser() user: CurrentUser,
    @Body() dto: CreateMyLeaveRequestDto,
  ) {
    return this.leaveService.createMyLeave(user, dto);
  }

  @Post('me/with-document')
  @UseInterceptors(
    FileInterceptor('document', {
      storage: diskStorage({
        destination: leaveDocumentsPath,
        filename: (_request, file, callback) => {
          const uniqueName = `${randomUUID()}${extname(file.originalname)}`;
          callback(null, uniqueName);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  createMyLeaveWithDocument(
    @GetCurrentUser() user: CurrentUser,
    @Body() dto: CreateMyLeaveRequestDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.leaveService.createMyLeaveWithDocument(user, dto, file);
  }

  @Get('documents/:id/download')
  async downloadLeaveDocument(
    @GetCurrentUser() user: CurrentUser,
    @Param('id') id: string,
    @Res() response: Response,
  ) {
    const document = await this.leaveService.findLeaveDocumentForDownload(
      user,
      id,
    );

    const filePath = join(
      process.cwd(),
      'uploads',
      'leave-documents',
      document.fileName,
    );

    return response.download(filePath, document.originalName);
  }

  /*
   * HR/Admin routes.
   */

  @RequirePermissions('leave:create')
  @Post()
  create(
    @GetCurrentUser() user: CurrentUser,
    @Body() dto: CreateLeaveRequestDto,
  ) {
    return this.leaveService.create(user, dto);
  }

  @RequirePermissions('leave:update')
  @Patch(':id')
  update(
    @GetCurrentUser() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdateLeaveRequestDto,
  ) {
    return this.leaveService.update(user, id, dto);
  }

  @RequirePermissions('leave:approve')
  @Patch(':id/approve')
  approve(@GetCurrentUser() user: CurrentUser, @Param('id') id: string) {
    return this.leaveService.approve(user, id);
  }

  @RequirePermissions('leave:reject')
  @Patch(':id/reject')
  reject(
    @GetCurrentUser() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: RejectLeaveRequestDto,
  ) {
    return this.leaveService.reject(user, id, dto);
  }

  @Patch(':id/cancel')
  cancel(@GetCurrentUser() user: CurrentUser, @Param('id') id: string) {
    return this.leaveService.cancel(user, id);
  }

  /*
   * Keep this LAST.
   * If this appears above /me, /my-requests or /documents,
   * Nest may treat those route names as leave request IDs.
   */

  @RequirePermissions('leave:read')
  @Get(':id')
  findOne(@GetCurrentUser() user: CurrentUser, @Param('id') id: string) {
    return this.leaveService.findOne(user, id);
  }
}
