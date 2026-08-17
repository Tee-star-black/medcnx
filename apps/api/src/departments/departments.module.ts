import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DepartmentStructureService } from './department-structure.service';
import { DepartmentsController } from './departments.controller';
import { DepartmentsService } from './departments.service';

@Module({
  imports: [AuthModule],
  controllers: [DepartmentsController],
  providers: [DepartmentsService, DepartmentStructureService],
})
export class DepartmentsModule {}
