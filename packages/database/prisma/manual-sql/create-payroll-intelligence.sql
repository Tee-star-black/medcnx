BEGIN;

-- =========================================================
-- 1. CREATE OR UPDATE PAYROLL RUN STATUS ENUM
-- =========================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    INNER JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'PayrollRunStatus'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."PayrollRunStatus" AS ENUM (
      'DRAFT',
      'CALCULATED',
      'AI_AUDITED',
      'HR_REVIEWED',
      'FINANCE_REVIEWED',
      'PENDING_CEO_APPROVAL',
      'CEO_APPROVED',
      'PAYMENT_PROCESSING',
      'PAID',
      'COMPLETED',
      'FINALISED',
      'REJECTED',
      'CANCELLED'
    );
  END IF;
END
$$;

ALTER TYPE "public"."PayrollRunStatus"
ADD VALUE IF NOT EXISTS 'DRAFT';

ALTER TYPE "public"."PayrollRunStatus"
ADD VALUE IF NOT EXISTS 'CALCULATED';

ALTER TYPE "public"."PayrollRunStatus"
ADD VALUE IF NOT EXISTS 'AI_AUDITED';

ALTER TYPE "public"."PayrollRunStatus"
ADD VALUE IF NOT EXISTS 'HR_REVIEWED';

ALTER TYPE "public"."PayrollRunStatus"
ADD VALUE IF NOT EXISTS 'FINANCE_REVIEWED';

ALTER TYPE "public"."PayrollRunStatus"
ADD VALUE IF NOT EXISTS 'PENDING_CEO_APPROVAL';

ALTER TYPE "public"."PayrollRunStatus"
ADD VALUE IF NOT EXISTS 'CEO_APPROVED';

ALTER TYPE "public"."PayrollRunStatus"
ADD VALUE IF NOT EXISTS 'PAYMENT_PROCESSING';

ALTER TYPE "public"."PayrollRunStatus"
ADD VALUE IF NOT EXISTS 'PAID';

ALTER TYPE "public"."PayrollRunStatus"
ADD VALUE IF NOT EXISTS 'COMPLETED';

ALTER TYPE "public"."PayrollRunStatus"
ADD VALUE IF NOT EXISTS 'FINALISED';

ALTER TYPE "public"."PayrollRunStatus"
ADD VALUE IF NOT EXISTS 'REJECTED';

ALTER TYPE "public"."PayrollRunStatus"
ADD VALUE IF NOT EXISTS 'CANCELLED';

-- Convert payroll_runs.status to the proper enum if it is currently text/varchar.
DO $$
DECLARE
  current_type TEXT;
BEGIN
  SELECT data_type
  INTO current_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'payroll_runs'
    AND column_name = 'status';

  IF current_type IS NOT NULL
     AND current_type <> 'USER-DEFINED' THEN

    ALTER TABLE "public"."payroll_runs"
    ALTER COLUMN "status" DROP DEFAULT;

    ALTER TABLE "public"."payroll_runs"
    ALTER COLUMN "status"
    TYPE "public"."PayrollRunStatus"
    USING "status"::text::"public"."PayrollRunStatus";

    ALTER TABLE "public"."payroll_runs"
    ALTER COLUMN "status"
    SET DEFAULT 'DRAFT'::"public"."PayrollRunStatus";
  END IF;
END
$$;

-- =========================================================
-- 2. PAYROLL INTELLIGENCE ENUMS
-- =========================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    INNER JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'PayrollAuditRiskLevel'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."PayrollAuditRiskLevel" AS ENUM (
      'LOW',
      'MEDIUM',
      'HIGH',
      'CRITICAL'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    INNER JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'PayrollAuditSeverity'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."PayrollAuditSeverity" AS ENUM (
      'INFO',
      'WARNING',
      'HIGH',
      'CRITICAL'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    INNER JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'PayrollAuditFindingStatus'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."PayrollAuditFindingStatus" AS ENUM (
      'OPEN',
      'ACKNOWLEDGED',
      'RESOLVED',
      'DISMISSED'
    );
  END IF;
END
$$;

-- =========================================================
-- 3. PAYROLL AUDITS
-- =========================================================

CREATE TABLE IF NOT EXISTS "public"."payroll_audits" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "payrollRunId" TEXT NOT NULL,

  "healthScore" INTEGER NOT NULL DEFAULT 100,
  "riskLevel" "public"."PayrollAuditRiskLevel" NOT NULL DEFAULT 'LOW',

  "criticalCount" INTEGER NOT NULL DEFAULT 0,
  "highCount" INTEGER NOT NULL DEFAULT 0,
  "warningCount" INTEGER NOT NULL DEFAULT 0,
  "infoCount" INTEGER NOT NULL DEFAULT 0,

  "summary" TEXT,
  "blocked" BOOLEAN NOT NULL DEFAULT false,
  "analysedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "analysedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "payroll_audits_pkey"
    PRIMARY KEY ("id")
);

-- =========================================================
-- 4. PAYROLL AUDIT FINDINGS
-- =========================================================

CREATE TABLE IF NOT EXISTS "public"."payroll_audit_findings" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "payrollAuditId" TEXT NOT NULL,
  "employeeId" TEXT,

  "ruleCode" TEXT NOT NULL,
  "severity" "public"."PayrollAuditSeverity" NOT NULL,
  "status" "public"."PayrollAuditFindingStatus" NOT NULL DEFAULT 'OPEN',

  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,

  "currentValue" DECIMAL(14, 2),
  "previousValue" DECIMAL(14, 2),
  "varianceValue" DECIMAL(14, 2),
  "varianceRate" DECIMAL(8, 4),

  "metadata" JSONB,

  "acknowledgedById" TEXT,
  "acknowledgedAt" TIMESTAMP(3),

  "resolvedById" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolutionNote" TEXT,

  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "payroll_audit_findings_pkey"
    PRIMARY KEY ("id")
);

-- =========================================================
-- 5. PAYROLL TIMELINE
-- =========================================================

CREATE TABLE IF NOT EXISTS "public"."payroll_timeline_events" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "payrollRunId" TEXT NOT NULL,
  "actorUserId" TEXT,

  "eventType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT,
  "metadata" JSONB,

  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "payroll_timeline_events_pkey"
    PRIMARY KEY ("id")
);

-- =========================================================
-- 6. INDEXES
-- =========================================================

CREATE UNIQUE INDEX IF NOT EXISTS "payroll_audits_payrollRunId_key"
ON "public"."payroll_audits" ("payrollRunId");

CREATE INDEX IF NOT EXISTS "payroll_audits_organisationId_idx"
ON "public"."payroll_audits" ("organisationId");

CREATE INDEX IF NOT EXISTS "payroll_audits_payrollRunId_idx"
ON "public"."payroll_audits" ("payrollRunId");

CREATE INDEX IF NOT EXISTS "payroll_audits_riskLevel_idx"
ON "public"."payroll_audits" ("riskLevel");

CREATE INDEX IF NOT EXISTS "payroll_audits_blocked_idx"
ON "public"."payroll_audits" ("blocked");

CREATE INDEX IF NOT EXISTS "payroll_audit_findings_organisationId_idx"
ON "public"."payroll_audit_findings" ("organisationId");

CREATE INDEX IF NOT EXISTS "payroll_audit_findings_payrollAuditId_idx"
ON "public"."payroll_audit_findings" ("payrollAuditId");

CREATE INDEX IF NOT EXISTS "payroll_audit_findings_employeeId_idx"
ON "public"."payroll_audit_findings" ("employeeId");

CREATE INDEX IF NOT EXISTS "payroll_audit_findings_severity_idx"
ON "public"."payroll_audit_findings" ("severity");

CREATE INDEX IF NOT EXISTS "payroll_audit_findings_status_idx"
ON "public"."payroll_audit_findings" ("status");

CREATE INDEX IF NOT EXISTS "payroll_audit_findings_ruleCode_idx"
ON "public"."payroll_audit_findings" ("ruleCode");

CREATE INDEX IF NOT EXISTS "payroll_timeline_events_organisationId_idx"
ON "public"."payroll_timeline_events" ("organisationId");

CREATE INDEX IF NOT EXISTS "payroll_timeline_events_payrollRunId_idx"
ON "public"."payroll_timeline_events" ("payrollRunId");

CREATE INDEX IF NOT EXISTS "payroll_timeline_events_eventType_idx"
ON "public"."payroll_timeline_events" ("eventType");

CREATE INDEX IF NOT EXISTS "payroll_timeline_events_createdAt_idx"
ON "public"."payroll_timeline_events" ("createdAt");

-- =========================================================
-- 7. FOREIGN KEYS
-- =========================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payroll_audits_organisationId_fkey'
  ) THEN
    ALTER TABLE "public"."payroll_audits"
    ADD CONSTRAINT "payroll_audits_organisationId_fkey"
    FOREIGN KEY ("organisationId")
    REFERENCES "public"."organisations" ("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payroll_audits_payrollRunId_fkey'
  ) THEN
    ALTER TABLE "public"."payroll_audits"
    ADD CONSTRAINT "payroll_audits_payrollRunId_fkey"
    FOREIGN KEY ("payrollRunId")
    REFERENCES "public"."payroll_runs" ("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payroll_audits_analysedById_fkey'
  ) THEN
    ALTER TABLE "public"."payroll_audits"
    ADD CONSTRAINT "payroll_audits_analysedById_fkey"
    FOREIGN KEY ("analysedById")
    REFERENCES "public"."users" ("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payroll_audit_findings_organisationId_fkey'
  ) THEN
    ALTER TABLE "public"."payroll_audit_findings"
    ADD CONSTRAINT "payroll_audit_findings_organisationId_fkey"
    FOREIGN KEY ("organisationId")
    REFERENCES "public"."organisations" ("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payroll_audit_findings_payrollAuditId_fkey'
  ) THEN
    ALTER TABLE "public"."payroll_audit_findings"
    ADD CONSTRAINT "payroll_audit_findings_payrollAuditId_fkey"
    FOREIGN KEY ("payrollAuditId")
    REFERENCES "public"."payroll_audits" ("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payroll_audit_findings_employeeId_fkey'
  ) THEN
    ALTER TABLE "public"."payroll_audit_findings"
    ADD CONSTRAINT "payroll_audit_findings_employeeId_fkey"
    FOREIGN KEY ("employeeId")
    REFERENCES "public"."employees" ("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payroll_audit_findings_acknowledgedById_fkey'
  ) THEN
    ALTER TABLE "public"."payroll_audit_findings"
    ADD CONSTRAINT "payroll_audit_findings_acknowledgedById_fkey"
    FOREIGN KEY ("acknowledgedById")
    REFERENCES "public"."users" ("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payroll_audit_findings_resolvedById_fkey'
  ) THEN
    ALTER TABLE "public"."payroll_audit_findings"
    ADD CONSTRAINT "payroll_audit_findings_resolvedById_fkey"
    FOREIGN KEY ("resolvedById")
    REFERENCES "public"."users" ("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payroll_timeline_events_organisationId_fkey'
  ) THEN
    ALTER TABLE "public"."payroll_timeline_events"
    ADD CONSTRAINT "payroll_timeline_events_organisationId_fkey"
    FOREIGN KEY ("organisationId")
    REFERENCES "public"."organisations" ("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payroll_timeline_events_payrollRunId_fkey'
  ) THEN
    ALTER TABLE "public"."payroll_timeline_events"
    ADD CONSTRAINT "payroll_timeline_events_payrollRunId_fkey"
    FOREIGN KEY ("payrollRunId")
    REFERENCES "public"."payroll_runs" ("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payroll_timeline_events_actorUserId_fkey'
  ) THEN
    ALTER TABLE "public"."payroll_timeline_events"
    ADD CONSTRAINT "payroll_timeline_events_actorUserId_fkey"
    FOREIGN KEY ("actorUserId")
    REFERENCES "public"."users" ("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END
$$;

COMMIT;