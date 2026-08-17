CREATE TABLE IF NOT EXISTS "attendance_records" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "clockInAt" TIMESTAMP(3) NOT NULL,
  "clockOutAt" TIMESTAMP(3),
  "status" "AttendanceStatus" NOT NULL DEFAULT 'CLOCKED_IN',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "attendance_records_organisationId_idx"
ON "attendance_records"("organisationId");

CREATE INDEX IF NOT EXISTS "attendance_records_employeeId_idx"
ON "attendance_records"("employeeId");

CREATE INDEX IF NOT EXISTS "attendance_records_clockInAt_idx"
ON "attendance_records"("clockInAt");

CREATE INDEX IF NOT EXISTS "attendance_records_status_idx"
ON "attendance_records"("status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'attendance_records_organisationId_fkey'
  ) THEN
    ALTER TABLE "attendance_records"
    ADD CONSTRAINT "attendance_records_organisationId_fkey"
    FOREIGN KEY ("organisationId")
    REFERENCES "organisations"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'attendance_records_employeeId_fkey'
  ) THEN
    ALTER TABLE "attendance_records"
    ADD CONSTRAINT "attendance_records_employeeId_fkey"
    FOREIGN KEY ("employeeId")
    REFERENCES "employees"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
  END IF;
END $$;