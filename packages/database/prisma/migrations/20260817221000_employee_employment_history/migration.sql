-- MedCNX employee lifecycle foundation: immutable effective-dated employment history.

CREATE TABLE "employee_employment_history" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "organisationId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "effectiveDate" TIMESTAMPTZ NOT NULL,
  "reason" TEXT,
  "previousDepartmentId" TEXT,
  "nextDepartmentId" TEXT,
  "previousManagerId" TEXT,
  "nextManagerId" TEXT,
  "previousJobTitle" TEXT,
  "nextJobTitle" TEXT,
  "previousEmploymentType" TEXT,
  "nextEmploymentType" TEXT,
  "previousEmploymentStatus" TEXT,
  "nextEmploymentStatus" TEXT,
  "changedByUserId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "employee_employment_history_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "employee_employment_history_employee_fkey"
    FOREIGN KEY ("employeeId", "organisationId")
    REFERENCES "employees"("id", "organisationId")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "employee_employment_history_changed_by_fkey"
    FOREIGN KEY ("changedByUserId", "organisationId")
    REFERENCES "users"("id", "organisationId")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "employee_employment_history_event_type_check"
    CHECK ("eventType" IN (
      'HIRED',
      'PROMOTED',
      'TRANSFERRED',
      'MANAGER_CHANGED',
      'EMPLOYMENT_TYPE_CHANGED',
      'SUSPENDED',
      'REACTIVATED',
      'RESIGNED',
      'TERMINATED',
      'RETURNED_FROM_LEAVE',
      'OTHER'
    ))
);

CREATE INDEX "employee_employment_history_org_employee_effective_idx"
  ON "employee_employment_history"("organisationId", "employeeId", "effectiveDate" DESC);
CREATE INDEX "employee_employment_history_event_type_idx"
  ON "employee_employment_history"("eventType");
CREATE INDEX "employee_employment_history_changed_by_idx"
  ON "employee_employment_history"("changedByUserId");

CREATE OR REPLACE FUNCTION medcnx_reject_employment_history_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'MedCNX employment history is immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER employee_employment_history_immutable_guard
BEFORE UPDATE OR DELETE ON "employee_employment_history"
FOR EACH ROW EXECUTE FUNCTION medcnx_reject_employment_history_mutation();

CREATE OR REPLACE FUNCTION medcnx_record_employee_hire()
RETURNS trigger AS $$
BEGIN
  INSERT INTO "employee_employment_history" (
    "organisationId",
    "employeeId",
    "eventType",
    "effectiveDate",
    "reason",
    "nextDepartmentId",
    "nextManagerId",
    "nextJobTitle",
    "nextEmploymentType",
    "nextEmploymentStatus",
    "metadata"
  ) VALUES (
    NEW."organisationId",
    NEW."id",
    'HIRED',
    COALESCE(NEW."startDate", NEW."createdAt", CURRENT_TIMESTAMP),
    'Employee record created',
    NEW."departmentId",
    NEW."managerId",
    NEW."jobTitle",
    NEW."employmentType",
    NEW."employmentStatus"::text,
    jsonb_build_object('source', 'employee_insert_trigger')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER employee_hire_history_guard
AFTER INSERT ON "employees"
FOR EACH ROW EXECUTE FUNCTION medcnx_record_employee_hire();
