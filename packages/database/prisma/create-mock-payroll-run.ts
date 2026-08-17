import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import {
  PayrollRunStatus,
  PrismaClient,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

dotenv.config({
  path: fileURLToPath(
    new URL('../.env', import.meta.url),
  ),
});

const connectionString =
  process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is missing in packages/database/.env',
  );
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

type MockPayrollValues = {
  overtime: number;
  bonus: number;
  commission: number;
  allowances: number;
  pensionEmployee: number;
  pensionEmployer: number;
  medicalAidEmployee: number;
  medicalAidEmployer: number;
  otherDeductions: number;
};

const mockValuesByEmployeeNumber: Record<
  string,
  MockPayrollValues
> = {
  'MED-ADMIN-001': {
    overtime: 0,
    bonus: 5000,
    commission: 0,
    allowances: 2500,
    pensionEmployee: 4200,
    pensionEmployer: 4200,
    medicalAidEmployee: 1800,
    medicalAidEmployer: 1800,
    otherDeductions: 500,
  },

  'MED-0001': {
    overtime: 1800,
    bonus: 2500,
    commission: 0,
    allowances: 1200,
    pensionEmployee: 2940,
    pensionEmployer: 2940,
    medicalAidEmployee: 1400,
    medicalAidEmployer: 1400,
    otherDeductions: 250,
  },

  'MED-0002': {
    overtime: 0,
    bonus: 3500,
    commission: 1500,
    allowances: 1800,
    pensionEmployee: 3360,
    pensionEmployer: 3360,
    medicalAidEmployee: 1500,
    medicalAidEmployer: 1500,
    otherDeductions: 400,
  },

  'MED-0003': {
    overtime: 0,
    bonus: 10000,
    commission: 0,
    allowances: 5000,
    pensionEmployee: 6650,
    pensionEmployer: 6650,
    medicalAidEmployee: 2200,
    medicalAidEmployer: 2200,
    otherDeductions: 1000,
  },

  'MED-0004': {
    overtime: 3200,
    bonus: 1000,
    commission: 0,
    allowances: 900,
    pensionEmployee: 1995,
    pensionEmployer: 1995,
    medicalAidEmployee: 1100,
    medicalAidEmployer: 1100,
    otherDeductions: 150,
  },

  'MED-0005': {
    overtime: 950,
    bonus: 500,
    commission: 0,
    allowances: 600,
    pensionEmployee: 0,
    pensionEmployer: 0,
    medicalAidEmployee: 0,
    medicalAidEmployer: 0,
    otherDeductions: 100,
  },
};

function roundMoney(value: number) {
  return (
    Math.round(
      (value + Number.EPSILON) * 100,
    ) / 100
  );
}

function calculateMockPaye(
  grossPay: number,
) {
  if (grossPay <= 15000) {
    return roundMoney(
      grossPay * 0.08,
    );
  }

  if (grossPay <= 30000) {
    return roundMoney(
      grossPay * 0.14,
    );
  }

  if (grossPay <= 50000) {
    return roundMoney(
      grossPay * 0.21,
    );
  }

  if (grossPay <= 80000) {
    return roundMoney(
      grossPay * 0.28,
    );
  }

  return roundMoney(
    grossPay * 0.34,
  );
}

function calculateUif(
  amount: number,
) {
  return roundMoney(
    Math.min(
      amount * 0.01,
      177.12,
    ),
  );
}

async function main() {
  console.log(
    'Creating MedCNX mock payroll run...',
  );

  const organisation =
    await prisma.organisation.findUnique({
      where: {
        slug: 'medcnx-demo-clinic',
      },
    });

  if (!organisation) {
    throw new Error(
      'MedCNX Demo Clinic organisation was not found. Run the main seed first.',
    );
  }

  const adminUser =
    await prisma.user.findFirst({
      where: {
        organisationId:
          organisation.id,
        email:
          'admin@medcnx.local',
      },
    });

  if (!adminUser) {
    throw new Error(
      'Admin user was not found. Run the main seed before creating the mock payroll run.',
    );
  }

  const employees =
    await prisma.employee.findMany({
      where: {
        organisationId:
          organisation.id,
        employmentStatus:
          'ACTIVE',
        compensationProfile: {
          isNot: null,
        },
      },

      include: {
        compensationProfile: true,
        department: true,
      },

      orderBy: {
        employeeNumber: 'asc',
      },
    });

  if (employees.length === 0) {
    throw new Error(
      'No active employees with compensation profiles were found.',
    );
  }

  const title =
    'July 2026 Mock Payroll Run';

  const payrollRun =
    await prisma.payrollRun.upsert({
      where: {
        organisationId_periodMonth_periodYear_title:
          {
            organisationId:
              organisation.id,
            periodMonth: 7,
            periodYear: 2026,
            title,
          },
      },

      update: {
        status:
          PayrollRunStatus.CALCULATED,

        notes:
          'Demonstration payroll run with mock salary, allowance, deduction and contribution values.',

        createdByUserId:
          adminUser.id,

        finalisedByUserId: null,
        finalisedAt: null,
      },

      create: {
        organisationId:
          organisation.id,

        title,
        periodMonth: 7,
        periodYear: 2026,

        status:
          PayrollRunStatus.CALCULATED,

        notes:
          'Demonstration payroll run with mock salary, allowance, deduction and contribution values.',

        createdByUserId:
          adminUser.id,
      },
    });

  await prisma.payrollRunItem.deleteMany({
    where: {
      payrollRunId:
        payrollRun.id,
    },
  });

  await prisma.payrollAudit.deleteMany({
    where: {
      payrollRunId:
        payrollRun.id,
    },
  });

  await prisma.payrollApproval.deleteMany({
    where: {
      payrollRunId:
        payrollRun.id,
    },
  });

  await prisma.payrollTimelineEvent.deleteMany(
    {
      where: {
        payrollRunId:
          payrollRun.id,
      },
    },
  );

  const totals = {
    employeeCount: 0,
    totalBasicSalary: 0,
    totalOvertime: 0,
    totalBonus: 0,
    totalCommission: 0,
    totalAllowances: 0,
    totalGrossPay: 0,
    totalPaye: 0,
    totalUifEmployee: 0,
    totalPensionEmployee: 0,
    totalMedicalAidEmployee: 0,
    totalOtherDeductions: 0,
    totalDeductions: 0,
    totalNetPay: 0,
    totalUifEmployer: 0,
    totalPensionEmployer: 0,
    totalMedicalAidEmployer: 0,
    totalEmployerContributions: 0,
  };

  for (const employee of employees) {
    const compensationProfile =
      employee.compensationProfile;

    if (!compensationProfile) {
      continue;
    }

    const basicSalary = Number(
      compensationProfile.basicSalary,
    );

    const mockValues =
      mockValuesByEmployeeNumber[
        employee.employeeNumber
      ] ?? {
        overtime: 0,
        bonus: 0,
        commission: 0,

        allowances: Number(
          compensationProfile.defaultAllowances,
        ),

        pensionEmployee: Number(
          compensationProfile.pensionEmployee,
        ),

        pensionEmployer: Number(
          compensationProfile.pensionEmployer,
        ),

        medicalAidEmployee: Number(
          compensationProfile.medicalAidEmployee,
        ),

        medicalAidEmployer: Number(
          compensationProfile.medicalAidEmployer,
        ),

        otherDeductions: Number(
          compensationProfile.defaultOtherDeductions,
        ),
      };

    const grossPay = roundMoney(
      basicSalary +
        mockValues.overtime +
        mockValues.bonus +
        mockValues.commission +
        mockValues.allowances,
    );

    const paye =
      compensationProfile.autoPaye
        ? calculateMockPaye(
            grossPay,
          )
        : 0;

    const uifEmployee =
      compensationProfile.uifEnabled
        ? calculateUif(
            grossPay,
          )
        : 0;

    const uifEmployer =
      compensationProfile.uifEnabled
        ? calculateUif(
            grossPay,
          )
        : 0;

    const totalDeductions =
      roundMoney(
        paye +
          uifEmployee +
          mockValues.pensionEmployee +
          mockValues.medicalAidEmployee +
          mockValues.otherDeductions,
      );

    const netPay = roundMoney(
      grossPay -
        totalDeductions,
    );

    const employerTotal =
      roundMoney(
        uifEmployer +
          mockValues.pensionEmployer +
          mockValues.medicalAidEmployer,
      );

    await prisma.payrollRunItem.create({
      data: {
        organisationId:
          organisation.id,

        payrollRunId:
          payrollRun.id,

        employeeId:
          employee.id,

        periodMonth: 7,
        periodYear: 2026,

        basicSalary,

        overtime:
          mockValues.overtime,

        bonus:
          mockValues.bonus,

        commission:
          mockValues.commission,

        allowances:
          mockValues.allowances,

        grossPay,

        paye,

        uifEmployee,

        pensionEmployee:
          mockValues.pensionEmployee,

        medicalAidEmployee:
          mockValues.medicalAidEmployee,

        otherDeductions:
          mockValues.otherDeductions,

        totalDeductions,
        netPay,

        uifEmployer,

        pensionEmployer:
          mockValues.pensionEmployer,

        medicalAidEmployer:
          mockValues.medicalAidEmployer,

        employerTotal,

        payeMode:
          'MOCK_DEMO',

        payeTaxYear: 2026,

        payeAnnualTaxableIncome:
          roundMoney(
            grossPay * 12,
          ),

        payeAnnualTaxBeforeRebate:
          roundMoney(
            paye * 12,
          ),

        payeAnnualTaxAfterRebate:
          roundMoney(
            paye * 12,
          ),

        notes: `Mock payroll values for ${employee.firstName} ${employee.lastName}.`,
      },
    });

    totals.employeeCount += 1;

    totals.totalBasicSalary +=
      basicSalary;

    totals.totalOvertime +=
      mockValues.overtime;

    totals.totalBonus +=
      mockValues.bonus;

    totals.totalCommission +=
      mockValues.commission;

    totals.totalAllowances +=
      mockValues.allowances;

    totals.totalGrossPay +=
      grossPay;

    totals.totalPaye +=
      paye;

    totals.totalUifEmployee +=
      uifEmployee;

    totals.totalPensionEmployee +=
      mockValues.pensionEmployee;

    totals.totalMedicalAidEmployee +=
      mockValues.medicalAidEmployee;

    totals.totalOtherDeductions +=
      mockValues.otherDeductions;

    totals.totalDeductions +=
      totalDeductions;

    totals.totalNetPay +=
      netPay;

    totals.totalUifEmployer +=
      uifEmployer;

    totals.totalPensionEmployer +=
      mockValues.pensionEmployer;

    totals.totalMedicalAidEmployer +=
      mockValues.medicalAidEmployer;

    totals.totalEmployerContributions +=
      employerTotal;

    console.log(
      `Added ${employee.employeeNumber} - ${employee.firstName} ${employee.lastName}: Gross R${grossPay.toFixed(
        2,
      )}, Net R${netPay.toFixed(
        2,
      )}`,
    );
  }

  const updatedRun =
    await prisma.payrollRun.update({
      where: {
        id: payrollRun.id,
      },

      data: {
        status:
          PayrollRunStatus.CALCULATED,

        employeeCount:
          totals.employeeCount,

        totalBasicSalary:
          roundMoney(
            totals.totalBasicSalary,
          ),

        totalOvertime:
          roundMoney(
            totals.totalOvertime,
          ),

        totalBonus:
          roundMoney(
            totals.totalBonus,
          ),

        totalCommission:
          roundMoney(
            totals.totalCommission,
          ),

        totalAllowances:
          roundMoney(
            totals.totalAllowances,
          ),

        totalGrossPay:
          roundMoney(
            totals.totalGrossPay,
          ),

        totalPaye:
          roundMoney(
            totals.totalPaye,
          ),

        totalUifEmployee:
          roundMoney(
            totals.totalUifEmployee,
          ),

        totalPensionEmployee:
          roundMoney(
            totals.totalPensionEmployee,
          ),

        totalMedicalAidEmployee:
          roundMoney(
            totals.totalMedicalAidEmployee,
          ),

        totalOtherDeductions:
          roundMoney(
            totals.totalOtherDeductions,
          ),

        totalDeductions:
          roundMoney(
            totals.totalDeductions,
          ),

        totalNetPay:
          roundMoney(
            totals.totalNetPay,
          ),

        totalUifEmployer:
          roundMoney(
            totals.totalUifEmployer,
          ),

        totalPensionEmployer:
          roundMoney(
            totals.totalPensionEmployer,
          ),

        totalMedicalAidEmployer:
          roundMoney(
            totals.totalMedicalAidEmployer,
          ),

        totalEmployerContributions:
          roundMoney(
            totals.totalEmployerContributions,
          ),
      },
    });

  await prisma.payrollTimelineEvent.create({
    data: {
      organisationId:
        organisation.id,

      payrollRunId:
        payrollRun.id,

      actorUserId:
        adminUser.id,

      eventType:
        'PAYROLL_RUN_CALCULATED',

      title:
        'Mock payroll calculated',

      message:
        'Mock employee payroll items and financial totals were added. The run is ready for payroll intelligence auditing.',

      metadata: {
        employeeCount:
          totals.employeeCount,

        totalGrossPay:
          roundMoney(
            totals.totalGrossPay,
          ),

        totalNetPay:
          roundMoney(
            totals.totalNetPay,
          ),

        status:
          PayrollRunStatus.CALCULATED,
      },
    },
  });

  console.log('');
  console.log(
    'Mock payroll run created successfully.',
  );

  console.log(
    `Payroll run ID: ${updatedRun.id}`,
  );

  console.log(
    `Title: ${updatedRun.title}`,
  );

  console.log(
    `Status: ${updatedRun.status}`,
  );

  console.log(
    `Employees: ${updatedRun.employeeCount}`,
  );

  console.log(
    `Gross pay: R${Number(
      updatedRun.totalGrossPay,
    ).toFixed(2)}`,
  );

  console.log(
    `Total deductions: R${Number(
      updatedRun.totalDeductions,
    ).toFixed(2)}`,
  );

  console.log(
    `Net pay: R${Number(
      updatedRun.totalNetPay,
    ).toFixed(2)}`,
  );

  console.log('');

  console.log(
    `Open: http://localhost:3000/dashboard/payroll/runs/${updatedRun.id}`,
  );

  console.log('');

  console.log(
    'The payroll run status is CALCULATED, so the Run intelligence button should now be available.',
  );

  console.log(
    'Important: these PAYE values are mock demonstration values and must not be used for real payroll processing.',
  );
}

main()
  .catch((error) => {
    console.error(
      'Mock payroll creation failed:',
      error,
    );

    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });