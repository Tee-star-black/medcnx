import { Module } from '@nestjs/common';
import { LeaveController } from './leave.controller';
import { LeaveService } from './leave.service';
import { EmployeeSelfServiceModule } from '../employee-self-service/employee-self-service.module';

@Module({
  imports: [EmployeeSelfServiceModule],
  controllers: [LeaveController],
  providers: [LeaveService],
})
export class LeaveModule {}
