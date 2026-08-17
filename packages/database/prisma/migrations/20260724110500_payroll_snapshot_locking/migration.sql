ALTER TABLE "payroll_runs"
ADD COLUMN "calculatedAt" TIMESTAMP(3),
ADD COLUMN "lockedAt" TIMESTAMP(3),
ADD COLUMN "lockedByUserId" TEXT,
ADD COLUMN "lockReason" TEXT,
ADD COLUMN "calculationVersion" TEXT,
ADD COLUMN "calculationSnapshot" JSONB;

ALTER TABLE "payroll_run_items"
ADD COLUMN "inputSnapshot" JSONB,
ADD COLUMN "calculationSnapshot" JSONB;

CREATE INDEX "payroll_runs_lockedAt_idx"
ON "payroll_runs"("lockedAt");
