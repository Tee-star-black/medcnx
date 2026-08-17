import { Module } from '@nestjs/common';
import { EmployeeContextService } from './employee-context.service';
import { EmployeeSelfServiceController } from './employee-self-service.controller';
import { EmployeeSelfServiceService } from './employee-self-service.service';
import { EmployeeNotificationService } from './employee-notification.service';

@Module({
  controllers: [EmployeeSelfServiceController],
  providers: [
    EmployeeContextService,
    EmployeeNotificationService,
    EmployeeSelfServiceService,
  ],
  exports: [
    EmployeeContextService,
    EmployeeNotificationService,
    EmployeeSelfServiceService,
  ],
})
export class EmployeeSelfServiceModule {}
