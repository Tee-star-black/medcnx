import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class GeneratePayslipDto {
  @IsString()
  employeeId: string;

  @IsInt()
  @Min(1)
  @Max(12)
  periodMonth: number;

  @IsInt()
  @Min(2000)
  @Max(2100)
  periodYear: number;

  @IsNumber()
  @Min(0)
  basicSalary: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  overtime?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  bonus?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  commission?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  allowances?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  paye?: number;

  @IsOptional()
  @IsBoolean()
  autoPaye?: boolean;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  medicalSchemeMembers?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  payeRegularTaxableIncomeYtd?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  payeAnnualPaymentsYtd?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  payeYtdBeforeCurrent?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  payePeriodsWorked?: number;

  @IsOptional()
  @IsString()
  @IsIn(['NONE', 'FIXED_PERCENTAGE', 'FIXED_AMOUNT'])
  taxDirectiveMode?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxDirectiveValue?: number;

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
  @IsNumber()
  @Min(0)
  otherDeductions?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  uifEmployeeRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  uifEmployerRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  uifMonthlyCap?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sdlEmployerRate?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  paymentDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  generatedBy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  visibleToEmployee?: boolean;

  @IsOptional()
  @IsBoolean()
  isConfidential?: boolean;
}
