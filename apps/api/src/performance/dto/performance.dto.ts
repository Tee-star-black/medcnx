import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  DevelopmentPlanStatus,
  PerformanceAssessmentType,
  PerformanceGoalPriority,
  PerformanceGoalStatus,
  PerformanceReviewerType,
  PerformanceTemplateStatus,
} from '@prisma/client';

export class PerformanceQuestionDto {
  @IsString() @MaxLength(80) id!: string;
  @IsString() @MaxLength(500) label!: string;
  @IsIn(['RATING', 'TEXT', 'YES_NO', 'MULTIPLE_CHOICE'])
  type!: 'RATING' | 'TEXT' | 'YES_NO' | 'MULTIPLE_CHOICE';
  @IsOptional() @IsString() @MaxLength(160) competency?: string;
  @IsOptional() @IsString() @MaxLength(500) helpText?: string;
  @IsOptional() @IsBoolean() required?: boolean;
  @IsOptional() @IsInt() @Min(2) @Max(10) maxScore?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(20) options?: string[];
}

export class CreatePerformanceTemplateDto {
  @IsString() @MaxLength(160) name!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsEnum(PerformanceAssessmentType) type!: PerformanceAssessmentType;
  @IsOptional() @IsEnum(PerformanceTemplateStatus)
  status?: PerformanceTemplateStatus;
  @IsOptional() @IsBoolean() anonymous?: boolean;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PerformanceQuestionDto)
  questions!: PerformanceQuestionDto[];
}

export class CreatePerformanceCycleDto {
  @IsString() templateId!: string;
  @IsString() @MaxLength(160) name!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsDateString() startDate!: string;
  @IsDateString() dueDate!: string;
}

export class AssignPerformanceReviewDto {
  @IsString() employeeId!: string;
  @IsString() reviewerUserId!: string;
  @IsEnum(PerformanceReviewerType) reviewerType!: PerformanceReviewerType;
  @IsOptional() @IsBoolean() confidential?: boolean;
}

export class SavePerformanceReviewDto {
  @IsObject() answers!: Record<string, unknown>;
  @IsOptional() @IsNumber() @Min(0) @Max(10) overallScore?: number;
  @IsOptional() @IsString() @MaxLength(4000) strengths?: string;
  @IsOptional() @IsString() @MaxLength(4000) developmentAreas?: string;
}

export class FinalisePerformanceReviewDto {
  @IsString() @MaxLength(6000) managerSummary!: string;
  @IsString() @MaxLength(3000) finalOutcome!: string;
}

export class AcknowledgePerformanceReviewDto {
  @IsOptional() @IsString() @MaxLength(3000) employeeComments?: string;
}

export class CreatePerformanceGoalDto {
  @IsString() employeeId!: string;
  @IsOptional() @IsString() reviewId?: string;
  @IsString() @MaxLength(200) title!: string;
  @IsOptional() @IsString() @MaxLength(3000) description?: string;
  @IsOptional() @IsString() @MaxLength(1000) successMeasure?: string;
  @IsOptional() @IsEnum(PerformanceGoalPriority)
  priority?: PerformanceGoalPriority;
  @IsDateString() targetDate!: string;
}

export class UpdatePerformanceGoalDto {
  @IsOptional() @IsEnum(PerformanceGoalStatus) status?: PerformanceGoalStatus;
  @IsOptional() @IsInt() @Min(0) @Max(100) progress?: number;
  @IsOptional() @IsString() @MaxLength(3000) evidence?: string;
  @IsOptional() @IsString() @MaxLength(3000) managerComments?: string;
}

export class CreateDevelopmentPlanDto {
  @IsString() employeeId!: string;
  @IsOptional() @IsString() reviewId?: string;
  @IsString() @MaxLength(200) title!: string;
  @IsString() @MaxLength(3000) developmentNeed!: string;
  @IsString() @MaxLength(4000) actionPlan!: string;
  @IsOptional() @IsString() @MaxLength(2000) supportRequired?: string;
  @IsDateString() targetDate!: string;
}

export class UpdateDevelopmentPlanDto {
  @IsOptional() @IsEnum(DevelopmentPlanStatus)
  status?: DevelopmentPlanStatus;
  @IsOptional() @IsString() @MaxLength(4000) progressNotes?: string;
}

export class CreateCompetencyDto {
  @IsString() @MaxLength(160) name!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsString() @MaxLength(120) category!: string;
  @IsOptional() @IsArray() @ArrayMaxSize(30) behaviouralIndicators?: string[];
}
