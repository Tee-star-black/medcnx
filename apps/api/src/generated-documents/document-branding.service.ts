import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { createHash } from 'crypto';
import type { CurrentUser } from '../auth/types/current-user.type';
import { PrismaService } from '../database/prisma.service';
import { DocumentStorageService } from './storage/document-storage.service';

type BrandingInput = {
  legalName?: string;
  tradingName?: string;
  registrationNumber?: string;
  address?: string;
  email?: string;
  phone?: string;
  defaultDocumentFooter?: string;
};
type SignatureInput = {
  ceoUserId?: string;
  ceoFullName?: string;
  ceoJobTitle?: string;
  status?: 'NOT_CONFIGURED' | 'ACTIVE' | 'DISABLED';
};

@Injectable()
export class DocumentBrandingService {
  constructor(
    private prisma: PrismaService,
    private storage: DocumentStorageService,
  ) {}
  async get(user: CurrentUser) {
    const organisation = await this.prisma.organisation.findUniqueOrThrow({
      where: { id: user.organisationId },
    });
    const [branding, signature] = await Promise.all([
      this.prisma.organisationBranding.findUnique({
        where: { organisationId: user.organisationId },
      }),
      this.prisma.organisationSignature.findUnique({
        where: { organisationId: user.organisationId },
        select: {
          id: true,
          organisationId: true,
          ceoUserId: true,
          ceoFullName: true,
          ceoJobTitle: true,
          status: true,
          updatedAt: true,
          storageKey: true,
        },
      }),
    ]);
    return {
      organisation,
      branding,
      signature: signature
        ? {
            ...signature,
            signatureConfigured: Boolean(signature.storageKey),
            storageKey: undefined,
          }
        : null,
    };
  }
  async updateBranding(
    user: CurrentUser,
    input: BrandingInput,
    file?: Express.Multer.File,
  ) {
    let logo: Record<string, unknown> = {};
    if (file) {
      this.assertImage(file, 'logo');
      const key = `organisations/${user.organisationId}/branding/logo/${Date.now()}-${this.safeName(file.originalname)}`;
      await this.storage.put(key, file.buffer, file.mimetype);
      logo = {
        logoStorageKey: key,
        logoMimeType: file.mimetype,
        logoUpdatedAt: new Date(),
      };
    }
    const branding = await this.prisma.organisationBranding.upsert({
      where: { organisationId: user.organisationId },
      create: {
        organisationId: user.organisationId,
        ...input,
        ...logo,
        updatedByUserId: user.id,
      },
      update: { ...input, ...logo, updatedByUserId: user.id },
    });
    await this.audit(user, 'Organisation branding updated.');
    return branding;
  }
  async updateSignature(
    user: CurrentUser,
    input: SignatureInput,
    file?: Express.Multer.File,
  ) {
    if (input.ceoUserId) {
      const ceo = await this.prisma.user.findFirst({
        where: { id: input.ceoUserId, organisationId: user.organisationId },
      });
      if (!ceo)
        throw new BadRequestException(
          'The selected CEO user does not belong to this organisation.',
        );
    }
    let asset: Record<string, unknown> = {};
    if (file) {
      this.assertImage(file, 'signature');
      const key = `organisations/${user.organisationId}/signatures/${Date.now()}-${this.safeName(file.originalname)}`;
      await this.storage.put(key, file.buffer, file.mimetype);
      asset = {
        storageKey: key,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        checksumSha256: createHash('sha256').update(file.buffer).digest('hex'),
        status: 'ACTIVE',
      };
    }
    const signature = await this.prisma.organisationSignature.upsert({
      where: { organisationId: user.organisationId },
      create: {
        organisationId: user.organisationId,
        ...input,
        ...asset,
        updatedByUserId: user.id,
      },
      update: { ...input, ...asset, updatedByUserId: user.id },
      select: {
        id: true,
        organisationId: true,
        ceoUserId: true,
        ceoFullName: true,
        ceoJobTitle: true,
        status: true,
        updatedAt: true,
        storageKey: true,
      },
    });
    await this.audit(user, 'CEO signature configuration updated.');
    return {
      ...signature,
      signatureConfigured: Boolean(signature.storageKey),
      storageKey: undefined,
    };
  }
  private assertImage(file: Express.Multer.File, label: string) {
    if (file.size > 5 * 1024 * 1024)
      throw new BadRequestException(`${label} image exceeds the 5 MB limit.`);
    if (!['image/png', 'image/jpeg'].includes(file.mimetype))
      throw new BadRequestException(`${label} must be a PNG or JPEG image.`);
    const png = file.buffer
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const jpg = file.buffer[0] === 0xff && file.buffer[1] === 0xd8;
    if (!png && !jpg) throw new BadRequestException(`Invalid ${label} image.`);
  }
  private safeName(value: string) {
    return value.replace(/[^a-zA-Z0-9._-]+/g, '-').toLowerCase();
  }
  private audit(user: CurrentUser, message: string) {
    return this.prisma.auditLog.create({
      data: {
        organisationId: user.organisationId,
        actorUserId: user.id,
        action: AuditAction.UPDATE,
        entity: 'OrganisationDocumentSettings',
        entityId: user.organisationId,
        message,
      },
    });
  }
}
