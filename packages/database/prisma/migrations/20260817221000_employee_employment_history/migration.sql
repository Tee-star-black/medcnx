-- MedCNX employee lifecycle foundation: immutable effective-dated employment history.

CREATE TABLE "employee_employment_history" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "organisationId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "effectiveDate" TIMESTAMPTZ NOT NULL,
  "reason" TEXT,
  "previousDepartmentId" TEXT,
  "previousDepartment