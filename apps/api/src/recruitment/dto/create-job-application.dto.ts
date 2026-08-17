import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateJobApplicationDto {
  @IsString()
  jobId: string;

  @IsString()
  candidateId: string;

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
