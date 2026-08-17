CREATE TYPE "DocumentTemplateCategory" AS ENUM ('EMPLOYMENT_CONTRACT','OFFER_LETTER','CONFIRMATION_OF_EMPLOYMENT','SALARY_ADJUSTMENT','PROMOTION','DISCIPLINARY_NOTICE','WARNING_LETTER','LEAVE_CONFIRMATION','TERMINATION','POLICY_ACKNOWLEDGEMENT','PAYSLIP','GENERAL_HR_LETTER','CUSTOM');
CREATE TYPE "DocumentTemplateStatus" AS ENUM ('DRAFT','ACTIVE','ARCHIVED');
CREATE TYPE "DocumentSignatureMode" AS ENUM ('NONE','AUTOMATIC','CEO_APPROVAL','MANUAL');
CREATE TYPE "OrganisationSignatureStatus" AS ENUM ('NOT_CONFIGURED','ACTIVE','DISABLED');
CREATE TYPE "GeneratedDocumentStatus" AS ENUM ('DRAFT','GENERATED_FOR_REVIEW','PENDING_CEO_APPROVAL','APPROVED','SIGNED','PUBLISHED','REJECTED','CANCELLED','FAILED');
CREATE TYPE "DocumentSignatureStatus" AS ENUM ('NOT_REQUIRED','UNSIGNED','PENDING_APPROVAL','SIGNED');
CREATE TYPE "DocumentApprovalStatus" AS ENUM ('PENDING','APPROVED','REJECTED','CANCELLED');

CREATE TABLE "document_templates" (
  "id" TEXT NOT NULL, "organisationId" TEXT NOT NULL, "name" TEXT NOT NULL,
  "description" TEXT, "category" "DocumentTemplateCategory" NOT NULL,
  "status" "DocumentTemplateStatus" NOT NULL DEFAULT 'DRAFT',
  "signatureMode" "DocumentSignatureMode" NOT NULL DEFAULT 'NONE',
  "defaultEmployeeVisibility" BOOLEAN NOT NULL DEFAULT false,
  "currentVersionId" TEXT, "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "document_template_versions" (
  "id" TEXT NOT NULL, "organisationId" TEXT NOT NULL, "templateId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL, "storageKey" TEXT NOT NULL, "originalName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL DEFAULT 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  "sizeBytes" INTEGER NOT NULL, "checksumSha256" TEXT NOT NULL,
  "detectedPlaceholders" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "unsupportedPlaceholders" TEXT[] DEFAULT ARRAY[]::TEXT[], "isValid" BOOLEAN NOT NULL DEFAULT false,
  "validationErrors" JSONB, "uploadedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "document_template_versions_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "organisation_branding" (
  "id" TEXT NOT NULL, "organisationId" TEXT NOT NULL, "legalName" TEXT, "tradingName" TEXT,
  "registrationNumber" TEXT, "address" TEXT, "email" TEXT, "phone" TEXT,
  "defaultDocumentFooter" TEXT, "logoStorageKey" TEXT, "logoMimeType" TEXT,
  "logoUpdatedAt" TIMESTAMP(3), "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "organisation_branding_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "organisation_signatures" (
  "id" TEXT NOT NULL, "organisationId" TEXT NOT NULL, "ceoUserId" TEXT, "ceoFullName" TEXT,
  "ceoJobTitle" TEXT, "storageKey" TEXT, "mimeType" TEXT, "sizeBytes" INTEGER,
  "checksumSha256" TEXT, "status" "OrganisationSignatureStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
  "updatedByUserId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "organisation_signatures_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "generated_documents" (
  "id" TEXT NOT NULL, "organisationId" TEXT NOT NULL, "employeeId" TEXT NOT NULL,
  "templateId" TEXT NOT NULL, "templateVersionId" TEXT NOT NULL, "referenceNumber" TEXT NOT NULL,
  "title" TEXT NOT NULL, "category" "DocumentTemplateCategory" NOT NULL,
  "status" "GeneratedDocumentStatus" NOT NULL DEFAULT 'DRAFT',
  "signatureMode" "DocumentSignatureMode" NOT NULL,
  "signatureStatus" "DocumentSignatureStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
  "visibleToEmployee" BOOLEAN NOT NULL DEFAULT false, "withdrawnAt" TIMESTAMP(3),
  "effectiveDate" TIMESTAMP(3), "idempotencyKey" TEXT, "currentVersionNumber" INTEGER NOT NULL DEFAULT 1,
  "generatedByUserId" TEXT NOT NULL, "approvedByUserId" TEXT, "approvedAt" TIMESTAMP(3),
  "publishedByUserId" TEXT, "publishedAt" TIMESTAMP(3), "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "generated_documents_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "generated_document_versions" (
  "id" TEXT NOT NULL, "organisationId" TEXT NOT NULL, "generatedDocumentId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL, "docxStorageKey" TEXT, "pdfStorageKey" TEXT,
  "docxSizeBytes" INTEGER, "pdfSizeBytes" INTEGER, "checksumSha256" TEXT,
  "mappedDataSnapshot" JSONB NOT NULL, "brandingSnapshot" JSONB,
  "signatureInserted" BOOLEAN NOT NULL DEFAULT false, "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "generated_document_versions_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "document_approvals" (
  "id" TEXT NOT NULL, "organisationId" TEXT NOT NULL, "generatedDocumentId" TEXT NOT NULL,
  "requestedByUserId" TEXT NOT NULL, "assignedToUserId" TEXT NOT NULL,
  "status" "DocumentApprovalStatus" NOT NULL DEFAULT 'PENDING', "decisionNote" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "decidedAt" TIMESTAMP(3),
  CONSTRAINT "document_approvals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "document_templates_organisationId_name_key" ON "document_templates"("organisationId","name");
CREATE UNIQUE INDEX "document_templates_currentVersionId_key" ON "document_templates"("currentVersionId");
CREATE INDEX "document_templates_organisationId_status_idx" ON "document_templates"("organisationId","status");
CREATE INDEX "document_templates_category_idx" ON "document_templates"("category");
CREATE UNIQUE INDEX "document_template_versions_templateId_versionNumber_key" ON "document_template_versions"("templateId","versionNumber");
CREATE INDEX "document_template_versions_organisationId_idx" ON "document_template_versions"("organisationId");
CREATE UNIQUE INDEX "organisation_branding_organisationId_key" ON "organisation_branding"("organisationId");
CREATE UNIQUE INDEX "organisation_signatures_organisationId_key" ON "organisation_signatures"("organisationId");
CREATE INDEX "organisation_signatures_ceoUserId_idx" ON "organisation_signatures"("ceoUserId");
CREATE UNIQUE INDEX "generated_documents_organisationId_referenceNumber_key" ON "generated_documents"("organisationId","referenceNumber");
CREATE UNIQUE INDEX "generated_documents_organisationId_idempotencyKey_key" ON "generated_documents"("organisationId","idempotencyKey");
CREATE INDEX "generated_documents_organisationId_status_idx" ON "generated_documents"("organisationId","status");
CREATE INDEX "generated_documents_employeeId_visibleToEmployee_status_idx" ON "generated_documents"("employeeId","visibleToEmployee","status");
CREATE INDEX "generated_documents_templateId_idx" ON "generated_documents"("templateId");
CREATE UNIQUE INDEX "generated_document_versions_generatedDocumentId_versionNumber_key" ON "generated_document_versions"("generatedDocumentId","versionNumber");
CREATE INDEX "generated_document_versions_organisationId_idx" ON "generated_document_versions"("organisationId");
CREATE INDEX "document_approvals_organisationId_status_idx" ON "document_approvals"("organisationId","status");
CREATE INDEX "document_approvals_assignedToUserId_status_idx" ON "document_approvals"("assignedToUserId","status");
CREATE INDEX "document_approvals_generatedDocumentId_idx" ON "document_approvals"("generatedDocumentId");

ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "document_template_versions" ADD CONSTRAINT "document_template_versions_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_template_versions" ADD CONSTRAINT "document_template_versions_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "document_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_template_versions" ADD CONSTRAINT "document_template_versions_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "document_template_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "organisation_branding" ADD CONSTRAINT "organisation_branding_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organisation_branding" ADD CONSTRAINT "organisation_branding_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "organisation_signatures" ADD CONSTRAINT "organisation_signatures_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organisation_signatures" ADD CONSTRAINT "organisation_signatures_ceoUserId_fkey" FOREIGN KEY ("ceoUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "organisation_signatures" ADD CONSTRAINT "organisation_signatures_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "document_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "document_template_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_publishedByUserId_fkey" FOREIGN KEY ("publishedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "generated_document_versions" ADD CONSTRAINT "generated_document_versions_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "generated_document_versions" ADD CONSTRAINT "generated_document_versions_generatedDocumentId_fkey" FOREIGN KEY ("generatedDocumentId") REFERENCES "generated_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "generated_document_versions" ADD CONSTRAINT "generated_document_versions_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "document_approvals" ADD CONSTRAINT "document_approvals_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_approvals" ADD CONSTRAINT "document_approvals_generatedDocumentId_fkey" FOREIGN KEY ("generatedDocumentId") REFERENCES "generated_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_approvals" ADD CONSTRAINT "document_approvals_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "document_approvals" ADD CONSTRAINT "document_approvals_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
