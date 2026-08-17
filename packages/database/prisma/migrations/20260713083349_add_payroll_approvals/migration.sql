-- CreateEnum
CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'CALCULATED', 'AI_AUDITED', 'HR_REVIEWED', 'FINANCE_REVIEWED', 'PENDING_CEO_APPROVAL', 'CEO_APPROVED', 'PAYMENT_PROCESSING', 'PAID', 'COMPLETED', 'FINALISED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayrollAuditRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "PayrollAuditSeverity" AS ENUM ('INFO', 'WARNING', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "PayrollAuditFindingStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "PayrollApprovalType" AS ENUM ('HR_REVIEW', 'FINANCE_REVIEW', 'CEO_APPROVAL');

-- CreateEnum
CREATE TYPE "PayrollApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RecruitmentJobStatus" AS ENUM ('OPEN', 'ON_HOLD', 'CLOSED');

-- CreateEnum
CREATE TYPE "JobApplicationStatus" AS ENUM ('APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED', 'WITHDRAWN');

-- AlterTable
ALTER TABLE "organisations" ADD COLUMN     "autoMarkMissedClockOut" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "defaultAnnualLeaveDays" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "defaultWorkingHoursPerDay" INTEGER NOT NULL DEFAULT 8,
ADD COLUMN     "lateClockInThresholdMinutes" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "leaveYearStartMonth" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "sickLeaveCycleDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "sickLeaveDocumentThresholdDays" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "standardClockInTime" TEXT NOT NULL DEFAULT '08:00',
ADD COLUMN     "standardClockOutTime" TEXT NOT NULL DEFAULT '17:00';

-- CreateTable
CREATE TABLE "employee_compensation_profiles" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "paymentFrequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "basicSalary" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "autoPaye" BOOLEAN NOT NULL DEFAULT true,
    "uifEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pensionEmployee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "pensionEmployer" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "medicalAidEmployee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "medicalAidEmployer" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "defaultAllowances" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "defaultOtherDeductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "bankName" TEXT,
    "bankAccountNumber" TEXT,
    "paymentReference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_compensation_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_runs" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
    "employeeCount" INTEGER NOT NULL DEFAULT 0,
    "totalBasicSalary" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalOvertime" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalBonus" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalCommission" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAllowances" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalGrossPay" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalPaye" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalUifEmployee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalPensionEmployee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalMedicalAidEmployee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalOtherDeductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalDeductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalNetPay" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalUifEmployer" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalPensionEmployer" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalMedicalAidEmployer" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalEmployerContributions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdByUserId" TEXT,
    "finalisedByUserId" TEXT,
    "finalisedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_run_items" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "basicSalary" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "overtime" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "bonus" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "commission" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "allowances" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "grossPay" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paye" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "uifEmployee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "pensionEmployee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "medicalAidEmployee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "otherDeductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalDeductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netPay" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "uifEmployer" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "pensionEmployer" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "medicalAidEmployer" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "employerTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "payeMode" TEXT,
    "payeTaxYear" INTEGER,
    "payeAnnualTaxableIncome" DECIMAL(12,2),
    "payeAnnualTaxBeforeRebate" DECIMAL(12,2),
    "payeAnnualTaxAfterRebate" DECIMAL(12,2),
    "payslipDocumentId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_run_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_audits" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "healthScore" INTEGER NOT NULL DEFAULT 100,
    "riskLevel" "PayrollAuditRiskLevel" NOT NULL DEFAULT 'LOW',
    "criticalCount" INTEGER NOT NULL DEFAULT 0,
    "highCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "infoCount" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "analysedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "analysedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_audit_findings" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "payrollAuditId" TEXT NOT NULL,
    "employeeId" TEXT,
    "ruleCode" TEXT NOT NULL,
    "severity" "PayrollAuditSeverity" NOT NULL,
    "status" "PayrollAuditFindingStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "currentValue" DECIMAL(14,2),
    "previousValue" DECIMAL(14,2),
    "varianceValue" DECIMAL(14,2),
    "varianceRate" DECIMAL(8,4),
    "metadata" JSONB,
    "acknowledgedById" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_audit_findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_timeline_events" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "eventType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_timeline_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_approvals" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "approvalType" "PayrollApprovalType" NOT NULL,
    "status" "PayrollApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "requestedByUserId" TEXT,
    "approverUserId" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "requestNote" TEXT,
    "decisionNote" TEXT,
    "rejectionReason" TEXT,
    "summarySnapshot" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recruitment_jobs" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "departmentId" TEXT,
    "createdByUserId" TEXT,
    "title" TEXT NOT NULL,
    "reference" TEXT,
    "description" TEXT,
    "location" TEXT,
    "employmentType" TEXT,
    "status" "RecruitmentJobStatus" NOT NULL DEFAULT 'OPEN',
    "openingDate" TIMESTAMP(3),
    "closingDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recruitment_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidates" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "currentCompany" TEXT,
    "currentRole" TEXT,
    "location" TEXT,
    "source" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_applications" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "status" "JobApplicationStatus" NOT NULL DEFAULT 'APPLIED',
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "interviewDate" TIMESTAMP(3),
    "offerDate" TIMESTAMP(3),
    "decisionDate" TIMESTAMP(3),
    "expectedSalary" DECIMAL(12,2),
    "rating" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "clockInAt" TIMESTAMP(3) NOT NULL,
    "clockOutAt" TIMESTAMP(3),
    "status" "AttendanceStatus" NOT NULL DEFAULT 'CLOCKED_IN',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employee_compensation_profiles_employeeId_key" ON "employee_compensation_profiles"("employeeId");

-- CreateIndex
CREATE INDEX "employee_compensation_profiles_organisationId_idx" ON "employee_compensation_profiles"("organisationId");

-- CreateIndex
CREATE INDEX "employee_compensation_profiles_employeeId_idx" ON "employee_compensation_profiles"("employeeId");

-- CreateIndex
CREATE INDEX "payroll_runs_organisationId_idx" ON "payroll_runs"("organisationId");

-- CreateIndex
CREATE INDEX "payroll_runs_periodMonth_periodYear_idx" ON "payroll_runs"("periodMonth", "periodYear");

-- CreateIndex
CREATE INDEX "payroll_runs_status_idx" ON "payroll_runs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_runs_organisationId_periodMonth_periodYear_title_key" ON "payroll_runs"("organisationId", "periodMonth", "periodYear", "title");

-- CreateIndex
CREATE INDEX "payroll_run_items_organisationId_idx" ON "payroll_run_items"("organisationId");

-- CreateIndex
CREATE INDEX "payroll_run_items_payrollRunId_idx" ON "payroll_run_items"("payrollRunId");

-- CreateIndex
CREATE INDEX "payroll_run_items_employeeId_idx" ON "payroll_run_items"("employeeId");

-- CreateIndex
CREATE INDEX "payroll_run_items_periodMonth_periodYear_idx" ON "payroll_run_items"("periodMonth", "periodYear");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_run_items_payrollRunId_employeeId_key" ON "payroll_run_items"("payrollRunId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_audits_payrollRunId_key" ON "payroll_audits"("payrollRunId");

-- CreateIndex
CREATE INDEX "payroll_audits_organisationId_idx" ON "payroll_audits"("organisationId");

-- CreateIndex
CREATE INDEX "payroll_audits_payrollRunId_idx" ON "payroll_audits"("payrollRunId");

-- CreateIndex
CREATE INDEX "payroll_audits_riskLevel_idx" ON "payroll_audits"("riskLevel");

-- CreateIndex
CREATE INDEX "payroll_audits_blocked_idx" ON "payroll_audits"("blocked");

-- CreateIndex
CREATE INDEX "payroll_audit_findings_organisationId_idx" ON "payroll_audit_findings"("organisationId");

-- CreateIndex
CREATE INDEX "payroll_audit_findings_payrollAuditId_idx" ON "payroll_audit_findings"("payrollAuditId");

-- CreateIndex
CREATE INDEX "payroll_audit_findings_employeeId_idx" ON "payroll_audit_findings"("employeeId");

-- CreateIndex
CREATE INDEX "payroll_audit_findings_severity_idx" ON "payroll_audit_findings"("severity");

-- CreateIndex
CREATE INDEX "payroll_audit_findings_status_idx" ON "payroll_audit_findings"("status");

-- CreateIndex
CREATE INDEX "payroll_audit_findings_ruleCode_idx" ON "payroll_audit_findings"("ruleCode");

-- CreateIndex
CREATE INDEX "payroll_timeline_events_organisationId_idx" ON "payroll_timeline_events"("organisationId");

-- CreateIndex
CREATE INDEX "payroll_timeline_events_payrollRunId_idx" ON "payroll_timeline_events"("payrollRunId");

-- CreateIndex
CREATE INDEX "payroll_timeline_events_eventType_idx" ON "payroll_timeline_events"("eventType");

-- CreateIndex
CREATE INDEX "payroll_timeline_events_createdAt_idx" ON "payroll_timeline_events"("createdAt");

-- CreateIndex
CREATE INDEX "payroll_approvals_organisationId_idx" ON "payroll_approvals"("organisationId");

-- CreateIndex
CREATE INDEX "payroll_approvals_payrollRunId_idx" ON "payroll_approvals"("payrollRunId");

-- CreateIndex
CREATE INDEX "payroll_approvals_approvalType_idx" ON "payroll_approvals"("approvalType");

-- CreateIndex
CREATE INDEX "payroll_approvals_status_idx" ON "payroll_approvals"("status");

-- CreateIndex
CREATE INDEX "payroll_approvals_approverUserId_idx" ON "payroll_approvals"("approverUserId");

-- CreateIndex
CREATE INDEX "payroll_approvals_requestedAt_idx" ON "payroll_approvals"("requestedAt");

-- CreateIndex
CREATE INDEX "recruitment_jobs_organisationId_idx" ON "recruitment_jobs"("organisationId");

-- CreateIndex
CREATE INDEX "recruitment_jobs_departmentId_idx" ON "recruitment_jobs"("departmentId");

-- CreateIndex
CREATE INDEX "recruitment_jobs_status_idx" ON "recruitment_jobs"("status");

-- CreateIndex
CREATE INDEX "recruitment_jobs_createdByUserId_idx" ON "recruitment_jobs"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "recruitment_jobs_organisationId_reference_key" ON "recruitment_jobs"("organisationId", "reference");

-- CreateIndex
CREATE INDEX "candidates_organisationId_idx" ON "candidates"("organisationId");

-- CreateIndex
CREATE INDEX "candidates_email_idx" ON "candidates"("email");

-- CreateIndex
CREATE INDEX "candidates_createdByUserId_idx" ON "candidates"("createdByUserId");

-- CreateIndex
CREATE INDEX "job_applications_organisationId_idx" ON "job_applications"("organisationId");

-- CreateIndex
CREATE INDEX "job_applications_jobId_idx" ON "job_applications"("jobId");

-- CreateIndex
CREATE INDEX "job_applications_candidateId_idx" ON "job_applications"("candidateId");

-- CreateIndex
CREATE INDEX "job_applications_status_idx" ON "job_applications"("status");

-- CreateIndex
CREATE UNIQUE INDEX "job_applications_jobId_candidateId_key" ON "job_applications"("jobId", "candidateId");

-- CreateIndex
CREATE INDEX "attendance_records_organisationId_idx" ON "attendance_records"("organisationId");

-- CreateIndex
CREATE INDEX "attendance_records_employeeId_idx" ON "attendance_records"("employeeId");

-- CreateIndex
CREATE INDEX "attendance_records_clockInAt_idx" ON "attendance_records"("clockInAt");

-- CreateIndex
CREATE INDEX "attendance_records_status_idx" ON "attendance_records"("status");

-- AddForeignKey
ALTER TABLE "employee_compensation_profiles" ADD CONSTRAINT "employee_compensation_profiles_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_compensation_profiles" ADD CONSTRAINT "employee_compensation_profiles_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_finalisedByUserId_fkey" FOREIGN KEY ("finalisedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_run_items" ADD CONSTRAINT "payroll_run_items_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_run_items" ADD CONSTRAINT "payroll_run_items_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_run_items" ADD CONSTRAINT "payroll_run_items_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_audits" ADD CONSTRAINT "payroll_audits_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_audits" ADD CONSTRAINT "payroll_audits_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_audits" ADD CONSTRAINT "payroll_audits_analysedById_fkey" FOREIGN KEY ("analysedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_audit_findings" ADD CONSTRAINT "payroll_audit_findings_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_audit_findings" ADD CONSTRAINT "payroll_audit_findings_payrollAuditId_fkey" FOREIGN KEY ("payrollAuditId") REFERENCES "payroll_audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_audit_findings" ADD CONSTRAINT "payroll_audit_findings_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_audit_findings" ADD CONSTRAINT "payroll_audit_findings_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_audit_findings" ADD CONSTRAINT "payroll_audit_findings_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_timeline_events" ADD CONSTRAINT "payroll_timeline_events_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_timeline_events" ADD CONSTRAINT "payroll_timeline_events_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_timeline_events" ADD CONSTRAINT "payroll_timeline_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_approvals" ADD CONSTRAINT "payroll_approvals_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_approvals" ADD CONSTRAINT "payroll_approvals_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_approvals" ADD CONSTRAINT "payroll_approvals_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_approvals" ADD CONSTRAINT "payroll_approvals_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruitment_jobs" ADD CONSTRAINT "recruitment_jobs_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruitment_jobs" ADD CONSTRAINT "recruitment_jobs_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruitment_jobs" ADD CONSTRAINT "recruitment_jobs_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "recruitment_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
