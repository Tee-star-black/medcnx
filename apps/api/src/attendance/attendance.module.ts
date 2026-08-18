import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmployeeSelfServiceModule } from '../employee-self-service/employee-self-service.module';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { ManagerAttendanceService } from './manager-attendance.service';

@Module({
  imports: [AuthModule, EmployeeSelfServiceModule],
  controllers: [AttendanceController],
  providers: [AttendanceService, ManagerAttendanceService],
})
export class AttendanceModule {}
