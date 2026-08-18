import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ManagerPerformanceService } from './manager-performance.service';
import { PerformanceController } from './performance.controller';
import { PerformanceService } from './performance.service';

@Module({
  imports: [AuthModule],
  controllers: [PerformanceController],
  providers: [PerformanceService, ManagerPerformanceService],
})
export class PerformanceModule {}
