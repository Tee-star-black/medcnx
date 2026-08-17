import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdatePayrollRunItemInputsDto {
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
  otherDeductions?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
