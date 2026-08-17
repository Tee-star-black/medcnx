ALTER TABLE "employee_compensation_profiles"
ADD COLUMN "medicalSchemeMembers" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "payroll_run_items"
ADD COLUMN "payeAnnualRebate" DECIMAL(12, 2),
ADD COLUMN "payeAnnualMedicalCredit" DECIMAL(12, 2),
ADD COLUMN "sdlEmployer" DECIMAL(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE "payroll_runs"
ADD COLUMN "totalSdlEmployer" DECIMAL(12, 2) NOT NULL DEFAULT 0;
