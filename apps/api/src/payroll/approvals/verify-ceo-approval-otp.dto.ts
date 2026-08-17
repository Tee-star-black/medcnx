import {
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export class VerifyCeoApprovalOtpDto {
  @IsUUID()
  challengeId: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, {
    message: 'OTP must contain exactly six digits.',
  })
  code: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  decisionNote?: string;
}
