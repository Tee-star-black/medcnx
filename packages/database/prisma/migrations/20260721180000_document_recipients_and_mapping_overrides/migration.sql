ALTER TABLE "generated_documents" ALTER COLUMN "employeeId" DROP NOT NULL;
ALTER TABLE "generated_documents" ADD COLUMN "recipientId" TEXT;
ALTER TABLE "generated_documents" DROP CONSTRAINT IF EXISTS "generated_documents_employeeId_fkey";
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "document_recipients" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "idNumber" TEXT,
  "address" TEXT,
  "jobTitle" TEXT,
  "department" TEXT,
  "proposedSalary" DECIMAL(12,2),
  "proposedStartDate" TIMESTAMP(3),
  "candidateId" TEXT,
  "convertedEmployeeId" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "document_recipients_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "document_recipients_organisationId_idx" ON "document_recipients"("organisationId");
CREATE INDEX "document_recipients_email_idx" ON "document_recipients"("email");
CREATE INDEX "document_recipients_candidateId_idx" ON "document_recipients"("candidateId");
CREATE INDEX "document_recipients_convertedEmployeeId_idx" ON "document_recipients"("convertedEmployeeId");
CREATE INDEX "generated_documents_recipientId_idx" ON "generated_documents"("recipientId");

ALTER TABLE "document_recipients" ADD CONSTRAINT "document_recipients_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_recipients" ADD CONSTRAINT "document_recipients_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "document_recipients" ADD CONSTRAINT "document_recipients_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "document_recipients" ADD CONSTRAINT "document_recipients_convertedEmployeeId_fkey" FOREIGN KEY ("convertedEmployeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "document_recipients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_subject_check" CHECK (("employeeId" IS NOT NULL) <> ("recipientId" IS NOT NULL));
