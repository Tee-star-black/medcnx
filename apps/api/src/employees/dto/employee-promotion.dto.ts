import { IsDateString, IsString, MaxLength, MinLength } from 'class-validator';

export class EmployeePromotionDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  jobTitle!: string;

  @IsDateString()
  effectiveDate!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
