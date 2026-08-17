import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  EmploymentStatus,
  PayrollRunStatus,
} from '@prisma/client';
import type { CurrentUser } from '../auth/types/current-user.type';
import { PrismaService } from '../database/prisma.service';
import { CreatePayrollRunDto } from './dto/create-payroll-run.dto';
import { UpdatePayrollRunItemInputsDto } from './dto/update-payroll-run-item-inputs.dto';
import { PayrollService } from './payroll.service';

const monthNames = [
  '',
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
];

const PAYROLL_CALCULATION_VERSION = 'ZA_PAYROLL_2027_V3';

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value);
}

function payrollPeriodBounds(periodMonth: number, periodYear: number) {
  return {
    start: new Date(Date.UTC(periodYear, periodMonth - 1, 1)),
    end: new Date(Date.UTC(periodYear, periodMonth, 0, 23, 59, 59, 999)),
  };
}

function employmentFractionForMonth(
  startDate: Date | null,
  endDate: Date | null,
  periodMonth: number,
  periodYear: number,
) {
  const period = payrollPeriodBounds(periodMonth, periodYear);
  const effectiveStart =
    startDate && startDate > period.start ? startDate : period.start;
  const effectiveEnd = endDate && endDate < period.end ? endDate : period.end;

  if (effectiveStart > effectiveEnd) return 0;

  const daysInMonth = new Date(
    Date.UTC(periodYear, periodMonth, 0),
  ).getUTCDate();
  const activeDays =
    Math.floor(
      (Date.UTC(
        effectiveEnd.getUTCFullYear(),
        effectiveEnd.getUTCMonth(),
        effectiveEnd.getUTCDate(),
      ) -
        Date.UTC(
          effectiveStart.getUTCFullYear(),
          effectiveStart.getUTCMonth(),
          effectiveStart.getUTCDate(),
        )) /
        86400000,
    ) + 1;

  return Math.min(1, Math.max(0, activeDays / daysInMonth));
}

function isBeforePayrollPeriod(
  itemYear: number,
  itemMonth: number,
  runYear: number,
  runMonth: number,
) {
  return itemYear < runYear || (itemYear === runYear && itemMonth < runMonth);
}

function money(value: number) {
  return Number(value.toFixed(2));
}

function clean(value?: string) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

function csvCell(value: unknown) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

@Injectable()
export class PayrollRunsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payrollService: PayrollService,
  ) {}

  async listPayrollRuns(user: CurrentUser) {
    const runs = await this.prisma.payrollRun.findMany({
      where: {
        organisationId: user.organisationId,
      },
      orderBy: [
        {
          periodYear: 'desc',
        },
        {
          periodMonth: 'desc',
        },
        {
          createdAt: 'desc',
        },
      ],
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        finalisedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        _count: {
          select: {
            items: true,
          },
        },
      },
    });

    return runs.map((run) => this.mapPayrollRun(run));
  }

  async createPayrollRun(user: CurrentUser, dto: CreatePayrollRunDto) {
    const title =
      clean(dto.title) ??
      `${monthNames[dto.periodMonth] ?? `Month ${dto.periodMonth}`} ${
        dto.periodYear
      } Payroll Run`;

    const existing = await this.prisma.payrollRun.findFirst({
      where: {
        organisationId: user.organisationId,
        periodMonth: dto.periodMonth,
        periodYear: dto.periodYear,
        title,
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      throw new BadRequestException(
        'A payroll run with this title already exists for the selected period.',
      );
    }

    const run = await this.prisma.payrollRun.create({
      data: {
        organisationId: user.organisationId,
        title,
        periodMonth: dto.periodMonth,
        periodYear: dto.periodYear,
        notes: clean(dto.notes),
        createdByUserId: user.id,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        finalisedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        _count: {
          select: {
            items: true,
          },
        },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organisationId: user.organisationId,
        actorUserId: user.id,
        action: AuditAction.CREATE,
        entity: 'PayrollRun',
        entityId: run.id,
        message: 'Payroll run created.',
        metadata: {
          payrollRunId: run.id,
          title: run.title,
          periodMonth: run.periodMonth,
          periodYear: run.periodYear,
          status: run.status,
        },
      },
    });

    return {
      message: 'Payroll run created.',
      payrollRun: this.mapPayrollRun(run),
    };
  }

  async getPayrollRun(user: CurrentUser, payrollRunId: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: {
        id: payrollRunId,
        organisationId: user.organisationId,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        finalisedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        items: {
          orderBy: {
            createdAt: 'asc',
          },
          include: {
            employee: {
              select: {
                id: true,
                employeeNumber: true,
                firstName: true,
                lastName: true,
                email: true,
                jobTitle: true,
                department: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            items: true,
          },
        },
      },
    });

    if (!run) {
      throw new NotFoundException('Payroll run not found.');
    }

    return this.mapPayrollRun(run, true);
  }

  async exportPayrollRegister(user: CurrentUser, payrollRunId: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: {
        id: payrollRunId,
        organisationId: user.organisationId,
      },
      include: {
        items: {
          include: {
            employee: {
              select: {
                employeeNumber: true,
                firstName: true,
                lastName: true,
                jobTitle: true,
                department: { select: { name: true } },
              },
            },
          },
          orderBy: [
            { employee: { lastName: 'asc' } },
            { employee: { firstName: 'asc' } },
          ],
        },
      },
    });

    if (!run) {
      throw new NotFoundException('Payroll run not found.');
    }

    if (run.items.length === 0) {
      throw new BadRequestException(
        'Calculate the payroll run before downloading its register.',
      );
    }

    const header = [
      'Employee Number',
      'Employee Name',
      'Department',
      'Job Title',
      'Basic Salary',
      'Overtime',
      'Bonus',
      'Commission',
      'Allowances',
      'Gross Pay',
      'PAYE',
      'UIF Employee',
      'Pension Employee',
      'Medical Aid Employee',
      'Other Deductions',
      'Total Deductions',
      'Net Pay',
      'UIF Employer',
      'SDL Employer',
      'Pension Employer',
      'Medical Aid Employer',
      'Employer Contributions',
      'Status',
      'Payroll Period',
    ];
    const rows = run.items.map((item) => [
      item.employee.employeeNumber,
      `${item.employee.firstName} ${item.employee.lastName}`,
      item.employee.department?.name ?? '',
      item.employee.jobTitle ?? '',
      toNumber(item.basicSalary).toFixed(2),
      toNumber(item.overtime).toFixed(2),
      toNumber(item.bonus).toFixed(2),
      toNumber(item.commission).toFixed(2),
      toNumber(item.allowances).toFixed(2),
      toNumber(item.grossPay).toFixed(2),
      toNumber(item.paye).toFixed(2),
      toNumber(item.uifEmployee).toFixed(2),
      toNumber(item.pensionEmployee).toFixed(2),
      toNumber(item.medicalAidEmployee).toFixed(2),
      toNumber(item.otherDeductions).toFixed(2),
      toNumber(item.totalDeductions).toFixed(2),
      toNumber(item.netPay).toFixed(2),
      toNumber(item.uifEmployer).toFixed(2),
      toNumber(item.sdlEmployer).toFixed(2),
      toNumber(item.pensionEmployer).toFixed(2),
      toNumber(item.medicalAidEmployer).toFixed(2),
      toNumber(item.employerTotal).toFixed(2),
      run.status,
      `${run.periodYear}-${String(run.periodMonth).padStart(2, '0')}`,
    ]);
    const content = `\uFEFF${[header, ...rows]
      .map((row) => row.map(csvCell).join(','))
      .join('\r\n')}\r\n`;

    await this.prisma.$transaction([
      this.prisma.auditLog.create({
        data: {
          organisationId: user.organisationId,
          actorUserId: user.id,
          action: AuditAction.DOWNLOAD,
          entity: 'PayrollRun',
          entityId: run.id,
          message: 'Payroll register downloaded.',
          metadata: {
            payrollRunId: run.id,
            periodMonth: run.periodMonth,
            periodYear: run.periodYear,
            employeeCount: run.items.length,
          },
        },
      }),
      this.prisma.payrollTimelineEvent.create({
        data: {
          organisationId: user.organisationId,
          payrollRunId: run.id,
          actorUserId: user.id,
          eventType: 'PAYROLL_REGISTER_EXPORTED',
          title: 'Payroll register exported',
          message: `Payroll register exported for ${run.items.length} employee${
            run.items.length === 1 ? '' : 's'
          }.`,
          metadata: {
            periodMonth: run.periodMonth,
            periodYear: run.periodYear,
            employeeCount: run.items.length,
          },
        },
      }),
    ]);

    return {
      fileName: `medcnx-payroll-register-${run.periodYear}-${String(
        run.periodMonth,
      ).padStart(2, '0')}.csv`,
      content,
    };
  }

  async calculatePayrollRun(user: CurrentUser, payrollRunId: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: {
        id: payrollRunId,
        organisationId: user.organisationId,
      },
    });

    if (!run) {
      throw new NotFoundException('Payroll run not found.');
    }

    if (run.status !== PayrollRunStatus.DRAFT) {
      throw new BadRequestException(
        'Only a draft payroll run can be calculated.',
      );
    }

    const period = payrollPeriodBounds(run.periodMonth, run.periodYear);
    const employees = await this.prisma.employee.findMany({
      where: {
        organisationId: user.organisationId,
        AND: [
          {
            OR: [
              {
                employmentStatus: {
                  in: [
                    EmploymentStatus.ACTIVE,
                    EmploymentStatus.ON_LEAVE,
                    EmploymentStatus.SUSPENDED,
                  ],
                },
              },
              {
                employmentStatus: {
                  in: [
                    EmploymentStatus.TERMINATED,
                    EmploymentStatus.RESIGNED,
                  ],
                },
                endDate: { not: null },
              },
            ],
          },
          {
            OR: [{ startDate: null }, { startDate: { lte: period.end } }],
          },
          {
            OR: [{ endDate: null }, { endDate: { gte: period.start } }],
          },
        ],
      },
      include: {
        compensationProfile: true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    if (employees.length === 0) {
      throw new BadRequestException(
        'No employees were in service during this payroll period.',
      );
    }

    const missingProfiles = employees.filter(
      (employee) => !employee.compensationProfile,
    );

    if (missingProfiles.length > 0) {
      const names = missingProfiles
        .slice(0, 5)
        .map((employee) => `${employee.firstName} ${employee.lastName}`)
        .join(', ');
      const remaining = missingProfiles.length - 5;

      throw new BadRequestException(
        `Compensation profiles are missing for: ${names}${
          remaining > 0 ? ` and ${remaining} more` : ''
        }. Complete every active employee profile before calculating payroll.`,
      );
    }

    const taxYearStartYear =
      run.periodMonth >= 3 ? run.periodYear : run.periodYear - 1;
    const priorItems = await this.prisma.payrollRunItem.findMany({
      where: {
        organisationId: user.organisationId,
        employeeId: { in: employees.map((employee) => employee.id) },
        payrollRunId: { not: run.id },
        payrollRun: {
          status: {
            in: [
              PayrollRunStatus.PAYMENT_PROCESSING,
              PayrollRunStatus.PAID,
              PayrollRunStatus.COMPLETED,
              PayrollRunStatus.FINALISED,
            ],
          },
        },
        OR: [
          {
            periodYear: taxYearStartYear,
            periodMonth: { gte: 3 },
          },
          {
            periodYear: taxYearStartYear + 1,
            periodMonth: { lte: 2 },
          },
        ],
      },
    });
    const priorByEmployee = new Map<
      string,
      {
        regularTaxableIncome: number;
        annualPayments: number;
        paye: number;
        periods: Set<string>;
      }
    >();

    for (const priorItem of priorItems) {
      if (
        !isBeforePayrollPeriod(
          priorItem.periodYear,
          priorItem.periodMonth,
          run.periodYear,
          run.periodMonth,
        )
      ) {
        continue;
      }

      const aggregate = priorByEmployee.get(priorItem.employeeId) ?? {
        regularTaxableIncome: 0,
        annualPayments: 0,
        paye: 0,
        periods: new Set<string>(),
      };
      aggregate.regularTaxableIncome +=
        priorItem.payeRegularTaxableIncome === null
          ? Math.max(0, toNumber(priorItem.grossPay) - toNumber(priorItem.bonus))
          : toNumber(priorItem.payeRegularTaxableIncome);
      aggregate.annualPayments += toNumber(priorItem.bonus);
      aggregate.paye += toNumber(priorItem.paye);
      aggregate.periods.add(
        `${priorItem.periodYear}-${priorItem.periodMonth}`,
      );
      priorByEmployee.set(priorItem.employeeId, aggregate);
    }

    const projectedAnnualRemuneration = money(
      employees.reduce((total, employee) => {
        const profile = employee.compensationProfile!;
        return (
          total +
          toNumber(profile.basicSalary) +
          toNumber(profile.defaultAllowances)
        );
      }, 0) * 12,
    );
    const sdlEnabled = projectedAnnualRemuneration >= 500000;

    const items = employees.map((employee) => {
      const profile = employee.compensationProfile!;
      const employmentFraction = employmentFractionForMonth(
        employee.startDate,
        employee.endDate,
        run.periodMonth,
        run.periodYear,
      );
      const prior = priorByEmployee.get(employee.id);
      const directiveIsValid =
        profile.taxDirectiveMode !== 'NONE' &&
        (!profile.taxDirectiveValidFrom ||
          profile.taxDirectiveValidFrom <= period.end) &&
        (!profile.taxDirectiveValidTo ||
          profile.taxDirectiveValidTo >= period.start);
      const calculation = this.payrollService.calculate({
        employeeId: employee.id,
        periodMonth: run.periodMonth,
        periodYear: run.periodYear,
        basicSalary: money(
          toNumber(profile.basicSalary) * employmentFraction,
        ),
        allowances: money(
          toNumber(profile.defaultAllowances) * employmentFraction,
        ),
        autoPaye: profile.autoPaye,
        pensionEmployee: toNumber(profile.pensionEmployee),
        pensionEmployer: toNumber(profile.pensionEmployer),
        medicalAidEmployee: toNumber(profile.medicalAidEmployee),
        medicalAidEmployer: toNumber(profile.medicalAidEmployer),
        medicalSchemeMembers: profile.medicalSchemeMembers,
        dateOfBirth: employee.dateOfBirth?.toISOString(),
        otherDeductions: toNumber(profile.defaultOtherDeductions),
        uifEmployeeRate: profile.uifEnabled ? 0.01 : 0,
        uifEmployerRate: profile.uifEnabled ? 0.01 : 0,
        sdlEmployerRate: sdlEnabled ? 0.01 : 0,
        payeRegularTaxableIncomeYtd: prior?.regularTaxableIncome ?? 0,
        payeAnnualPaymentsYtd: prior?.annualPayments ?? 0,
        payeYtdBeforeCurrent: prior?.paye ?? 0,
        payePeriodsWorked: (prior?.periods.size ?? 0) + 1,
        taxDirectiveMode: directiveIsValid
          ? profile.taxDirectiveMode
          : 'NONE',
        taxDirectiveValue: directiveIsValid
          ? toNumber(profile.taxDirectiveValue)
          : undefined,
      });

      return {
        organisationId: user.organisationId,
        payrollRunId: run.id,
        employeeId: employee.id,
        periodMonth: run.periodMonth,
        periodYear: run.periodYear,
        basicSalary: calculation.earnings.basicSalary,
        overtime: calculation.earnings.overtime,
        bonus: calculation.earnings.bonus,
        commission: calculation.earnings.commission,
        allowances: calculation.earnings.allowances,
        grossPay: calculation.earnings.grossPay,
        paye: calculation.deductions.paye,
        uifEmployee: calculation.deductions.uifEmployee,
        pensionEmployee: calculation.deductions.pensionEmployee,
        medicalAidEmployee: calculation.deductions.medicalAidEmployee,
        otherDeductions: calculation.deductions.otherDeductions,
        totalDeductions: calculation.deductions.totalDeductions,
        netPay: calculation.netPay,
        uifEmployer: calculation.employerContributions.uifEmployer,
        sdlEmployer: calculation.employerContributions.sdlEmployer,
        pensionEmployer: calculation.employerContributions.pensionEmployer,
        medicalAidEmployer:
          calculation.employerContributions.medicalAidEmployer,
        employerTotal: calculation.employerContributions.total,
        payeMode: calculation.calculationSettings.payeMode,
        payeTaxYear: calculation.calculationSettings.payeTaxYear,
        payeAnnualTaxableIncome:
          calculation.calculationSettings.payeAnnualTaxableIncome,
        payeAnnualTaxBeforeRebate:
          calculation.calculationSettings.payeAnnualTaxBeforeRebate,
        payeAnnualRebate:
          calculation.calculationSettings.payeAnnualRebate,
        payeAnnualMedicalCredit:
          calculation.calculationSettings
            .payeAnnualMedicalSchemeFeesTaxCredit,
        payeAnnualTaxAfterRebate:
          calculation.calculationSettings.payeAnnualTaxAfterRebate,
        payeRegularTaxableIncome:
          calculation.calculationSettings.regularTaxableIncome,
        payeRegularTaxableIncomeYtd:
          calculation.calculationSettings.payeRegularTaxableIncomeYtd,
        payeAnnualPaymentsYtd:
          calculation.calculationSettings.payeAnnualPaymentsYtd,
        payeYtdBeforeCurrent:
          calculation.calculationSettings.payeYtdBeforeCurrent,
        payeCumulativeLiability:
          calculation.calculationSettings.payeCumulativeLiability,
        payeAnnualPaymentTax:
          calculation.calculationSettings.payeAnnualPaymentTax,
        payePeriodsWorked:
          calculation.calculationSettings.payePeriodsWorked,
        allowableRetirementDeduction:
          calculation.calculationSettings.allowableRetirementDeduction,
        inputSnapshot: {
          basicSalary: calculation.earnings.basicSalary,
          overtime: 0,
          bonus: 0,
          commission: 0,
          allowances: calculation.earnings.allowances,
          employmentFraction,
          pensionEmployee: toNumber(profile.pensionEmployee),
          pensionEmployer: toNumber(profile.pensionEmployer),
          medicalAidEmployee: toNumber(profile.medicalAidEmployee),
          medicalAidEmployer: toNumber(profile.medicalAidEmployer),
          medicalSchemeMembers: profile.medicalSchemeMembers,
          dateOfBirth: employee.dateOfBirth?.toISOString() ?? null,
          otherDeductions: toNumber(profile.defaultOtherDeductions),
          uifEnabled: profile.uifEnabled,
          autoPaye: profile.autoPaye,
          taxDirectiveMode: directiveIsValid
            ? profile.taxDirectiveMode
            : 'NONE',
          taxDirectiveReference: directiveIsValid
            ? profile.taxDirectiveReference
            : null,
        },
        calculationSnapshot: {
          version: PAYROLL_CALCULATION_VERSION,
          grossPay: calculation.earnings.grossPay,
          totalDeductions: calculation.deductions.totalDeductions,
          netPay: calculation.netPay,
          employerTotal: calculation.employerContributions.total,
          sdlEmployer: calculation.employerContributions.sdlEmployer,
          payeMode: calculation.calculationSettings.payeMode,
          payeTaxYear: calculation.calculationSettings.payeTaxYear,
          payeAnnualRebate:
            calculation.calculationSettings.payeAnnualRebate,
          payeAnnualMedicalSchemeFeesTaxCredit:
            calculation.calculationSettings
              .payeAnnualMedicalSchemeFeesTaxCredit,
          payeRegularTaxableIncomeYtd:
            calculation.calculationSettings.payeRegularTaxableIncomeYtd,
          payeAnnualPaymentsYtd:
            calculation.calculationSettings.payeAnnualPaymentsYtd,
          payeYtdBeforeCurrent:
            calculation.calculationSettings.payeYtdBeforeCurrent,
          payeCumulativeLiability:
            calculation.calculationSettings.payeCumulativeLiability,
          payeAnnualPaymentTax:
            calculation.calculationSettings.payeAnnualPaymentTax,
          payePeriodsWorked:
            calculation.calculationSettings.payePeriodsWorked,
        },
      };
    });

    const sum = (selector: (item: (typeof items)[number]) => number) =>
      money(items.reduce((total, item) => total + selector(item), 0));

    const totals = {
      employeeCount: items.length,
      totalBasicSalary: sum((item) => item.basicSalary),
      totalOvertime: sum((item) => item.overtime),
      totalBonus: sum((item) => item.bonus),
      totalCommission: sum((item) => item.commission),
      totalAllowances: sum((item) => item.allowances),
      totalGrossPay: sum((item) => item.grossPay),
      totalPaye: sum((item) => item.paye),
      totalUifEmployee: sum((item) => item.uifEmployee),
      totalPensionEmployee: sum((item) => item.pensionEmployee),
      totalMedicalAidEmployee: sum((item) => item.medicalAidEmployee),
      totalOtherDeductions: sum((item) => item.otherDeductions),
      totalDeductions: sum((item) => item.totalDeductions),
      totalNetPay: sum((item) => item.netPay),
      totalUifEmployer: sum((item) => item.uifEmployer),
      totalSdlEmployer: sum((item) => item.sdlEmployer),
      totalPensionEmployer: sum((item) => item.pensionEmployer),
      totalMedicalAidEmployer: sum((item) => item.medicalAidEmployer),
      totalEmployerContributions: sum((item) => item.employerTotal),
    };

    await this.prisma.$transaction(async (transaction) => {
      await transaction.payrollRunItem.deleteMany({
        where: { payrollRunId: run.id },
      });
      await transaction.payrollRunItem.createMany({ data: items });
      await transaction.payrollRun.update({
        where: { id: run.id },
        data: {
          status: PayrollRunStatus.CALCULATED,
          ...totals,
          calculatedAt: new Date(),
          calculationVersion: PAYROLL_CALCULATION_VERSION,
          calculationSnapshot: {
            version: PAYROLL_CALCULATION_VERSION,
            projectedAnnualRemuneration,
            sdlEnabled,
            sdlAnnualRemunerationThreshold: 500000,
            periodMonth: run.periodMonth,
            periodYear: run.periodYear,
            ...totals,
          },
        },
      });
      await transaction.payrollTimelineEvent.create({
        data: {
          organisationId: user.organisationId,
          payrollRunId: run.id,
          actorUserId: user.id,
          eventType: 'PAYROLL_CALCULATED',
          title: 'Payroll calculated',
          message: `${items.length} active employee${items.length === 1 ? '' : 's'} calculated from compensation profiles.`,
          metadata: {
            previousStatus: PayrollRunStatus.DRAFT,
            nextStatus: PayrollRunStatus.CALCULATED,
            employeeCount: items.length,
          },
        },
      });
    });

    return {
      message: `Payroll calculated for ${items.length} active employee${
        items.length === 1 ? '' : 's'
      }.`,
      payrollRun: await this.getPayrollRun(user, run.id),
    };
  }

  async updatePayrollRunItemInputs(
    user: CurrentUser,
    payrollRunId: string,
    payrollRunItemId: string,
    dto: UpdatePayrollRunItemInputsDto,
  ) {
    const item = await this.prisma.payrollRunItem.findFirst({
      where: {
        id: payrollRunItemId,
        payrollRunId,
        organisationId: user.organisationId,
      },
      include: {
        payrollRun: true,
        employee: { include: { compensationProfile: true } },
      },
    });

    if (!item) {
      throw new NotFoundException('Payroll run employee item not found.');
    }

    if (item.payrollRun.status !== PayrollRunStatus.CALCULATED) {
      throw new BadRequestException(
        'Variable inputs can only be edited after calculation and before the intelligence audit.',
      );
    }

    if (item.payrollRun.lockedAt) {
      throw new BadRequestException(
        'Payroll inputs are locked because the formal review workflow has started.',
      );
    }

    if (item.payslipDocumentId) {
      throw new BadRequestException(
        'Inputs cannot be changed after a payslip has been generated.',
      );
    }

    const profile = item.employee.compensationProfile;
    if (!profile) {
      throw new BadRequestException(
        'The employee compensation profile is required to recalculate payroll.',
      );
    }

    const itemPeriod = payrollPeriodBounds(item.periodMonth, item.periodYear);
    const directiveIsValid =
      profile.taxDirectiveMode !== 'NONE' &&
      (!profile.taxDirectiveValidFrom ||
        profile.taxDirectiveValidFrom <= itemPeriod.end) &&
      (!profile.taxDirectiveValidTo ||
        profile.taxDirectiveValidTo >= itemPeriod.start);
    const calculation = this.payrollService.calculate({
      employeeId: item.employeeId,
      periodMonth: item.periodMonth,
      periodYear: item.periodYear,
      basicSalary: toNumber(item.basicSalary),
      overtime: dto.overtime ?? toNumber(item.overtime),
      bonus: dto.bonus ?? toNumber(item.bonus),
      commission: dto.commission ?? toNumber(item.commission),
      allowances: dto.allowances ?? toNumber(item.allowances),
      autoPaye: profile.autoPaye,
      pensionEmployee: toNumber(profile.pensionEmployee),
      pensionEmployer: toNumber(profile.pensionEmployer),
      medicalAidEmployee: toNumber(profile.medicalAidEmployee),
      medicalAidEmployer: toNumber(profile.medicalAidEmployer),
      medicalSchemeMembers: profile.medicalSchemeMembers,
      dateOfBirth: item.employee.dateOfBirth?.toISOString(),
      otherDeductions: dto.otherDeductions ?? toNumber(item.otherDeductions),
      uifEmployeeRate: profile.uifEnabled ? 0.01 : 0,
      uifEmployerRate: profile.uifEnabled ? 0.01 : 0,
      sdlEmployerRate:
        toNumber(item.payrollRun.totalSdlEmployer) > 0 ? 0.01 : 0,
      payeRegularTaxableIncomeYtd: Math.max(
        0,
        toNumber(item.payeRegularTaxableIncomeYtd) -
          toNumber(item.payeRegularTaxableIncome),
      ),
      payeAnnualPaymentsYtd: Math.max(
        0,
        toNumber(item.payeAnnualPaymentsYtd) - toNumber(item.bonus),
      ),
      payeYtdBeforeCurrent: toNumber(item.payeYtdBeforeCurrent),
      payePeriodsWorked: item.payePeriodsWorked ?? 1,
      taxDirectiveMode: directiveIsValid
        ? profile.taxDirectiveMode
        : 'NONE',
      taxDirectiveValue: directiveIsValid
        ? toNumber(profile.taxDirectiveValue)
        : undefined,
    });

    await this.prisma.$transaction(async (transaction) => {
      await transaction.payrollRunItem.update({
        where: { id: item.id },
        data: {
          overtime: calculation.earnings.overtime,
          bonus: calculation.earnings.bonus,
          commission: calculation.earnings.commission,
          allowances: calculation.earnings.allowances,
          grossPay: calculation.earnings.grossPay,
          paye: calculation.deductions.paye,
          uifEmployee: calculation.deductions.uifEmployee,
          pensionEmployee: calculation.deductions.pensionEmployee,
          medicalAidEmployee: calculation.deductions.medicalAidEmployee,
          otherDeductions: calculation.deductions.otherDeductions,
          totalDeductions: calculation.deductions.totalDeductions,
          netPay: calculation.netPay,
          uifEmployer: calculation.employerContributions.uifEmployer,
          sdlEmployer: calculation.employerContributions.sdlEmployer,
          pensionEmployer: calculation.employerContributions.pensionEmployer,
          medicalAidEmployer:
            calculation.employerContributions.medicalAidEmployer,
          employerTotal: calculation.employerContributions.total,
          payeMode: calculation.calculationSettings.payeMode,
          payeTaxYear: calculation.calculationSettings.payeTaxYear,
          payeAnnualTaxableIncome:
            calculation.calculationSettings.payeAnnualTaxableIncome,
          payeAnnualTaxBeforeRebate:
            calculation.calculationSettings.payeAnnualTaxBeforeRebate,
          payeAnnualRebate:
            calculation.calculationSettings.payeAnnualRebate,
          payeAnnualMedicalCredit:
            calculation.calculationSettings
              .payeAnnualMedicalSchemeFeesTaxCredit,
          payeAnnualTaxAfterRebate:
            calculation.calculationSettings.payeAnnualTaxAfterRebate,
          payeRegularTaxableIncome:
            calculation.calculationSettings.regularTaxableIncome,
          payeRegularTaxableIncomeYtd:
            calculation.calculationSettings.payeRegularTaxableIncomeYtd,
          payeAnnualPaymentsYtd:
            calculation.calculationSettings.payeAnnualPaymentsYtd,
          payeYtdBeforeCurrent:
            calculation.calculationSettings.payeYtdBeforeCurrent,
          payeCumulativeLiability:
            calculation.calculationSettings.payeCumulativeLiability,
          payeAnnualPaymentTax:
            calculation.calculationSettings.payeAnnualPaymentTax,
          payePeriodsWorked:
            calculation.calculationSettings.payePeriodsWorked,
          allowableRetirementDeduction:
            calculation.calculationSettings.allowableRetirementDeduction,
          inputSnapshot: {
            basicSalary: toNumber(item.basicSalary),
            overtime: dto.overtime ?? toNumber(item.overtime),
            bonus: dto.bonus ?? toNumber(item.bonus),
            commission: dto.commission ?? toNumber(item.commission),
            allowances: dto.allowances ?? toNumber(item.allowances),
            pensionEmployee: toNumber(profile.pensionEmployee),
            pensionEmployer: toNumber(profile.pensionEmployer),
            medicalAidEmployee: toNumber(profile.medicalAidEmployee),
            medicalAidEmployer: toNumber(profile.medicalAidEmployer),
            medicalSchemeMembers: profile.medicalSchemeMembers,
            dateOfBirth: item.employee.dateOfBirth?.toISOString() ?? null,
            otherDeductions:
              dto.otherDeductions ?? toNumber(item.otherDeductions),
            uifEnabled: profile.uifEnabled,
            autoPaye: profile.autoPaye,
            taxDirectiveMode: directiveIsValid
              ? profile.taxDirectiveMode
              : 'NONE',
            taxDirectiveReference: directiveIsValid
              ? profile.taxDirectiveReference
              : null,
          },
          calculationSnapshot: {
            version: PAYROLL_CALCULATION_VERSION,
            grossPay: calculation.earnings.grossPay,
            totalDeductions: calculation.deductions.totalDeductions,
            netPay: calculation.netPay,
            employerTotal: calculation.employerContributions.total,
            sdlEmployer: calculation.employerContributions.sdlEmployer,
            payeMode: calculation.calculationSettings.payeMode,
            payeTaxYear: calculation.calculationSettings.payeTaxYear,
            payeAnnualRebate:
              calculation.calculationSettings.payeAnnualRebate,
            payeAnnualMedicalSchemeFeesTaxCredit:
              calculation.calculationSettings
                .payeAnnualMedicalSchemeFeesTaxCredit,
            payeRegularTaxableIncomeYtd:
              calculation.calculationSettings.payeRegularTaxableIncomeYtd,
            payeAnnualPaymentsYtd:
              calculation.calculationSettings.payeAnnualPaymentsYtd,
            payeYtdBeforeCurrent:
              calculation.calculationSettings.payeYtdBeforeCurrent,
            payeCumulativeLiability:
              calculation.calculationSettings.payeCumulativeLiability,
            payeAnnualPaymentTax:
              calculation.calculationSettings.payeAnnualPaymentTax,
            payePeriodsWorked:
              calculation.calculationSettings.payePeriodsWorked,
          },
          notes: clean(dto.notes) ?? item.notes,
        },
      });

      const items = await transaction.payrollRunItem.findMany({
        where: { payrollRunId },
      });
      const sum = (field: keyof (typeof items)[number]) =>
        money(
          items.reduce((total, current) => total + toNumber(current[field]), 0),
        );

      await transaction.payrollRun.update({
        where: { id: payrollRunId },
        data: {
          totalBasicSalary: sum('basicSalary'),
          totalOvertime: sum('overtime'),
          totalBonus: sum('bonus'),
          totalCommission: sum('commission'),
          totalAllowances: sum('allowances'),
          totalGrossPay: sum('grossPay'),
          totalPaye: sum('paye'),
          totalUifEmployee: sum('uifEmployee'),
          totalPensionEmployee: sum('pensionEmployee'),
          totalMedicalAidEmployee: sum('medicalAidEmployee'),
          totalOtherDeductions: sum('otherDeductions'),
          totalDeductions: sum('totalDeductions'),
          totalNetPay: sum('netPay'),
          totalUifEmployer: sum('uifEmployer'),
          totalSdlEmployer: sum('sdlEmployer'),
          totalPensionEmployer: sum('pensionEmployer'),
          totalMedicalAidEmployer: sum('medicalAidEmployer'),
          totalEmployerContributions: sum('employerTotal'),
          calculatedAt: new Date(),
          calculationVersion: PAYROLL_CALCULATION_VERSION,
          calculationSnapshot: {
            version: PAYROLL_CALCULATION_VERSION,
            periodMonth: item.periodMonth,
            periodYear: item.periodYear,
            employeeCount: items.length,
            totalBasicSalary: sum('basicSalary'),
            totalOvertime: sum('overtime'),
            totalBonus: sum('bonus'),
            totalCommission: sum('commission'),
            totalAllowances: sum('allowances'),
            totalGrossPay: sum('grossPay'),
            totalPaye: sum('paye'),
            totalUifEmployee: sum('uifEmployee'),
            totalDeductions: sum('totalDeductions'),
            totalNetPay: sum('netPay'),
            totalEmployerContributions: sum('employerTotal'),
          },
        },
      });

      await transaction.payrollTimelineEvent.create({
        data: {
          organisationId: user.organisationId,
          payrollRunId,
          actorUserId: user.id,
          eventType: 'PAYROLL_INPUTS_UPDATED',
          title: 'Variable payroll inputs updated',
          message: `${item.employee.firstName} ${item.employee.lastName}'s variable earnings and deductions were recalculated.`,
          metadata: {
            employeeId: item.employeeId,
            payrollRunItemId: item.id,
            overtime: calculation.earnings.overtime,
            bonus: calculation.earnings.bonus,
            commission: calculation.earnings.commission,
            allowances: calculation.earnings.allowances,
            otherDeductions: calculation.deductions.otherDeductions,
          },
        },
      });

      await transaction.auditLog.create({
        data: {
          organisationId: user.organisationId,
          actorUserId: user.id,
          action: AuditAction.UPDATE,
          entity: 'PayrollRunItem',
          entityId: item.id,
          message: 'Variable payroll inputs updated and payroll recalculated.',
          metadata: {
            payrollRunId,
            employeeId: item.employeeId,
            before: {
              overtime: toNumber(item.overtime),
              bonus: toNumber(item.bonus),
              commission: toNumber(item.commission),
              allowances: toNumber(item.allowances),
              otherDeductions: toNumber(item.otherDeductions),
              notes: item.notes,
            },
            after: {
              overtime: calculation.earnings.overtime,
              bonus: calculation.earnings.bonus,
              commission: calculation.earnings.commission,
              allowances: calculation.earnings.allowances,
              otherDeductions: calculation.deductions.otherDeductions,
              notes: clean(dto.notes) ?? item.notes,
            },
          },
        },
      });
    });

    return {
      message:
        'Variable payroll inputs saved and statutory deductions recalculated.',
      payrollRun: await this.getPayrollRun(user, payrollRunId),
    };
  }

  async generatePayrollRunPayslips(user: CurrentUser, payrollRunId: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: {
        id: payrollRunId,
        organisationId: user.organisationId,
      },
      include: {
        items: {
          include: {
            employee: {
              select: {
                firstName: true,
                lastName: true,
                employeeNumber: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!run) {
      throw new NotFoundException('Payroll run not found.');
    }

    if (
      run.status !== PayrollRunStatus.COMPLETED &&
      run.status !== PayrollRunStatus.FINALISED
    ) {
      throw new BadRequestException(
        'Payslips can only be generated after payroll payments have been completed.',
      );
    }

    if (run.items.length === 0) {
      throw new BadRequestException('This payroll run has no employee items.');
    }

    let generated = 0;
    let published = 0;
    let skipped = 0;
    const failures: Array<{
      employeeId: string;
      employeeName: string;
      message: string;
    }> = [];

    for (const item of run.items) {
      const employeeName = `${item.employee.firstName} ${item.employee.lastName}`;

      if (item.payslipDocumentId) {
        try {
          const result = await this.prisma.employeeDocument.updateMany({
            where: {
              id: item.payslipDocumentId,
              organisationId: user.organisationId,
              employeeId: item.employeeId,
            },
            data: { visibleToEmployee: true },
          });
          if (result.count > 0) {
            published += 1;
          } else {
            skipped += 1;
          }
        } catch (error) {
          failures.push({
            employeeId: item.employeeId,
            employeeName,
            message:
              error instanceof Error ? error.message : 'Publication failed.',
          });
        }
        continue;
      }

      const grossPay = toNumber(item.grossPay);
      const uifEmployee = toNumber(item.uifEmployee);
      const uifEmployer = toNumber(item.uifEmployer);
      try {
        const result = await this.payrollService.savePayslip(user, {
          employeeId: item.employeeId,
          periodMonth: run.periodMonth,
          periodYear: run.periodYear,
          basicSalary: toNumber(item.basicSalary),
          overtime: toNumber(item.overtime),
          bonus: toNumber(item.bonus),
          commission: toNumber(item.commission),
          allowances: toNumber(item.allowances),
          autoPaye: false,
          paye: toNumber(item.paye),
          pensionEmployee: toNumber(item.pensionEmployee),
          pensionEmployer: toNumber(item.pensionEmployer),
          medicalAidEmployee: toNumber(item.medicalAidEmployee),
          medicalAidEmployer: toNumber(item.medicalAidEmployer),
          otherDeductions: toNumber(item.otherDeductions),
          uifEmployeeRate: grossPay > 0 ? uifEmployee / grossPay : 0,
          uifEmployerRate: grossPay > 0 ? uifEmployer / grossPay : 0,
          uifMonthlyCap: Math.max(uifEmployee, uifEmployer),
          generatedBy: `${user.firstName} ${user.lastName}`,
          notes: `Generated from payroll run: ${run.title}`,
          visibleToEmployee: true,
          isConfidential: true,
        });

        await this.prisma.payrollRunItem.update({
          where: { id: item.id },
          data: { payslipDocumentId: result.document.id },
        });
        generated += 1;
      } catch (error) {
        failures.push({
          employeeId: item.employeeId,
          employeeName,
          message:
            error instanceof Error ? error.message : 'Generation failed.',
        });
      }
    }

    await this.prisma.payrollTimelineEvent.create({
      data: {
        organisationId: user.organisationId,
        payrollRunId: run.id,
        actorUserId: user.id,
        eventType: 'PAYSLIPS_GENERATED',
        title: 'Payroll payslips generated',
        message: `${generated} generated, ${published} published, ${skipped} skipped, ${failures.length} failed.`,
        metadata: {
          generated,
          published,
          skipped,
          failed: failures.length,
        },
      },
    });

    return {
      message:
        failures.length === 0
          ? 'Payroll payslips generated successfully.'
          : 'Payslip generation completed with some failures.',
      generated,
      published,
      skipped,
      failed: failures.length,
      failures,
      payrollRun: await this.getPayrollRun(user, run.id),
    };
  }

  async exportBankPaymentFile(user: CurrentUser, payrollRunId: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: {
        id: payrollRunId,
        organisationId: user.organisationId,
      },
      include: {
        items: {
          include: {
            employee: {
              include: { compensationProfile: true },
            },
          },
          orderBy: [
            { employee: { lastName: 'asc' } },
            { employee: { firstName: 'asc' } },
          ],
        },
      },
    });

    if (!run) {
      throw new NotFoundException('Payroll run not found.');
    }

    if (run.status !== PayrollRunStatus.CEO_APPROVED) {
      throw new BadRequestException(
        'The bank payment file can only be exported after CEO approval.',
      );
    }

    if (run.items.length === 0) {
      throw new BadRequestException('This payroll run has no payment items.');
    }

    const validationErrors: string[] = [];
    const accountOwners = new Map<string, string[]>();

    for (const item of run.items) {
      const employeeName = `${item.employee.firstName} ${item.employee.lastName}`;
      const profile = item.employee.compensationProfile;

      if (!profile?.bankName?.trim()) {
        validationErrors.push(`${employeeName}: bank name is missing.`);
      }
      if (!profile?.bankAccountNumber?.trim()) {
        validationErrors.push(
          `${employeeName}: bank account number is missing.`,
        );
      }
      if (!profile?.paymentReference?.trim()) {
        validationErrors.push(`${employeeName}: payment reference is missing.`);
      }
      if (toNumber(item.netPay) <= 0) {
        validationErrors.push(
          `${employeeName}: net pay must be greater than zero.`,
        );
      }

      const normalisedAccount = profile?.bankAccountNumber
        ?.replace(/\s+/g, '')
        .toLowerCase();
      if (normalisedAccount) {
        accountOwners.set(normalisedAccount, [
          ...(accountOwners.get(normalisedAccount) ?? []),
          employeeName,
        ]);
      }
    }

    for (const owners of accountOwners.values()) {
      if (owners.length > 1) {
        validationErrors.push(
          `Duplicate bank account detected for ${owners.join(' and ')}.`,
        );
      }
    }

    if (validationErrors.length > 0) {
      throw new BadRequestException({
        message: 'Bank payment validation failed.',
        errors: validationErrors,
      });
    }

    const header = [
      'Employee Number',
      'Employee Name',
      'Bank Name',
      'Account Number',
      'Payment Reference',
      'Amount',
      'Currency',
      'Payroll Period',
    ];
    const rows = run.items.map((item) => {
      const profile = item.employee.compensationProfile!;
      return [
        item.employee.employeeNumber,
        `${item.employee.firstName} ${item.employee.lastName}`,
        profile.bankName,
        profile.bankAccountNumber,
        profile.paymentReference,
        toNumber(item.netPay).toFixed(2),
        'ZAR',
        `${run.periodYear}-${String(run.periodMonth).padStart(2, '0')}`,
      ];
    });
    const content = `\uFEFF${[header, ...rows]
      .map((row) => row.map(csvCell).join(','))
      .join('\r\n')}\r\n`;
    const totalAmount = money(
      run.items.reduce((total, item) => total + toNumber(item.netPay), 0),
    );

    await this.prisma.$transaction([
      this.prisma.payrollTimelineEvent.create({
        data: {
          organisationId: user.organisationId,
          payrollRunId: run.id,
          actorUserId: user.id,
          eventType: 'PAYROLL_BANK_FILE_EXPORTED',
          title: 'Bank payment file exported',
          message: `${run.items.length} payments exported with a total of ZAR ${totalAmount.toFixed(2)}.`,
          metadata: {
            paymentCount: run.items.length,
            totalAmount,
            currency: 'ZAR',
          },
        },
      }),
      this.prisma.auditLog.create({
        data: {
          organisationId: user.organisationId,
          actorUserId: user.id,
          action: AuditAction.CREATE,
          entity: 'PayrollBankExport',
          entityId: run.id,
          message: 'Payroll bank payment file exported.',
          metadata: {
            payrollRunId: run.id,
            paymentCount: run.items.length,
            totalAmount,
            currency: 'ZAR',
          },
        },
      }),
    ]);

    return {
      fileName: `payroll-payments-${run.periodYear}-${String(
        run.periodMonth,
      ).padStart(2, '0')}.csv`,
      content,
    };
  }

  async finalisePayrollRun(user: CurrentUser, payrollRunId: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: {
        id: payrollRunId,
        organisationId: user.organisationId,
      },
      include: {
        items: {
          select: { payslipDocumentId: true },
        },
        _count: {
          select: {
            items: true,
          },
        },
      },
    });

    if (!run) {
      throw new NotFoundException('Payroll run not found.');
    }

    if (run.status !== PayrollRunStatus.COMPLETED) {
      throw new BadRequestException(
        'Only a completed payroll run can be finalised.',
      );
    }

    if (run._count.items === 0) {
      throw new BadRequestException(
        'A payroll run with no employee items cannot be finalised.',
      );
    }

    const missingPayslipCount = run.items.filter(
      (item) => !item.payslipDocumentId,
    ).length;

    if (missingPayslipCount > 0) {
      throw new BadRequestException(
        `Generate all payslips before finalising payroll. ${missingPayslipCount} payslip${
          missingPayslipCount === 1 ? ' is' : 's are'
        } still missing.`,
      );
    }

    const finalisedAt = new Date();
    const payslipDocumentIds = run.items
      .map((item) => item.payslipDocumentId)
      .filter((id): id is string => Boolean(id));

    const updatedRun = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.payrollRun.update({
        where: { id: run.id },
        data: {
          status: PayrollRunStatus.FINALISED,
          finalisedByUserId: user.id,
          finalisedAt,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          finalisedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          _count: { select: { items: true } },
        },
      });

      await transaction.employeeDocument.updateMany({
        where: {
          id: { in: payslipDocumentIds },
          organisationId: user.organisationId,
        },
        data: { visibleToEmployee: true },
      });

      await transaction.payrollTimelineEvent.create({
        data: {
          organisationId: user.organisationId,
          payrollRunId: run.id,
          actorUserId: user.id,
          eventType: 'PAYROLL_FINALISED',
          title: 'Payroll finalised',
          message: 'Payroll run finalised, locked and payslips published.',
          metadata: {
            previousStatus: PayrollRunStatus.COMPLETED,
            nextStatus: PayrollRunStatus.FINALISED,
            finalisedAt: finalisedAt.toISOString(),
            payslipCount: payslipDocumentIds.length,
          },
        },
      });

      await transaction.auditLog.create({
        data: {
          organisationId: user.organisationId,
          actorUserId: user.id,
          action: AuditAction.UPDATE,
          entity: 'PayrollRun',
          entityId: run.id,
          message: 'Payroll run finalised and locked.',
          metadata: {
            payrollRunId: run.id,
            title: run.title,
            periodMonth: run.periodMonth,
            periodYear: run.periodYear,
            itemCount: run._count.items,
            payslipCount: payslipDocumentIds.length,
          },
        },
      });

      return updated;
    });

    return {
      message: 'Payroll run finalised.',
      payrollRun: this.mapPayrollRun(updatedRun),
    };
  }

  async cancelPayrollRun(user: CurrentUser, payrollRunId: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: {
        id: payrollRunId,
        organisationId: user.organisationId,
      },
    });

    if (!run) {
      throw new NotFoundException('Payroll run not found.');
    }

    if (run.status === PayrollRunStatus.FINALISED) {
      throw new BadRequestException(
        'Finalised payroll runs cannot be cancelled.',
      );
    }

    const updatedRun = await this.prisma.payrollRun.update({
      where: {
        id: run.id,
      },
      data: {
        status: PayrollRunStatus.CANCELLED,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        finalisedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        _count: {
          select: {
            items: true,
          },
        },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organisationId: user.organisationId,
        actorUserId: user.id,
        action: AuditAction.UPDATE,
        entity: 'PayrollRun',
        entityId: run.id,
        message: 'Payroll run cancelled.',
        metadata: {
          payrollRunId: run.id,
          title: run.title,
          periodMonth: run.periodMonth,
          periodYear: run.periodYear,
        },
      },
    });

    return {
      message: 'Payroll run cancelled.',
      payrollRun: this.mapPayrollRun(updatedRun),
    };
  }

  async deletePayrollRun(user: CurrentUser, payrollRunId: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: {
        id: payrollRunId,
        organisationId: user.organisationId,
      },
      include: {
        _count: {
          select: {
            items: true,
          },
        },
      },
    });

    if (!run) {
      throw new NotFoundException('Payroll run not found.');
    }

    if (run.status !== PayrollRunStatus.DRAFT) {
      throw new BadRequestException('Only draft payroll runs can be deleted.');
    }

    await this.prisma.payrollRun.delete({
      where: {
        id: run.id,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organisationId: user.organisationId,
        actorUserId: user.id,
        action: AuditAction.DELETE,
        entity: 'PayrollRun',
        entityId: run.id,
        message: 'Payroll run deleted.',
        metadata: {
          payrollRunId: run.id,
          title: run.title,
          periodMonth: run.periodMonth,
          periodYear: run.periodYear,
          itemCount: run._count.items,
        },
      },
    });

    return {
      message: 'Payroll run deleted.',
    };
  }

  private mapPayrollRun(run: any, includeItems = false) {
    const mapped: any = {
      id: run.id,
      organisationId: run.organisationId,
      title: run.title,
      periodMonth: run.periodMonth,
      periodYear: run.periodYear,
      status: run.status,

      employeeCount: run.employeeCount,
      itemCount: run._count?.items ?? run.items?.length ?? 0,

      totalBasicSalary: toNumber(run.totalBasicSalary),
      totalOvertime: toNumber(run.totalOvertime),
      totalBonus: toNumber(run.totalBonus),
      totalCommission: toNumber(run.totalCommission),
      totalAllowances: toNumber(run.totalAllowances),
      totalGrossPay: toNumber(run.totalGrossPay),

      totalPaye: toNumber(run.totalPaye),
      totalUifEmployee: toNumber(run.totalUifEmployee),
      totalPensionEmployee: toNumber(run.totalPensionEmployee),
      totalMedicalAidEmployee: toNumber(run.totalMedicalAidEmployee),
      totalOtherDeductions: toNumber(run.totalOtherDeductions),
      totalDeductions: toNumber(run.totalDeductions),
      totalNetPay: toNumber(run.totalNetPay),

      totalUifEmployer: toNumber(run.totalUifEmployer),
      totalSdlEmployer: toNumber(run.totalSdlEmployer),
      totalPensionEmployer: toNumber(run.totalPensionEmployer),
      totalMedicalAidEmployer: toNumber(run.totalMedicalAidEmployer),
      totalEmployerContributions: toNumber(run.totalEmployerContributions),

      notes: run.notes,
      calculatedAt: run.calculatedAt,
      lockedAt: run.lockedAt,
      lockedByUserId: run.lockedByUserId,
      lockReason: run.lockReason,
      calculationVersion: run.calculationVersion,
      createdByUserId: run.createdByUserId,
      finalisedByUserId: run.finalisedByUserId,
      finalisedAt: run.finalisedAt,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
      createdBy: run.createdBy ?? null,
      finalisedBy: run.finalisedBy ?? null,
    };

    if (includeItems) {
      mapped.items = (run.items ?? []).map((item: any) => ({
        id: item.id,
        organisationId: item.organisationId,
        payrollRunId: item.payrollRunId,
        employeeId: item.employeeId,
        periodMonth: item.periodMonth,
        periodYear: item.periodYear,

        basicSalary: toNumber(item.basicSalary),
        overtime: toNumber(item.overtime),
        bonus: toNumber(item.bonus),
        commission: toNumber(item.commission),
        allowances: toNumber(item.allowances),
        grossPay: toNumber(item.grossPay),

        paye: toNumber(item.paye),
        uifEmployee: toNumber(item.uifEmployee),
        pensionEmployee: toNumber(item.pensionEmployee),
        medicalAidEmployee: toNumber(item.medicalAidEmployee),
        otherDeductions: toNumber(item.otherDeductions),
        totalDeductions: toNumber(item.totalDeductions),
        netPay: toNumber(item.netPay),

        uifEmployer: toNumber(item.uifEmployer),
        sdlEmployer: toNumber(item.sdlEmployer),
        pensionEmployer: toNumber(item.pensionEmployer),
        medicalAidEmployer: toNumber(item.medicalAidEmployer),
        employerTotal: toNumber(item.employerTotal),

        payeMode: item.payeMode,
        payeTaxYear: item.payeTaxYear,
        payeAnnualTaxableIncome: toNumber(item.payeAnnualTaxableIncome),
        payeAnnualTaxBeforeRebate: toNumber(item.payeAnnualTaxBeforeRebate),
        payeAnnualRebate: toNumber(item.payeAnnualRebate),
        payeAnnualMedicalCredit: toNumber(item.payeAnnualMedicalCredit),
        payeAnnualTaxAfterRebate: toNumber(item.payeAnnualTaxAfterRebate),
        payeRegularTaxableIncome: toNumber(
          item.payeRegularTaxableIncome,
        ),
        payeRegularTaxableIncomeYtd: toNumber(
          item.payeRegularTaxableIncomeYtd,
        ),
        payeAnnualPaymentsYtd: toNumber(item.payeAnnualPaymentsYtd),
        payeYtdBeforeCurrent: toNumber(item.payeYtdBeforeCurrent),
        payeCumulativeLiability: toNumber(
          item.payeCumulativeLiability,
        ),
        payeAnnualPaymentTax: toNumber(item.payeAnnualPaymentTax),
        payePeriodsWorked: item.payePeriodsWorked,
        allowableRetirementDeduction: toNumber(
          item.allowableRetirementDeduction,
        ),

        payslipDocumentId: item.payslipDocumentId,
        notes: item.notes,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        employee: item.employee ?? null,
      }));
    }

    return mapped;
  }
}
