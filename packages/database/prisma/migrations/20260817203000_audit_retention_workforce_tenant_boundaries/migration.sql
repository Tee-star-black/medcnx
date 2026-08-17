-- MedCNX foundation hardening: immutable audit history and tenant-safe workforce relations.

-- Composite targets used by tenant-aware foreign keys.
CREATE UNIQUE INDEX IF NOT EXISTS "leave_requests_id_organisationId_key"
  ON "leave_requests" ("id", "organisationId");

CREATE UNIQUE INDEX IF NOT EXISTS "attendance_records_id_organisationId_key"
  ON "attendance_records" ("id", "organisationId");

-- Audit records must survive lifecycle operations and must never be edited or deleted
-- through normal application/database activity.
ALTER TABLE "audit_logs"
  DROP CONSTRAINT IF EXISTS "audit_logs_organisationId_fkey";
ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "organisations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "medcnx_reject_audit_log_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'MedCNX audit logs are immutable';
END;
$$;

DROP TRIGGER IF EXISTS "audit_logs_immutable_guard" ON "audit_logs";
CREATE TRIGGER "audit_logs_immutable_guard"
BEFORE UPDATE OR DELETE ON "audit_logs"
FOR EACH ROW
EXECUTE FUNCTION "medcnx_reject_audit_log_mutation"();

-- Leave requests must reference employees and approvers in the same organisation.
ALTER TABLE "leave_requests"
  ADD CONSTRAINT "leave_requests_employee_tenant_fkey"
  FOREIGN KEY ("employeeId", "organisationId")
  REFERENCES "employees" ("id", "organisationId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "leave_requests"
  ADD CONSTRAINT "leave_requests_approver_tenant_fkey"
  FOREIGN KEY ("approvedByUserId", "organisationId")
  REFERENCES "users" ("id", "organisationId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "leave_documents"
  ADD CONSTRAINT "leave_documents_request_tenant_fkey"
  FOREIGN KEY ("leaveRequestId", "organisationId")
  REFERENCES "leave_requests" ("id", "organisationId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "leave_documents"
  ADD CONSTRAINT "leave_documents_employee_tenant_fkey"
  FOREIGN KEY ("employeeId", "organisationId")
  REFERENCES "employees" ("id", "organisationId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Attendance records and corrections must remain inside one organisation.
ALTER TABLE "attendance_records"
  ADD CONSTRAINT "attendance_records_employee_tenant_fkey"
  FOREIGN KEY ("employeeId", "organisationId")
  REFERENCES "employees" ("id", "organisationId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "attendance_records"
  ADD CONSTRAINT "attendance_records_corrector_tenant_fkey"
  FOREIGN KEY ("correctedByUserId", "organisationId")
  REFERENCES "users" ("id", "organisationId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "attendance_correction_requests"
  ADD CONSTRAINT "attendance_corrections_employee_tenant_fkey"
  FOREIGN KEY ("employeeId", "organisationId")
  REFERENCES "employees" ("id", "organisationId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "attendance_correction_requests"
  ADD CONSTRAINT "attendance_corrections_record_tenant_fkey"
  FOREIGN KEY ("attendanceRecordId", "organisationId")
  REFERENCES "attendance_records" ("id", "organisationId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "attendance_correction_requests"
  ADD CONSTRAINT "attendance_corrections_requester_tenant_fkey"
  FOREIGN KEY ("requestedByUserId", "organisationId")
  REFERENCES "users" ("id", "organisationId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "attendance_correction_requests"
  ADD CONSTRAINT "attendance_corrections_reviewer_tenant_fkey"
  FOREIGN KEY ("reviewerUserId", "organisationId")
  REFERENCES "users" ("id", "organisationId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Remove the obsolete destructive employee permission from existing databases.
DELETE FROM "role_permissions"
WHERE "permissionId" IN (
  SELECT "id" FROM "permissions" WHERE "key" = 'employees:delete'
);
DELETE FROM "permissions" WHERE "key" = 'employees:delete';
