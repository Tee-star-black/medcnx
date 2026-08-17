-- MedCNX workforce hierarchy foundation.
-- Cross-model integrity is enforced with triggers because the hierarchy models live
-- in a separate Prisma schema file without relation fields on legacy core models.

CREATE TABLE "department_structures" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "organisationId" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "parentDepartmentId" TEXT,
  "headEmployeeId" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "department_structures_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "department_structures_departmentId_key" UNIQUE ("departmentId")
);

CREATE INDEX "department_structures_organisationId_idx" ON "department_structures"("organisationId");
CREATE INDEX "department_structures_parentDepartmentId_idx" ON "department_structures"("parentDepartmentId");
CREATE INDEX "department_structures_headEmployeeId_idx" ON "department_structures"("headEmployeeId");

CREATE TABLE "positions" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "organisationId" TEXT NOT NULL,
  "departmentId" TEXT,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "level" TEXT,
  "employmentCategory" TEXT,
  "approvedHeadcount" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "positions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "positions_approved_headcount_nonnegative" CHECK ("approvedHeadcount" >= 0),
  CONSTRAINT "positions_organisationId_code_key" UNIQUE ("organisationId", "code")
);

CREATE INDEX "positions_organisationId_idx" ON "positions"("organisationId");
CREATE INDEX "positions_departmentId_idx" ON "positions"("departmentId");
CREATE INDEX "positions_active_idx" ON "positions"("active");

CREATE TABLE "employee_position_assignments" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "organisationId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "positionId" TEXT NOT NULL,
  "effectiveFrom" TIMESTAMPTZ NOT NULL,
  "effectiveTo" TIMESTAMPTZ,
  "reason" TEXT,
  "assignedByUserId" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "employee_position_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "employee_position_assignments_date_order" CHECK ("effectiveTo" IS NULL OR "effectiveTo" >= "effectiveFrom")
);

CREATE INDEX "employee_position_assignments_organisationId_idx" ON "employee_position_assignments"("organisationId");
CREATE INDEX "employee_position_assignments_employeeId_idx" ON "employee_position_assignments"("employeeId");
CREATE INDEX "employee_position_assignments_positionId_idx" ON "employee_position_assignments"("positionId");
CREATE INDEX "employee_position_assignments_effectiveFrom_idx" ON "employee_position_assignments"("effectiveFrom");

CREATE OR REPLACE FUNCTION medcnx_validate_department_structure()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  found_cycle BOOLEAN;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "organisations" o WHERE o."id" = NEW."organisationId"
  ) THEN
    RAISE EXCEPTION 'Organisation not found for department structure.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "departments" d
    WHERE d."id" = NEW."departmentId"
      AND d."organisationId" = NEW."organisationId"
  ) THEN
    RAISE EXCEPTION 'Department must belong to the same organisation.';
  END IF;

  IF NEW."parentDepartmentId" = NEW."departmentId" THEN
    RAISE EXCEPTION 'A department cannot be its own parent.';
  END IF;

  IF NEW."parentDepartmentId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "departments" d
    WHERE d."id" = NEW."parentDepartmentId"
      AND d."organisationId" = NEW."organisationId"
  ) THEN
    RAISE EXCEPTION 'Parent department must belong to the same organisation.';
  END IF;

  IF NEW."headEmployeeId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "employees" e
    WHERE e."id" = NEW."headEmployeeId"
      AND e."organisationId" = NEW."organisationId"
      AND e."employmentStatus" NOT IN ('TERMINATED', 'RESIGNED')
  ) THEN
    RAISE EXCEPTION 'Department head must be an active employee in the same organisation.';
  END IF;

  IF NEW."parentDepartmentId" IS NOT NULL THEN
    WITH RECURSIVE ancestors AS (
      SELECT ds."departmentId", ds."parentDepartmentId"
      FROM "department_structures" ds
      WHERE ds."departmentId" = NEW."parentDepartmentId"
        AND ds."organisationId" = NEW."organisationId"
      UNION ALL
      SELECT ds."departmentId", ds."parentDepartmentId"
      FROM "department_structures" ds
      JOIN ancestors a ON ds."departmentId" = a."parentDepartmentId"
      WHERE ds."organisationId" = NEW."organisationId"
    )
    SELECT EXISTS (
      SELECT 1 FROM ancestors WHERE "departmentId" = NEW."departmentId"
    ) INTO found_cycle;

    IF found_cycle THEN
      RAISE EXCEPTION 'Department hierarchy cycle detected.';
    END IF;
  END IF;

  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "department_structures_validate"
BEFORE INSERT OR UPDATE ON "department_structures"
FOR EACH ROW EXECUTE FUNCTION medcnx_validate_department_structure();

CREATE OR REPLACE FUNCTION medcnx_validate_position()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "organisations" o WHERE o."id" = NEW."organisationId"
  ) THEN
    RAISE EXCEPTION 'Organisation not found for position.';
  END IF;

  IF NEW."departmentId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "departments" d
    WHERE d."id" = NEW."departmentId"
      AND d."organisationId" = NEW."organisationId"
  ) THEN
    RAISE EXCEPTION 'Position department must belong to the same organisation.';
  END IF;

  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "positions_validate"
BEFORE INSERT OR UPDATE ON "positions"
FOR EACH ROW EXECUTE FUNCTION medcnx_validate_position();

CREATE OR REPLACE FUNCTION medcnx_validate_employee_position_assignment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "employees" e
    WHERE e."id" = NEW."employeeId"
      AND e."organisationId" = NEW."organisationId"
      AND e."employmentStatus" NOT IN ('TERMINATED', 'RESIGNED')
  ) THEN
    RAISE EXCEPTION 'Position assignment employee must be active and in the same organisation.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "positions" p
    WHERE p."id" = NEW."positionId"
      AND p."organisationId" = NEW."organisationId"
      AND p."active" = true
  ) THEN
    RAISE EXCEPTION 'Position assignment must reference an active position in the same organisation.';
  END IF;

  IF NEW."assignedByUserId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "users" u
    WHERE u."id" = NEW."assignedByUserId"
      AND u."organisationId" = NEW."organisationId"
  ) THEN
    RAISE EXCEPTION 'Position assignment actor must belong to the same organisation.';
  END IF;

  IF NEW."effectiveTo" IS NULL AND EXISTS (
    SELECT 1 FROM "employee_position_assignments" a
    WHERE a."employeeId" = NEW."employeeId"
      AND a."organisationId" = NEW."organisationId"
      AND a."effectiveTo" IS NULL
      AND a."id" <> NEW."id"
  ) THEN
    RAISE EXCEPTION 'Employee already has an active position assignment.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "employee_position_assignments_validate"
BEFORE INSERT OR UPDATE ON "employee_position_assignments"
FOR EACH ROW EXECUTE FUNCTION medcnx_validate_employee_position_assignment();

CREATE OR REPLACE FUNCTION medcnx_guard_department_hierarchy_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "department_structures" ds
    WHERE ds."departmentId" = OLD."id" OR ds."parentDepartmentId" = OLD."id"
  ) OR EXISTS (
    SELECT 1 FROM "positions" p WHERE p."departmentId" = OLD."id"
  ) THEN
    RAISE EXCEPTION 'Department is referenced by workforce hierarchy and cannot be deleted.';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER "departments_guard_hierarchy_delete"
BEFORE DELETE ON "departments"
FOR EACH ROW EXECUTE FUNCTION medcnx_guard_department_hierarchy_delete();

CREATE OR REPLACE FUNCTION medcnx_guard_employee_hierarchy_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "department_structures" ds WHERE ds."headEmployeeId" = OLD."id"
  ) OR EXISTS (
    SELECT 1 FROM "employee_position_assignments" a WHERE a."employeeId" = OLD."id"
  ) THEN
    RAISE EXCEPTION 'Employee is referenced by workforce hierarchy history and cannot be deleted.';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER "employees_guard_hierarchy_delete"
BEFORE DELETE ON "employees"
FOR EACH ROW EXECUTE FUNCTION medcnx_guard_employee_hierarchy_delete();

CREATE OR REPLACE FUNCTION medcnx_guard_position_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "employee_position_assignments" a WHERE a."positionId" = OLD."id"
  ) THEN
    RAISE EXCEPTION 'Position has assignment history and cannot be deleted.';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER "positions_guard_delete"
BEFORE DELETE ON "positions"
FOR EACH ROW EXECUTE FUNCTION medcnx_guard_position_delete();
