import {
  IsBooleanString,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { EmployeeDocumentCategory } from '@prisma/client';

export class UpdateEmployeeDocumentDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsEnum(EmployeeDocumentCategory)
  category?: EmployeeDocumentCategory;

  @IsOptional()
  @IsBooleanString()
  isConfidential?: string;

  @IsOptional()
  @IsBooleanString()
  visibleToEmployee?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;
}
