import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import {
  PayrollApprovalStatus,
  PayrollApprovalType,
  PayrollOtpPurpose,
  PayrollOtpStatus,
  PayrollRunStatus,
  Prisma,
} from '@prisma/client';

import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'crypto';

import { PrismaService } from '../../database/prisma.service';

interface RequestOtpContext {
  ipAddress?: string;
  userAgent?: string;
}

interface VerifyOtpContext {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class PayrollApprovalOtpService {
  private readonly otpExpiryMinutes: number;
  private readonly resendCooldownSeconds: number;
  private readonly maximumAttempts = 5;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.otpExpiryMinutes = Number(
      this.configService.get<string>('PAYROLL_OTP_EXPIRY_MINUTES') ?? 10,
    );
    this.resendCooldownSeconds = Number(
      this.configService.get<string>('PAYROLL_OTP_RESEND_SECONDS') ?? 60,
    );
  }

  async requestCeoApprovalOtp(
    organisationId: string,
    payrollRunId: string,
    userId: string,
    context: RequestOtpContext,
    note?: string,
  ) {
    const approval = await this.prisma.payrollApproval.findFirst({
      where: {
        organisationId,
        payrollRunId,
        approvalType: PayrollApprovalType.CEO_APPROVAL,
        status: PayrollApprovalStatus.PENDING,
      },

      include: {
        payrollRun: {
          select: {
            id: true,
            title: true,
            status: true,
            totalNetPay: true,
            employeeCount: true,
          },
        },

        approver: {
          select: {
            id: true,
            email: true,
          },
        },
      },

      orderBy: {
        requestedAt: 'desc',
      },
    });

    if (!approval) {
      throw new NotFoundException(
        'A pending CEO payroll approval request was not found.',
      );
    }

    if (approval.payrollRun.status !== PayrollRunStatus.PENDING_CEO_APPROVAL) {
      throw new BadRequestException('Payroll is not awaiting CEO approval.');
    }

    if (!approval.approverUserId) {
      throw new BadRequestException(
        'A CEO approver must be assigned before an OTP can be requested.',
      );
    }

    if (approval.approverUserId !== userId) {
      throw new ForbiddenException(
        'Only the assigned CEO approver may request this OTP.',
      );
    }

    if (!approval.approver?.email) {
      throw new BadRequestException(
        'The assigned CEO approver does not have an email address.',
      );
    }

    const approverEmail = approval.approver.email;

    const latestChallenge = await this.prisma.payrollOtpChallenge.findFirst({
      where: {
        organisationId,
        payrollApprovalId: approval.id,
        userId,
        purpose: PayrollOtpPurpose.CEO_PAYROLL_APPROVAL,
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    if (latestChallenge) {
      const secondsSinceLastRequest = Math.floor(
        (Date.now() - latestChallenge.createdAt.getTime()) / 1000,
      );
      const secondsRemaining =
        this.resendCooldownSeconds - secondsSinceLastRequest;

      if (secondsRemaining > 0) {
        throw new BadRequestException(
          `Please wait ${secondsRemaining} second${
            secondsRemaining === 1 ? '' : 's'
          } before requesting another OTP.`,
        );
      }
    }

    const challengeId = randomUUID();
    const otpCode = this.generateOtp();

    const codeHash = this.hashOtp(challengeId, otpCode);

    const expiresAt = new Date(Date.now() + this.otpExpiryMinutes * 60 * 1000);

    const challenge = await this.prisma.$transaction(async (transaction) => {
      await transaction.payrollOtpChallenge.updateMany({
        where: {
          organisationId,
          payrollApprovalId: approval.id,
          userId,

          purpose: PayrollOtpPurpose.CEO_PAYROLL_APPROVAL,

          status: PayrollOtpStatus.PENDING,
        },

        data: {
          status: PayrollOtpStatus.CANCELLED,

          cancelledAt: new Date(),
        },
      });

      const createdChallenge = await transaction.payrollOtpChallenge.create({
        data: {
          id: challengeId,

          organisationId,

          payrollApprovalId: approval.id,

          userId,

          purpose: PayrollOtpPurpose.CEO_PAYROLL_APPROVAL,

          status: PayrollOtpStatus.PENDING,

          codeHash,

          attempts: 0,

          maxAttempts: this.maximumAttempts,

          expiresAt,

          requestedIpAddress: context.ipAddress,

          userAgent: context.userAgent,

          metadata: {
            payrollRunId,
            approvalId: approval.id,
            deliveryChannel: 'EMAIL',
            requestedNote: note ?? null,
          },
        },
      });

      await transaction.payrollTimelineEvent.create({
        data: {
          organisationId,
          payrollRunId,

          actorUserId: userId,

          eventType: 'PAYROLL_CEO_OTP_REQUESTED',

          title: 'CEO approval OTP requested',

          message:
            note ?? 'A secure OTP was requested for CEO payroll approval.',

          metadata: {
            challengeId: createdChallenge.id,

            approvalId: approval.id,

            expiresAt: expiresAt.toISOString(),

            deliveryChannel: 'EMAIL',

            recipient: this.maskEmail(approverEmail),
          },
        },
      });

      return createdChallenge;
    });

    const response: {
      challengeId: string;
      expiresAt: Date;
      expiresInSeconds: number;
      maximumAttempts: number;
      deliveryChannel: string;
      recipient: string;
      developmentOtp?: string;
    } = {
      challengeId: challenge.id,

      expiresAt: challenge.expiresAt,

      expiresInSeconds: this.otpExpiryMinutes * 60,

      maximumAttempts: challenge.maxAttempts,

      deliveryChannel: 'EMAIL',

      recipient: this.maskEmail(approverEmail),
    };

    if (this.configService.get<string>('NODE_ENV') !== 'production') {
      response.developmentOtp = otpCode;
    }

    return response;
  }

  async verifyCeoApprovalOtp(
    organisationId: string,
    payrollRunId: string,
    userId: string,
    challengeId: string,
    code: string,
    context: VerifyOtpContext,
    decisionNote?: string,
  ) {
    const challenge = await this.prisma.payrollOtpChallenge.findFirst({
      where: {
        id: challengeId,

        organisationId,
        userId,

        purpose: PayrollOtpPurpose.CEO_PAYROLL_APPROVAL,

        payrollApproval: {
          payrollRunId,

          approvalType: PayrollApprovalType.CEO_APPROVAL,
        },
      },

      include: {
        payrollApproval: {
          include: {
            payrollRun: {
              select: {
                id: true,
                title: true,
                status: true,
                totalGrossPay: true,
                totalDeductions: true,
                totalNetPay: true,
                employeeCount: true,
              },
            },
          },
        },
      },
    });

    if (!challenge) {
      throw new NotFoundException('The OTP challenge was not found.');
    }

    const approval = challenge.payrollApproval;

    if (approval.status !== PayrollApprovalStatus.PENDING) {
      throw new BadRequestException(
        'This CEO approval request is no longer pending.',
      );
    }

    if (approval.approverUserId !== userId) {
      throw new ForbiddenException(
        'Only the assigned CEO approver may verify this OTP.',
      );
    }

    if (approval.payrollRun.status !== PayrollRunStatus.PENDING_CEO_APPROVAL) {
      throw new BadRequestException(
        'Payroll is no longer awaiting CEO approval.',
      );
    }

    if (challenge.status === PayrollOtpStatus.VERIFIED) {
      throw new BadRequestException('This OTP has already been verified.');
    }

    if (challenge.status === PayrollOtpStatus.LOCKED) {
      throw new UnauthorizedException(
        'This OTP challenge is locked because the maximum number of attempts was reached.',
      );
    }

    if (
      challenge.status === PayrollOtpStatus.CANCELLED ||
      challenge.status === PayrollOtpStatus.EXPIRED
    ) {
      throw new BadRequestException('This OTP challenge is no longer valid.');
    }

    if (challenge.expiresAt.getTime() < Date.now()) {
      await this.prisma.payrollOtpChallenge.update({
        where: {
          id: challenge.id,
        },

        data: {
          status: PayrollOtpStatus.EXPIRED,
        },
      });

      await this.prisma.payrollTimelineEvent.create({
        data: {
          organisationId,
          payrollRunId,

          actorUserId: userId,

          eventType: 'PAYROLL_CEO_OTP_EXPIRED',

          title: 'CEO approval OTP expired',

          message: 'The CEO approval OTP expired before verification.',

          metadata: {
            challengeId: challenge.id,

            approvalId: approval.id,
          },
        },
      });

      throw new BadRequestException('The OTP has expired. Request a new OTP.');
    }

    const suppliedCodeHash = this.hashOtp(challenge.id, code);

    const codeIsValid = this.secureCompare(
      challenge.codeHash,
      suppliedCodeHash,
    );

    if (!codeIsValid) {
      const nextAttemptCount = challenge.attempts + 1;

      const shouldLock = nextAttemptCount >= challenge.maxAttempts;

      await this.prisma.$transaction(async (transaction) => {
        await transaction.payrollOtpChallenge.update({
          where: {
            id: challenge.id,
          },

          data: {
            attempts: nextAttemptCount,

            status: shouldLock
              ? PayrollOtpStatus.LOCKED
              : PayrollOtpStatus.PENDING,
          },
        });

        await transaction.payrollTimelineEvent.create({
          data: {
            organisationId,
            payrollRunId,

            actorUserId: userId,

            eventType: shouldLock
              ? 'PAYROLL_CEO_OTP_LOCKED'
              : 'PAYROLL_CEO_OTP_FAILED',

            title: shouldLock
              ? 'CEO approval OTP locked'
              : 'CEO approval OTP verification failed',

            message: shouldLock
              ? 'The OTP challenge was locked after too many failed attempts.'
              : 'An incorrect OTP was entered for CEO payroll approval.',

            metadata: {
              challengeId: challenge.id,

              approvalId: approval.id,

              attempts: nextAttemptCount,

              maxAttempts: challenge.maxAttempts,

              locked: shouldLock,
            },
          },
        });
      });

      const attemptsRemaining = Math.max(
        0,
        challenge.maxAttempts - nextAttemptCount,
      );

      if (shouldLock) {
        throw new UnauthorizedException(
          'The OTP challenge has been locked. Request a new OTP.',
        );
      }

      throw new UnauthorizedException(
        `Invalid OTP. ${attemptsRemaining} attempt${
          attemptsRemaining === 1 ? '' : 's'
        } remaining.`,
      );
    }

    return this.prisma.$transaction(async (transaction) => {
      const verifiedAt = new Date();

      await transaction.payrollOtpChallenge.update({
        where: {
          id: challenge.id,
        },

        data: {
          status: PayrollOtpStatus.VERIFIED,

          verifiedAt,

          verifiedIpAddress: context.ipAddress,

          userAgent: context.userAgent ?? challenge.userAgent,
        },
      });

      const updatedApproval = await transaction.payrollApproval.update({
        where: {
          id: approval.id,
        },

        data: {
          status: PayrollApprovalStatus.APPROVED,

          approverUserId: userId,

          reviewedAt: verifiedAt,

          approvedAt: verifiedAt,

          decisionNote:
            decisionNote ?? 'CEO approval confirmed using secure OTP.',

          metadata: this.mergeMetadata(approval.metadata, {
            otpChallengeId: challenge.id,

            otpVerifiedAt: verifiedAt.toISOString(),

            otpVerified: true,

            verifiedIpAddress: context.ipAddress ?? null,
          }),
        },
      });

      const updatedPayrollRun = await transaction.payrollRun.update({
        where: {
          id: payrollRunId,
        },

        data: {
          status: PayrollRunStatus.CEO_APPROVED,
        },
      });

      await transaction.payrollTimelineEvent.create({
        data: {
          organisationId,
          payrollRunId,

          actorUserId: userId,

          eventType: 'PAYROLL_CEO_OTP_VERIFIED',

          title: 'CEO approval OTP verified',

          message: 'The CEO identity was confirmed using a secure OTP.',

          metadata: {
            challengeId: challenge.id,

            approvalId: approval.id,

            verifiedAt: verifiedAt.toISOString(),
          },
        },
      });

      await transaction.payrollTimelineEvent.create({
        data: {
          organisationId,
          payrollRunId,

          actorUserId: userId,

          eventType: 'PAYROLL_CEO_APPROVED',

          title: 'Payroll approved by CEO',

          message:
            decisionNote ??
            'Payroll was approved by the CEO after secure OTP confirmation.',

          metadata: {
            approvalId: approval.id,

            challengeId: challenge.id,

            totalGrossPay: approval.payrollRun.totalGrossPay.toFixed(2),

            totalDeductions: approval.payrollRun.totalDeductions.toFixed(2),

            totalNetPay: approval.payrollRun.totalNetPay.toFixed(2),

            employeeCount: approval.payrollRun.employeeCount,

            approvedAt: verifiedAt.toISOString(),
          },
        },
      });

      return {
        approval: updatedApproval,

        payrollRun: updatedPayrollRun,

        otpVerified: true,

        verifiedAt,
      };
    });
  }

  private generateOtp(): string {
    return randomInt(100000, 1000000).toString();
  }

  private hashOtp(challengeId: string, code: string): string {
    const secret = this.configService.get<string>('PAYROLL_OTP_SECRET');

    if (!secret) {
      throw new Error('PAYROLL_OTP_SECRET is not configured.');
    }

    return createHmac('sha256', secret)
      .update(`${challengeId}:${code}`)
      .digest('hex');
  }

  private secureCompare(storedHash: string, suppliedHash: string): boolean {
    const storedBuffer = Buffer.from(storedHash, 'hex');

    const suppliedBuffer = Buffer.from(suppliedHash, 'hex');

    if (storedBuffer.length !== suppliedBuffer.length) {
      return false;
    }

    return timingSafeEqual(storedBuffer, suppliedBuffer);
  }

  private maskEmail(email: string): string {
    const [localPart, domain] = email.split('@');

    if (!localPart || !domain) {
      return '***';
    }

    const visibleCharacters = localPart.slice(0, 2);

    return (
      visibleCharacters +
      '*'.repeat(Math.max(3, localPart.length - 2)) +
      `@${domain}`
    );
  }

  private mergeMetadata(
    currentMetadata: Prisma.JsonValue | null,

    additionalMetadata: Record<string, Prisma.JsonValue>,
  ): Prisma.InputJsonObject {
    const existingMetadata =
      currentMetadata &&
      typeof currentMetadata === 'object' &&
      !Array.isArray(currentMetadata)
        ? (currentMetadata as Prisma.JsonObject)
        : {};

    return {
      ...existingMetadata,
      ...additionalMetadata,
    };
  }
}
