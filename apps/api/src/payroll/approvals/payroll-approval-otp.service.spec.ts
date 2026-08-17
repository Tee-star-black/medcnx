import { BadRequestException } from '@nestjs/common';
import {
  PayrollApprovalStatus,
  PayrollOtpPurpose,
  PayrollOtpStatus,
  PayrollRunStatus,
} from '@prisma/client';

import { PayrollApprovalOtpService } from './payroll-approval-otp.service';

describe('PayrollApprovalOtpService hardening', () => {
  const prisma = {
    payrollOtpChallenge: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    payrollTimelineEvent: { create: jest.fn() },
  };
  const config = { get: jest.fn().mockReturnValue(undefined) };
  const service = new PayrollApprovalOtpService(
    prisma as never,
    config as never,
  );

  const challenge = (overrides: Record<string, unknown> = {}) => ({
    id: 'challenge-1',
    organisationId: 'organisation-1',
    userId: 'approver-1',
    purpose: PayrollOtpPurpose.CEO_PAYROLL_APPROVAL,
    status: PayrollOtpStatus.PENDING,
    codeHash: 'unused-in-these-tests',
    attempts: 0,
    maxAttempts: 5,
    expiresAt: new Date(Date.now() + 60_000),
    userAgent: null,
    payrollApproval: {
      id: 'approval-1',
      status: PayrollApprovalStatus.PENDING,
      approverUserId: 'approver-1',
      metadata: null,
      payrollRun: {
        id: 'run-1',
        status: PayrollRunStatus.PENDING_CEO_APPROVAL,
      },
    },
    ...overrides,
  });

  beforeEach(() => jest.clearAllMocks());

  it('prevents an OTP challenge from being reused', async () => {
    prisma.payrollOtpChallenge.findFirst.mockResolvedValue(
      challenge({ status: PayrollOtpStatus.VERIFIED }),
    );

    await expect(
      service.verifyCeoApprovalOtp(
        'organisation-1',
        'run-1',
        'approver-1',
        'challenge-1',
        '123456',
        {},
      ),
    ).rejects.toThrow('already been verified');
  });

  it('marks an expired OTP challenge and rejects verification', async () => {
    prisma.payrollOtpChallenge.findFirst.mockResolvedValue(
      challenge({ expiresAt: new Date(Date.now() - 60_000) }),
    );
    prisma.payrollOtpChallenge.update.mockResolvedValue({});
    prisma.payrollTimelineEvent.create.mockResolvedValue({});

    await expect(
      service.verifyCeoApprovalOtp(
        'organisation-1',
        'run-1',
        'approver-1',
        'challenge-1',
        '123456',
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.payrollOtpChallenge.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: PayrollOtpStatus.EXPIRED },
      }),
    );
  });
});
