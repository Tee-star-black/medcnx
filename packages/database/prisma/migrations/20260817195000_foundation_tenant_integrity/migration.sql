-- MedCNX foundation hardening: enforce organisation boundaries in the database.

CREATE UNIQUE INDEX IF NOT EXISTS "departments_id_organisationId_key" ON "departments" ("id", "organisationId");
CREATE UNIQUE INDEX IF NOT EXISTS "employees_id_organisationId_key" ON "employees" ("id", "organisationId");
CREATE UNIQUE INDEX IF NOT EXISTS "users_id_organisationId_key" ON "users" ("id", "organisationId");
CREATE UNIQUE INDEX IF NOT EXISTS "payroll_runs_id_organisationId_key" ON "payroll_runs" ("id", "organisationId");
CREATE UNIQUE INDEX IF NOT EXISTS "payroll_audits_id_organisationId_key" ON "payroll_audits" ("id", "organisationId");
CREATE UNIQUE INDEX IF NOT EXISTS "payroll_approvals_id_organisationId_key" ON "payroll_approvals" ("id", "organisationId");

ALTER TABLE "employees" ADD CONSTRAINT "employees_department_tenant_fkey" FOREIGN KEY ("departmentId", "organisationId") REFERENCES "departments" ("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employees" ADD CONSTRAINT "employees_manager_tenant_fkey" FOREIGN KEY ("managerId", "organisationId") REFERENCES "employees" ("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_tenant_fkey" FOREIGN KEY ("userId", "organisationId") REFERENCES "users" ("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_employee_tenant_fkey" FOREIGN KEY ("employeeId", "organisationId") REFERENCES "employees" ("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employee_compensation_profiles" ADD CONSTRAINT "employee_compensation_employee_tenant_fkey" FOREIGN KEY ("employeeId", "organisationId") REFERENCES "employees" ("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payroll_run_items" ADD CONSTRAINT "payroll_run_items_run_tenant_fkey" FOREIGN KEY ("payrollRunId", "organisationId") REFERENCES "payroll_runs" ("id", "organisationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_run_items" ADD CONSTRAINT "payroll_run_items_employee_tenant_fkey" FOREIGN KEY ("employeeId", "organisationId") REFERENCES "employees" ("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payroll_audits" ADD CONSTRAINT "payroll_audits_run_tenant_fkey" FOREIGN KEY ("payrollRunId", "organisationId") REFERENCES "payroll_runs" ("id", "organisationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_audit_findings" ADD CONSTRAINT "payroll_audit_findings_audit_tenant_fkey" FOREIGN KEY ("payrollAuditId", "organisationId") REFERENCES "payroll_audits" ("id", "organisationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_audit_findings" ADD CONSTRAINT "payroll_audit_findings_employee_tenant_fkey" FOREIGN KEY ("employeeId", "organisationId") REFERENCES "employees" ("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payroll_timeline_events" ADD CONSTRAINT "payroll_timeline_events_run_tenant_fkey" FOREIGN KEY ("payrollRunId", "organisationId") REFERENCES "payroll_runs" ("id", "organisationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_approvals" ADD CONSTRAINT "payroll_approvals_run_tenant_fkey" FOREIGN KEY ("payrollRunId", "organisationId") REFERENCES "payroll_runs" ("id", "organisationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_otp_challenges" ADD CONSTRAINT "payroll_otp_approval_tenant_fkey" FOREIGN KEY ("payrollApprovalId", "organisationId") REFERENCES "payroll_approvals" ("id", "organisationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_otp_challenges" ADD CONSTRAINT "payroll_otp_user_tenant_fkey" FOREIGN KEY ("userId", "organisationId") REFERENCES "users" ("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "medcnx_enforce_user_role_tenant"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  user_organisation_id text;
  role_organisation_id text;
BEGIN
  SELECT "organisationId" INTO user_organisation_id FROM "users" WHERE "id" = NEW."userId";
  SELECT "organisationId" INTO role_organisation_id FROM "roles" WHERE "id" = NEW."roleId";

  IF user_organisation_id IS NULL THEN
    RAISE EXCEPTION 'Cannot assign role: user % does not exist', NEW."userId";
  END IF;

  IF role_organisation_id IS NOT NULL AND role_organisation_id <> user_organisation_id THEN
    RAISE EXCEPTION 'Cross-tenant role assignment rejected for user % and role %', NEW."userId", NEW."roleId";
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "user_roles_tenant_guard" ON "user_roles";
CREATE TRIGGER "user_roles_tenant_guard" BEFORE INSERT OR UPDATE OF "userId", "roleId" ON "user_roles" FOR EACH ROW EXECUTE FUNCTION "medcnx_enforce_user_role_tenant"();
