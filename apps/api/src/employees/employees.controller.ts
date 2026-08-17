import {
  Body,
  Controller,
  Delete,
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
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { UploadEmployeeDocumentDto } from './dto/upload-employee-document.dto';
import { UpdateEmployeeDocumentDto } from './dto/update-employee-document.dto';
import { EmployeesService } from './employees.service';

const employeeDocumentsUploadDestination = join(
  process.cwd(),
  'uploads',
  'employee-documents',
);

const allowedEmployeeDocumentMimeTypes = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @RequirePermissions('employees:read')
  @Get()
  findAll(@GetCurrentUser() user: CurrentUser) {
    return this.employeesService.findAll(user);
  }

  @Get('me')
  findMe(@GetCurrentUser() user: CurrentUser) {
    return this.employeesService.findMe(user);
  }

  @Get('me/documents')
  findMyDocuments(@GetCurrentUser() user: CurrentUser) {
    return this.employeesService.findMyDocuments(user);
  }

  @RequirePermissions('employees:read')
  @Get('documents')
  findAllEmployeeDocuments(@GetCurrentUser() user: CurrentUser) {
    return this.employeesService.findAllEmployeeDocuments(user);
  }
  
  @Get('documents/:documentId/download')
  async downloadEmployeeDocument(
    @GetCurrentUser() user: CurrentUser,
    @Param('documentId') documentId: string,
    @Res() response: Response,
  ) {
    const document =
      await this.employeesService.findEmployeeDocumentForDownload(
        user,
        documentId,
      );

    const filePath = join(
      process.cwd(),
      'uploads',
      'employee-documents',
      document.fileName,
    );

    if (!existsSync(filePath)) {
      response.status(404).json({
        message: 'Stored file not found on server.',
      });
      return;
    }

    response.setHeader('Content-Type', document.mimeType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(document.originalName)}"`,
    );

    return response.download(filePath, document.originalName);
  }

  @RequirePermissions('employees:update')
  @Patch('documents/:documentId')
  updateEmployeeDocument(
    @GetCurrentUser() user: CurrentUser,
    @Param('documentId') documentId: string,
    @Body() updateEmployeeDocumentDto: UpdateEmployeeDocumentDto,
  ) {
    return this.employeesService.updateEmployeeDocument(
      user,
      documentId,
      updateEmployeeDocumentDto,
    );
  }

  @RequirePermissions('employees:update')
  @Delete('documents/:documentId')
  deleteEmployeeDocument(
    @GetCurrentUser() user: CurrentUser,
    @Param('documentId') documentId: string,
  ) {
    return this.employeesService.deleteEmployeeDocument(user, documentId);
  }

  @RequirePermissions('employees:read')
  @Get(':id')
  findOne(@GetCurrentUser() user: CurrentUser, @Param('id') id: string) {
    return this.employeesService.findOne(user, id);
  }

  @RequirePermissions('employees:read')
  @Get(':id/documents')
  findEmployeeDocuments(
    @GetCurrentUser() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.employeesService.findEmployeeDocuments(user, id);
  }

  @RequirePermissions('employees:update')
  @Post(':id/documents')
  @UseInterceptors(
    FileInterceptor('document', {
      storage: diskStorage({
        destination: (_request, _file, callback) => {
          if (!existsSync(employeeDocumentsUploadDestination)) {
            mkdirSync(employeeDocumentsUploadDestination, {
              recursive: true,
            });
          }

          callback(null, employeeDocumentsUploadDestination);
        },
        filename: (_request, file, callback) => {
          const safeExtension = extname(file.originalname).toLowerCase();
          callback(null, `${randomUUID()}${safeExtension}`);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
      fileFilter: (_request, file, callback) => {
        if (!allowedEmployeeDocumentMimeTypes.includes(file.mimetype)) {
          callback(
            new Error(
              'Invalid file type. Upload PDF, PNG, JPG, DOC or DOCX only.',
            ),
            false,
          );
          return;
        }

        callback(null, true);
      },
    }),
  )
  uploadEmployeeDocument(
    @GetCurrentUser() user: CurrentUser,
    @Param('id') id: string,
    @Body() uploadEmployeeDocumentDto: UploadEmployeeDocumentDto,
    @UploadedFile() document?: Express.Multer.File,
  ) {
    return this.employeesService.uploadEmployeeDocument(
      user,
      id,
      uploadEmployeeDocumentDto,
      document,
    );
  }

  @RequirePermissions('employees:create')
  @Post()
  create(
    @GetCurrentUser() user: CurrentUser,
    @Body() createEmployeeDto: CreateEmployeeDto,
  ) {
    return this.employeesService.create(user, createEmployeeDto);
  }

  @RequirePermissions('employees:update')
  @Patch(':id')
  update(
    @GetCurrentUser() user: CurrentUser,
    @Param('id') id: string,
    @Body() updateEmployeeDto: UpdateEmployeeDto,
  ) {
    return this.employeesService.update(user, id, updateEmployeeDto);
  }

  @RequirePermissions('employees:delete')
  @Delete(':id')
  remove(@GetCurrentUser() user: CurrentUser, @Param('id') id: string) {
    return this.employeesService.remove(user, id);
  }
}
