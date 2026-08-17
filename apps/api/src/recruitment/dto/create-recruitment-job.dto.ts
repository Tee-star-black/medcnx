import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateRecruitmentJobDto {
  @IsString()
  @MaxLength(160)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  reference?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  employmentType?: string;

  @IsOptional()
  @IsString()
  @IsIn(['OPEN', 'ON_HOLD', 'CLOSED'])
  status?: string;

  @IsOptional()
  @IsString()
  openingDate?: string;

  @IsOptional()
  @IsString()
  closingDate?: string;
}
