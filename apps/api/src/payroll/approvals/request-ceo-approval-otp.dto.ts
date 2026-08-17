import {
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class RequestCeoApprovalOtpDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
