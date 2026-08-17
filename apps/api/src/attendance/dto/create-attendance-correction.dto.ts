import { AttendanceCorrectionReason } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateAttendanceCorrectionDto {
  @IsOptional()
  @IsUUID()
  attendanceRecordId?: string;

  @IsDateString()
  requestedDate!: string;

  @IsOptional()
  @IsDateString()
  requestedClockInAt?: string;

  @IsOptional()
  @IsDateString()
  requestedClockOutAt?: string;

  @IsEnum(AttendanceCorrectionReason)
  reasonCategory!: AttendanceCorrectionReason;

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  explanation!: string;
}
