import { PayrollService } from './payroll.service';

describe('PayrollService calculations', () => {
  const service = new PayrollService({} as never);

  it('calculates PAYE and UIF automatically', () => {
    const result = service.calculate({
      employeeId: 'employee-1',
      periodMonth: 7,
      periodYear: 2026,
      basicSalary: 30000,
      autoPaye: true,
    });

    expect(result.earnings.grossPay).toBe(30000);
    expect(result.deductions.paye).toBeGreaterThan(0);
    expect(result.deductions.uifEmployee).toBe(177.12);
    expect(result.employerContributions.uifEmployer).toBe(177.12);
    expect(result.netPay).toBeLessThan(result.earnings.grossPay);
  });

  it('includes overtime, bonuses and allowances in gross pay', () => {
    const result = service.calculate({
      employeeId: 'employee-1',
      periodMonth: 7,
      periodYear: 2026,
      basicSalary: 30000,
      overtime: 5000,
      bonus: 2500,
      allowances: 1500,
      autoPaye: true,
    });

    expect(result.earnings.grossPay).toBe(39000);
  });

  it('uses manual PAYE only when automatic PAYE is disabled', () => {
    const result = service.calculate({
      employeeId: 'employee-1',
      periodMonth: 7,
      periodYear: 2026,
      basicSalary: 30000,
      autoPaye: false,
      paye: 4200,
    });

    expect(result.deductions.paye).toBe(4200);
    expect(result.calculationSettings.payeMode).toBe('MANUAL_PHASE_1');
  });

  it('adds SDL only when the employer is liable for the levy', () => {
    const liable = service.calculate({
      employeeId: 'employee-1',
      periodMonth: 7,
      periodYear: 2026,
      basicSalary: 30000,
      autoPaye: true,
      sdlEmployerRate: 0.01,
    });
    const exempt = service.calculate({
      employeeId: 'employee-1',
      periodMonth: 7,
      periodYear: 2026,
      basicSalary: 30000,
      autoPaye: true,
      sdlEmployerRate: 0,
    });

    expect(liable.employerContributions.sdlEmployer).toBe(300);
    expect(exempt.employerContributions.sdlEmployer).toBe(0);
  });

  it('limits retirement deductions to 27.5% of remuneration', () => {
    const result = service.calculate({
      employeeId: 'employee-1',
      periodMonth: 7,
      periodYear: 2026,
      basicSalary: 30000,
      pensionEmployee: 12000,
      autoPaye: true,
    });

    expect(
      result.calculationSettings.allowableRetirementDeduction,
    ).toBe(8250);
    expect(result.calculationSettings.regularTaxableIncome).toBe(21750);
  });

  it('applies a valid fixed-percentage directive before deductions', () => {
    const result = service.calculate({
      employeeId: 'employee-1',
      periodMonth: 7,
      periodYear: 2026,
      basicSalary: 30000,
      autoPaye: true,
      taxDirectiveMode: 'FIXED_PERCENTAGE',
      taxDirectiveValue: 20,
    });

    expect(result.deductions.paye).toBe(6000);
    expect(result.calculationSettings.payeMode).toBe(
      'TAX_DIRECTIVE_FIXED_PERCENTAGE',
    );
  });
});
