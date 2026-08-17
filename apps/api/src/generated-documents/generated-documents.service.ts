import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  DocumentSignatureMode,
  GeneratedDocumentStatus,
  Prisma,
} from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import type { CurrentUser } from '../auth/types/current-user.type';
import { PrismaService } from '../database/prisma.service';
import {
  CreateGeneratedDocumentDto,
  DocumentMappingOverridesDto,
  PreviewGeneratedDocumentDto,
} from './dto/document-workflow.dto';
import { DocumentStorageService } from './storage/document-storage.service';
import { DocumentTemplateEngineService } from './document-template-engine.service';
import { PdfConverterService } from './pdf-converter.service';
import {
  formatDocumentDate,
  formatZar,
  getMissingFields,
} from './document-rules';

const PUBLISHABLE: GeneratedDocumentStatus[] = [
  'GENERATED_FOR_REVIEW',
  'SIGNED',
  'APPROVED',
];
type Context = Awaited<ReturnType<GeneratedDocumentsService['context']>>;

@Injectable()
export class GeneratedDocumentsService {
  constructor(
    private prisma: PrismaService,
    private storage: DocumentStorageService,
    private engine: DocumentTemplateEngineService,
    private pdf: PdfConverterService,
  ) {}

  list(user: CurrentUser) {
    return this.prisma.generatedDocument.findMany({
      where: { organisationId: user.organisationId },
      include: {
        employee: {
          select: {
            id: true,
            userId: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
          },
        },
        recipient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            jobTitle: true,
          },
        },
        template: { select: { id: true, name: true } },
        templateVersion: { select: { versionNumber: true } },
        generatedBy: { select: { firstName: true, lastName: true } },
        approvedBy: { select: { firstName: true, lastName: true } },
        approvals: { orderBy: { requestedAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  async get(user: CurrentUser, id: string) {
    const item = await this.prisma.generatedDocument.findFirst({
      where: { id, organisationId: user.organisationId },
      include: {
        employee: {
          select: {
            id: true,
            userId: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
            jobTitle: true,
          },
        },
        recipient: true,
        template: true,
        templateVersion: {
          select: {
            id: true,
            versionNumber: true,
            detectedPlaceholders: true,
            storageKey: true,
          },
        },
        versions: { orderBy: { versionNumber: 'desc' } },
        generatedBy: { select: { id: true, firstName: true, lastName: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
        publishedBy: { select: { id: true, firstName: true, lastName: true } },
        approvals: {
          include: {
            requestedBy: {
              select: { id: true, firstName: true, lastName: true },
            },
            assignedTo: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
          orderBy: { requestedAt: 'desc' },
        },
      },
    });
    if (!item) throw new NotFoundException('Generated document was not found.');
    return item;
  }

  async preview(user: CurrentUser, dto: PreviewGeneratedDocumentDto) {
    const ctx = await this.context(user, dto);
    return {
      template: {
        id: ctx.template.id,
        name: ctx.template.name,
        version: ctx.template.currentVersion!.versionNumber,
        category: ctx.template.category,
        signatureMode: ctx.template.signatureMode,
        placeholders: ctx.template.currentVersion!.detectedPlaceholders,
      },
      subject: ctx.subject,
      mappedData: ctx.data,
      missingFields: ctx.missingFields,
      canGenerate: ctx.missingFields.length === 0,
      employeeVisibility: ctx.template.defaultEmployeeVisibility,
      pdfPreviewAvailable: true,
    };
  }

  async previewPdf(user: CurrentUser, dto: PreviewGeneratedDocumentDto) {
    const ctx = await this.context(user, dto);
    if (ctx.missingFields.length)
      throw new BadRequestException({
        message: 'Required information is missing.',
        missingFields: ctx.missingFields,
      });
    let signature: Buffer | undefined;
    if (ctx.template.signatureMode === 'AUTOMATIC') {
      if (!user.permissions.includes('organisation_signature:use'))
        throw new ForbiddenException(
          'Automatic signature preview requires organisation_signature:use.',
        );
      signature = (await this.signature(user.organisationId)).bytes;
    }
    const [templateBytes, logo] = await Promise.all([
      this.storage.get(ctx.template.currentVersion!.storageKey),
      ctx.branding?.logoStorageKey
        ? this.storage.get(ctx.branding.logoStorageKey)
        : Promise.resolve(undefined),
    ]);
    const docx = this.engine.render(templateBytes, ctx.data, {
      logo,
      signature,
    });
    const pdf = await this.pdf.convert(docx);
    await this.prisma.auditLog.create({
      data: {
        organisationId: user.organisationId,
        actorUserId: user.id,
        employeeId: ctx.employee?.id,
        action: AuditAction.VIEW,
        entity: 'DocumentPreview',
        entityId: ctx.template.id,
        message: 'Sensitive generated document preview rendered.',
        metadata: {
          templateVersion: ctx.template.currentVersion!.versionNumber,
        } as Prisma.InputJsonValue,
      },
    });
    return pdf;
  }

  async create(user: CurrentUser, dto: CreateGeneratedDocumentDto) {
    if (dto.idempotencyKey) {
      const existing = await this.prisma.generatedDocument.findFirst({
        where: {
          organisationId: user.organisationId,
          idempotencyKey: dto.idempotencyKey,
        },
      });
      if (existing) return this.get(user, existing.id);
    }
    const ctx = await this.context(user, dto);
    if (ctx.missingFields.length)
      throw new BadRequestException({
        message: 'Required information is missing.',
        missingFields: ctx.missingFields,
      });
    const id = randomUUID();
    const recipientId = ctx.isExternal ? randomUUID() : null;
    const reference = `MCX-${new Date().getFullYear()}-${id.slice(0, 8).toUpperCase()}`;
    (ctx.data.document as Record<string, unknown>).referenceNumber = reference;
    if (
      ctx.template.signatureMode === 'AUTOMATIC' &&
      !user.permissions.includes('organisation_signature:use')
    )
      throw new ForbiddenException(
        'Automatic signature use requires organisation_signature:use.',
      );
    const signature =
      ctx.template.signatureMode === 'AUTOMATIC'
        ? await this.signature(user.organisationId)
        : undefined;
    const templateBytes = await this.storage.get(
      ctx.template.currentVersion!.storageKey,
    );
    const logo = ctx.branding?.logoStorageKey
      ? await this.storage.get(ctx.branding.logoStorageKey)
      : undefined;
    const docx = this.engine.render(templateBytes, ctx.data, {
      logo,
      signature: signature?.bytes,
    });
    const pdf = await this.pdf.convert(docx);
    const subjectPath = ctx.employee
      ? `employees/${ctx.employee.id}`
      : `external-recipients/${recipientId}`;
    const base = `organisations/${user.organisationId}/${subjectPath}/generated-documents/${id}/v1`;
    const [docxObject, pdfObject] = await Promise.all([
      this.storage.put(
        `${base}/document.docx`,
        docx,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ),
      this.storage.put(`${base}/document.pdf`, pdf, 'application/pdf'),
    ]);
    const mode = ctx.template.signatureMode;
    const status: GeneratedDocumentStatus =
      mode === 'CEO_APPROVAL'
        ? 'PENDING_CEO_APPROVAL'
        : mode === 'AUTOMATIC'
          ? 'SIGNED'
          : 'GENERATED_FOR_REVIEW';
    const signatureStatus =
      mode === 'CEO_APPROVAL'
        ? 'PENDING_APPROVAL'
        : mode === 'AUTOMATIC'
          ? 'SIGNED'
          : mode === 'MANUAL'
            ? 'UNSIGNED'
            : 'NOT_REQUIRED';
    const created = await this.prisma.$transaction(async (tx) => {
      if (ctx.isExternal && dto.recipient && recipientId) {
        await tx.documentRecipient.create({
          data: {
            id: recipientId,
            organisationId: user.organisationId,
            firstName: dto.recipient.firstName.trim(),
            lastName: dto.recipient.lastName.trim(),
            email: dto.recipient.email?.trim(),
            phone: dto.recipient.phone?.trim(),
            idNumber: dto.recipient.idNumber?.trim(),
            address: dto.recipient.address?.trim(),
            jobTitle: dto.recipient.jobTitle?.trim(),
            department: dto.recipient.department?.trim(),
            proposedSalary: dto.recipient.proposedSalary,
            proposedStartDate: dto.recipient.proposedStartDate
              ? new Date(dto.recipient.proposedStartDate)
              : null,
            candidateId: dto.recipient.candidateId,
            createdByUserId: user.id,
          },
        });
      }
      if (dto.updateEmployeeProfile && ctx.employee && dto.overrides) {
        await this.updateEmployeeFromOverrides(
          tx,
          user.organisationId,
          ctx.employee.id,
          dto.overrides,
        );
      }
      const document = await tx.generatedDocument.create({
        data: {
          id,
          organisationId: user.organisationId,
          employeeId: ctx.employee?.id,
          recipientId,
          templateId: ctx.template.id,
          templateVersionId: ctx.template.currentVersion!.id,
          referenceNumber: reference,
          title: dto.title?.trim() || ctx.template.name,
          category: ctx.template.category,
          status,
          signatureMode: mode,
          signatureStatus,
          visibleToEmployee: false,
          effectiveDate: dto.effectiveDate ? new Date(dto.effectiveDate) : null,
          idempotencyKey: dto.idempotencyKey,
          generatedByUserId: user.id,
        },
      });
      await tx.generatedDocumentVersion.create({
        data: {
          organisationId: user.organisationId,
          generatedDocumentId: id,
          versionNumber: 1,
          docxStorageKey: docxObject.key,
          pdfStorageKey: pdfObject.key,
          docxSizeBytes: docx.length,
          pdfSizeBytes: pdf.length,
          checksumSha256: this.hash(pdf),
          mappedDataSnapshot: ctx.data as Prisma.InputJsonValue,
          brandingSnapshot: this.brandingSnapshot(ctx) as Prisma.InputJsonValue,
          signatureInserted: mode === 'AUTOMATIC',
          createdByUserId: user.id,
        },
      });
      if (mode === 'CEO_APPROVAL') {
        const ceo = await tx.organisationSignature.findUnique({
          where: { organisationId: user.organisationId },
        });
        if (!ceo?.ceoUserId)
          throw new BadRequestException(
            'Configure a CEO user before requesting CEO approval.',
          );
        await tx.documentApproval.create({
          data: {
            organisationId: user.organisationId,
            generatedDocumentId: id,
            requestedByUserId: user.id,
            assignedToUserId: ceo.ceoUserId,
          },
        });
        await this.notifyUser(
          tx,
          user.organisationId,
          ceo.ceoUserId,
          'ACTION_REQUIRED',
          'Document approval requested',
          `${reference} requires your approval.`,
          `/dashboard/documents/generated/${id}`,
        );
      }
      return document;
    });
    await this.audit(
      user,
      AuditAction.CREATE,
      id,
      ctx.employee?.id,
      'Generated document created.',
      {
        reference,
        status,
        templateVersion: ctx.template.currentVersion!.versionNumber,
        signatureInserted: mode === 'AUTOMATIC',
        subjectType: ctx.isExternal ? 'EXTERNAL_RECIPIENT' : 'EMPLOYEE',
        profileUpdated: Boolean(dto.updateEmployeeProfile && ctx.employee),
      },
    );
    if (mode === 'AUTOMATIC')
      await this.audit(
        user,
        AuditAction.APPROVE,
        id,
        ctx.employee?.id,
        'CEO signature inserted during authorised backend generation.',
      );
    return this.get(user, created.id);
  }

  async approve(user: CurrentUser, id: string, note?: string) {
    const item = await this.get(user, id);
    if (item.status !== 'PENDING_CEO_APPROVAL')
      throw new BadRequestException('Only pending documents can be approved.');
    const approval = item.approvals.find((a) => a.status === 'PENDING');
    if (!approval || approval.assignedToUserId !== user.id)
      throw new ForbiddenException(
        'This approval request is not assigned to you.',
      );
    const sig = await this.signature(user.organisationId);
    const latest = item.versions[0];
    const templateBytes = await this.storage.get(
      item.templateVersion.storageKey,
    );
    const data = latest.mappedDataSnapshot as Record<string, unknown>;
    const branding = latest.brandingSnapshot as Record<string, unknown> | null;
    const logoKey = branding?.logoStorageKey as string | undefined;
    const logo = logoKey ? await this.storage.get(logoKey) : undefined;
    const docx = this.engine.render(templateBytes, data, {
      logo,
      signature: sig.bytes,
    });
    const pdf = await this.pdf.convert(docx);
    const version = item.currentVersionNumber + 1;
    const subjectPath = item.employeeId
      ? `employees/${item.employeeId}`
      : `external-recipients/${item.recipientId}`;
    const base = `organisations/${user.organisationId}/${subjectPath}/generated-documents/${id}/v${version}`;
    const [d, p] = await Promise.all([
      this.storage.put(
        `${base}/document.docx`,
        docx,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ),
      this.storage.put(`${base}/document.pdf`, pdf, 'application/pdf'),
    ]);
    await this.prisma.$transaction(async (tx) => {
      await tx.generatedDocumentVersion.create({
        data: {
          organisationId: user.organisationId,
          generatedDocumentId: id,
          versionNumber: version,
          docxStorageKey: d.key,
          pdfStorageKey: p.key,
          docxSizeBytes: docx.length,
          pdfSizeBytes: pdf.length,
          checksumSha256: this.hash(pdf),
          mappedDataSnapshot: data as Prisma.InputJsonValue,
          brandingSnapshot: (branding ?? undefined) as
            Prisma.InputJsonValue | undefined,
          signatureInserted: true,
          createdByUserId: user.id,
        },
      });
      await tx.documentApproval.update({
        where: { id: approval.id },
        data: { status: 'APPROVED', decisionNote: note, decidedAt: new Date() },
      });
      await tx.generatedDocument.update({
        where: { id },
        data: {
          status: 'SIGNED',
          signatureStatus: 'SIGNED',
          approvedByUserId: user.id,
          approvedAt: new Date(),
          currentVersionNumber: version,
        },
      });
      await this.notifyUser(
        tx,
        user.organisationId,
        item.generatedByUserId,
        'DOCUMENT',
        'Document approved',
        `${item.referenceNumber} was approved and signed.`,
        `/dashboard/documents/generated/${id}`,
      );
    });
    await this.audit(
      user,
      AuditAction.APPROVE,
      id,
      item.employeeId,
      'Generated document approved and signature inserted.',
    );
    return this.get(user, id);
  }
  async reject(user: CurrentUser, id: string, note?: string) {
    const item = await this.get(user, id);
    const approval = item.approvals.find((a) => a.status === 'PENDING');
    if (item.status !== 'PENDING_CEO_APPROVAL' || !approval)
      throw new BadRequestException('Only pending documents can be rejected.');
    if (approval.assignedToUserId !== user.id)
      throw new ForbiddenException(
        'This approval request is not assigned to you.',
      );
    await this.prisma.$transaction(async (tx) => {
      await tx.documentApproval.update({
        where: { id: approval.id },
        data: { status: 'REJECTED', decisionNote: note, decidedAt: new Date() },
      });
      await tx.generatedDocument.update({
        where: { id },
        data: { status: 'REJECTED', visibleToEmployee: false },
      });
      await this.notifyUser(
        tx,
        user.organisationId,
        item.generatedByUserId,
        'DOCUMENT',
        'Document rejected',
        `${item.referenceNumber} was rejected.`,
        `/dashboard/documents/generated/${id}`,
      );
    });
    await this.audit(
      user,
      AuditAction.REJECT,
      id,
      item.employeeId,
      'Generated document rejected.',
    );
    return this.get(user, id);
  }
  async publish(user: CurrentUser, id: string) {
    const item = await this.get(user, id);
    if (!PUBLISHABLE.includes(item.status))
      throw new BadRequestException('This document is not ready to publish.');
    await this.prisma.generatedDocument.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        visibleToEmployee: Boolean(item.employeeId),
        publishedByUserId: user.id,
        publishedAt: new Date(),
      },
    });
    if (item.employee?.userId)
      await this.notifyUser(
        this.prisma,
        user.organisationId,
        item.employee.userId,
        'DOCUMENT',
        'New document available',
        `${item.title} is now available in My Documents.`,
        `/employee/documents`,
      );
    await this.audit(
      user,
      AuditAction.UPDATE,
      id,
      item.employeeId,
      item.employeeId
        ? 'Generated document published to employee.'
        : 'External recipient document finalised.',
    );
    return this.get(user, id);
  }
  async setVisibility(user: CurrentUser, id: string, visible: boolean) {
    const item = await this.get(user, id);
    if (visible && !item.employeeId)
      throw new BadRequestException(
        'External recipients do not have Employee Self-Service access.',
      );
    if (visible && item.status !== 'PUBLISHED')
      throw new BadRequestException(
        'Only published documents may be visible to employees.',
      );
    await this.prisma.generatedDocument.update({
      where: { id },
      data: { visibleToEmployee: visible },
    });
    await this.audit(
      user,
      AuditAction.UPDATE,
      id,
      item.employeeId,
      visible
        ? 'Employee visibility enabled.'
        : 'Employee visibility disabled.',
    );
    return this.get(user, id);
  }
  async cancel(user: CurrentUser, id: string) {
    const item = await this.get(user, id);
    if (['SIGNED', 'PUBLISHED', 'REJECTED', 'CANCELLED'].includes(item.status))
      throw new BadRequestException(
        'Final documents cannot be cancelled or overwritten.',
      );
    await this.prisma.generatedDocument.update({
      where: { id },
      data: { status: 'CANCELLED', visibleToEmployee: false },
    });
    await this.audit(
      user,
      AuditAction.UPDATE,
      id,
      item.employeeId,
      'Generated document cancelled.',
    );
    return this.get(user, id);
  }
  async download(user: CurrentUser, id: string, format: 'pdf' | 'docx') {
    const item = await this.get(user, id);
    const latest = item.versions[0];
    const key = format === 'pdf' ? latest.pdfStorageKey : latest.docxStorageKey;
    if (!key)
      throw new NotFoundException(
        `${format.toUpperCase()} output is unavailable.`,
      );
    await this.audit(
      user,
      AuditAction.DOWNLOAD,
      id,
      item.employeeId,
      `Generated ${format.toUpperCase()} downloaded.`,
    );
    return {
      bytes: await this.storage.get(key),
      name: `${item.referenceNumber}-${item.title.replace(/[^a-z0-9]+/gi, '-')}.${format}`,
      mime:
        format === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
  }
  async own(user: CurrentUser) {
    const employee = await this.prisma.employee.findFirst({
      where: { userId: user.id, organisationId: user.organisationId },
    });
    if (!employee)
      throw new NotFoundException('Employee profile was not found.');
    return this.prisma.generatedDocument.findMany({
      where: {
        organisationId: user.organisationId,
        employeeId: employee.id,
        status: 'PUBLISHED',
        visibleToEmployee: true,
        withdrawnAt: null,
      },
      select: {
        id: true,
        title: true,
        referenceNumber: true,
        category: true,
        status: true,
        createdAt: true,
        publishedAt: true,
        effectiveDate: true,
        template: { select: { name: true } },
      },
      orderBy: { publishedAt: 'desc' },
    });
  }
  async downloadOwn(user: CurrentUser, id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { userId: user.id, organisationId: user.organisationId },
    });
    if (!employee)
      throw new NotFoundException('Employee profile was not found.');
    const item = await this.prisma.generatedDocument.findFirst({
      where: {
        id,
        organisationId: user.organisationId,
        employeeId: employee.id,
        status: 'PUBLISHED',
        visibleToEmployee: true,
        withdrawnAt: null,
      },
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
    });
    if (!item) throw new NotFoundException('Published document was not found.');
    const key = item.versions[0]?.pdfStorageKey;
    if (!key) throw new NotFoundException('PDF output is unavailable.');
    await this.audit(
      user,
      AuditAction.DOWNLOAD,
      id,
      employee.id,
      'Employee downloaded own generated document.',
    );
    return {
      bytes: await this.storage.get(key),
      name: `${item.referenceNumber}.pdf`,
      mime: 'application/pdf',
    };
  }

  async context(user: CurrentUser, dto: PreviewGeneratedDocumentDto) {
    const template = await this.prisma.documentTemplate.findFirst({
      where: {
        id: dto.templateId,
        organisationId: user.organisationId,
        status: 'ACTIVE',
      },
      include: { currentVersion: true },
    });
    if (!template?.currentVersion)
      throw new NotFoundException('Active document template was not found.');
    if (Boolean(dto.employeeId) === Boolean(dto.recipient))
      throw new BadRequestException(
        'Select one registered employee or enter one external recipient.',
      );
    const employee = dto.employeeId
      ? await this.prisma.employee.findFirst({
          where: { id: dto.employeeId, organisationId: user.organisationId },
          include: { department: true, compensationProfile: true },
        })
      : null;
    if (dto.employeeId && !employee)
      throw new NotFoundException('Employee was not found.');
    if (dto.recipient?.candidateId) {
      const candidate = await this.prisma.candidate.findFirst({
        where: {
          id: dto.recipient.candidateId,
          organisationId: user.organisationId,
        },
        select: { id: true },
      });
      if (!candidate)
        throw new NotFoundException('Recruitment candidate was not found.');
    }
    const organisation = await this.prisma.organisation.findUniqueOrThrow({
      where: { id: user.organisationId },
    });
    const [branding, signature] = await Promise.all([
      this.prisma.organisationBranding.findUnique({
        where: { organisationId: user.organisationId },
      }),
      this.prisma.organisationSignature.findUnique({
        where: { organisationId: user.organisationId },
      }),
    ]);
    const address =
      branding?.address ||
      [
        organisation.addressLine1,
        organisation.addressLine2,
        organisation.city,
        organisation.province,
        organisation.postalCode,
        organisation.country,
      ]
        .filter(Boolean)
        .join(', ');
    const overrides = dto.overrides ?? {};
    const firstName =
      overrides.firstName ??
      employee?.firstName ??
      dto.recipient?.firstName ??
      '';
    const lastName =
      overrides.lastName ?? employee?.lastName ?? dto.recipient?.lastName ?? '';
    const salaryValue = overrides.basicSalary ?? dto.recipient?.proposedSalary;
    const startDateValue = overrides.startDate
      ? new Date(overrides.startDate)
      : (employee?.startDate ??
        (dto.recipient?.proposedStartDate
          ? new Date(dto.recipient.proposedStartDate)
          : null));
    const data = {
      employee: {
        fullName: `${firstName} ${lastName}`.trim(),
        firstName,
        lastName,
        employeeNumber: employee?.employeeNumber || 'PRE-HIRE',
        email:
          overrides.email ??
          employee?.email ??
          employee?.personalEmail ??
          dto.recipient?.email ??
          '',
        phone: overrides.phone ?? employee?.phone ?? dto.recipient?.phone ?? '',
        jobTitle:
          overrides.jobTitle ??
          employee?.jobTitle ??
          dto.recipient?.jobTitle ??
          '',
        department:
          overrides.department ??
          employee?.department?.name ??
          dto.recipient?.department ??
          '',
        startDate: formatDocumentDate(startDateValue),
        employmentStatus:
          overrides.employmentStatus ??
          (employee
            ? employee.employmentStatus.replaceAll('_', ' ')
            : 'PROSPECTIVE'),
        basicSalary: salaryValue
          ? formatZar(Number(salaryValue))
          : formatZar(employee?.compensationProfile?.basicSalary),
        address:
          overrides.address ??
          employee?.residentialAddress ??
          dto.recipient?.address ??
          '',
        idNumber:
          overrides.idNumber ??
          employee?.idNumber ??
          dto.recipient?.idNumber ??
          '',
      },
      organisation: {
        name:
          overrides.organisationName ??
          branding?.legalName ??
          branding?.tradingName ??
          organisation.name,
        address: overrides.organisationAddress ?? address,
        email:
          overrides.organisationEmail ??
          branding?.email ??
          organisation.email ??
          '',
        phone:
          overrides.organisationPhone ??
          branding?.phone ??
          organisation.phone ??
          '',
        registrationNumber:
          overrides.organisationRegistrationNumber ??
          branding?.registrationNumber ??
          '',
        logo: '',
      },
      document: {
        title: dto.title?.trim() || template.name,
        referenceNumber: 'Assigned on generation',
        generatedDate: formatDocumentDate(new Date()),
        effectiveDate: dto.effectiveDate
          ? formatDocumentDate(new Date(dto.effectiveDate))
          : '',
        positionTitle:
          overrides.positionTitle ??
          overrides.jobTitle ??
          employee?.jobTitle ??
          dto.recipient?.jobTitle ??
          '',
        commencementDate:
          overrides.commencementDate ?? formatDocumentDate(startDateValue),
        reportingLine: overrides.reportingLine ?? '',
        natureOfEmployment:
          overrides.natureOfEmployment ??
          (employee?.employmentType
            ? employee.employmentType.replaceAll('_', ' ')
            : 'Full-time permanent employment'),
        hoursOfWork:
          overrides.hoursOfWork ??
          '40 hours per week, scheduled according to operational requirements.',
        remunerationPackage:
          overrides.remunerationPackage ??
          (salaryValue
            ? `${formatZar(Number(salaryValue))} gross per month`
            : employee?.compensationProfile?.basicSalary
              ? `${formatZar(employee.compensationProfile.basicSalary)} gross per month`
              : ''),
        regulatoryCompliance:
          overrides.regulatoryCompliance ??
          'Compliance with applicable legislation, ethical rules, POPIA and company policies.',
        expiryDate: overrides.expiryDate ?? '',
        addresseeName: overrides.addresseeName ?? '',
        addresseeAddress: overrides.addresseeAddress ?? '',
        professionalRegistrationNumber:
          overrides.professionalRegistrationNumber ?? '',
        remunerationInWords: overrides.remunerationInWords ?? '',
        payeReferenceNumber: overrides.payeReferenceNumber ?? '',
        payPeriod: overrides.payPeriod ?? '',
        bankAccountMasked:
          overrides.bankAccountMasked ??
          (employee?.compensationProfile?.bankAccountNumber
            ? `•••• ${employee.compensationProfile.bankAccountNumber.slice(-4)}`
            : ''),
        bankName:
          overrides.bankName ?? employee?.compensationProfile?.bankName ?? '',
        allowancesDetails:
          overrides.allowancesDetails ??
          (employee?.compensationProfile?.defaultAllowances
            ? formatZar(employee.compensationProfile.defaultAllowances)
            : ''),
        contractType: overrides.contractType ?? 'Permanent employment',
        employmentSchedule:
          overrides.employmentSchedule ??
          (employee?.employmentType === 'PART_TIME'
            ? 'Part-time'
            : 'Full-time'),
        endDate: overrides.endDate ?? 'Not applicable',
        probationPeriod: overrides.probationPeriod ?? '3 months',
        workLocation: overrides.workLocation ?? address,
        noticePeriod: overrides.noticePeriod ?? 'As prescribed by the BCEA',
        professionalCouncil: overrides.professionalCouncil ?? 'Not applicable',
        specialConditions: overrides.specialConditions ?? 'None',
        confirmationPurpose: overrides.confirmationPurpose ?? '',
        leaveType: overrides.leaveType ?? '',
        leaveStartDate: overrides.leaveStartDate
          ? formatDocumentDate(new Date(overrides.leaveStartDate))
          : '',
        leaveEndDate: overrides.leaveEndDate
          ? formatDocumentDate(new Date(overrides.leaveEndDate))
          : '',
        leaveDays: overrides.leaveDays ?? '',
        incidentDate: overrides.incidentDate
          ? formatDocumentDate(new Date(overrides.incidentDate))
          : '',
        incidentDescription: overrides.incidentDescription ?? '',
        hearingDate: overrides.hearingDate
          ? formatDocumentDate(new Date(overrides.hearingDate))
          : '',
        hearingLocation: overrides.hearingLocation ?? '',
        chairperson: overrides.chairperson ?? '',
        warningLevel: overrides.warningLevel ?? '',
        warningExpiryDate: overrides.warningExpiryDate
          ? formatDocumentDate(new Date(overrides.warningExpiryDate))
          : '',
        requiredImprovement: overrides.requiredImprovement ?? '',
        disciplinaryOutcome: overrides.disciplinaryOutcome ?? '',
        terminationDate: overrides.terminationDate
          ? formatDocumentDate(new Date(overrides.terminationDate))
          : '',
      },
      ceo: {
        fullName: signature?.ceoFullName || '',
        jobTitle: signature?.ceoJobTitle || '',
        signature: '',
      },
    };
    const assetMissing: string[] = [];
    if (
      template.currentVersion.detectedPlaceholders.includes(
        'organisation.logo',
      ) &&
      !branding?.logoStorageKey
    )
      assetMissing.push('organisation.logo');
    if (
      ['AUTOMATIC', 'CEO_APPROVAL'].includes(template.signatureMode) &&
      (!signature?.storageKey || signature.status !== 'ACTIVE')
    )
      assetMissing.push('ceo.signature');
    const missingFields = getMissingFields(
      template.currentVersion.detectedPlaceholders,
      data,
      assetMissing,
    );
    return {
      template,
      employee,
      isExternal: !employee,
      subject: {
        type: employee ? 'EMPLOYEE' : 'EXTERNAL',
        id: employee?.id ?? null,
        employeeNumber: employee?.employeeNumber ?? null,
        fullName: `${firstName} ${lastName}`.trim(),
        department: data.employee.department,
        email: data.employee.email,
      },
      organisation,
      branding,
      signature,
      data,
      missingFields: [...new Set(missingFields)],
    };
  }
  private async signature(organisationId: string) {
    const sig = await this.prisma.organisationSignature.findUnique({
      where: { organisationId },
    });
    if (!sig?.storageKey || sig.status !== 'ACTIVE')
      throw new BadRequestException(
        'An active private CEO signature is required.',
      );
    return { bytes: await this.storage.get(sig.storageKey), record: sig };
  }
  private brandingSnapshot(ctx: Context) {
    return {
      legalName: ctx.branding?.legalName,
      tradingName: ctx.branding?.tradingName,
      address: ctx.branding?.address,
      email: ctx.branding?.email,
      phone: ctx.branding?.phone,
      logoStorageKey: ctx.branding?.logoStorageKey,
      logoUpdatedAt: ctx.branding?.logoUpdatedAt,
      ceoFullName: ctx.signature?.ceoFullName,
      ceoJobTitle: ctx.signature?.ceoJobTitle,
      signatureUpdatedAt: ctx.signature?.updatedAt,
    };
  }
  private hash(bytes: Buffer) {
    return createHash('sha256').update(bytes).digest('hex');
  }
  private async updateEmployeeFromOverrides(
    tx: Prisma.TransactionClient,
    organisationId: string,
    employeeId: string,
    overrides: DocumentMappingOverridesDto,
  ) {
    await tx.employee.updateMany({
      where: { id: employeeId, organisationId },
      data: {
        firstName: overrides.firstName,
        lastName: overrides.lastName,
        email: overrides.email,
        jobTitle: overrides.jobTitle,
        residentialAddress: overrides.address,
        idNumber: overrides.idNumber,
        startDate: overrides.startDate
          ? new Date(overrides.startDate)
          : undefined,
      },
    });
    if (overrides.basicSalary) {
      await tx.employeeCompensationProfile.upsert({
        where: { employeeId },
        create: {
          organisationId,
          employeeId,
          basicSalary: overrides.basicSalary,
        },
        update: { basicSalary: overrides.basicSalary },
      });
    }
  }
  private audit(
    user: CurrentUser,
    action: AuditAction,
    id: string,
    employeeId: string | null | undefined,
    message: string,
    metadata?: Record<string, unknown>,
  ) {
    return this.prisma.auditLog.create({
      data: {
        organisationId: user.organisationId,
        actorUserId: user.id,
        employeeId,
        action,
        entity: 'GeneratedDocument',
        entityId: id,
        message,
        metadata: metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }
  private notifyUser(
    tx: Prisma.TransactionClient | PrismaService,
    organisationId: string,
    userId: string,
    category: 'DOCUMENT' | 'ACTION_REQUIRED',
    title: string,
    message: string,
    href: string,
  ) {
    return tx.employeeNotification.create({
      data: { organisationId, userId, category, title, message, href },
    });
  }
}
