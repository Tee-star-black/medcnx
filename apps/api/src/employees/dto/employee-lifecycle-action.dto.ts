import { IsDateString, IsString, MaxLength, MinLength } from 'class-validator';

export class EmployeeLifecycleActionDto {
  @IsDateString()
  effectiveDate!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
