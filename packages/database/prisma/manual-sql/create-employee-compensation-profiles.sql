CREATE TABLE IF NOT EXISTS "employee_compensation_profiles" (
  "id" TEXT PRIMARY KEY,

  "organisationId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL UNIQUE,

  "paymentFrequency" TEXT NOT NULL DEFAULT 'MONTHLY',
  "basicSalary" NUMERIC(12, 2) NOT NULL DEFAULT 0,

  "autoPaye" BOOLEAN NOT NULL DEFAULT true,
  "uifEnabled" BOOLEAN NOT NULL DEFAULT true,

  "pensionEmployee" NUMERIC(12, 2) NOT NULL DEFAULT 0,
  "pensionEmployer" NUMERIC(12, 2) NOT NULL DEFAULT 0,

  "medicalAidEmployee" NUMERIC(12, 2) NOT NULL DEFAULT 0,
  "medicalAidEmployer" NUMERIC(12, 2) NOT NULL DEFAULT 0,

  "defaultAllowances" NUMERIC(12, 2) NOT NULL DEFAULT 0,
  "defaultOtherDeductions" NUMERIC(12, 2) NOT NULL DEFAULT 0,

  "bankName" TEXT,
  "bankAccountNumber" TEXT,
  "paymentReference" TEXT,

  "notes" TEXT,

  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "employee_compensation_profiles_organisationId_fkey"
    FOREIGN KEY ("organisationId") REFERENCES "organisations"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT "employee_compensation_profiles_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "employees"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "employee_compensation_profiles_organisationId_idx"
ON "employee_compensation_profiles"("organisationId");

CREATE INDEX IF NOT EXISTS "employee_compensation_profiles_employeeId_idx"
ON "employee_compensation_profiles"("employeeId");