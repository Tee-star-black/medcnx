import {
  EmploymentStatus,
  PayrollAuditRiskLevel,
  PayrollAuditSeverity,
  PayrollRunStatus,
  Prisma,
} from '@prisma/client';

import { PayrollHealthScoreService } from '../payroll-health-score.service';
import type { PayrollAuditContext } from '../interfaces/payroll-audit-context.interface';
import { DuplicateBankAccountRule } from './duplicate-bank-account.rule';
import { MissingBankDetailsRule } from './missing-bank-details.rule';
import { NegativeNetSalaryRule } from './negative-net-salary.rule';
import { PayrollTotalSpikeRule } from './payroll-total-spike.rule';
import { TerminatedEmployeeRule } from './terminated-employee.rule';
import { UnusualOvertimeRule } from './unusual-overtime.rule';

const decimal = (value: number) => new Prisma.Decimal(value);

function item(
  overrides: Record<string, unknown> = {},
): PayrollAuditContext['payrollRun']['items'][number] {
  const employeeId = String(overrides.employeeId ?? 'employee-1');
  const compensationProfile = {
    id: `profile-${employeeId}`,
    organisationId: 'organisation-1',
    employeeId,
    paymentFrequency: 'MONTHLY',
    basicSalary: decimal(30000),
    autoPaye: true,
    uifEnabled: true,
    pensionEmployee: decimal(0),
    pensionEmployer: decimal(0),
    medicalAidEmployee: decimal(0),
    medicalAidEmployer: decimal(0),
    defaultAllowances: decimal(0),
    defaultOtherDeductions: decimal(0),
    bankName: 'FNB',
    bankAccountNumber: `620000${employeeId}`,
    paymentReference: employeeId,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return {
    id: String(overrides.id ?? `item-${employeeId}`),
    organisationId: 'organisation-1',
    payrollRunId: 'run-current',
    employeeId,
    periodMonth: 7,
    periodYear: 2026,
    basicSalary: decimal(30000),
    overtime: decimal(0),
    bonus: decimal(0),
    commission: decimal(0),
    allowances: decimal(0),
    grossPay: decimal(30000),
    paye: decimal(4500),
    uifEmployee: decimal(177.12),
    pensionEmployee: decimal(0),
    medicalAidEmployee: decimal(0),
    otherDeductions: decimal(0),
    totalDeductions: decimal(4677.12),
    netPay: decimal(25322.88),
    uifEmployer: decimal(177.12),
    pensionEmployer: decimal(0),
    medicalAidEmployer: decimal(0),
    employerTotal: decimal(177.12),
    payeMode: 'AUTO_SARS_ANNUALISED',
    payeTaxYear: 2027,
    payeAnnualTaxableIncome: decimal(360000),
    payeAnnualTaxBeforeRebate: decimal(0),
    payeAnnualTaxAfterRebate: decimal(0),
    payslipDocumentId: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    employee: {
      id: employeeId,
      organisationId: 'organisation-1',
      userId: null,
      departmentId: null,
      employeeNumber: employeeId,
      firstName: String(overrides.firstName ?? 'Test'),
      lastName: String(overrides.lastName ?? 'Employee'),
      email: `${employeeId}@example.test`,
      phone: null,
      jobTitle: null,
      employmentType: 'PERMANENT',
      employmentStatus: EmploymentStatus.ACTIVE,
      startDate: null,
      endDate: null,
      idNumber: null,
      passportNumber: null,
      dateOfBirth: null,
      gender: null,
      nationality: null,
      emergencyContactName: null,
      emergencyContactPhone: null,
      emergencyContactRelation: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      compensationProfile,
    },
    ...overrides,
  } as unknown as PayrollAuditContext['payrollRun']['items'][number];
}

function context(
  items: PayrollAuditContext['payrollRun']['items'],
  currentGross = 30000,
  previousGross?: number,
): PayrollAuditContext {
  return {
    organisationId: 'organisation-1',
    payrollRun: {
      id: 'run-current',
      organisationId: 'organisation-1',
      title: 'July 2026 payroll',
      periodMonth: 7,
      periodYear: 2026,
      status: PayrollRunStatus.CALCULATED,
      totalGrossPay: decimal(currentGross),
      items,
    } as PayrollAuditContext['payrollRun'],
    previousPayrollRun:
      previousGross === undefined
        ? null
        : ({
            id: 'run-previous',
            totalGrossPay: decimal(previousGross),
            items: [],
          } as PayrollAuditContext['previousPayrollRun']),
    generatedAt: new Date(),
  };
}

describe('Payroll intelligence outlier rules', () => {
  it('flags overtime above the configured cost threshold', async () => {
    const findings = await new UnusualOvertimeRule().evaluate(
      context([item({ overtime: decimal(12000), grossPay: decimal(42000) })]),
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      ruleCode: 'UNUSUAL_OVERTIME',
      severity: PayrollAuditSeverity.HIGH,
    });
  });

  it('does not flag ordinary overtime', async () => {
    const findings = await new UnusualOvertimeRule().evaluate(
      context([item({ overtime: decimal(2000), grossPay: decimal(32000) })]),
    );
    expect(findings).toHaveLength(0);
  });

  it('flags a material payroll total spike', async () => {
    const findings = await new PayrollTotalSpikeRule().evaluate(
      context([item()], 150000, 100000),
    );
    expect(findings[0]).toMatchObject({
      ruleCode: 'PAYROLL_TOTAL_SPIKE',
      severity: PayrollAuditSeverity.HIGH,
      varianceRate: 0.5,
    });
  });

  it('flags incomplete banking details as critical', async () => {
    const payrollItem = item();
    payrollItem.employee.compensationProfile!.bankAccountNumber = null;
    const findings = await new MissingBankDetailsRule().evaluate(
      context([payrollItem]),
    );
    expect(findings[0]?.severity).toBe(PayrollAuditSeverity.CRITICAL);
  });

  it('flags every employee sharing a bank account', async () => {
    const first = item({ employeeId: 'employee-1' });
    const second = item({ employeeId: 'employee-2' });
    second.employee.compensationProfile!.bankAccountNumber =
      first.employee.compensationProfile!.bankAccountNumber;
    const findings = await new DuplicateBankAccountRule().evaluate(
      context([first, second]),
    );
    expect(findings).toHaveLength(2);
    expect(findings.every((finding) => finding.severity === 'CRITICAL')).toBe(
      true,
    );
  });

  it('flags negative net salary as critical', async () => {
    const findings = await new NegativeNetSalaryRule().evaluate(
      context([
        item({
          netPay: decimal(-2500),
          totalDeductions: decimal(32500),
        }),
      ]),
    );
    expect(findings[0]?.ruleCode).toBe('NEGATIVE_NET_SALARY');
  });

  it('flags a terminated employee included in payroll', async () => {
    const payrollItem = item();
    payrollItem.employee.employmentStatus = EmploymentStatus.TERMINATED;
    const findings = await new TerminatedEmployeeRule().evaluate(
      context([payrollItem]),
    );
    expect(findings[0]?.ruleCode).toBe('TERMINATED_EMPLOYEE_INCLUDED');
  });

  it('blocks payroll and lowers health score for critical outliers', () => {
    const result = new PayrollHealthScoreService().calculate([
      {
        ruleCode: 'NEGATIVE_NET_SALARY',
        severity: PayrollAuditSeverity.CRITICAL,
        title: 'Negative net salary',
        description: 'Test fixture',
      },
      {
        ruleCode: 'UNUSUAL_OVERTIME',
        severity: PayrollAuditSeverity.HIGH,
        title: 'Unusual overtime',
        description: 'Test fixture',
      },
    ]);

    expect(result).toMatchObject({
      blocked: true,
      healthScore: 63,
      riskLevel: PayrollAuditRiskLevel.CRITICAL,
      criticalCount: 1,
      highCount: 1,
    });
  });
});
