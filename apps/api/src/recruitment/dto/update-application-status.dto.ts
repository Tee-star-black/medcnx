import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateApplicationStatusDto {
  @IsString()
  @IsIn([
    'APPLIED',
    'SCREENING',
    'INTERVIEW',
    'OFFER',
    'HIRED',
    'REJECTED',
    'WITHDRAWN',
  ])
  status: string;

  @IsOptional()
  @IsString()
  interviewDate?: string;

  @IsOptional()
  @IsString()
  offerDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  expectedSalary?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
