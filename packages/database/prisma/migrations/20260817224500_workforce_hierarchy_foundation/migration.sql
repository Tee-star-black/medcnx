-- MedCNX workforce hierarchy foundation.

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
  CONSTRAINT "positions_organisationId_code_key" UNIQUE ("organisationId", "code"),
  CONSTRAINT "positions_id_organisationId_key" UNIQUE ("id", "organisationId")
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
CREATE UNIQUE INDEX "employee_position_assignments_one_active_per_employee" ON "employee_position_assignments"("employeeId") WHERE "effectiveTo" IS NULL;

ALTER TABLE "department_structures"
  ADD CONSTRAINT "department_structures_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "department_structures_department_tenant_fkey"
  FOREIGN KEY ("departmentId", "organisationId") REFERENCES "departments"("id", "organisationId") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "department_structures_parent_tenant_fkey"
  FOREIGN KEY ("parentDepartmentId", "organisationId") REFERENCES "departments"("id", "organisationId") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "department_structures_head_tenant_fkey"
  FOREIGN KEY ("headEmployeeId", "organisationId") REFERENCES "employees"("id", "organisationId") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "positions"
  ADD CONSTRAINT "positions_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "positions_department_tenant_fkey"
  FOREIGN KEY ("departmentId", "organisationId") REFERENCES "departments"("id", "organisationId") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "employee_position_assignments"
  ADD CONSTRAINT "employee_position_assignments_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "employee_position_assignments_employee_tenant_fkey"
  FOREIGN KEY ("employeeId", "organisationId") REFERENCES "employees"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "employee_position_assignments_position_tenant_fkey"
  FOREIGN KEY ("positionId", "organisationId") REFERENCES "positions"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "employee_position_assignments_actor_fkey"
  FOREIGN KEY ("assignedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION medcnx_validate_department_structure()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  found_cycle BOOLEAN;
BEGIN
  IF NEW."parentDepartmentId" = NEW."departmentId" THEN
    RAISE EXCEPTION 'A department cannot be its own parent.';
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
