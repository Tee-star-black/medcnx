import { IsDateString, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class EmployeeManagerChangeDto {
  @IsOptional()
  @IsString()
  managerId?: string;

  @IsDateString()
  effectiveDate!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
