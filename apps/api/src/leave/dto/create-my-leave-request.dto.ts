import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { LeaveTypeDto } from './create-leave-request.dto';

export class CreateMyLeaveRequestDto {
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
