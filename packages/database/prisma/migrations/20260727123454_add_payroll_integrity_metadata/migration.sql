-- Add payroll-run calculation and locking metadata.
-- IF NOT EXISTS allows the migration history to rebuild cleanly in Prisma's
-- shadow database where some columns may already have been introduced.

ALTER TABLE "payroll_runs"
    ADD COLUMN IF NOT EXISTS "calculatedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "lockedByUserId" TEXT,
    ADD COLUMN IF NOT EXISTS "lockReason" TEXT;

ALTER TABLE "payroll_run_items"
    ADD COLUMN IF NOT EXISTS "inputSnapshot" JSONB,
    ADD COLUMN IF NOT EXISTS "calculationSnapshot" JSONB;