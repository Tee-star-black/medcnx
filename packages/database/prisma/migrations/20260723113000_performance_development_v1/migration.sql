-- Performance & Development V1
ALTER TYPE "EmployeeNotificationCategory" ADD VALUE IF NOT EXISTS 'PERFORMANCE';

CREATE TYPE "PerformanceAssessmentType" AS ENUM (
  'PROBATION', 'ANNUAL', 'QUARTERLY', 'SELF_ASSESSMENT',
  'MANAGER_ASSESSMENT', 'PEER_ASSESSMENT', 'REVIEW_360',
  'CLINICAL_COMPETENCY', 'TRAINING_EVALUATION',
  'PERFORMANCE_IMPROVEMENT', 'CUSTOM'
);
CREATE TYPE "PerformanceTemplateStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "PerformanceCycleStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'COMPLETED', 'ARCHIVED');
CREATE TYPE "PerformanceReviewerType" AS ENUM ('SELF', 'MANAGER', 'PEER', 'DIRECT_REPORT', 'DEPARTMENT_HEAD', 'EXTERNAL');
CREATE TYPE "PerformanceReviewStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'MANAGER_REVIEW', 'AWAITING_ACKNOWLEDGEMENT', 'COMPLETED', 'CANCELLED');
CREATE TYPE "PerformanceGoalPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "PerformanceGoalStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "DevelopmentPlanStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

ALTER TABLE "employees" ADD COLUMN "managerId" TEXT;
CREATE INDEX "employees_managerId_idx" ON "employees"("managerId");
ALTER TABLE "employees"
  ADD CONSTRAINT "employees_managerId_fkey"
  FOREIGN KEY ("managerId") REFERENCES "employees"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "performance_templates" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "type" "PerformanceAssessmentType" NOT NULL,
  "status" "PerformanceTemplateStatus" NOT NULL DEFAULT 'ACTIVE',
  "anonymous" BOOLEAN NOT NULL DEFAULT false,
  "questions" JSONB NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "performance_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "performance_cycles" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "startDate" TIMESTAMP(3) NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "status" "PerformanceCycleStatus" NOT NULL DEFAULT 'DRAFT',
  "createdByUserId" TEXT NOT NULL,
  "launchedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "performance_cycles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "performance_reviews" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "cycleId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "reviewerUserId" TEXT NOT NULL,
  "reviewerEmployeeId" TEXT,
  "reviewerType" "PerformanceReviewerType" NOT NULL,
  "status" "PerformanceReviewStatus" NOT NULL DEFAULT 'ASSIGNED',
  "confidential" BOOLEAN NOT NULL DEFAULT false,
  "answers" JSONB,
  "overallScore" DECIMAL(5,2),
  "strengths" TEXT,
  "developmentAreas" TEXT,
  "managerSummary" TEXT,
  "finalOutcome" TEXT,
  "submittedAt" TIMESTAMP(3),
  "finalisedByUserId" TEXT,
  "finalisedAt" TIMESTAMP(3),
  "employeeAcknowledgedAt" TIMESTAMP(3),
  "employeeComments" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "performance_reviews_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "performance_goals" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "reviewId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "successMeasure" TEXT,
  "priority" "PerformanceGoalPriority" NOT NULL DEFAULT 'MEDIUM',
  "status" "PerformanceGoalStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "targetDate" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "evidence" TEXT,
  "managerComments" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "performance_goals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "performance_development_plans" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "reviewId" TEXT,
  "title" TEXT NOT NULL,
  "developmentNeed" TEXT NOT NULL,
  "actionPlan" TEXT NOT NULL,
  "supportRequired" TEXT,
  "targetDate" TIMESTAMP(3) NOT NULL,
  "status" "DevelopmentPlanStatus" NOT NULL DEFAULT 'PLANNED',
  "progressNotes" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "performance_development_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "performance_competencies" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT NOT NULL,
  "behaviouralIndicators" JSONB,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "performance_competencies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "performance_templates_organisationId_name_key" ON "performance_templates"("organisationId", "name");
CREATE INDEX "performance_templates_organisationId_status_idx" ON "performance_templates"("organisationId", "status");
CREATE UNIQUE INDEX "performance_cycles_organisationId_name_key" ON "performance_cycles"("organisationId", "name");
CREATE INDEX "performance_cycles_organisationId_status_dueDate_idx" ON "performance_cycles"("organisationId", "status", "dueDate");
CREATE INDEX "performance_cycles_templateId_idx" ON "performance_cycles"("templateId");
CREATE UNIQUE INDEX "performance_reviews_cycleId_employeeId_reviewerUserId_reviewerType_key" ON "performance_reviews"("cycleId", "employeeId", "reviewerUserId", "reviewerType");
CREATE INDEX "performance_reviews_organisationId_status_idx" ON "performance_reviews"("organisationId", "status");
CREATE INDEX "performance_reviews_employeeId_status_idx" ON "performance_reviews"("employeeId", "status");
CREATE INDEX "performance_reviews_reviewerUserId_status_idx" ON "performance_reviews"("reviewerUserId", "status");
CREATE INDEX "performance_reviews_cycleId_idx" ON "performance_reviews"("cycleId");
CREATE INDEX "performance_goals_organisationId_status_targetDate_idx" ON "performance_goals"("organisationId", "status", "targetDate");
CREATE INDEX "performance_goals_employeeId_idx" ON "performance_goals"("employeeId");
CREATE INDEX "performance_goals_reviewId_idx" ON "performance_goals"("reviewId");
CREATE INDEX "performance_development_plans_organisationId_status_targetDate_idx" ON "performance_development_plans"("organisationId", "status", "targetDate");
CREATE INDEX "performance_development_plans_employeeId_idx" ON "performance_development_plans"("employeeId");
CREATE INDEX "performance_development_plans_reviewId_idx" ON "performance_development_plans"("reviewId");
CREATE UNIQUE INDEX "performance_competencies_organisationId_name_key" ON "performance_competencies"("organisationId", "name");
CREATE INDEX "performance_competencies_organisationId_active_idx" ON "performance_competencies"("organisationId", "active");

ALTER TABLE "performance_templates" ADD CONSTRAINT "performance_templates_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "performance_templates" ADD CONSTRAINT "performance_templates_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "performance_cycles" ADD CONSTRAINT "performance_cycles_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "performance_cycles" ADD CONSTRAINT "performance_cycles_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "performance_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "performance_cycles" ADD CONSTRAINT "performance_cycles_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "performance_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_reviewerEmployeeId_fkey" FOREIGN KEY ("reviewerEmployeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_finalisedByUserId_fkey" FOREIGN KEY ("finalisedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "performance_goals" ADD CONSTRAINT "performance_goals_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "performance_goals" ADD CONSTRAINT "performance_goals_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "performance_goals" ADD CONSTRAINT "performance_goals_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "performance_reviews"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "performance_goals" ADD CONSTRAINT "performance_goals_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "performance_development_plans" ADD CONSTRAINT "performance_development_plans_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "performance_development_plans" ADD CONSTRAINT "performance_development_plans_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "performance_development_plans" ADD CONSTRAINT "performance_development_plans_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "performance_reviews"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "performance_development_plans" ADD CONSTRAINT "performance_development_plans_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "performance_competencies" ADD CONSTRAINT "performance_competencies_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "performance_competencies" ADD CONSTRAINT "performance_competencies_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
