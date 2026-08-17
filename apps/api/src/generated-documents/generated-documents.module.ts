import { Module } from '@nestjs/common';
import { GeneratedDocumentsController } from './generated-documents.controller';
import { GeneratedDocumentsService } from './generated-documents.service';
import { DocumentTemplatesService } from './document-templates.service';
import { DocumentTemplateEngineService } from './document-template-engine.service';
import { DocumentStorageService } from './storage/document-storage.service';
import { PdfConverterService } from './pdf-converter.service';
import { DocumentBrandingService } from './document-branding.service';

@Module({
  controllers: [GeneratedDocumentsController],
  providers: [
    GeneratedDocumentsService,
    DocumentTemplatesService,
    DocumentTemplateEngineService,
    DocumentStorageService,
    PdfConverterService,
    DocumentBrandingService,
  ],
})
export class GeneratedDocumentsModule {}
