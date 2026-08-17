import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewProfileChangeRequestDto {
  @IsIn(['APPROVED', 'REJECTED'])
  decision!: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comments?: string;
}
