CREATE TYPE "AttendanceCorrectionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
CREATE TYPE "AttendanceCorrectionReason" AS ENUM ('FORGOT_CLOCK_IN', 'FORGOT_CLOCK_OUT', 'INCORRECT_TIME', 'TECHNICAL_PROBLEM', 'APPROVED_OFF_SITE_WORK', 'OTHER');

ALTER TABLE "organisations"
  ADD COLUMN "attendanceWorkingDays" INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5]::INTEGER[],
  ADD COLUMN "attendanceGracePeriodMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "allowEarlyClockIn" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "allowEarlyClockOut" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "requireLateAttendanceNote" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "requireEarlyClockOutNote" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "managersMayEditAttendance" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "attendanceCorrectionsRequireApproval" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "attendance_records"
  ADD COLUMN "expectedMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "workedMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lateMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "earlyClockOutMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "calculatedOvertimeMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "approvedOvertimeMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "payableOvertimeMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "policyResult" TEXT,
  ADD COLUMN "correctedAt" TIMESTAMP(3),
  ADD COLUMN "correctedByUserId" TEXT,
  ADD COLUMN "correctionOriginalValues" JSONB;

CREATE TABLE "attendance_correction_requests" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "attendanceRecordId" TEXT,
  "requestedByUserId" TEXT NOT NULL,
  "requestedDate" DATE NOT NULL,
  "requestedClockInAt" TIMESTAMP(3),
  "requestedClockOutAt" TIMESTAMP(3),
  "reasonCategory" "AttendanceCorrectionReason" NOT NULL,
  "explanation" TEXT NOT NULL,
  "status" "AttendanceCorrectionStatus" NOT NULL DEFAULT 'PENDING',
  "reviewerUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewComments" TEXT,
  "originalValues" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "attendance_correction_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "attendance_correction_requests_organisationId_idx" ON "attendance_correction_requests"("organisationId");
CREATE INDEX "attendance_correction_requests_employeeId_idx" ON "attendance_correction_requests"("employeeId");
CREATE INDEX "attendance_correction_requests_attendanceRecordId_idx" ON "attendance_correction_requests"("attendanceRecordId");
CREATE INDEX "attendance_correction_requests_status_idx" ON "attendance_correction_requests"("status");
CREATE INDEX "attendance_correction_requests_requestedDate_idx" ON "attendance_correction_requests"("requestedDate");

ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_correctedByUserId_fkey" FOREIGN KEY ("correctedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "attendance_correction_requests" ADD CONSTRAINT "attendance_correction_requests_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_correction_requests" ADD CONSTRAINT "attendance_correction_requests_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_correction_requests" ADD CONSTRAINT "attendance_correction_requests_attendanceRecordId_fkey" FOREIGN KEY ("attendanceRecordId") REFERENCES "attendance_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "attendance_correction_requests" ADD CONSTRAINT "attendance_correction_requests_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_correction_requests" ADD CONSTRAINT "attendance_correction_requests_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
