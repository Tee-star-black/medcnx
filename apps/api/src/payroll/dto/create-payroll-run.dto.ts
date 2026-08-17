import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePayrollRunDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsInt()
  @Min(1)
  @Max(12)
  periodMonth: number;

  @IsInt()
  @Min(2000)
  @Max(2100)
  periodYear: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
