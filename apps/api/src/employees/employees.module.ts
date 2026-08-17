import { Module } from '@nestjs/common';
import { EmployeeSelfServiceModule } from '../employee-self-service/employee-self-service.module';
import { EmployeeLifecycleService } from './employee-lifecycle.service';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';

@Module({
  imports: [EmployeeSelfServiceModule],
  controllers: [EmployeesController],
  providers: [EmployeesService, EmployeeLifecycleService],
})
export class EmployeesModule {}
