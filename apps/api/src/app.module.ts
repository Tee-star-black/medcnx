import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AttendanceModule } from './attendance/attendance.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { DepartmentsModule } from './departments/departments.module';
import { EmployeesModule } from './employees/employees.module';
import { GeneratedDocumentsModule } from './generated-documents/generated-documents.module';
import { PerformanceModule } from './performance/performance.module';
import { LeaveModule } from './leave/leave.module';
import { OrganisationsModule } from './organisations/organisations.module';
import { PayrollModule } from './payroll/payroll.module';
import { RecruitmentModule } from './recruitment/recruitment.module';
import { MailModule } from './mail/mail.module';
import { EmployeeSelfServiceModule } from './employee-self-service/employee-self-service.module';
import { AccessControlModule } from './access-control/access-control.module';
import { validateEnvironment } from './config/validate-environment';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
    }),
    DatabaseModule,
    AuthModule,
    OrganisationsModule,
    DepartmentsModule,
    EmployeesModule,
    LeaveModule,
    AuditLogsModule,
    AttendanceModule,
    GeneratedDocumentsModule,
    PerformanceModule,
    PayrollModule,
    RecruitmentModule,
    MailModule,
    EmployeeSelfServiceModule,
    AccessControlModule,
  ],
})
export class AppModule {}
