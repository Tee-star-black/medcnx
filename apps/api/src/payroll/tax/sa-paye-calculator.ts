type TaxBracket = {
  min: number;
  max: number | null;
  baseTax: number;
  rate: number;
};

type TaxYearRule = {
  taxYear: number;
  startDate: string;
  endDate: string;
  primaryRebate: number;
  secondaryRebate: number;
  tertiaryRebate: number;
  medicalCreditFirstTwo: number;
  medicalCreditAdditional: number;
  brackets: TaxBracket[];
};

export type PayeCalculationInput = {
  monthlyTaxableIncome: number;
  periodMonth: number;
  periodYear: number;
  dateOfBirth?: string | Date | null;
  medicalSchemeMembers?: number;
  regularTaxableIncomeYtd?: number;
  annualPaymentsYtd?: number;
  payeYtdBeforeCurrent?: number;
  periodsWorkedIncludingCurrent?: number;
};

export type PayeCalculationResult = {
  paye: number;
  annualTaxableIncome: number;
  annualTaxBeforeRebate: number;
  annualRebate: number;
  annualMedicalSchemeFeesTaxCredit: number;
  annualTaxAfterRebate: number;
  monthlyTax: number;
  regularTaxableIncomeYtd: number;
  annualPaymentsYtd: number;
  payeYtdBeforeCurrent: number;
  cumulativePayeLiability: number;
  annualPaymentTax: number;
  periodsWorkedIncludingCurrent: number;
  ageAtTaxYearEnd: number | null;
  medicalSchemeMembers: number;
  taxYear: number;
  taxYearStartDate: string;
  taxYearEndDate: string;
  method: 'AUTO_SARS_ANNUALISED';
};

const taxYearRules: TaxYearRule[] = [
  {
    taxYear: 2027,
    startDate: '2026-03-01',
    endDate: '2027-02-28',
    primaryRebate: 17820,
    secondaryRebate: 9765,
    tertiaryRebate: 3249,
    medicalCreditFirstTwo: 376,
    medicalCreditAdditional: 254,
    brackets: [
      {
        min: 0,
        max: 245100,
        baseTax: 0,
        rate: 0.18,
      },
      {
        min: 245101,
        max: 383100,
        baseTax: 44118,
        rate: 0.26,
      },
      {
        min: 383101,
        max: 530200,
        baseTax: 79998,
        rate: 0.31,
      },
      {
        min: 530201,
        max: 695800,
        baseTax: 125599,
        rate: 0.36,
      },
      {
        min: 695801,
        max: 887000,
        baseTax: 185215,
        rate: 0.39,
      },
      {
        min: 887001,
        max: 1878600,
        baseTax: 259783,
        rate: 0.41,
      },
      {
        min: 1878601,
        max: null,
        baseTax: 666339,
        rate: 0.45,
      },
    ],
  },
  {
    taxYear: 2026,
    startDate: '2025-03-01',
    endDate: '2026-02-28',
    primaryRebate: 17235,
    secondaryRebate: 9444,
    tertiaryRebate: 3145,
    medicalCreditFirstTwo: 364,
    medicalCreditAdditional: 246,
    brackets: [
      {
        min: 0,
        max: 237100,
        baseTax: 0,
        rate: 0.18,
      },
      {
        min: 237101,
        max: 370500,
        baseTax: 42678,
        rate: 0.26,
      },
      {
        min: 370501,
        max: 512800,
        baseTax: 77362,
        rate: 0.31,
      },
      {
        min: 512801,
        max: 673000,
        baseTax: 121475,
        rate: 0.36,
      },
      {
        min: 673001,
        max: 857900,
        baseTax: 179147,
        rate: 0.39,
      },
      {
        min: 857901,
        max: 1817000,
        baseTax: 251258,
        rate: 0.41,
      },
      {
        min: 1817001,
        max: null,
        baseTax: 644489,
        rate: 0.45,
      },
    ],
  },
];

function money(value: number) {
  return Number(value.toFixed(2));
}

function getPeriodDate(periodMonth: number, periodYear: number) {
  return new Date(Date.UTC(periodYear, periodMonth - 1, 1));
}

function getRuleForPeriod(periodMonth: number, periodYear: number) {
  const periodDate = getPeriodDate(periodMonth, periodYear);

  const rule = taxYearRules.find((item) => {
    const startDate = new Date(`${item.startDate}T00:00:00.000Z`);
    const endDate = new Date(`${item.endDate}T23:59:59.999Z`);

    return periodDate >= startDate && periodDate <= endDate;
  });

  if (!rule) {
    throw new RangeError(
      `No South African payroll tax rules are configured for ${periodYear}-${String(
        periodMonth,
      ).padStart(2, '0')}.`,
    );
  }

  return rule;
}

function ageOnDate(dateOfBirth: string | Date | null | undefined, onDate: string) {
  if (!dateOfBirth) return null;

  const birthDate =
    dateOfBirth instanceof Date ? dateOfBirth : new Date(dateOfBirth);
  const effectiveDate = new Date(`${onDate}T00:00:00.000Z`);

  if (Number.isNaN(birthDate.getTime()) || birthDate > effectiveDate) {
    return null;
  }

  let age = effectiveDate.getUTCFullYear() - birthDate.getUTCFullYear();
  const birthdayHasPassed =
    effectiveDate.getUTCMonth() > birthDate.getUTCMonth() ||
    (effectiveDate.getUTCMonth() === birthDate.getUTCMonth() &&
      effectiveDate.getUTCDate() >= birthDate.getUTCDate());

  if (!birthdayHasPassed) age -= 1;
  return age;
}

function calculateAnnualRebate(rule: TaxYearRule, age: number | null) {
  let rebate = rule.primaryRebate;
  if (age !== null && age >= 65) rebate += rule.secondaryRebate;
  if (age !== null && age >= 75) rebate += rule.tertiaryRebate;
  return rebate;
}

function calculateMonthlyMedicalCredit(rule: TaxYearRule, members: number) {
  if (members <= 0) return 0;
  const firstTwo = Math.min(members, 2) * rule.medicalCreditFirstTwo;
  const additional =
    Math.max(0, members - 2) * rule.medicalCreditAdditional;
  return firstTwo + additional;
}

function calculateAnnualTaxBeforeRebate(
  annualTaxableIncome: number,
  brackets: TaxBracket[],
) {
  const bracket = brackets.find((item) => {
    const aboveMinimum = annualTaxableIncome >= item.min;
    const belowMaximum =
      item.max === null ? true : annualTaxableIncome <= item.max;

    return aboveMinimum && belowMaximum;
  });

  if (!bracket) {
    return 0;
  }

  const taxableAboveBracketMinimum =
    bracket.min <= 1 ? annualTaxableIncome : annualTaxableIncome - bracket.min + 1;

  return bracket.baseTax + taxableAboveBracketMinimum * bracket.rate;
}

function calculateAnnualTaxAfterCredits({
  annualTaxableIncome,
  rule,
  annualRebate,
  annualMedicalSchemeFeesTaxCredit,
}: {
  annualTaxableIncome: number;
  rule: TaxYearRule;
  annualRebate: number;
  annualMedicalSchemeFeesTaxCredit: number;
}) {
  return Math.max(
    0,
    calculateAnnualTaxBeforeRebate(annualTaxableIncome, rule.brackets) -
      annualRebate -
      annualMedicalSchemeFeesTaxCredit,
  );
}

export function calculateSouthAfricanPaye(
  input: PayeCalculationInput,
): PayeCalculationResult {
  const monthlyTaxableIncome = Math.max(0, input.monthlyTaxableIncome);
  const rule = getRuleForPeriod(input.periodMonth, input.periodYear);
  const ageAtTaxYearEnd = ageOnDate(input.dateOfBirth, rule.endDate);
  const medicalSchemeMembers = Math.max(
    0,
    Math.trunc(input.medicalSchemeMembers ?? 0),
  );

  const annualRebate = calculateAnnualRebate(rule, ageAtTaxYearEnd);
  const annualMedicalSchemeFeesTaxCredit = money(
    calculateMonthlyMedicalCredit(rule, medicalSchemeMembers) * 12,
  );
  const periodsWorkedIncludingCurrent = Math.min(
    12,
    Math.max(1, Math.trunc(input.periodsWorkedIncludingCurrent ?? 1)),
  );
  const regularTaxableIncomeYtd = money(
    Math.max(
      0,
      input.regularTaxableIncomeYtd ?? monthlyTaxableIncome,
    ),
  );
  const annualPaymentsYtd = money(
    Math.max(0, input.annualPaymentsYtd ?? 0),
  );
  const payeYtdBeforeCurrent = money(
    Math.max(0, input.payeYtdBeforeCurrent ?? 0),
  );
  const annualTaxableIncome = money(
    (regularTaxableIncomeYtd / periodsWorkedIncludingCurrent) * 12,
  );
  const annualTaxBeforeRebate = money(
    calculateAnnualTaxBeforeRebate(annualTaxableIncome, rule.brackets),
  );
  const annualTaxAfterRebate = money(
    calculateAnnualTaxAfterCredits({
      annualTaxableIncome,
      rule,
      annualRebate,
      annualMedicalSchemeFeesTaxCredit,
    }),
  );
  const regularPayeLiabilityYtd = money(
    annualTaxAfterRebate * (periodsWorkedIncludingCurrent / 12),
  );
  const annualPaymentTax = money(
    Math.max(
      0,
      calculateAnnualTaxBeforeRebate(
        annualTaxableIncome + annualPaymentsYtd,
        rule.brackets,
      ) - annualTaxBeforeRebate,
    ),
  );
  const cumulativePayeLiability = money(
    regularPayeLiabilityYtd + annualPaymentTax,
  );

  const monthlyTax = money(
    Math.max(0, cumulativePayeLiability - payeYtdBeforeCurrent),
  );

  return {
    paye: monthlyTax,
    annualTaxableIncome,
    annualTaxBeforeRebate,
    annualRebate,
    annualMedicalSchemeFeesTaxCredit,
    annualTaxAfterRebate,
    monthlyTax,
    regularTaxableIncomeYtd,
    annualPaymentsYtd,
    payeYtdBeforeCurrent,
    cumulativePayeLiability,
    annualPaymentTax,
    periodsWorkedIncludingCurrent,
    ageAtTaxYearEnd,
    medicalSchemeMembers,
    taxYear: rule.taxYear,
    taxYearStartDate: rule.startDate,
    taxYearEndDate: rule.endDate,
    method: 'AUTO_SARS_ANNUALISED',
  };
}
