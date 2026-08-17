import { IsDateString, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AssignPositionDto {
  @IsString()
  positionId!: string;

  @IsDateString()
  effectiveDate!: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason?: string;
}
