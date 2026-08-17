import { EmployeeProfileChangeField } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateProfileChangeRequestDto {
  @IsEnum(EmployeeProfileChangeField)
  field!: EmployeeProfileChangeField;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  requestedValue!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
