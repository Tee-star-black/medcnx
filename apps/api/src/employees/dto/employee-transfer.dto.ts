import { IsDateString, IsString, MaxLength, MinLength } from 'class-validator';

export class EmployeeTransferDto {
  @IsString()
  departmentId!: string;

  @IsDateString()
  effectiveDate!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
