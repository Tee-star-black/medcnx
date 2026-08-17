import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class PrepareCeoApprovalDto {
  @IsUUID()
  approverUserId: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  requestNote?: string;
}
