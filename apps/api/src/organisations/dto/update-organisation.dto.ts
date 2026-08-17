import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateOrganisationDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  province?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  postalCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  standardClockInTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  standardClockOutTime?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(240)
  lateClockInThresholdMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  defaultWorkingHoursPerDay?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  leaveYearStartMonth?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  defaultAnnualLeaveDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  sickLeaveCycleDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  sickLeaveDocumentThresholdDays?: number;

  @IsOptional()
  @IsBoolean()
  autoMarkMissedClockOut?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  attendanceWorkingDays?: number[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  attendanceGracePeriodMinutes?: number;

  @IsOptional()
  @IsBoolean()
  allowEarlyClockIn?: boolean;

  @IsOptional()
  @IsBoolean()
  allowEarlyClockOut?: boolean;

  @IsOptional()
  @IsBoolean()
  requireLateAttendanceNote?: boolean;

  @IsOptional()
  @IsBoolean()
  requireEarlyClockOutNote?: boolean;

  @IsOptional()
  @IsBoolean()
  managersMayEditAttendance?: boolean;

  @IsOptional()
  @IsBoolean()
  attendanceCorrectionsRequireApproval?: boolean;
}
