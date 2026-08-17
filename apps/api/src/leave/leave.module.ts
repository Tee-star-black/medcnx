import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmployeeSelfServiceModule } from '../employee-self-service/employee-self-service.module';
import { LeaveController } from './leave.controller';
import { LeaveService } from './leave.service';

@Module({
  imports: [AuthModule, EmployeeSelfServiceModule],
  controllers: [LeaveController],
  providers: [LeaveService],
})
export class LeaveModule {}
