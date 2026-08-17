CREATE TABLE IF NOT EXISTS "payroll_runs" (
  "id" TEXT PRIMARY KEY,
  "organisationId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "periodMonth" INTEGER NOT NULL,
  "periodYear" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',

  "employeeCount" INTEGER NOT NULL DEFAULT 0,

  "totalBasicSalary" NUMERIC(12, 2) NOT NULL DEFAULT 0,
  "totalOvertime" NUMERIC(12, 2) NOT NULL DEFAULT 0,
  "totalBonus" NUMERIC(12, 2) NOT NULL DEFAULT 0,
  "totalCommission" NUMERIC(12, 2) NOT NULL DEFAULT 0,
  "totalAllowances" NUMERIC(12, 2) NOT NULL DEFAULT 0,
  "totalGrossPay" NUMERIC(12, 2) NOT NULL DEFAULT 0,

  "totalPaye" NUMERIC(12, 2) NOT NULL DEFAULT 0,
  "totalUifEmployee" NUMERIC(12, 2) NOT NULL DEFAULT 0,
  "totalPensionEmployee" NUMERIC(12, 2) NOT NULL DEFAULT 0,
  "totalMedicalAidEmployee" NUMERIC(12, 2) NOT NULL DEFAULT 0,
  "totalOtherDeductions" NUMERIC(12, 2) NOT NULL DEFAULT 0,
  "totalDeductions" NUMERIC(12, 2) NOT NULL DEFAULT 0,
  "totalNetPay" NUMERIC(12, 2) NOT NULL DEFAULT 0,

  "totalUifEmployer" NUMERIC(12, 2) NOT NULL DEFAULT 0,
  "totalPensionEmployer" NUMERIC(12, 2) NOT NULL DEFAULT 0,
  "totalMedicalAidEmployer" NUMERIC(12, 2) NOT NULL DEFAULT 0,
  "totalEmployerContributions" NUMERIC(12, 2) NOT NULL DEFAULT 0,

  "notes" TEXT,
  "createdByUserId" TEXT,
  "finalisedByUserId" TEXT,
  "finalisedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "payroll_runs_organisationId_fkey"
    FOREIGN KEY ("organisationId") REFERENCES "organisations"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT "payroll_runs_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "users"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  CONSTRAINT "payroll_runs_finalisedByUserId_fkey"
    FOREIGN KEY ("finalisedByUserId") REFERENCES "users"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "payroll_runs_organisationId_periodMonth_periodYear_title_key"
ON "payroll_runs"("organisationId", "periodMonth", "periodYear", "title");

CREATE INDEX IF NOT EXISTS "payroll_runs_organisationId_idx"
ON "payroll_runs"("organisationId");

CREATE INDEX IF NOT EXISTS "payroll_runs_periodMonth_periodYear_idx"
ON "payroll_runs"("periodMonth", "periodYear");

CREATE INDEX IF NOT EXISTS "payroll_runs_status_idx"
ON "payroll_runs"("status");

CREATE TABLE IF NOT EXISTS "payroll_run_items" (
  "id" TEXT PRIMARY KEY,
  "organisationId" TEXT NOT NULL,
  "payrollRunId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,

  "periodMonth" INTEGER NOT NULL,
  "periodYear" INTEGER NOT NULL,

  "basicSalary" NUMERIC(12, 2) NOT NULL DEFAULT 0,
  "overtime" NUMERIC(12, 2) NOT NULL DEFAULT 0,
  "bonus" NUMERIC(12, 2) NOT NULL DEFAULT 0,
  "commission" NUMERIC(12, 2) NOT NULL DEFAULT 0,
  "allowances" NUMERIC(12, 2) NOT NULL DEFAULT 0,
  "grossPay" NUMERIC(12, 2) NOT NULL DEFAULT 0,

  "paye" NUMERIC(12, 2) NOT NULL DEFAULT 0,
  "uifEmployee" NUMERIC(12, 2) NOT NULL DEFAULT 0,
  "pensionEmployee" NUMERIC(12, 2) NOT NULL DEFAULT 0,
  "medicalAidEmployee" NUMERIC(12, 2) NOT NULL DEFAULT 0,
  "otherDeductions" NUMERIC(12, 2) NOT NULL DEFAULT 0,
  "totalDeductions" NUMERIC(12, 2) NOT NULL DEFAULT 0,
  "netPay" NUMERIC(12, 2) NOT NULL DEFAULT 0,

  "uifEmployer" NUMERIC(12, 2) NOT NULL DEFAULT 0,
  "pensionEmployer" NUMERIC(12, 2) NOT NULL DEFAULT 0,
  "medicalAidEmployer" NUMERIC(12, 2) NOT NULL DEFAULT 0,
  "employerTotal" NUMERIC(12, 2) NOT NULL DEFAULT 0,

  "payeMode" TEXT,
  "payeTaxYear" INTEGER,
  "payeAnnualTaxableIncome" NUMERIC(12, 2),
  "payeAnnualTaxBeforeRebate" NUMERIC(12, 2),
  "payeAnnualTaxAfterRebate" NUMERIC(12, 2),

  "payslipDocumentId" TEXT,
  "notes" TEXT,

  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "payroll_run_items_organisationId_fkey"
    FOREIGN KEY ("organisationId") REFERENCES "organisations"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT "payroll_run_items_payrollRunId_fkey"
    FOREIGN KEY ("payrollRunId") REFERENCES "payroll_runs"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT "payroll_run_items_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "employees"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "payroll_run_items_payrollRunId_employeeId_key"
ON "payroll_run_items"("payrollRunId", "employeeId");

CREATE INDEX IF NOT EXISTS "payroll_run_items_organisationId_idx"
ON "payroll_run_items"("organisationId");

CREATE INDEX IF NOT EXISTS "payroll_run_items_payrollRunId_idx"
ON "payroll_run_items"("payrollRunId");

CREATE INDEX IF NOT EXISTS "payroll_run_items_employeeId_idx"
ON "payroll_run_items"("employeeId");

CREATE INDEX IF NOT EXISTS "payroll_run_items_periodMonth_periodYear_idx"
ON "payroll_run_items"("periodMonth", "periodYear");