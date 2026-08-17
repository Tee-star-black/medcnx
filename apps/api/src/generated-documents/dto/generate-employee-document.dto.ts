import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class GenerateEmployeeDocumentDto {
  @IsString()
  employeeId: string;

  @IsString()
  @IsIn([
    'PROOF_OF_EMPLOYMENT',
    'APPOINTMENT_LETTER',
    'EMPLOYMENT_CONTRACT',
    'TERMINATION_LETTER',
    'WARNING_LETTER',
    'SALARY_CONFIRMATION',
  ])
  documentType:
    | 'PROOF_OF_EMPLOYMENT'
    | 'APPOINTMENT_LETTER'
    | 'EMPLOYMENT_CONTRACT'
    | 'TERMINATION_LETTER'
    | 'WARNING_LETTER'
    | 'SALARY_CONFIRMATION';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  salary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  issuedBy?: string;

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
