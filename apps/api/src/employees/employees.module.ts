import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmployeeSelfServiceModule } from '../employee-self-service/employee-self-service.module';
import { EmployeeLifecycleService } from './employee-lifecycle.service';
import { EmployeeManagerService } from './employee-manager.service';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';

@Module({
  imports: [AuthModule, EmployeeSelfServiceModule],
  controllers: [EmployeesController],
  providers: [EmployeesService, EmployeeLifecycleService, EmployeeManagerService],
})
export class EmployeesModule {}
