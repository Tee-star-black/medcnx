import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  DocumentSignatureMode,
  DocumentTemplateCategory,
} from '@prisma/client';

export class UploadDocumentTemplateDto {
  @IsString() @MaxLength(160) name!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsEnum(DocumentTemplateCategory) category!: DocumentTemplateCategory;
  @IsEnum(DocumentSignatureMode) signatureMode!: DocumentSignatureMode;
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  defaultEmployeeVisibility?: boolean;
}

export class UpdateDocumentTemplateDto {
  @IsOptional() @IsString() @MaxLength(160) name?: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional()
  @IsEnum(DocumentTemplateCategory)
  category?: DocumentTemplateCategory;
  @IsOptional()
  @IsEnum(DocumentSignatureMode)
  signatureMode?: DocumentSignatureMode;
  @IsOptional() @IsBoolean() defaultEmployeeVisibility?: boolean;
}
