import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export enum LeaveTypeDto {
  ANNUAL = 'ANNUAL',
  SICK = 'SICK',
  FAMILY_RESPONSIBILITY = 'FAMILY_RESPONSIBILITY',
  MATERNITY = 'MATERNITY',
  PATERNITY = 'PATERNITY',
  STUDY = 'STUDY',
  UNPAID = 'UNPAID',
  OTHER = 'OTHER',
}

export class CreateLeaveRequestDto {
  @IsUUID()
  employeeId: string;

  @IsEnum(LeaveTypeDto)
  leaveType: LeaveTypeDto;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
