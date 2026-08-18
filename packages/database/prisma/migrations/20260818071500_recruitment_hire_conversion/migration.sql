-- Transactional recruitment-to-workforce conversion traceability.

CREATE TABLE "recruitment_hire_conversions" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "organisationId" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "positionId" TEXT,
  "recruitmentJobId" TEXT NOT NULL,
  "convertedByUserId" TEXT NOT NULL,
  "convertedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recruitment_hire_conversions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "recruitment_hire_conversions_applicationId_key" UNIQUE ("applicationId"),
  CONSTRAINT "recruitment_hire_conversions_employeeId_key" UNIQUE ("employeeId")
);

CREATE INDEX "recruitment_hire_conversions_organisationId_idx"
  ON "recruitment_hire_conversions"("organisationId");
CREATE INDEX "recruitment_hire_conversions_candidateId_idx"
  ON "recruitment_hire_conversions"("candidateId");
CREATE INDEX "recruitment_hire_conversions_positionId_idx"
  ON "recruitment_hire_conversions"("positionId");
CREATE INDEX "recruitment_hire_conversions_recruitmentJobId_idx"
  ON "recruitment_hire_conversions"("recruitmentJobId");

CREATE OR REPLACE FUNCTION medcnx_validate_recruitment_hire_conversion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "job_applications" ja
    WHERE ja."id" = NEW."applicationId"
      AND ja."organisationId" = NEW."organisationId"
      AND ja."candidateId" = NEW."candidateId"
      AND ja."jobId" = NEW."recruitmentJobId"
  ) THEN
    RAISE EXCEPTION 'Hire conversion application, candidate, and recruitment job must belong to the same organisation and application.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "employees" e
    WHERE e."id" = NEW."employeeId"
      AND e."organisationId" = NEW."organisationId"
  ) THEN
    RAISE EXCEPTION 'Hire conversion employee must belong to the same organisation.';
  END IF;

  IF NEW."positionId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "positions" p
    WHERE p."id" = NEW."positionId"
      AND p."organisationId" = NEW."organisationId"
  ) THEN
    RAISE EXCEPTION 'Hire conversion position must belong to the same organisation.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "users" u
    WHERE u."id" = NEW."convertedByUserId"
      AND u."organisationId" = NEW."organisationId"
  ) THEN
    RAISE EXCEPTION 'Hire conversion actor must belong to the same organisation.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "recruitment_hire_conversions_validate"
BEFORE INSERT OR UPDATE ON "recruitment_hire_conversions"
FOR EACH ROW EXECUTE FUNCTION medcnx_validate_recruitment_hire_conversion();

CREATE OR REPLACE FUNCTION medcnx_guard_hire_conversion_sources_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME = 'job_applications' AND EXISTS (
    SELECT 1 FROM "recruitment_hire_conversions" rhc WHERE rhc."applicationId" = OLD."id"
  ) THEN
    RAISE EXCEPTION 'Cannot delete a job application that has been converted to an employee.';
  END IF;

  IF TG_TABLE_NAME = 'candidates' AND EXISTS (
    SELECT 1 FROM "recruitment_hire_conversions" rhc WHERE rhc."candidateId" = OLD."id"
  ) THEN
    RAISE EXCEPTION 'Cannot delete a candidate that has been converted to an employee.';
  END IF;

  IF TG_TABLE_NAME = 'employees' AND EXISTS (
    SELECT 1 FROM "recruitment_hire_conversions" rhc WHERE rhc."employeeId" = OLD."id"
  ) THEN
    RAISE EXCEPTION 'Cannot delete an employee with recruitment conversion history.';
  END IF;

  RETURN OLD;
END;
$$;

CREATE TRIGGER "job_applications_guard_hire_conversion_delete"
BEFORE DELETE ON "job_applications"
FOR EACH ROW EXECUTE FUNCTION medcnx_guard_hire_conversion_sources_delete();

CREATE TRIGGER "candidates_guard_hire_conversion_delete"
BEFORE DELETE ON "candidates"
FOR EACH ROW EXECUTE FUNCTION medcnx_guard_hire_conversion_sources_delete();

CREATE TRIGGER "employees_guard_hire_conversion_delete"
BEFORE DELETE ON "employees"
FOR EACH ROW EXECUTE FUNCTION medcnx_guard_hire_conversion_sources_delete();
