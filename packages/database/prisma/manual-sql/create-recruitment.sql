CREATE TABLE IF NOT EXISTS "recruitment_jobs" (
  "id" TEXT PRIMARY KEY,
  "organisationId" TEXT NOT NULL,
  "departmentId" TEXT,
  "createdByUserId" TEXT,

  "title" TEXT NOT NULL,
  "reference" TEXT,
  "description" TEXT,
  "location" TEXT,
  "employmentType" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',

  "openingDate" TIMESTAMP(3),
  "closingDate" TIMESTAMP(3),

  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "recruitment_jobs_organisationId_fkey"
    FOREIGN KEY ("organisationId") REFERENCES "organisations"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT "recruitment_jobs_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "departments"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  CONSTRAINT "recruitment_jobs_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "users"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "recruitment_jobs_organisationId_reference_key"
ON "recruitment_jobs"("organisationId", "reference");

CREATE INDEX IF NOT EXISTS "recruitment_jobs_organisationId_idx"
ON "recruitment_jobs"("organisationId");

CREATE INDEX IF NOT EXISTS "recruitment_jobs_departmentId_idx"
ON "recruitment_jobs"("departmentId");

CREATE INDEX IF NOT EXISTS "recruitment_jobs_status_idx"
ON "recruitment_jobs"("status");

CREATE INDEX IF NOT EXISTS "recruitment_jobs_createdByUserId_idx"
ON "recruitment_jobs"("createdByUserId");


CREATE TABLE IF NOT EXISTS "candidates" (
  "id" TEXT PRIMARY KEY,
  "organisationId" TEXT NOT NULL,
  "createdByUserId" TEXT,

  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,

  "currentCompany" TEXT,
  "currentRole" TEXT,
  "location" TEXT,
  "source" TEXT,
  "notes" TEXT,

  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "candidates_organisationId_fkey"
    FOREIGN KEY ("organisationId") REFERENCES "organisations"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT "candidates_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "users"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "candidates_organisationId_idx"
ON "candidates"("organisationId");

CREATE INDEX IF NOT EXISTS "candidates_email_idx"
ON "candidates"("email");

CREATE INDEX IF NOT EXISTS "candidates_createdByUserId_idx"
ON "candidates"("createdByUserId");


CREATE TABLE IF NOT EXISTS "job_applications" (
  "id" TEXT PRIMARY KEY,
  "organisationId" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,

  "status" TEXT NOT NULL DEFAULT 'APPLIED',

  "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "interviewDate" TIMESTAMP(3),
  "offerDate" TIMESTAMP(3),
  "decisionDate" TIMESTAMP(3),

  "expectedSalary" NUMERIC(12, 2),
  "rating" INTEGER,
  "notes" TEXT,

  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "job_applications_organisationId_fkey"
    FOREIGN KEY ("organisationId") REFERENCES "organisations"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT "job_applications_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "recruitment_jobs"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT "job_applications_candidateId_fkey"
    FOREIGN KEY ("candidateId") REFERENCES "candidates"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "job_applications_jobId_candidateId_key"
ON "job_applications"("jobId", "candidateId");

CREATE INDEX IF NOT EXISTS "job_applications_organisationId_idx"
ON "job_applications"("organisationId");

CREATE INDEX IF NOT EXISTS "job_applications_jobId_idx"
ON "job_applications"("jobId");

CREATE INDEX IF NOT EXISTS "job_applications_candidateId_idx"
ON "job_applications"("candidateId");

CREATE INDEX IF NOT EXISTS "job_applications_status_idx"
ON "job_applications"("status");