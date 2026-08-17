import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  DocumentSignatureMode,
  DocumentTemplateCategory,
  DocumentTemplateStatus,
} from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { readFile } from 'fs/promises';
import { join } from 'path';
import type { CurrentUser } from '../auth/types/current-user.type';
import { PrismaService } from '../database/prisma.service';
import { DocumentTemplateEngineService } from './document-template-engine.service';
import {
  UploadDocumentTemplateDto,
  UpdateDocumentTemplateDto,
} from './dto/document-template.dto';
import { DocumentStorageService } from './storage/document-storage.service';

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MAX_TEMPLATE_BYTES = 15 * 1024 * 1024;

type PresetDefinition = {
  key: string;
  filename: string;
  name: string;
  description: string;
  category: string;
  signatureMode: DocumentSignatureMode;
  defaultEmployeeVisibility: boolean;
};

const PRESETS: readonly PresetDefinition[] = [
  {
    key: 'employment-contract-master',
    filename: 'MedCNX_Employment_Contract_Master.docx',
    name: 'Employment Contract',
    description:
      'Master employment agreement with editable role, commencement, reporting, hours, remuneration and compliance terms.',
    category: 'EMPLOYMENT_CONTRACT',
    signatureMode: DocumentSignatureMode.CEO_APPROVAL,
    defaultEmployeeVisibility: true,
  },
  {
    key: 'employment-offer-letter',
    filename: 'MedCNX_Employment_Offer_Letter.docx',
    name: 'Employment Offer Letter',
    description: 'Professional offer letter for a prospective employee.',
    category: 'OFFER_LETTER',
    signatureMode: DocumentSignatureMode.CEO_APPROVAL,
    defaultEmployeeVisibility: true,
  },
  {
    key: 'confirmation-of-employment',
    filename: 'MedCNX_Confirmation_of_Employment.docx',
    name: 'Confirmation of Employment',
    description: 'Formal confirmation of an employee’s current employment.',
    category: 'CONFIRMATION_OF_EMPLOYMENT',
    signatureMode: DocumentSignatureMode.AUTOMATIC,
    defaultEmployeeVisibility: true,
  },
  {
    key: 'salary-confirmation',
    filename: 'MedCNX_Salary_Confirmation.docx',
    name: 'Salary Confirmation',
    description: 'Formal confirmation of position and remuneration.',
    category: 'SALARY_CONFIRMATION',
    signatureMode: DocumentSignatureMode.CEO_APPROVAL,
    defaultEmployeeVisibility: true,
  },
  {
    key: 'leave-confirmation',
    filename: 'MedCNX_Leave_Confirmation.docx',
    name: 'Leave Confirmation',
    description: 'Written confirmation of approved employee leave.',
    category: 'LEAVE_CONFIRMATION',
    signatureMode: DocumentSignatureMode.AUTOMATIC,
    defaultEmployeeVisibility: true,
  },
  {
    key: 'policy-acknowledgement',
    filename: 'MedCNX_Policy_Acknowledgement.docx',
    name: 'Policy Acknowledgement',
    description: 'Employee acknowledgement and acceptance of company policy.',
    category: 'POLICY_ACKNOWLEDGEMENT',
    signatureMode: DocumentSignatureMode.AUTOMATIC,
    defaultEmployeeVisibility: true,
  },
  {
    key: 'disciplinary-hearing-notice',
    filename: 'MedCNX_Notice_to_Attend_Disciplinary_Hearing.docx',
    name: 'Notice to Attend Disciplinary Hearing',
    description: 'Notice containing hearing details and alleged misconduct.',
    category: 'DISCIPLINARY_NOTICE',
    signatureMode: DocumentSignatureMode.CEO_APPROVAL,
    defaultEmployeeVisibility: true,
  },
  {
    key: 'written-warning',
    filename: 'MedCNX_Written_Warning.docx',
    name: 'Written Warning',
    description: 'Formal written warning with offence and validity details.',
    category: 'WARNING_LETTER',
    signatureMode: DocumentSignatureMode.CEO_APPROVAL,
    defaultEmployeeVisibility: true,
  },
  {
    key: 'disciplinary-outcome',
    filename: 'MedCNX_Disciplinary_Outcome.docx',
    name: 'Disciplinary Outcome',
    description: 'Formal record of a disciplinary hearing outcome.',
    category: 'DISCIPLINARY_OUTCOME',
    signatureMode: DocumentSignatureMode.CEO_APPROVAL,
    defaultEmployeeVisibility: true,
  },
  {
    key: 'certificate-of-service',
    filename: 'MedCNX_Certificate_of_Service.docx',
    name: 'Certificate of Service',
    description: 'Certificate recording an employee’s completed service.',
    category: 'SERVICE_CERTIFICATE',
    signatureMode: DocumentSignatureMode.CEO_APPROVAL,
    defaultEmployeeVisibility: true,
  },
  {
    key: 'resignation-acknowledgement',
    filename: 'MedCNX_Resignation_Acknowledgement.docx',
    name: 'Resignation Acknowledgement',
    description: 'Formal acknowledgement of an employee resignation.',
    category: 'RESIGNATION_ACKNOWLEDGEMENT',
    signatureMode: DocumentSignatureMode.CEO_APPROVAL,
    defaultEmployeeVisibility: true,
  },
] as const;

@Injectable()
export class DocumentTemplatesService {
  constructor(
    private prisma: PrismaService,
    private storage: DocumentStorageService,
    private engine: DocumentTemplateEngineService,
  ) {}

  list(user: CurrentUser, search?: string, category?: string, status?: string) {
    return this.prisma.documentTemplate.findMany({
      where: {
        organisationId: user.organisationId,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(category ? { category: category as never } : {}),
        ...(status ? { status: status as never } : {}),
      },
      include: {
        currentVersion: true,
        _count: { select: { versions: true, documents: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async listPresets(user: CurrentUser) {
    const existing = await this.prisma.documentTemplate.findMany({
      where: {
        organisationId: user.organisationId,
        name: { in: PRESETS.map((preset) => preset.name) },
      },
      select: { id: true, name: true, status: true },
    });
    const byName = new Map(existing.map((item) => [item.name, item]));
    return PRESETS.map((preset) => ({
      ...preset,
      imported: byName.has(preset.name),
      templateId: byName.get(preset.name)?.id ?? null,
      templateStatus: byName.get(preset.name)?.status ?? null,
    }));
  }

  async previewPreset(_user: CurrentUser, key: string) {
    const preset = this.getPreset(key);
    return {
      bytes: await this.readPreset(preset),
      mime: DOCX_MIME,
      filename: preset.filename,
    };
  }

  async importPreset(user: CurrentUser, key: string) {
    const preset = this.getPreset(key);
    const existing = await this.prisma.documentTemplate.findFirst({
      where: { organisationId: user.organisationId, name: preset.name },
      include: { currentVersion: true },
    });
    if (existing) {
      return { imported: false, skipped: true, template: existing };
    }
    const bytes = await this.readPreset(preset);
    const template = await this.upload(
      user,
      {
        name: preset.name,
        description: preset.description,
        category: preset.category as DocumentTemplateCategory,
        signatureMode: preset.signatureMode,
        defaultEmployeeVisibility: preset.defaultEmployeeVisibility,
      },
      {
        fieldname: 'file',
        originalname: preset.filename,
        encoding: '7bit',
        mimetype: DOCX_MIME,
        size: bytes.length,
        destination: '',
        filename: preset.filename,
        path: '',
        buffer: bytes,
        stream: undefined as never,
      },
    );
    return { imported: true, skipped: false, template };
  }

  async bootstrapPresets(user: CurrentUser) {
    const imported: Array<{ key: string; templateId: string }> = [];
    const skipped: Array<{ key: string; templateId: string }> = [];
    const failed: Array<{ key: string; message: string }> = [];

    for (const preset of PRESETS) {
      try {
        const result = await this.importPreset(user, preset.key);
        const record = {
          key: preset.key,
          templateId: result.template.id,
        };
        if (result.imported) imported.push(record);
        else skipped.push(record);
      } catch (error) {
        failed.push({
          key: preset.key,
          message:
            error instanceof Error ? error.message : 'Preset import failed.',
        });
      }
    }

    return {
      total: PRESETS.length,
      imported,
      skipped,
      failed,
    };
  }

  async get(user: CurrentUser, id: string) {
    const item = await this.prisma.documentTemplate.findFirst({
      where: { id, organisationId: user.organisationId },
      include: {
        currentVersion: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
          select: {
            id: true,
            versionNumber: true,
            originalName: true,
            sizeBytes: true,
            detectedPlaceholders: true,
            unsupportedPlaceholders: true,
            isValid: true,
            validationErrors: true,
            createdAt: true,
            uploadedBy: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
    });
    if (!item) throw new NotFoundException('Document template was not found.');
    return item;
  }

  async upload(
    user: CurrentUser,
    dto: UploadDocumentTemplateDto,
    file?: Express.Multer.File,
  ) {
    this.assertDocx(file);
    const validation = this.engine.detect(file!.buffer);
    const id = randomUUID();
    const key = `organisations/${user.organisationId}/templates/${id}/v1/${this.safeName(file!.originalname)}`;
    await this.storage.put(key, file!.buffer, DOCX_MIME);
    try {
      const template = await this.prisma.$transaction(async (tx) => {
        const created = await tx.documentTemplate.create({
          data: {
            id,
            organisationId: user.organisationId,
            name: dto.name.trim(),
            description: dto.description?.trim(),
            category: dto.category,
            signatureMode: dto.signatureMode,
            defaultEmployeeVisibility: dto.defaultEmployeeVisibility ?? false,
            createdByUserId: user.id,
          },
        });
        const version = await tx.documentTemplateVersion.create({
          data: {
            organisationId: user.organisationId,
            templateId: id,
            versionNumber: 1,
            storageKey: key,
            originalName: file!.originalname,
            mimeType: DOCX_MIME,
            sizeBytes: file!.size,
            checksumSha256: this.hash(file!.buffer),
            detectedPlaceholders: validation.detectedPlaceholders,
            unsupportedPlaceholders: validation.unsupportedPlaceholders,
            isValid: validation.isValid,
            validationErrors: validation.validationErrors,
            uploadedByUserId: user.id,
          },
        });
        return tx.documentTemplate.update({
          where: { id },
          data: { currentVersionId: version.id },
          include: { currentVersion: true },
        });
      });
      await this.audit(
        user,
        AuditAction.UPLOAD,
        'DocumentTemplate',
        id,
        'Document template uploaded.',
        { version: 1, validation: validation.isValid },
      );
      return template;
    } catch (error) {
      await this.storage.delete(key);
      throw error;
    }
  }

  async replace(user: CurrentUser, id: string, file?: Express.Multer.File) {
    this.assertDocx(file);
    const template = await this.get(user, id);
    if (template.status === DocumentTemplateStatus.ARCHIVED)
      throw new BadRequestException(
        'Archived templates cannot receive replacement versions.',
      );
    const versionNumber =
      Math.max(...template.versions.map((v) => v.versionNumber), 0) + 1;
    const validation = this.engine.detect(file!.buffer);
    const key = `organisations/${user.organisationId}/templates/${id}/v${versionNumber}/${this.safeName(file!.originalname)}`;
    await this.storage.put(key, file!.buffer, DOCX_MIME);
    try {
      const version = await this.prisma.$transaction(async (tx) => {
        const v = await tx.documentTemplateVersion.create({
          data: {
            organisationId: user.organisationId,
            templateId: id,
            versionNumber,
            storageKey: key,
            originalName: file!.originalname,
            mimeType: DOCX_MIME,
            sizeBytes: file!.size,
            checksumSha256: this.hash(file!.buffer),
            detectedPlaceholders: validation.detectedPlaceholders,
            unsupportedPlaceholders: validation.unsupportedPlaceholders,
            isValid: validation.isValid,
            validationErrors: validation.validationErrors,
            uploadedByUserId: user.id,
          },
        });
        await tx.documentTemplate.update({
          where: { id },
          data: { currentVersionId: v.id, status: 'DRAFT' },
        });
        return v;
      });
      await this.audit(
        user,
        AuditAction.UPLOAD,
        'DocumentTemplate',
        id,
        'Document template version replaced.',
        { version: versionNumber, validation: validation.isValid },
      );
      return version;
    } catch (error) {
      await this.storage.delete(key);
      throw error;
    }
  }

  async update(user: CurrentUser, id: string, dto: UpdateDocumentTemplateDto) {
    await this.get(user, id);
    const item = await this.prisma.documentTemplate.update({
      where: { id },
      data: dto,
    });
    await this.audit(
      user,
      AuditAction.UPDATE,
      'DocumentTemplate',
      id,
      'Document template settings updated.',
    );
    return item;
  }
  async validate(user: CurrentUser, id: string) {
    const item = await this.get(user, id);
    const bytes = await this.storage.get(item.currentVersion!.storageKey);
    const validation = this.engine.detect(bytes);
    await this.prisma.documentTemplateVersion.update({
      where: { id: item.currentVersion!.id },
      data: { ...validation, validationErrors: validation.validationErrors },
    });
    await this.audit(
      user,
      AuditAction.VIEW,
      'DocumentTemplate',
      id,
      'Document template validated.',
      { valid: validation.isValid },
    );
    return validation;
  }
  async activate(user: CurrentUser, id: string) {
    const item = await this.get(user, id);
    if (!item.currentVersion?.isValid)
      throw new BadRequestException(
        'Validate and correct all template placeholders before activation.',
      );
    const updated = await this.prisma.documentTemplate.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });
    await this.audit(
      user,
      AuditAction.UPDATE,
      'DocumentTemplate',
      id,
      'Document template activated.',
    );
    return updated;
  }
  async archive(user: CurrentUser, id: string) {
    await this.get(user, id);
    const updated = await this.prisma.documentTemplate.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });
    await this.audit(
      user,
      AuditAction.UPDATE,
      'DocumentTemplate',
      id,
      'Document template archived.',
    );
    return updated;
  }

  private assertDocx(file?: Express.Multer.File) {
    if (!file)
      throw new BadRequestException('A DOCX template file is required.');
    if (file.size > MAX_TEMPLATE_BYTES)
      throw new BadRequestException('Template exceeds the 15 MB limit.');
    if (
      !file.originalname.toLowerCase().endsWith('.docx') ||
      file.buffer.subarray(0, 2).toString() !== 'PK'
    )
      throw new BadRequestException('Only valid DOCX files are accepted.');
  }
  private getPreset(key: string) {
    const preset = PRESETS.find((item) => item.key === key);
    if (!preset) throw new NotFoundException('Template preset was not found.');
    return preset;
  }
  private async readPreset(preset: PresetDefinition) {
    const candidates = [
      join(
        process.cwd(),
        'apps',
        'api',
        'resources',
        'document-templates',
        preset.filename,
      ),
      join(
        process.cwd(),
        'resources',
        'document-templates',
        preset.filename,
      ),
    ];
    for (const candidate of candidates) {
      try {
        return await readFile(candidate);
      } catch {
        // Try the next supported monorepo/runtime location.
      }
    }
    throw new NotFoundException(
      `Preset file "${preset.filename}" was not found in apps/api/resources/document-templates.`,
    );
  }
  private safeName(value: string) {
    return (
      value
        .normalize('NFKD')
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase() || 'template.docx'
    );
  }
  private hash(bytes: Buffer) {
    return createHash('sha256').update(bytes).digest('hex');
  }
  private audit(
    user: CurrentUser,
    action: AuditAction,
    entity: string,
    entityId: string,
    message: string,
    metadata?: Record<string, unknown>,
  ) {
    return this.prisma.auditLog.create({
      data: {
        organisationId: user.organisationId,
        actorUserId: user.id,
        action,
        entity,
        entityId,
        message,
        metadata: metadata as never,
      },
    });
  }
}
