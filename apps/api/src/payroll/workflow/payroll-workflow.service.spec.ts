import { NotFoundException } from '@nestjs/common';
import {
  PayrollAuditFindingStatus,
  PayrollAuditSeverity,
  PayrollRunStatus,
} from '@prisma/client';

import { PayrollWorkflowService } from './payroll-workflow.service';

describe('PayrollWorkflowService hardening', () => {
  const prisma = {
    payrollRun: { findFirst: jest.fn() },
    payrollRunItem: { count: jest.fn() },
  };
  const service = new PayrollWorkflowService(prisma as never);

  beforeEach(() => jest.clearAllMocks());

  it('uses organisation isolation when loading a payroll run', async () => {
    prisma.payrollRun.findFirst.mockResolvedValue(null);

    await expect(
      service.transitionStatus(
        'organisation-a',
        'run-from-another-organisation',
        PayrollRunStatus.CALCULATED,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.payrollRun.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'run-from-another-organisation',
          organisationId: 'organisation-a',
        },
      }),
    );
  });

  it('blocks HR review while a critical finding remains unresolved', async () => {
    prisma.payrollRun.findFirst.mockResolvedValue({
      id: 'run-1',
      status: PayrollRunStatus.AI_AUDITED,
      audit: {
        blocked: true,
        findings: [
          {
            severity: PayrollAuditSeverity.CRITICAL,
            status: PayrollAuditFindingStatus.OPEN,
          },
        ],
      },
    });

    await expect(
      service.transitionStatus(
        'organisation-1',
        'run-1',
        PayrollRunStatus.HR_REVIEWED,
      ),
    ).rejects.toThrow('Critical payroll findings must be resolved');
  });

  it('requires every payslip before finalisation', async () => {
    prisma.payrollRun.findFirst.mockResolvedValue({
      id: 'run-1',
      status: PayrollRunStatus.COMPLETED,
      audit: null,
    });
    prisma.payrollRunItem.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1);

    await expect(
      service.transitionStatus(
        'organisation-1',
        'run-1',
        PayrollRunStatus.FINALISED,
      ),
    ).rejects.toThrow('Generate all payslips');
  });
});
