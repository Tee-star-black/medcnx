import {
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class HireApplicationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  employeeNumber: string;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  employmentType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
