import { Module } from '@nestjs/common';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { EmployeeSelfServiceModule } from '../employee-self-service/employee-self-service.module';

@Module({
  imports: [EmployeeSelfServiceModule],
  controllers: [AttendanceController],
  providers: [AttendanceService],
})
export class AttendanceModule {}
