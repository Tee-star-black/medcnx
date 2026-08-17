import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class UpdatePositionDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  title?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  level?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  employmentCategory?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  approvedHeadcount?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
