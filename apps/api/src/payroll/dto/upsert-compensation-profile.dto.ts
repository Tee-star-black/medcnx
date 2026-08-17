import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpsertCompensationProfileDto {
  @IsOptional()
  @IsString()
  @IsIn(['MONTHLY', 'WEEKLY', 'FORTNIGHTLY'])
  paymentFrequency?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  basicSalary?: number;

  @IsOptional()
  @IsBoolean()
  autoPaye?: boolean;

  @IsOptional()
  @IsBoolean()
  uifEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pensionEmployee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pensionEmployer?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  medicalAidEmployee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  medicalAidEmployer?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  medicalSchemeMembers?: number;

  @IsOptional()
  @IsString()
  @IsIn(['NONE', 'FIXED_PERCENTAGE', 'FIXED_AMOUNT'])
  taxDirectiveMode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  taxDirectiveReference?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxDirectiveValue?: number;

  @IsOptional()
  @IsDateString()
  taxDirectiveValidFrom?: string;

  @IsOptional()
  @IsDateString()
  taxDirectiveValidTo?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultAllowances?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultOtherDeductions?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  bankName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  bankAccountNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  paymentReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
