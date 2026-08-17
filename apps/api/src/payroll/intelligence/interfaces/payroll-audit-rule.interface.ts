import {
  PayrollAuditSeverity,
  Prisma,
} from '@prisma/client';

import { PayrollAuditContext } from './payroll-audit-context.interface';

export interface PayrollAuditRuleFinding {
  employeeId?: string;

  ruleCode: string;
  severity: PayrollAuditSeverity;

  title: string;
  description: string;

  currentValue?: Prisma.Decimal | number | null;
  previousValue?: Prisma.Decimal | number | null;
  varianceValue?: Prisma.Decimal | number | null;
  varianceRate?: Prisma.Decimal | number | null;

  metadata?: Prisma.InputJsonValue;
}

export interface PayrollAuditRule {
  readonly code: string;
  readonly name: string;
  readonly description: string;

  evaluate(
    context: PayrollAuditContext,
  ): Promise<PayrollAuditRuleFinding[]>;
}
