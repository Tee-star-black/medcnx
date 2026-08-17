import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateCandidateDto {
  @IsString()
  @MaxLength(120)
  firstName: string;

  @IsString()
  @MaxLength(120)
  lastName: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  currentCompany?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  currentRole?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  source?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
