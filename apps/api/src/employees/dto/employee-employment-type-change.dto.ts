import { IsDateString, IsString, MaxLength, MinLength } from 'class-validator';

export class EmployeeEmploymentTypeChangeDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  employmentType!: string;

  @IsDateString()
  effectiveDate!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
