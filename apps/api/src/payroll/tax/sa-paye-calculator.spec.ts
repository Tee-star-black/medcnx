import { calculateSouthAfricanPaye } from './sa-paye-calculator';

describe('South African PAYE calculator', () => {
  it('uses the 2027 SARS brackets for periods from March 2026', () => {
    const result = calculateSouthAfricanPaye({
      monthlyTaxableIncome: 30000,
      periodMonth: 7,
      periodYear: 2026,
    });

    expect(result.taxYear).toBe(2027);
    expect(result.annualTaxBeforeRebate).toBe(73992);
    expect(result.annualRebate).toBe(17820);
    expect(result.paye).toBe(4681);
  });

  it('applies secondary and tertiary rebates using age at tax-year end', () => {
    const age65 = calculateSouthAfricanPaye({
      monthlyTaxableIncome: 30000,
      periodMonth: 7,
      periodYear: 2026,
      dateOfBirth: '1962-02-28',
    });
    const age75 = calculateSouthAfricanPaye({
      monthlyTaxableIncome: 30000,
      periodMonth: 7,
      periodYear: 2026,
      dateOfBirth: '1952-02-28',
    });

    expect(age65.ageAtTaxYearEnd).toBe(65);
    expect(age65.annualRebate).toBe(27585);
    expect(age75.ageAtTaxYearEnd).toBe(75);
    expect(age75.annualRebate).toBe(30834);
  });

  it('applies the monthly medical scheme fees tax credit', () => {
    const result = calculateSouthAfricanPaye({
      monthlyTaxableIncome: 30000,
      periodMonth: 7,
      periodYear: 2026,
      medicalSchemeMembers: 3,
    });

    expect(result.annualMedicalSchemeFeesTaxCredit).toBe(12072);
    expect(result.paye).toBe(3675);
  });

  it('refuses to guess when a tax year has not been configured', () => {
    expect(() =>
      calculateSouthAfricanPaye({
        monthlyTaxableIncome: 30000,
        periodMonth: 3,
        periodYear: 2027,
      }),
    ).toThrow('No South African payroll tax rules are configured');
  });

  it('taxes an annual bonus as an annual payment instead of recurring salary', () => {
    const result = calculateSouthAfricanPaye({
      monthlyTaxableIncome: 30000,
      regularTaxableIncomeYtd: 180000,
      annualPaymentsYtd: 120000,
      payeYtdBeforeCurrent: 23405,
      periodsWorkedIncludingCurrent: 6,
      periodMonth: 8,
      periodYear: 2026,
    });

    expect(result.annualTaxableIncome).toBe(360000);
    expect(result.annualPaymentTax).toBe(36045);
    expect(result.paye).toBe(40726);
  });

  it('deducts prior PAYE from cumulative YTD liability', () => {
    const result = calculateSouthAfricanPaye({
      monthlyTaxableIncome: 30000,
      regularTaxableIncomeYtd: 60000,
      payeYtdBeforeCurrent: 4681,
      periodsWorkedIncludingCurrent: 2,
      periodMonth: 4,
      periodYear: 2026,
    });

    expect(result.cumulativePayeLiability).toBe(9362);
    expect(result.paye).toBe(4681);
  });
});
