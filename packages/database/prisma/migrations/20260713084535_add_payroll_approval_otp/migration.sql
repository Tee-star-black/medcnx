-- CreateEnum
CREATE TYPE "PayrollOtpPurpose" AS ENUM ('CEO_PAYROLL_APPROVAL', 'PAYROLL_RELEASE', 'SENSITIVE_DOCUMENT_DOWNLOAD');

-- CreateEnum
CREATE TYPE "PayrollOtpStatus" AS ENUM ('PENDING', 'VERIFIED', 'EXPIRED', 'LOCKED', 'CANCELLED');

-- CreateTable
CREATE TABLE "payroll_otp_challenges" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "payrollApprovalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "PayrollOtpPurpose" NOT NULL,
    "status" "PayrollOtpStatus" NOT NULL DEFAULT 'PENDING',
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "requestedIpAddress" TEXT,
    "verifiedIpAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payroll_otp_challenges_organisationId_idx" ON "payroll_otp_challenges"("organisationId");

-- CreateIndex
CREATE INDEX "payroll_otp_challenges_payrollApprovalId_idx" ON "payroll_otp_challenges"("payrollApprovalId");

-- CreateIndex
CREATE INDEX "payroll_otp_challenges_userId_idx" ON "payroll_otp_challenges"("userId");

-- CreateIndex
CREATE INDEX "payroll_otp_challenges_purpose_idx" ON "payroll_otp_challenges"("purpose");

-- CreateIndex
CREATE INDEX "payroll_otp_challenges_status_idx" ON "payroll_otp_challenges"("status");

-- CreateIndex
CREATE INDEX "payroll_otp_challenges_expiresAt_idx" ON "payroll_otp_challenges"("expiresAt");

-- AddForeignKey
ALTER TABLE "payroll_otp_challenges" ADD CONSTRAINT "payroll_otp_challenges_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_otp_challenges" ADD CONSTRAINT "payroll_otp_challenges_payrollApprovalId_fkey" FOREIGN KEY ("payrollApprovalId") REFERENCES "payroll_approvals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_otp_challenges" ADD CONSTRAINT "payroll_otp_challenges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
