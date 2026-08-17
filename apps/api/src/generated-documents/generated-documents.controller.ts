import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { GetCurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import type { CurrentUser } from '../auth/types/current-user.type';
import { DocumentBrandingService } from './document-branding.service';
import { DocumentTemplatesService } from './document-templates.service';
import {
  UploadDocumentTemplateDto,
  UpdateDocumentTemplateDto,
} from './dto/document-template.dto';
import {
  CreateGeneratedDocumentDto,
  DocumentDecisionDto,
  DocumentVisibilityDto,
  PreviewGeneratedDocumentDto,
} from './dto/document-workflow.dto';
import { GeneratedDocumentsService } from './generated-documents.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('document-v2')
export class GeneratedDocumentsController {
  constructor(
    private templates: DocumentTemplatesService,
    private documents: GeneratedDocumentsService,
    private branding: DocumentBrandingService,
  ) {}
  @Get('templates/presets')
  @RequirePermissions('document_templates:read')
  listTemplatePresets(@GetCurrentUser() u: CurrentUser) {
    return this.templates.listPresets(u);
  }
  @Get('templates/presets/:key/preview')
  @RequirePermissions('document_templates:read')
  async previewTemplatePreset(
    @GetCurrentUser() u: CurrentUser,
    @Param('key') key: string,
    @Res() res: Response,
  ) {
    const preset = await this.templates.previewPreset(u, key);
    res.setHeader('Content-Type', preset.mime);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${preset.filename}"`,
    );
    res.send(preset.bytes);
  }
  @Post('templates/presets/:key/import')
  @RequirePermissions('document_templates:create')
  importTemplatePreset(
    @GetCurrentUser() u: CurrentUser,
    @Param('key') key: string,
  ) {
    return this.templates.importPreset(u, key);
  }
  @Post('templates/bootstrap-defaults')
  @RequirePermissions('document_templates:create')
  bootstrapDefaultTemplates(@GetCurrentUser() u: CurrentUser) {
    return this.templates.bootstrapPresets(u);
  }
  @Get('templates')
  @RequirePermissions('document_templates:read')
  listTemplates(
    @GetCurrentUser() u: CurrentUser,
    @Query('search') s?: string,
    @Query('category') c?: string,
    @Query('status') st?: string,
  ) {
    return this.templates.list(u, s, c, st);
  }
  @Get('templates/:id')
  @RequirePermissions('document_templates:read')
  getTemplate(@GetCurrentUser() u: CurrentUser, @Param('id') id: string) {
    return this.templates.get(u, id);
  }
  @Post('templates')
  @RequirePermissions('document_templates:create')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 15 * 1024 * 1024,
        fields: 8,
        fieldNameSize: 100,
        fieldSize: 10 * 1024,
      },
    }),
  )
  uploadTemplate(
    @GetCurrentUser() u: CurrentUser,
    @Body() d: UploadDocumentTemplateDto,
    @UploadedFile() f?: Express.Multer.File,
  ) {
    return this.templates.upload(u, d, f);
  }
  @Post('templates/:id/versions')
  @RequirePermissions('document_templates:update')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 15 * 1024 * 1024,
        fields: 2,
        fieldNameSize: 100,
        fieldSize: 10 * 1024,
      },
    }),
  )
  replaceTemplate(
    @GetCurrentUser() u: CurrentUser,
    @Param('id') id: string,
    @UploadedFile() f?: Express.Multer.File,
  ) {
    return this.templates.replace(u, id, f);
  }
  @Patch('templates/:id')
  @RequirePermissions('document_templates:update')
  updateTemplate(
    @GetCurrentUser() u: CurrentUser,
    @Param('id') id: string,
    @Body() d: UpdateDocumentTemplateDto,
  ) {
    return this.templates.update(u, id, d);
  }
  @Post('templates/:id/validate')
  @RequirePermissions('document_templates:update')
  validateTemplate(@GetCurrentUser() u: CurrentUser, @Param('id') id: string) {
    return this.templates.validate(u, id);
  }
  @Post('templates/:id/activate')
  @RequirePermissions('document_templates:update')
  activateTemplate(@GetCurrentUser() u: CurrentUser, @Param('id') id: string) {
    return this.templates.activate(u, id);
  }
  @Post('templates/:id/archive')
  @RequirePermissions('document_templates:archive')
  archiveTemplate(@GetCurrentUser() u: CurrentUser, @Param('id') id: string) {
    return this.templates.archive(u, id);
  }
  @Get('generated')
  @RequirePermissions(
    'generated_documents:read',
    'generated_documents:view-all',
  )
  list(@GetCurrentUser() u: CurrentUser) {
    return this.documents.list(u);
  }
  @Get('generated/:id') @RequirePermissions('generated_documents:read') get(
    @GetCurrentUser() u: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.documents.get(u, id);
  }
  @Post('generated/preview')
  @RequirePermissions('generated_documents:preview')
  preview(
    @GetCurrentUser() u: CurrentUser,
    @Body() d: PreviewGeneratedDocumentDto,
  ) {
    return this.documents.preview(u, d);
  }
  @Post('generated/preview-pdf')
  @RequirePermissions('generated_documents:preview')
  async previewPdf(
    @GetCurrentUser() u: CurrentUser,
    @Body() d: PreviewGeneratedDocumentDto,
    @Res() res: Response,
  ) {
    const pdf = await this.documents.previewPdf(u, d);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'inline; filename="document-preview.pdf"',
    );
    res.send(pdf);
  }
  @Post('generated') @RequirePermissions('generated_documents:create') create(
    @GetCurrentUser() u: CurrentUser,
    @Body() d: CreateGeneratedDocumentDto,
  ) {
    return this.documents.create(u, d);
  }
  @Post('generated/:id/approve')
  @RequirePermissions('generated_documents:approve')
  approve(
    @GetCurrentUser() u: CurrentUser,
    @Param('id') id: string,
    @Body() d: DocumentDecisionDto,
  ) {
    return this.documents.approve(u, id, d.note);
  }
  @Post('generated/:id/reject')
  @RequirePermissions('generated_documents:reject')
  reject(
    @GetCurrentUser() u: CurrentUser,
    @Param('id') id: string,
    @Body() d: DocumentDecisionDto,
  ) {
    return this.documents.reject(u, id, d.note);
  }
  @Post('generated/:id/publish')
  @RequirePermissions('generated_documents:publish')
  publish(@GetCurrentUser() u: CurrentUser, @Param('id') id: string) {
    return this.documents.publish(u, id);
  }
  @Patch('generated/:id/visibility')
  @RequirePermissions('generated_documents:publish')
  visibility(
    @GetCurrentUser() u: CurrentUser,
    @Param('id') id: string,
    @Body() d: DocumentVisibilityDto,
  ) {
    return this.documents.setVisibility(u, id, d.visibleToEmployee);
  }
  @Post('generated/:id/cancel')
  @RequirePermissions('generated_documents:create')
  cancel(@GetCurrentUser() u: CurrentUser, @Param('id') id: string) {
    return this.documents.cancel(u, id);
  }
  @Get('generated/:id/download/:format')
  @RequirePermissions('generated_documents:download')
  async download(
    @GetCurrentUser() u: CurrentUser,
    @Param('id') id: string,
    @Param('format') format: string,
    @Res() res: Response,
  ) {
    const f = await this.documents.download(
      u,
      id,
      format === 'docx' ? 'docx' : 'pdf',
    );
    res.setHeader('Content-Type', f.mime);
    res.setHeader('Content-Disposition', `attachment; filename="${f.name}"`);
    res.send(f.bytes);
  }
  @Get('my-documents') @RequirePermissions('generated_documents:view-own') own(
    @GetCurrentUser() u: CurrentUser,
  ) {
    return this.documents.own(u);
  }
  @Get('my-documents/:id/download')
  @RequirePermissions(
    'generated_documents:view-own',
    'generated_documents:download',
  )
  async ownDownload(
    @GetCurrentUser() u: CurrentUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const f = await this.documents.downloadOwn(u, id);
    res.setHeader('Content-Type', f.mime);
    res.setHeader('Content-Disposition', `attachment; filename="${f.name}"`);
    res.send(f.bytes);
  }
  @Get('settings/branding') @RequirePermissions('organisation:read') settings(
    @GetCurrentUser() u: CurrentUser,
  ) {
    return this.branding.get(u);
  }
  @Patch('settings/branding')
  @RequirePermissions('organisation_branding:manage')
  @UseInterceptors(
    FileInterceptor('logo', {
      limits: { fileSize: 5 * 1024 * 1024, fields: 2, fieldNameSize: 100 },
    }),
  )
  brandingUpdate(
    @GetCurrentUser() u: CurrentUser,
    @Body() d: Record<string, string>,
    @UploadedFile() f?: Express.Multer.File,
  ) {
    return this.branding.updateBranding(u, d, f);
  }
  @Patch('settings/signature')
  @RequirePermissions('organisation_signature:manage')
  @UseInterceptors(
    FileInterceptor('signature', {
      limits: { fileSize: 5 * 1024 * 1024, fields: 4, fieldNameSize: 100 },
    }),
  )
  signatureUpdate(
    @GetCurrentUser() u: CurrentUser,
    @Body() d: Record<string, string>,
    @UploadedFile() f?: Express.Multer.File,
  ) {
    return this.branding.updateSignature(u, d as never, f);
  }
}
