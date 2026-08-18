import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PositionHistoryService } from './position-history.service';
import { PositionsController } from './positions.controller';
import { PositionsService } from './positions.service';

@Module({
  imports: [AuthModule],
  controllers: [PositionsController],
  providers: [PositionsService, PositionHistoryService],
  exports: [PositionsService],
})
export class PositionsModule {}
