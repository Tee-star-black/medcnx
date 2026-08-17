-- Link recruitment demand to approved workforce positions without coupling the core recruitment schema.

CREATE TABLE "recruitment_position_links" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "organisationId" TEXT NOT NULL,
  "recruitmentJobId" TEXT NOT NULL,
  "positionId" TEXT NOT NULL,
  "plannedOpenings" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recruitment_position_links_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "recruitment_position_links_recruitmentJobId_key" UNIQUE ("recruitmentJobId"),
  CONSTRAINT "recruitment_position_links_planned_openings_positive" CHECK ("plannedOpenings" > 0)
);

CREATE INDEX "recruitment_position_links_organisationId_idx"
  ON "recruitment_position_links"("organisationId");
CREATE INDEX "recruitment_position_links_positionId_idx"
  ON "recruitment_position_links"("positionId");

CREATE OR REPLACE FUNCTION medcnx_validate_recruitment_position_link()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "positions" p
    WHERE p."id" = NEW."positionId"
      AND p."organisationId" = NEW."organisationId"
      AND p."active" = true
  ) THEN
    RAISE EXCEPTION 'Recruitment position must be active and belong to the same organisation.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "recruitment_jobs" rj
    WHERE rj."id" = NEW."recruitmentJobId"
      AND rj."organisationId" = NEW."organisationId"
  ) THEN
    RAISE EXCEPTION 'Recruitment job must belong to the same organisation.';
  END IF;

  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "recruitment_position_links_validate"
BEFORE INSERT OR UPDATE ON "recruitment_position_links"
FOR EACH ROW EXECUTE FUNCTION medcnx_validate_recruitment_position_link();

CREATE OR REPLACE FUNCTION medcnx_guard_position_recruitment_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "recruitment_position_links" rpl
    WHERE rpl."positionId" = OLD."id"
  ) THEN
    RAISE EXCEPTION 'Cannot delete a position linked to recruitment history.';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER "positions_guard_recruitment_delete"
BEFORE DELETE ON "positions"
FOR EACH ROW EXECUTE FUNCTION medcnx_guard_position_recruitment_delete();

CREATE OR REPLACE FUNCTION medcnx_guard_recruitment_job_link_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "recruitment_position_links" rpl
    WHERE rpl."recruitmentJobId" = OLD."id"
  ) THEN
    RAISE EXCEPTION 'Cannot delete a recruitment job linked to workforce planning history.';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER "recruitment_jobs_guard_position_link_delete"
BEFORE DELETE ON "recruitment_jobs"
FOR EACH ROW EXECUTE FUNCTION medcnx_guard_recruitment_job_link_delete();
