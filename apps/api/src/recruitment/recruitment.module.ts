import { Module } from '@nestjs/common';
import { RecruitmentController } from './recruitment.controller';
import { RecruitmentHiringService } from './recruitment-hiring.service';
import { RecruitmentService } from './recruitment.service';

@Module({
  controllers: [RecruitmentController],
  providers: [RecruitmentService, RecruitmentHiringService],
})
export class RecruitmentModule {}
