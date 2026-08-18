CREATE TABLE "employee_manager_assignments" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "organisationId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "managerId" TEXT,
  "effectiveFrom" TIMESTAMPTZ NOT NULL,
  "effectiveTo" TIMESTAMPTZ,
  "reason" TEXT,
  "assignedByUserId" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "employee_manager_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "employee_manager_assignments_date_order" CHECK ("effectiveTo" IS NULL OR "effectiveTo" >= "effectiveFrom"),
  CONSTRAINT "employee_manager_assignments_no_self" CHECK ("managerId" IS NULL OR "managerId" <> "employeeId")
);

CREATE INDEX "employee_manager_assignments_organisationId_idx" ON "employee_manager_assignments"("organisationId");
CREATE INDEX "employee_manager_assignments_employeeId_idx" ON "employee_manager_assignments"("employeeId");
CREATE INDEX "employee_manager_assignments_managerId_idx" ON "employee_manager_assignments"("managerId");
CREATE INDEX "employee_manager_assignments_effectiveFrom_idx" ON "employee_manager_assignments"("effectiveFrom");
CREATE UNIQUE INDEX "employee_manager_assignments_one_current_idx"
  ON "employee_manager_assignments"("organisationId", "employeeId")
  WHERE "effectiveTo" IS NULL;

CREATE OR REPLACE FUNCTION medcnx_validate_employee_manager_assignment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "employees" e
    WHERE e."id" = NEW."employeeId"
      AND e."organisationId" = NEW."organisationId"
  ) THEN
    RAISE EXCEPTION 'Manager assignment employee must belong to the same organisation.';
  END IF;

  IF NEW."managerId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "employees" m
    WHERE m."id" = NEW."managerId"
      AND m."organisationId" = NEW."organisationId"
      AND m."employmentStatus" NOT IN ('TERMINATED', 'RESIGNED')
  ) THEN
    RAISE EXCEPTION 'Manager must be active and belong to the same organisation.';
  END IF;

  IF NEW."assignedByUserId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "users" u
    WHERE u."id" = NEW."assignedByUserId"
      AND u."organisationId" = NEW."organisationId"
  ) THEN
    RAISE EXCEPTION 'Manager assignment actor must belong to the same organisation.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "employee_manager_assignments_validate"
BEFORE INSERT OR UPDATE ON "employee_manager_assignments"
FOR EACH ROW EXECUTE FUNCTION medcnx_validate_employee_manager_assignment();

INSERT INTO "employee_manager_assignments" (
  "organisationId",
  "employeeId",
  "managerId",
  "effectiveFrom",
  "effectiveTo",
  "reason",
  "assignedByUserId"
)
SELECT
  e."organisationId",
  e."id",
  e."managerId",
  COALESCE(e."startDate", e."createdAt", CURRENT_TIMESTAMP),
  NULL,
  'Backfilled current reporting relationship during manager history migration.',
  NULL
FROM "employees" e
WHERE e."managerId" IS NOT NULL;

CREATE OR REPLACE FUNCTION medcnx_guard_employee_manager_history_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "employee_manager_assignments" a
    WHERE a."employeeId" = OLD."id" OR a."managerId" = OLD."id"
  ) THEN
    RAISE EXCEPTION 'Employee is referenced by manager assignment history and cannot be deleted.';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER "employees_guard_manager_history_delete"
BEFORE DELETE ON "employees"
FOR EACH ROW EXECUTE FUNCTION medcnx_guard_employee_manager_history_delete();
