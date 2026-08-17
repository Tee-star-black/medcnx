import { Module } from '@nestjs/common';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { EmployeeSelfServiceModule } from '../employee-self-service/employee-self-service.module';

@Module({
  imports: [EmployeeSelfServiceModule],
  controllers: [EmployeesController],
  providers: [EmployeesService]
})
export class EmployeesModule {}
