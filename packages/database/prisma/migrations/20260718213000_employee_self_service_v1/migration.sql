CREATE TYPE "EmployeeProfileChangeField" AS ENUM (
  'PERSONAL_EMAIL',
  'PHONE',
  'PREFERRED_NAME',
  'RESIDENTIAL_ADDRESS',
  'EMERGENCY_CONTACT_NAME',
  'EMERGENCY_CONTACT_PHONE',
  'EMERGENCY_CONTACT_RELATION',
  'BANK_NAME',
  'BANK_ACCOUNT_NUMBER'
);

CREATE TYPE "ProfileChangeRequestStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED'
);

CREATE TYPE "EmployeeNotificationCategory" AS ENUM (
  'LEAVE',
  'ATTENDANCE',
  'PAYSLIP',
  'DOCUMENT',
  'PROFILE',
  'ANNOUNCEMENT',
  'ACTION_REQUIRED',
  'GENERAL'
);

ALTER TABLE "employees"
  ADD COLUMN "personalEmail" TEXT,
  ADD COLUMN "preferredName" TEXT,
  ADD COLUMN "residentialAddress" TEXT;

CREATE TABLE "employee_profile_change_requests" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "requestedByUserId" TEXT NOT NULL,
  "field" "EmployeeProfileChangeField" NOT NULL,
  "currentValue" TEXT,
  "requestedValue" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "ProfileChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reviewerUserId" TEXT,
  "reviewComments" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "employee_profile_change_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "employee_notifications" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "category" "EmployeeNotificationCategory" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "href" TEXT,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "employee_notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "employee_profile_change_requests_organisationId_idx" ON "employee_profile_change_requests"("organisationId");
CREATE INDEX "employee_profile_change_requests_employeeId_idx" ON "employee_profile_change_requests"("employeeId");
CREATE INDEX "employee_profile_change_requests_status_idx" ON "employee_profile_change_requests"("status");
CREATE INDEX "employee_notifications_organisationId_idx" ON "employee_notifications"("organisationId");
CREATE INDEX "employee_notifications_userId_readAt_idx" ON "employee_notifications"("userId", "readAt");
CREATE INDEX "employee_notifications_createdAt_idx" ON "employee_notifications"("createdAt");

ALTER TABLE "employee_profile_change_requests"
  ADD CONSTRAINT "employee_profile_change_requests_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_profile_change_requests"
  ADD CONSTRAINT "employee_profile_change_requests_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_profile_change_requests"
  ADD CONSTRAINT "employee_profile_change_requests_requestedByUserId_fkey"
  FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employee_profile_change_requests"
  ADD CONSTRAINT "employee_profile_change_requests_reviewerUserId_fkey"
  FOREIGN KEY ("reviewerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "employee_notifications"
  ADD CONSTRAINT "employee_notifications_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_notifications"
  ADD CONSTRAINT "employee_notifications_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
