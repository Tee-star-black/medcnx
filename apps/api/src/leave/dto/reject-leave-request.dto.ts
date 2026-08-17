import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectLeaveRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  rejectionNote?: string;
}
