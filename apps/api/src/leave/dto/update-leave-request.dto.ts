import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { LeaveTypeDto } from './create-leave-request.dto';

export class UpdateLeaveRequestDto {
  @IsOptional()
  @IsEnum(LeaveTypeDto)
  leaveType?: LeaveTypeDto;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
