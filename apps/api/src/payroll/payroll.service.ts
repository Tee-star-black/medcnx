import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  EmployeeDocumentCategory,
  EmployeeNotificationCategory,
} from '@prisma/client';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import type { CurrentUser } from '../auth/types/current-user.type';
import { PrismaService } from '../database/prisma.service';
import { EmployeeNotificationService } from '../employee-self-service/employee-notification.service';
import { CalculatePayslipDto } from './dto/calculate-payslip.dto';
import { GeneratePayslipDto } from './dto/generate-payslip.dto';
import { calculateSouthAfricanPaye } from './tax/sa-paye-calculator';

function money(value?: number | null) {
  return Number((value ?? 0).toFixed(2));
}

function escapeHtml(value?: string | null) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatCurrency(value?: number | null) {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
  }).format(value ?? 0);
}

function formatMonth(month: number) {
  return (
    [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ][month - 1] ?? `Month ${month}`
  );
}

function formatDate(value?: string | Date | null) {
  if (!value) {
    return 'Not specified';
  }

  return new Intl.DateTimeFormat('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(new Date(value));
}

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: EmployeeNotificationService,
  ) {}

  async calculatePayslip(user: CurrentUser, dto: CalculatePayslipDto) {
    const employee = await this.findEmployee(user, dto.employeeId);

    const calculation = this.calculate(dto);

    return {
      employee: {
        id: employee.id,
        employeeNumber: employee.employeeNumber,
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        jobTitle: employee.jobTitle,
        department: employee.department,
      },

      period: {
        month: dto.periodMonth,
        year: dto.periodYear,
      },

      ...calculation,
    };
  }

  async generatePayslip(user: CurrentUser, dto: GeneratePayslipDto) {
    const employee = await this.findEmployee(user, dto.employeeId);

    const organisation = await this.prisma.organisation.findUnique({
      where: {
        id: user.organisationId,
      },
    });

    const calculation = this.calculate(dto);

    const html = this.buildPayslipHtml({
      employee,
      organisation,
      dto,
      calculation,
    });

    return {
      documentType: 'PAYSLIP',
      title: `Payslip - ${formatMonth(dto.periodMonth)} ${dto.periodYear}`,
      employeeId: employee.id,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      periodMonth: dto.periodMonth,
      periodYear: dto.periodYear,
      generatedAt: new Date().toISOString(),
      calculation,
      html,
    };
  }

  async savePayslip(user: CurrentUser, dto: GeneratePayslipDto) {
    const generatedPayslip = await this.generatePayslip(user, dto);
    const employee = await this.findEmployee(user, dto.employeeId);

    const uploadDirectory = join(
      process.cwd(),
      'uploads',
      'employee-documents',
    );

    await mkdir(uploadDirectory, { recursive: true });

    const safeEmployeeName = `${employee.firstName}-${employee.lastName}`
      .replace(/[^a-z0-9-]/gi, '-')
      .toLowerCase();

    const fileName = `payslip-${safeEmployeeName}-${dto.periodYear}-${String(
      dto.periodMonth,
    ).padStart(2, '0')}-${Date.now()}.html`;

    const filePath = join(uploadDirectory, fileName);

    await writeFile(filePath, generatedPayslip.html, 'utf8');

    const document = await this.prisma.employeeDocument.create({
      data: {
        organisationId: user.organisationId,
        employeeId: employee.id,
        category: EmployeeDocumentCategory.PAYSLIP,
        title: generatedPayslip.title,
        description: `Generated payslip for ${formatMonth(dto.periodMonth)} ${
          dto.periodYear
        }.`,
        fileName,
        originalName: `${generatedPayslip.title} - ${employee.firstName} ${employee.lastName}.html`,
        mimeType: 'text/html',
        sizeBytes: Buffer.byteLength(generatedPayslip.html, 'utf8'),
        storageKey: `employee-documents/${fileName}`,
        isConfidential: dto.isConfidential ?? true,
        visibleToEmployee: dto.visibleToEmployee ?? true,
        uploadedByUserId: user.id,
      },
      select: {
        id: true,
        employeeId: true,
        title: true,
        category: true,
        originalName: true,
        mimeType: true,
        visibleToEmployee: true,
        isConfidential: true,
        createdAt: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organisationId: user.organisationId,
        actorUserId: user.id,
        action: AuditAction.CREATE,
        entity: 'EmployeeDocument',
        entityId: document.id,
        metadata: {
          source: 'PAYROLL_GENERATOR',
          category: EmployeeDocumentCategory.PAYSLIP,
          employeeId: employee.id,
          periodMonth: dto.periodMonth,
          periodYear: dto.periodYear,
          grossPay: generatedPayslip.calculation.earnings.grossPay,
          netPay: generatedPayslip.calculation.netPay,
          payeMode: generatedPayslip.calculation.calculationSettings.payeMode,
          payeTaxYear:
            generatedPayslip.calculation.calculationSettings.payeTaxYear,
        },
      },
    });

    if (document.visibleToEmployee) {
      await this.notifications.notifyEmployee({
        organisationId: user.organisationId,
        employeeId: employee.id,
        category: EmployeeNotificationCategory.PAYSLIP,
        title: 'New payslip available',
        message: `${generatedPayslip.title} is ready to view or download.`,
        href: '/employee/payslips',
      });
    }

    return {
      message: 'Payslip saved to employee documents.',
      document,
    };
  }

  private async findEmployee(user: CurrentUser, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: {
        id: employeeId,
        organisationId: user.organisationId,
      },
      include: {
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found.');
    }

    return employee;
  }

  calculate(dto: CalculatePayslipDto | GeneratePayslipDto) {
    const basicSalary = money(dto.basicSalary);
    const overtime = money(dto.overtime);
    const bonus = money(dto.bonus);
    const commission = money(dto.commission);
    const allowances = money(dto.allowances);

    const grossPay = money(
      basicSalary + overtime + bonus + commission + allowances,
    );

    const pensionEmployee = money(dto.pensionEmployee);
    const pensionEmployer = money(dto.pensionEmployer);
    const medicalAidEmployee = money(dto.medicalAidEmployee);
    const medicalAidEmployer = money(dto.medicalAidEmployer);
    const retirementContributions = money(
      pensionEmployee + pensionEmployer,
    );
    const remunerationForRetirementLimit = money(
      grossPay + pensionEmployer + medicalAidEmployer,
    );
    const allowableRetirementDeduction = money(
      Math.min(
        retirementContributions,
        remunerationForRetirementLimit * 0.275,
        430000 / 12,
      ),
    );
    const regularTaxableIncome = money(
      Math.max(
        0,
        basicSalary +
          overtime +
          commission +
          allowances +
          pensionEmployer +
          medicalAidEmployer -
          allowableRetirementDeduction,
      ),
    );

    const automaticPaye = dto.autoPaye
      ? calculateSouthAfricanPaye({
          monthlyTaxableIncome: regularTaxableIncome,
          periodMonth: dto.periodMonth,
          periodYear: dto.periodYear,
          dateOfBirth: dto.dateOfBirth,
          medicalSchemeMembers: dto.medicalSchemeMembers,
          regularTaxableIncomeYtd:
            dto.payeRegularTaxableIncomeYtd === undefined
              ? regularTaxableIncome
              : dto.payeRegularTaxableIncomeYtd + regularTaxableIncome,
          annualPaymentsYtd:
            (dto.payeAnnualPaymentsYtd ?? 0) + bonus,
          payeYtdBeforeCurrent: dto.payeYtdBeforeCurrent,
          periodsWorkedIncludingCurrent: dto.payePeriodsWorked,
        })
      : null;

    const uifEmployeeRate = dto.uifEmployeeRate ?? 0.01;
    const uifEmployerRate = dto.uifEmployerRate ?? 0.01;
    const uifMonthlyCap = dto.uifMonthlyCap ?? 177.12;

    const calculatedUifEmployee = money(grossPay * uifEmployeeRate);
    const calculatedUifEmployer = money(grossPay * uifEmployerRate);

    const uifEmployee = money(Math.min(calculatedUifEmployee, uifMonthlyCap));
    const uifEmployer = money(Math.min(calculatedUifEmployer, uifMonthlyCap));
    const sdlEmployerRate = dto.sdlEmployerRate ?? 0;
    const sdlEmployer = money(grossPay * sdlEmployerRate);

    const directiveMode = dto.taxDirectiveMode ?? 'NONE';
    const directiveValue = Math.max(0, dto.taxDirectiveValue ?? 0);
    const directivePaye =
      directiveMode === 'FIXED_PERCENTAGE'
        ? money(
            remunerationForRetirementLimit * (directiveValue / 100),
          )
        : directiveMode === 'FIXED_AMOUNT'
          ? money(directiveValue)
          : null;
    const paye =
      directivePaye ??
      (automaticPaye ? automaticPaye.paye : money(dto.paye));
    const otherDeductions = money(dto.otherDeductions);

    const totalDeductions = money(
      paye +
        uifEmployee +
        pensionEmployee +
        medicalAidEmployee +
        otherDeductions,
    );

    const netPay = money(grossPay - totalDeductions);

    const employerContributionsTotal = money(
      uifEmployer + sdlEmployer + pensionEmployer + medicalAidEmployer,
    );

    return {
      earnings: {
        basicSalary,
        overtime,
        bonus,
        commission,
        allowances,
        grossPay,
      },

      deductions: {
        paye,
        uifEmployee,
        pensionEmployee,
        medicalAidEmployee,
        otherDeductions,
        totalDeductions,
      },

      employerContributions: {
        uifEmployer,
        sdlEmployer,
        pensionEmployer,
        medicalAidEmployer,
        total: employerContributionsTotal,
      },

      netPay,

      calculationSettings: {
        uifEmployeeRate,
        uifEmployerRate,
        uifMonthlyCap,
        sdlEmployerRate,
        payeMode:
          directiveMode !== 'NONE'
            ? `TAX_DIRECTIVE_${directiveMode}`
            : automaticPaye
              ? 'AUTO_SARS_YTD'
              : 'MANUAL_PHASE_1',
        taxDirectiveMode: directiveMode,
        taxDirectiveValue:
          directiveMode === 'NONE' ? null : directiveValue,
        regularTaxableIncome,
        retirementContributions,
        allowableRetirementDeduction,
        payeTaxYear: automaticPaye?.taxYear ?? null,
        payeTaxYearStartDate: automaticPaye?.taxYearStartDate ?? null,
        payeTaxYearEndDate: automaticPaye?.taxYearEndDate ?? null,
        payeAnnualTaxableIncome: automaticPaye?.annualTaxableIncome ?? null,
        payeAnnualTaxBeforeRebate:
          automaticPaye?.annualTaxBeforeRebate ?? null,
        payeAnnualRebate: automaticPaye?.annualRebate ?? null,
        payeAnnualMedicalSchemeFeesTaxCredit:
          automaticPaye?.annualMedicalSchemeFeesTaxCredit ?? null,
        payeAnnualTaxAfterRebate: automaticPaye?.annualTaxAfterRebate ?? null,
        payeAgeAtTaxYearEnd: automaticPaye?.ageAtTaxYearEnd ?? null,
        payeMedicalSchemeMembers:
          automaticPaye?.medicalSchemeMembers ?? null,
        payeRegularTaxableIncomeYtd:
          automaticPaye?.regularTaxableIncomeYtd ?? null,
        payeAnnualPaymentsYtd:
          automaticPaye?.annualPaymentsYtd ?? null,
        payeYtdBeforeCurrent:
          automaticPaye?.payeYtdBeforeCurrent ?? null,
        payeCumulativeLiability:
          automaticPaye?.cumulativePayeLiability ?? null,
        payeAnnualPaymentTax:
          automaticPaye?.annualPaymentTax ?? null,
        payePeriodsWorked:
          automaticPaye?.periodsWorkedIncludingCurrent ?? null,
      },
    };
  }

  private buildPayslipHtml({
    employee,
    organisation,
    dto,
    calculation,
  }: {
    employee: Awaited<ReturnType<PayrollService['findEmployee']>>;
    organisation: Awaited<
      ReturnType<PrismaService['organisation']['findUnique']>
    >;
    dto: GeneratePayslipDto;
    calculation: ReturnType<PayrollService['calculate']>;
  }) {
    const employeeName = `${employee.firstName} ${employee.lastName}`;
    const period = `${formatMonth(dto.periodMonth)} ${dto.periodYear}`;

    const organisationName = organisation?.name ?? 'MedCNX Organisation';
    const organisationEmail = organisation?.email ?? '';
    const organisationPhone = organisation?.phone ?? '';

    const organisationAddress = [
      organisation?.addressLine1,
      organisation?.addressLine2,
      organisation?.city,
      organisation?.province,
      organisation?.postalCode,
      organisation?.country,
    ]
      .filter(Boolean)
      .join(', ');

    const rows = {
      earnings: [
        ['Basic salary', calculation.earnings.basicSalary],
        ['Overtime', calculation.earnings.overtime],
        ['Bonus', calculation.earnings.bonus],
        ['Commission', calculation.earnings.commission],
        ['Allowances', calculation.earnings.allowances],
      ],
      deductions: [
        ['PAYE', calculation.deductions.paye],
        ['UIF employee', calculation.deductions.uifEmployee],
        ['Pension employee', calculation.deductions.pensionEmployee],
        ['Medical aid employee', calculation.deductions.medicalAidEmployee],
        ['Other deductions', calculation.deductions.otherDeductions],
      ],
      employer: [
        ['UIF employer', calculation.employerContributions.uifEmployer],
        ['SDL employer', calculation.employerContributions.sdlEmployer],
        ['Pension employer', calculation.employerContributions.pensionEmployer],
        [
          'Medical aid employer',
          calculation.employerContributions.medicalAidEmployer,
        ],
      ],
    };

    const payeModeLabel = calculation.calculationSettings.payeMode.startsWith(
      'TAX_DIRECTIVE_',
    )
      ? 'SARS tax directive'
      : calculation.calculationSettings.payeMode.startsWith('AUTO_SARS_')
        ? `Auto SARS YTD${
            calculation.calculationSettings.payeTaxYear
              ? ` · ${calculation.calculationSettings.payeTaxYear}`
              : ''
          }`
        : 'Manual phase 1';

    return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Payslip - ${escapeHtml(employeeName)} - ${escapeHtml(period)}</title>
  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      background: #e5e7eb;
      color: #111827;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 13px;
      line-height: 1.5;
    }

    .page {
      width: 210mm;
      min-height: 297mm;
      margin: 24px auto;
      background: #ffffff;
      border: 1px solid #d1d5db;
      padding: 18mm;
    }

    .topbar {
      display: flex;
      justify-content: space-between;
      gap: 32px;
      border-bottom: 2px solid #111827;
      padding-bottom: 18px;
      margin-bottom: 24px;
    }

    .brand h1 {
      margin: 0;
      font-size: 24px;
      letter-spacing: -0.05em;
    }

    .brand p {
      margin: 4px 0 0;
      color: #6b7280;
      font-size: 12px;
    }

    .badge {
      border: 1px solid #111827;
      padding: 10px 14px;
      text-align: right;
      min-width: 170px;
    }

    .badge strong {
      display: block;
      font-size: 16px;
      letter-spacing: 0.08em;
    }

    .badge span {
      display: block;
      color: #6b7280;
      margin-top: 4px;
    }

    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-bottom: 18px;
    }

    .box {
      border: 1px solid #d1d5db;
      padding: 14px;
      min-height: 110px;
    }

    .box h2 {
      margin: 0 0 10px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.16em;
      color: #6b7280;
    }

    .line {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      border-bottom: 1px solid #f3f4f6;
      padding: 6px 0;
    }

    .line:last-child {
      border-bottom: 0;
    }

    .line span:first-child {
      color: #6b7280;
    }

    .line strong {
      text-align: right;
      font-weight: 700;
    }

    .tables {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-top: 18px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #d1d5db;
    }

    th {
      background: #111827;
      color: #ffffff;
      text-align: left;
      font-size: 11px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      padding: 10px;
    }

    td {
      border-top: 1px solid #e5e7eb;
      padding: 9px 10px;
    }

    td:last-child {
      text-align: right;
      font-weight: 700;
    }

    tfoot td {
      background: #f9fafb;
      font-weight: 700;
      border-top: 2px solid #111827;
    }

    .net {
      margin-top: 18px;
      background: #111827;
      color: #ffffff;
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 24px;
      align-items: center;
      padding: 18px;
    }

    .net p {
      margin: 0;
      color: rgba(255, 255, 255, 0.65);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.16em;
    }

    .net h2 {
      margin: 4px 0 0;
      font-size: 30px;
      letter-spacing: -0.05em;
    }

    .note {
      border: 1px solid #d1d5db;
      padding: 14px;
      margin-top: 18px;
      color: #374151;
    }

    .footer {
      margin-top: 28px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18px;
      color: #6b7280;
      font-size: 11px;
      border-top: 1px solid #d1d5db;
      padding-top: 14px;
    }

    .signature {
      margin-top: 28px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
    }

    .signature div {
      border-top: 1px solid #111827;
      padding-top: 8px;
      color: #6b7280;
      font-size: 12px;
    }

    @media print {
      body {
        background: #ffffff;
      }

      .page {
        margin: 0;
        border: 0;
        width: auto;
        min-height: auto;
        padding: 14mm;
      }
    }
  </style>
</head>
<body>
  <main class="page">
    <section class="topbar">
      <div class="brand">
        <h1>${escapeHtml(organisationName)}</h1>
        <p>${escapeHtml(organisationEmail)}</p>
        <p>${escapeHtml(organisationPhone)}</p>
        <p>${escapeHtml(organisationAddress)}</p>
      </div>

      <div class="badge">
        <strong>PAYSLIP</strong>
        <span>${escapeHtml(period)}</span>
      </div>
    </section>

    <section class="grid">
      <div class="box">
        <h2>Employee details</h2>
        <div class="line"><span>Name</span><strong>${escapeHtml(employeeName)}</strong></div>
        <div class="line"><span>Employee no.</span><strong>${escapeHtml(employee.employeeNumber)}</strong></div>
        <div class="line"><span>Job title</span><strong>${escapeHtml(employee.jobTitle ?? 'Not specified')}</strong></div>
        <div class="line"><span>Department</span><strong>${escapeHtml(employee.department?.name ?? 'Not assigned')}</strong></div>
      </div>

      <div class="box">
        <h2>Pay details</h2>
        <div class="line"><span>Pay period</span><strong>${escapeHtml(period)}</strong></div>
        <div class="line"><span>Payment date</span><strong>${escapeHtml(formatDate(dto.paymentDate))}</strong></div>
        <div class="line"><span>Generated by</span><strong>${escapeHtml(dto.generatedBy ?? 'Payroll')}</strong></div>
        <div class="line"><span>PAYE mode</span><strong>${escapeHtml(payeModeLabel)}</strong></div>
      </div>
    </section>

    <section class="tables">
      <table>
        <thead>
          <tr>
            <th>Earnings</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          ${rows.earnings
            .map(
              ([label, value]) => `
          <tr>
            <td>${escapeHtml(String(label))}</td>
            <td>${formatCurrency(Number(value))}</td>
          </tr>`,
            )
            .join('')}
        </tbody>
        <tfoot>
          <tr>
            <td>Gross pay</td>
            <td>${formatCurrency(calculation.earnings.grossPay)}</td>
          </tr>
        </tfoot>
      </table>

      <table>
        <thead>
          <tr>
            <th>Deductions</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          ${rows.deductions
            .map(
              ([label, value]) => `
          <tr>
            <td>${escapeHtml(String(label))}</td>
            <td>${formatCurrency(Number(value))}</td>
          </tr>`,
            )
            .join('')}
        </tbody>
        <tfoot>
          <tr>
            <td>Total deductions</td>
            <td>${formatCurrency(calculation.deductions.totalDeductions)}</td>
          </tr>
        </tfoot>
      </table>
    </section>

    <section class="tables">
      <table>
        <thead>
          <tr>
            <th>Employer contributions</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          ${rows.employer
            .map(
              ([label, value]) => `
          <tr>
            <td>${escapeHtml(String(label))}</td>
            <td>${formatCurrency(Number(value))}</td>
          </tr>`,
            )
            .join('')}
        </tbody>
        <tfoot>
          <tr>
            <td>Employer contribution total</td>
            <td>${formatCurrency(calculation.employerContributions.total)}</td>
          </tr>
        </tfoot>
      </table>

      <div class="box">
        <h2>Payroll summary</h2>
        <div class="line"><span>Gross pay</span><strong>${formatCurrency(calculation.earnings.grossPay)}</strong></div>
        <div class="line"><span>Total deductions</span><strong>${formatCurrency(calculation.deductions.totalDeductions)}</strong></div>
        <div class="line"><span>Employer contributions</span><strong>${formatCurrency(calculation.employerContributions.total)}</strong></div>
        <div class="line"><span>UIF cap applied</span><strong>${formatCurrency(calculation.calculationSettings.uifMonthlyCap)}</strong></div>
      </div>
    </section>

    <section class="net">
      <div>
        <p>Net pay</p>
        <h2>${formatCurrency(calculation.netPay)}</h2>
      </div>

      <div>
        <p>Payable to</p>
        <h2>${escapeHtml(employeeName)}</h2>
      </div>
    </section>

    ${
      dto.notes
        ? `<section class="note"><strong>Notes:</strong><br />${escapeHtml(dto.notes)}</section>`
        : ''
    }

    <section class="signature">
      <div>Employer / HR signature</div>
      <div>Employee acknowledgement</div>
    </section>

    <section class="footer">
      <p>This payslip was generated by MedCNX payroll automation.</p>
      <p>Generated on ${escapeHtml(formatDate(new Date()))}</p>
    </section>
  </main>
</body>
</html>`;
  }
}
