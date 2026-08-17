# MedCNX Document Generation V2 — Handoff

## Implemented

- Versioned reusable DOCX templates with upload, validation, activation, archiving and replacement history.
- Employee/organisation/date/salary mapping with South African date and Rand formatting.
- Private organisation branding and CEO signature settings.
- `NONE`, `AUTOMATIC`, `CEO_APPROVAL` and `MANUAL` signature modes.
- Backend-only DOCX rendering, protected image insertion and LibreOffice PDF conversion.
- Immutable generated versions, approval decisions, PDF preview, publish/hide controls and audit events.
- Employee Self-Service access restricted to the logged-in employee's published, visible PDF documents.
- Local development storage and private Google Cloud Storage drivers.
- Organisation scoping in all V2 queries plus tenant-isolation tests.
- Inline editing and revalidation of mapped employee and organisation values before generation.
- Optional, explicit persistence of document edits back to a registered employee profile.
- External/pre-hire recipients for offers and contracts without creating an employee login.
- A lighter, step-based generation screen with contextual hover help.
- Category-led template management with Employment, Confirmations, Leave, Policy & Compliance, Disciplinary, Payroll, Termination and General HR groups.
- One master employment contract replacing role-specific presets for new use, while existing templates and generated records remain unchanged.
- Preset PDF preview and one-click import inside the Add template workflow.
- Idempotent automatic installation of 11 professional default templates when an authorised administrator first opens Template Management.

## Database migration

`packages/database/prisma/migrations/20260721150000_document_generation_v2/migration.sql`, `packages/database/prisma/migrations/20260721180000_document_recipients_and_mapping_overrides/migration.sql` and `packages/database/prisma/migrations/20260722143000_expand_document_template_categories/migration.sql`

The first migration adds the V2 document records. The second adds `DocumentRecipient`, permits either an organisation employee or an external/pre-hire subject, and enforces that every generated document has exactly one subject. The category migration adds the expanded controlled HR document-type catalogue. Existing templates and employee documents are not removed or rewritten.

## Permissions added

`document_templates:read`, `document_templates:create`, `document_templates:update`, `document_templates:archive`, `generated_documents:read`, `generated_documents:create`, `generated_documents:preview`, `generated_documents:publish`, `generated_documents:approve`, `generated_documents:reject`, `generated_documents:download`, `generated_documents:view-all`, `generated_documents:view-own`, `organisation_branding:manage`, `organisation_signature:manage`, `organisation_signature:use`.

## Packages added

- `@google-cloud/storage@^7.21.0`
- `docxtemplater@^3.69.0`
- `pizzip@^3.2.0`

## Environment variables

- `DOCUMENT_STORAGE_DRIVER=local|gcs`
- `DOCUMENT_STORAGE_LOCAL_ROOT=./private-storage`
- `DOCUMENT_STORAGE_GCS_BUCKET=<private bucket>`
- `LIBREOFFICE_BINARY=libreoffice`
- `DOCUMENT_PDF_TIMEOUT_MS=45000`

## PowerShell installation and migration

```powershell
Set-Location "C:\path\to\medcnx"
npm install
npx prisma format --schema packages/database/prisma/schema.prisma
npx prisma generate --schema packages/database/prisma/schema.prisma
npx prisma migrate deploy --schema packages/database/prisma/schema.prisma
npx prisma db seed --schema packages/database/prisma/schema.prisma
```

For a local development database where migration history is already aligned, `npx prisma migrate dev --schema packages/database/prisma/schema.prisma` may be used instead of `migrate deploy`.

## PowerShell run commands

API terminal:

```powershell
Set-Location "C:\path\to\medcnx"
npm run dev --workspace apps/api
```

Web terminal:

```powershell
Set-Location "C:\path\to\medcnx"
npm run dev --workspace apps/web
```

Prisma Studio:

```powershell
npx prisma studio --schema packages/database/prisma/schema.prisma
```

## Manual verification

### HR

1. Open **Documents → Manage templates** and choose a business category.
2. Select **Add template → Choose a preset**, preview the master contract PDF and choose **Use preset**. Use **Upload Word file** only for a genuinely custom document.
3. Configure organisation branding under **Settings → Branding and CEO signature**.
4. Open **Documents → Generated documents**, select a registered employee or choose **New or external person**.
5. Review and edit the mapped values inline. For a registered employee, opt in only if those edits should also update the employee profile.
6. Revalidate, open the PDF preview, then generate.
7. For `CEO_APPROVAL`, confirm the status is `PENDING_CEO_APPROVAL`; otherwise publish/finalise a ready or signed document.

### CEO

1. Sign in as the CEO user configured in document signature settings.
2. Open the approval notification and document detail.
3. Review/download the unsigned draft, enter a decision note, then approve or reject.
4. Confirm approval produces a new signed immutable version and notifies the requester.

### Employee

1. Sign in as the employee linked to the generated document.
2. Open **My Documents** and confirm only published/visible documents appear.
3. Filter and download the final PDF.
4. Confirm another employee account cannot access that document ID.

## Verification results

- Prisma format: passed.
- Prisma client generation: passed (7.8.0).
- NestJS API production build: passed.
- Next.js web production build: passed, including 35 routes.
- API test suite: 25 suites passed, 101 tests passed.
- Default template catalogue: 11 presets and 13 rendered pages passed visual and placeholder validation.
- Master employment contract: three-page DOCX and populated PDF render passed with no clipping or overlap.
- Real DOCX image insertion and LibreOffice PDF conversion: passed.
- Rendered page inspection: passed; no clipping or overlap was found in the salary confirmation sample.

## Supplied-template notes

Prepared copies are in `apps/api/resources/document-templates`; supplied PNGs are in `apps/api/resources/branding` and never under `apps/web/public`. Supported employee fields were converted to MedCNX placeholders. The source documents still contain practice-specific human-completion blanks (for example HPCSA/SANC registration, reporting lines, financial institution details and amount-in-words). These fields do not exist in the current Employee schema and were intentionally not guessed. Add governed fields to the schema or revise those clauses before using those particular blanks as automated data.

## Known limitations

- Database-backed API end-to-end tests require a disposable PostgreSQL test database and were not executed in this source-only workspace; unit, security-scope and production builds pass.
- LibreOffice must be present in every API runtime. `infra/Dockerfile.api` installs it for Cloud Run.
- GCS service-account access, bucket retention/lifecycle rules and Secret Manager wiring must be configured in the target GCP project.
- The supplied signature image is still pending. Upload it through the protected settings page; previously generated files will remain unchanged when it is later replaced.

## Files created

- `apps/api/src/generated-documents/document-branding.service.ts`
- `apps/api/src/generated-documents/document-rules.ts`
- `apps/api/src/generated-documents/document-rules.spec.ts`
- `apps/api/src/generated-documents/document-template-engine.service.ts`
- `apps/api/src/generated-documents/document-template-engine.service.spec.ts`
- `apps/api/src/generated-documents/document-templates.service.ts`
- `apps/api/src/generated-documents/document-templates.service.spec.ts`
- `apps/api/src/generated-documents/dto/document-template.dto.ts`
- `apps/api/src/generated-documents/dto/document-workflow.dto.ts`
- `apps/api/src/generated-documents/pdf-converter.service.ts`
- `apps/api/src/generated-documents/storage/document-storage.service.ts`
- `apps/web/src/app/dashboard/documents/generated/[id]/page.tsx`
- `apps/web/src/app/dashboard/documents/templates/page.tsx`
- `apps/web/src/app/dashboard/documents/templates/[id]/page.tsx`
- `apps/web/src/app/dashboard/settings/document-branding/page.tsx`
- `packages/database/prisma/migrations/20260721150000_document_generation_v2/migration.sql`
- `packages/database/prisma/migrations/20260721180000_document_recipients_and_mapping_overrides/migration.sql`
- `scripts/prepare-document-templates.mjs`
- `infra/Dockerfile.api`
- `docs/DOCUMENT_GENERATION_V2.md`
- `docs/DOCUMENT_GENERATION_V2_HANDOFF.md`
- Prepared DOCX and private branding resources under `apps/api/resources/`.

## Files modified

- `apps/api/.env.example`
- `apps/api/package.json`
- `apps/api/src/generated-documents/generated-documents.controller.ts`
- `apps/api/src/generated-documents/generated-documents.module.ts`
- `apps/api/src/generated-documents/generated-documents.service.ts`
- `apps/web/src/app/dashboard/documents/generated/page.tsx`
- `apps/web/src/app/employee/documents/page.tsx`
- `packages/database/prisma/schema.prisma`
- `packages/database/prisma/seed.ts`
- `package-lock.json`

The obsolete HTML generator DTO was removed: `apps/api/src/generated-documents/dto/generate-employee-document.dto.ts`.
