'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Calculator,
  ExternalLink,
  FileText,
  Loader2,
  Printer,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { api } from '@/lib/api';

type Employee = {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  jobTitle?: string | null;
  employmentStatus: string;
  department?: {
    id: string;
    name: string;
  } | null;
};

type PayslipCalculation = {
  employee: {
    id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    email?: string | null;
    jobTitle?: string | null;
    department?: {
      id: string;
      name: string;
    } | null;
  };
  period: {
    month: number;
    year: number;
  };
  earnings: {
    basicSalary: number;
    overtime: number;
    bonus: number;
    commission: number;
    allowances: number;
    grossPay: number;
  };
  deductions: {
    paye: number;
    uifEmployee: number;
    pensionEmployee: number;
    medicalAidEmployee: number;
    otherDeductions: number;
    totalDeductions: number;
  };
  employerContributions: {
    uifEmployer: number;
    pensionEmployer: number;
    medicalAidEmployer: number;
    total: number;
  };
  netPay: number;
  calculationSettings: {
    uifEmployeeRate: number;
    uifEmployerRate: number;
    uifMonthlyCap: number;
    payeMode: string;
    payeTaxYear?: number | null;
    payeTaxYearStartDate?: string | null;
    payeTaxYearEndDate?: string | null;
    payeAnnualTaxableIncome?: number | null;
    payeAnnualTaxBeforeRebate?: number | null;
    payeAnnualTaxAfterRebate?: number | null;
  };
};

type GeneratedPayslip = {
  documentType: 'PAYSLIP';
  title: string;
  employeeId: string;
  employeeName: string;
  periodMonth: number;
  periodYear: number;
  generatedAt: string;
  calculation: Omit<PayslipCalculation, 'employee' | 'period'>;
  html: string;
};

type SavedPayslipResponse = {
  message: string;
  document: {
    id: string;
    employeeId: string;
    title: string;
    category: string;
    originalName: string;
    mimeType: string;
    visibleToEmployee: boolean;
    isConfidential: boolean;
    createdAt: string;
  };
};

type CompensationProfileResponse = {
  employee: {
    id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    email?: string | null;
    jobTitle?: string | null;
    department?: {
      id: string;
      name: string;
    } | null;
  };
  profile: {
    id: string | null;
    organisationId: string;
    employeeId: string;
    paymentFrequency: string;
    basicSalary: number;
    autoPaye: boolean;
    uifEnabled: boolean;
    pensionEmployee: number;
    pensionEmployer: number;
    medicalAidEmployee: number;
    medicalAidEmployer: number;
    defaultAllowances: number;
    defaultOtherDeductions: number;
    bankName: string | null;
    bankAccountNumber: string | null;
    paymentReference: string | null;
    notes: string | null;
    createdAt: string | null;
    updatedAt: string | null;
  };
};

const months = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

function formatCurrency(value?: number | null) {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
  }).format(value ?? 0);
}

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function currentMonth() {
  return new Date().getMonth() + 1;
}

function currentYear() {
  return new Date().getFullYear();
}

function todayDateInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function employeeLabel(employee: Employee) {
  return `${employee.firstName} ${employee.lastName} · ${employee.employeeNumber}`;
}

function monthLabel(month: number) {
  return months.find((item) => item.value === month)?.label ?? `Month ${month}`;
}

function formatPayeMode(value?: string | null) {
  if (!value) {
    return 'Not calculated';
  }

  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => {
    return letter.toUpperCase();
  });
}

export default function PayrollRunPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');

  const [periodMonth, setPeriodMonth] = useState(currentMonth());
  const [periodYear, setPeriodYear] = useState(currentYear());
  const [paymentDate, setPaymentDate] = useState(todayDateInputValue());
  const [generatedBy, setGeneratedBy] = useState('HR Manager');
  const [notes, setNotes] = useState('');

  const [basicSalary, setBasicSalary] = useState('');
  const [overtime, setOvertime] = useState('');
  const [bonus, setBonus] = useState('');
  const [commission, setCommission] = useState('');
  const [allowances, setAllowances] = useState('');

  const [autoPaye, setAutoPaye] = useState(true);
  const [paye, setPaye] = useState('');

  const [pensionEmployee, setPensionEmployee] = useState('');
  const [pensionEmployer, setPensionEmployer] = useState('');
  const [medicalAidEmployee, setMedicalAidEmployee] = useState('');
  const [medicalAidEmployer, setMedicalAidEmployer] = useState('');
  const [otherDeductions, setOtherDeductions] = useState('');

  const [uifEmployeeRate, setUifEmployeeRate] = useState('0.01');
  const [uifEmployerRate, setUifEmployerRate] = useState('0.01');
  const [uifMonthlyCap, setUifMonthlyCap] = useState('177.12');

  const [visibleToEmployee, setVisibleToEmployee] = useState(true);
  const [isConfidential, setIsConfidential] = useState(true);

  const [loading, setLoading] = useState(true);
  const [loadingCompensationProfile, setLoadingCompensationProfile] =
    useState(false);
  const [compensationProfileLoaded, setCompensationProfileLoaded] =
    useState(false);
  const [compensationProfileMessage, setCompensationProfileMessage] =
    useState('');

  const [calculating, setCalculating] = useState(false);
  const [generatingPayslip, setGeneratingPayslip] = useState(false);
  const [savingPayslip, setSavingPayslip] = useState(false);

  const [calculation, setCalculation] = useState<PayslipCalculation | null>(
    null,
  );
  const [generatedPayslip, setGeneratedPayslip] =
    useState<GeneratedPayslip | null>(null);
  const [savedPayslip, setSavedPayslip] =
    useState<SavedPayslipResponse['document'] | null>(null);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    if (!employeeId) {
      return;
    }

    loadSelectedEmployeeCompensationProfile(employeeId);
  }, [employeeId]);

  const selectedEmployee = useMemo(() => {
    return employees.find((employee) => employee.id === employeeId) ?? null;
  }, [employees, employeeId]);

  const filteredEmployees = useMemo(() => {
    const query = employeeSearch.trim().toLowerCase();

    if (!query) {
      return employees;
    }

    return employees.filter((employee) => {
      const fullName =
        `${employee.firstName} ${employee.lastName}`.toLowerCase();

      return (
        fullName.includes(query) ||
        employee.employeeNumber.toLowerCase().includes(query) ||
        employee.email?.toLowerCase().includes(query) ||
        employee.jobTitle?.toLowerCase().includes(query) ||
        employee.department?.name.toLowerCase().includes(query)
      );
    });
  }, [employees, employeeSearch]);

  const grossPreview =
    toNumber(basicSalary) +
    toNumber(overtime) +
    toNumber(bonus) +
    toNumber(commission) +
    toNumber(allowances);

  const payrollPayload = {
    employeeId,
    periodMonth,
    periodYear,
    basicSalary: toNumber(basicSalary),
    overtime: toNumber(overtime),
    bonus: toNumber(bonus),
    commission: toNumber(commission),
    allowances: toNumber(allowances),
    paye: autoPaye ? undefined : toNumber(paye),
    autoPaye,
    pensionEmployee: toNumber(pensionEmployee),
    pensionEmployer: toNumber(pensionEmployer),
    medicalAidEmployee: toNumber(medicalAidEmployee),
    medicalAidEmployer: toNumber(medicalAidEmployer),
    otherDeductions: toNumber(otherDeductions),
    uifEmployeeRate: toNumber(uifEmployeeRate),
    uifEmployerRate: toNumber(uifEmployerRate),
    uifMonthlyCap: toNumber(uifMonthlyCap),
    paymentDate,
    generatedBy: generatedBy.trim() || undefined,
    notes: notes.trim() || undefined,
  };

  async function loadEmployees() {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await api.get<Employee[]>('/employees');

      setEmployees(response.data);

      if (response.data.length > 0) {
        setEmployeeId(response.data[0].id);
      }
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ?? 'Could not load employees.';

      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally {
      setLoading(false);
    }
  }

  async function loadSelectedEmployeeCompensationProfile(nextEmployeeId: string) {
    setLoadingCompensationProfile(true);
    setCompensationProfileLoaded(false);
    setCompensationProfileMessage('');

    try {
      const response = await api.get<CompensationProfileResponse>(
        `/payroll/employees/${nextEmployeeId}/compensation`,
      );

      const profile = response.data.profile;

      setBasicSalary(String(profile.basicSalary ?? 0));
      setAllowances(String(profile.defaultAllowances ?? 0));
      setPensionEmployee(String(profile.pensionEmployee ?? 0));
      setPensionEmployer(String(profile.pensionEmployer ?? 0));
      setMedicalAidEmployee(String(profile.medicalAidEmployee ?? 0));
      setMedicalAidEmployer(String(profile.medicalAidEmployer ?? 0));
      setOtherDeductions(String(profile.defaultOtherDeductions ?? 0));
      setAutoPaye(Boolean(profile.autoPaye));

      if (profile.uifEnabled) {
        setUifEmployeeRate('0.01');
        setUifEmployerRate('0.01');
        setUifMonthlyCap('177.12');
      } else {
        setUifEmployeeRate('0');
        setUifEmployerRate('0');
        setUifMonthlyCap('0');
      }

      if (profile.paymentReference) {
        setNotes((currentNotes) => {
          if (currentNotes.trim()) {
            return currentNotes;
          }

          return `Payment reference: ${profile.paymentReference}`;
        });
      }

      setPaye('');
      resetPayrollOutput();

      setCompensationProfileLoaded(Boolean(profile.id));
      setCompensationProfileMessage(
        profile.id
          ? 'Compensation profile loaded into payroll inputs.'
          : 'No saved compensation profile found. Default values were loaded.',
      );
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ??
        'Could not load compensation profile.';

      setCompensationProfileLoaded(false);
      setCompensationProfileMessage(
        Array.isArray(message) ? message.join(' ') : message,
      );
    } finally {
      setLoadingCompensationProfile(false);
    }
  }

  function clearGeneratedPayslip() {
    setGeneratedPayslip(null);
    setSavedPayslip(null);
  }

  function resetPayrollOutput() {
    setCalculation(null);
    clearGeneratedPayslip();
  }

  function validatePayrollInput() {
    if (!employeeId) {
      setError('Please choose an employee.');
      return false;
    }

    if (toNumber(basicSalary) <= 0) {
      setError('Basic salary must be greater than zero.');
      return false;
    }

    if (!autoPaye && toNumber(paye) < 0) {
      setError('Manual PAYE cannot be below zero.');
      return false;
    }

    return true;
  }

  async function calculatePayslip(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    setError('');
    setSuccess('');
    resetPayrollOutput();

    if (!validatePayrollInput()) {
      return;
    }

    setCalculating(true);

    try {
      const response = await api.post<PayslipCalculation>(
        '/payroll/calculate-payslip',
        payrollPayload,
      );

      setCalculation(response.data);
      setSuccess('Payslip calculated successfully.');
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ?? 'Could not calculate payslip.';

      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally {
      setCalculating(false);
    }
  }

  async function generatePayslip() {
    setError('');
    setSuccess('');
    clearGeneratedPayslip();

    if (!validatePayrollInput()) {
      return;
    }

    setGeneratingPayslip(true);

    try {
      const response = await api.post<GeneratedPayslip>(
        '/payroll/generate-payslip',
        payrollPayload,
      );

      setGeneratedPayslip(response.data);
      setSuccess('Payslip generated successfully.');
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ?? 'Could not generate payslip.';

      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally {
      setGeneratingPayslip(false);
    }
  }

  async function savePayslip() {
    setError('');
    setSuccess('');

    if (!generatedPayslip) {
      setError('Generate the payslip before saving.');
      return;
    }

    setSavingPayslip(true);

    try {
      const response = await api.post<SavedPayslipResponse>(
        '/payroll/generate-payslip/save',
        {
          ...payrollPayload,
          visibleToEmployee,
          isConfidential,
        },
      );

      setSavedPayslip(response.data.document);
      setSuccess(response.data.message);
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ?? 'Could not save payslip.';

      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally {
      setSavingPayslip(false);
    }
  }

  function openPayslip() {
    if (!generatedPayslip) {
      return;
    }

    const payslipWindow = window.open('', '_blank');

    if (!payslipWindow) {
      setError('Could not open payslip window. Please allow popups.');
      return;
    }

    payslipWindow.document.open();
    payslipWindow.document.write(generatedPayslip.html);
    payslipWindow.document.close();
  }

  function printPayslip() {
    if (!generatedPayslip) {
      return;
    }

    const payslipWindow = window.open('', '_blank');

    if (!payslipWindow) {
      setError('Could not open print window. Please allow popups.');
      return;
    }

    payslipWindow.document.open();
    payslipWindow.document.write(generatedPayslip.html);
    payslipWindow.document.close();

    payslipWindow.onload = () => {
      payslipWindow.focus();
      payslipWindow.print();
    };
  }

  return (
    <DashboardShell activePage="payroll">
      <div className="space-y-8">
        <section className="flex flex-col gap-5 border-b border-black/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              href="/dashboard/payroll"
              className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-black"
            >
              <ArrowLeft size={15} />
              Back to payroll
            </Link>

            <p className="mb-2 text-sm uppercase tracking-[0.25em] text-gray-400">
              Payroll engine
            </p>

            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#111827]">
              Run payroll calculation
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              Calculate earnings, deductions, UIF, PAYE, employer contributions
              and net pay, then generate and save a formal employee payslip.
            </p>
          </div>

          <button
            type="button"
            onClick={loadEmployees}
            className="inline-flex items-center justify-center gap-2 border border-black/10 bg-white px-5 py-3 text-sm font-medium text-gray-600 transition hover:border-black hover:text-black"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </section>

        {error ? (
          <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        ) : null}

        {loading ? (
          <div className="flex min-h-[520px] items-center justify-center border border-black/10 bg-white">
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <Loader2 className="animate-spin" size={18} />
              Loading payroll data...
            </div>
          </div>
        ) : (
          <section className="grid gap-6 xl:grid-cols-[440px_1fr]">
            <form
              onSubmit={calculatePayslip}
              className="border border-black/10 bg-white"
            >
              <div className="border-b border-black/10 px-6 py-5">
                <h2 className="text-lg font-semibold tracking-[-0.03em]">
                  Payroll inputs
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Enter pay details and choose how PAYE should be calculated.
                </p>
              </div>

              <div className="space-y-6 p-6">
                {selectedEmployee ? (
                  <div className="border border-black/10 bg-[#111827] p-4 text-white">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/50">
                      Selected employee
                    </p>

                    <p className="mt-2 text-sm font-semibold">
                      {selectedEmployee.firstName} {selectedEmployee.lastName}
                    </p>

                    <p className="mt-1 text-xs text-white/60">
                      {selectedEmployee.employeeNumber} ·{' '}
                      {selectedEmployee.jobTitle ?? 'No job title'} ·{' '}
                      {selectedEmployee.department?.name ??
                        'Unassigned department'}
                    </p>
                  </div>
                ) : null}

                <div
                  className={`border p-4 ${
                    compensationProfileLoaded
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-amber-200 bg-amber-50 text-amber-800'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {loadingCompensationProfile ? (
                      <Loader2 className="mt-0.5 animate-spin" size={16} />
                    ) : compensationProfileLoaded ? (
                      <Sparkles className="mt-0.5" size={16} />
                    ) : (
                      <ShieldCheck className="mt-0.5" size={16} />
                    )}

                    <div>
                      <p className="text-sm font-semibold">
                        {loadingCompensationProfile
                          ? 'Loading compensation profile...'
                          : compensationProfileLoaded
                            ? 'Compensation profile applied'
                            : 'Compensation profile status'}
                      </p>

                      <p className="mt-1 text-sm leading-6">
                        {loadingCompensationProfile
                          ? 'MedCNX is loading saved salary and deduction defaults for this employee.'
                          : compensationProfileMessage ||
                            'Select an employee to load payroll defaults.'}
                      </p>

                      {selectedEmployee ? (
                        <Link
                          href={`/dashboard/employees/${selectedEmployee.id}/payroll`}
                          className="mt-3 inline-flex items-center gap-2 text-sm font-medium underline underline-offset-4"
                        >
                          Open payroll profile
                          <ExternalLink size={14} />
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium">
                      Search employee
                    </span>

                    <div className="relative">
                      <Search
                        size={16}
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                      />

                      <input
                        value={employeeSearch}
                        onChange={(event) =>
                          setEmployeeSearch(event.target.value)
                        }
                        placeholder="Search by name, number, department..."
                        className="w-full border border-black/10 bg-[#f8fafc] py-3 pl-11 pr-4 text-sm outline-none transition focus:border-black"
                      />
                    </div>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium">
                      Employee <span className="text-red-500">*</span>
                    </span>

                    <select
                      value={employeeId}
                      onChange={(event) => {
                        setEmployeeId(event.target.value);
                      }}
                      className="w-full border border-black/10 bg-[#f8fafc] px-4 py-3 text-sm outline-none transition focus:border-black"
                    >
                      {filteredEmployees.length === 0 ? (
                        <option value="">No employees found</option>
                      ) : (
                        filteredEmployees.map((employee) => (
                          <option key={employee.id} value={employee.id}>
                            {employeeLabel(employee)}
                          </option>
                        ))
                      )}
                    </select>
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium">
                      Pay month
                    </span>

                    <select
                      value={periodMonth}
                      onChange={(event) => {
                        setPeriodMonth(Number(event.target.value));
                        resetPayrollOutput();
                      }}
                      className="w-full border border-black/10 bg-[#f8fafc] px-4 py-3 text-sm outline-none transition focus:border-black"
                    >
                      {months.map((month) => (
                        <option key={month.value} value={month.value}>
                          {month.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium">
                      Pay year
                    </span>

                    <input
                      type="number"
                      value={periodYear}
                      onChange={(event) => {
                        setPeriodYear(Number(event.target.value));
                        resetPayrollOutput();
                      }}
                      className="w-full border border-black/10 bg-[#f8fafc] px-4 py-3 text-sm outline-none transition focus:border-black"
                    />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium">
                      Payment date
                    </span>

                    <input
                      type="date"
                      value={paymentDate}
                      onChange={(event) => {
                        setPaymentDate(event.target.value);
                        clearGeneratedPayslip();
                      }}
                      className="w-full border border-black/10 bg-[#f8fafc] px-4 py-3 text-sm outline-none transition focus:border-black"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium">
                      Generated by
                    </span>

                    <input
                      value={generatedBy}
                      onChange={(event) => {
                        setGeneratedBy(event.target.value);
                        clearGeneratedPayslip();
                      }}
                      className="w-full border border-black/10 bg-[#f8fafc] px-4 py-3 text-sm outline-none transition focus:border-black"
                    />
                  </label>
                </div>

                <InputGroup title="Earnings">
                  <MoneyInput
                    label="Basic salary"
                    value={basicSalary}
                    onChange={(value) => {
                      setBasicSalary(value);
                      resetPayrollOutput();
                    }}
                    required
                  />

                  <MoneyInput
                    label="Overtime"
                    value={overtime}
                    onChange={(value) => {
                      setOvertime(value);
                      resetPayrollOutput();
                    }}
                  />

                  <MoneyInput
                    label="Bonus"
                    value={bonus}
                    onChange={(value) => {
                      setBonus(value);
                      resetPayrollOutput();
                    }}
                  />

                  <MoneyInput
                    label="Commission"
                    value={commission}
                    onChange={(value) => {
                      setCommission(value);
                      resetPayrollOutput();
                    }}
                  />

                  <MoneyInput
                    label="Allowances"
                    value={allowances}
                    onChange={(value) => {
                      setAllowances(value);
                      resetPayrollOutput();
                    }}
                  />
                </InputGroup>

                <section className="border border-black/10 bg-[#f8fafc] p-4">
                  <h3 className="mb-4 text-sm font-semibold text-[#111827]">
                    PAYE mode
                  </h3>

                  <div className="grid gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setAutoPaye(true);
                        resetPayrollOutput();
                      }}
                      className={`border px-4 py-3 text-left text-sm transition ${
                        autoPaye
                          ? 'border-black bg-black text-white'
                          : 'border-black/10 bg-white text-gray-600 hover:border-black hover:text-black'
                      }`}
                    >
                      <span className="block font-semibold">
                        Automatic SARS PAYE
                      </span>
                      <span
                        className={`mt-1 block leading-6 ${
                          autoPaye ? 'text-white/65' : 'text-gray-500'
                        }`}
                      >
                        MedCNX calculates PAYE from the selected pay period and
                        monthly taxable income.
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAutoPaye(false);
                        resetPayrollOutput();
                      }}
                      className={`border px-4 py-3 text-left text-sm transition ${
                        !autoPaye
                          ? 'border-black bg-black text-white'
                          : 'border-black/10 bg-white text-gray-600 hover:border-black hover:text-black'
                      }`}
                    >
                      <span className="block font-semibold">Manual PAYE</span>
                      <span
                        className={`mt-1 block leading-6 ${
                          !autoPaye ? 'text-white/65' : 'text-gray-500'
                        }`}
                      >
                        HR enters the PAYE value manually for special cases or
                        corrections.
                      </span>
                    </button>
                  </div>

                  <div className="mt-4">
                    <MoneyInput
                      label="Manual PAYE"
                      value={paye}
                      onChange={(value) => {
                        setPaye(value);
                        resetPayrollOutput();
                      }}
                      disabled={autoPaye}
                    />

                    {autoPaye ? (
                      <p className="mt-2 text-xs leading-5 text-gray-500">
                        Manual PAYE is disabled because automatic PAYE is active.
                      </p>
                    ) : null}
                  </div>
                </section>

                <InputGroup title="Deductions">
                  <MoneyInput
                    label="Pension employee"
                    value={pensionEmployee}
                    onChange={(value) => {
                      setPensionEmployee(value);
                      resetPayrollOutput();
                    }}
                  />

                  <MoneyInput
                    label="Medical aid employee"
                    value={medicalAidEmployee}
                    onChange={(value) => {
                      setMedicalAidEmployee(value);
                      resetPayrollOutput();
                    }}
                  />

                  <MoneyInput
                    label="Other deductions"
                    value={otherDeductions}
                    onChange={(value) => {
                      setOtherDeductions(value);
                      resetPayrollOutput();
                    }}
                  />
                </InputGroup>

                <InputGroup title="Employer contributions">
                  <MoneyInput
                    label="Pension employer"
                    value={pensionEmployer}
                    onChange={(value) => {
                      setPensionEmployer(value);
                      resetPayrollOutput();
                    }}
                  />

                  <MoneyInput
                    label="Medical aid employer"
                    value={medicalAidEmployer}
                    onChange={(value) => {
                      setMedicalAidEmployer(value);
                      resetPayrollOutput();
                    }}
                  />
                </InputGroup>

                <InputGroup title="UIF settings">
                  <MoneyInput
                    label="Employee UIF rate"
                    value={uifEmployeeRate}
                    onChange={(value) => {
                      setUifEmployeeRate(value);
                      resetPayrollOutput();
                    }}
                    step="0.001"
                  />

                  <MoneyInput
                    label="Employer UIF rate"
                    value={uifEmployerRate}
                    onChange={(value) => {
                      setUifEmployerRate(value);
                      resetPayrollOutput();
                    }}
                    step="0.001"
                  />

                  <MoneyInput
                    label="Monthly UIF cap"
                    value={uifMonthlyCap}
                    onChange={(value) => {
                      setUifMonthlyCap(value);
                      resetPayrollOutput();
                    }}
                  />
                </InputGroup>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium">
                    Payslip notes
                  </span>

                  <textarea
                    value={notes}
                    onChange={(event) => {
                      setNotes(event.target.value);
                      clearGeneratedPayslip();
                    }}
                    rows={4}
                    placeholder="Optional notes for this payslip..."
                    className="w-full resize-none border border-black/10 bg-[#f8fafc] px-4 py-3 text-sm outline-none transition focus:border-black"
                  />
                </label>

                <div className="grid gap-3">
                  <label className="flex items-start gap-3 border border-black/10 bg-[#f8fafc] p-4">
                    <input
                      type="checkbox"
                      checked={visibleToEmployee}
                      onChange={(event) =>
                        setVisibleToEmployee(event.target.checked)
                      }
                      className="mt-1 h-4 w-4"
                    />

                    <span>
                      <span className="block text-sm font-medium text-[#111827]">
                        Visible to employee
                      </span>

                      <span className="mt-1 block text-sm leading-6 text-gray-500">
                        Employee can see this payslip in their portal.
                      </span>
                    </span>
                  </label>

                  <label className="flex items-start gap-3 border border-black/10 bg-[#f8fafc] p-4">
                    <input
                      type="checkbox"
                      checked={isConfidential}
                      onChange={(event) =>
                        setIsConfidential(event.target.checked)
                      }
                      className="mt-1 h-4 w-4"
                    />

                    <span>
                      <span className="block text-sm font-medium text-[#111827]">
                        Confidential payroll document
                      </span>

                      <span className="mt-1 block text-sm leading-6 text-gray-500">
                        Keep this marked as sensitive payroll information.
                      </span>
                    </span>
                  </label>
                </div>

                <div className="border border-black/10 bg-[#f8fafc] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-gray-400">
                    Gross pay preview
                  </p>

                  <p className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-[#111827]">
                    {formatCurrency(grossPreview)}
                  </p>

                  <p className="mt-1 text-xs text-gray-500">
                    PAYE mode: {autoPaye ? 'Automatic SARS PAYE' : 'Manual PAYE'}
                  </p>
                </div>

                <div className="grid gap-3">
                  <button
                    type="submit"
                    disabled={
                      calculating || !employeeId || loadingCompensationProfile
                    }
                    className="inline-flex w-full items-center justify-center gap-2 border border-black bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {calculating ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        Calculating...
                      </>
                    ) : (
                      <>
                        <Calculator size={16} />
                        Calculate payslip
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={generatePayslip}
                    disabled={
                      generatingPayslip ||
                      !employeeId ||
                      loadingCompensationProfile
                    }
                    className="inline-flex w-full items-center justify-center gap-2 border border-black/10 bg-white px-5 py-3 text-sm font-medium text-gray-700 transition hover:border-black hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {generatingPayslip ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        Generating payslip...
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} />
                        Generate payslip
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>

            <section className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <SummaryCard
                  title="Gross pay"
                  value={formatCurrency(calculation?.earnings.grossPay)}
                  helper="Total earnings before deductions"
                  icon={<Wallet size={18} />}
                />

                <SummaryCard
                  title="Deductions"
                  value={formatCurrency(
                    calculation?.deductions.totalDeductions,
                  )}
                  helper="PAYE, UIF and employee deductions"
                  icon={<ShieldCheck size={18} />}
                />

                <SummaryCard
                  title="Net pay"
                  value={formatCurrency(calculation?.netPay)}
                  helper="Amount payable to employee"
                  icon={<FileText size={18} />}
                  dark
                />
              </div>

              {!calculation && !generatedPayslip ? (
                <div className="flex min-h-[620px] items-center justify-center border border-dashed border-black/15 bg-white px-5 py-14 text-center">
                  <div>
                    <Calculator size={36} className="mx-auto text-gray-300" />

                    <p className="mt-4 text-sm font-medium text-[#111827]">
                      No payroll calculation yet
                    </p>

                    <p className="mt-1 max-w-md text-sm leading-6 text-gray-500">
                      Select an employee, load their payroll defaults, then
                      calculate and generate a formal payslip preview.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {calculation ? (
                    <section className="border border-black/10 bg-white">
                      <div className="border-b border-black/10 px-6 py-5">
                        <h2 className="text-lg font-semibold tracking-[-0.03em]">
                          Payslip calculation result
                        </h2>

                        <p className="mt-1 text-sm text-gray-500">
                          {calculation.employee.firstName}{' '}
                          {calculation.employee.lastName} ·{' '}
                          {monthLabel(calculation.period.month)}{' '}
                          {calculation.period.year}
                        </p>
                      </div>

                      <div className="grid gap-6 p-6 xl:grid-cols-2">
                        <BreakdownCard
                          title="Earnings"
                          rows={[
                            ['Basic salary', calculation.earnings.basicSalary],
                            ['Overtime', calculation.earnings.overtime],
                            ['Bonus', calculation.earnings.bonus],
                            ['Commission', calculation.earnings.commission],
                            ['Allowances', calculation.earnings.allowances],
                          ]}
                          totalLabel="Gross pay"
                          totalValue={calculation.earnings.grossPay}
                        />

                        <BreakdownCard
                          title="Deductions"
                          rows={[
                            ['PAYE', calculation.deductions.paye],
                            [
                              'UIF employee',
                              calculation.deductions.uifEmployee,
                            ],
                            [
                              'Pension employee',
                              calculation.deductions.pensionEmployee,
                            ],
                            [
                              'Medical aid employee',
                              calculation.deductions.medicalAidEmployee,
                            ],
                            [
                              'Other deductions',
                              calculation.deductions.otherDeductions,
                            ],
                          ]}
                          totalLabel="Total deductions"
                          totalValue={calculation.deductions.totalDeductions}
                        />

                        <BreakdownCard
                          title="Employer contributions"
                          rows={[
                            [
                              'UIF employer',
                              calculation.employerContributions.uifEmployer,
                            ],
                            [
                              'Pension employer',
                              calculation.employerContributions
                                .pensionEmployer,
                            ],
                            [
                              'Medical aid employer',
                              calculation.employerContributions
                                .medicalAidEmployer,
                            ],
                          ]}
                          totalLabel="Employer total"
                          totalValue={calculation.employerContributions.total}
                        />

                        <section className="border border-black/10 bg-[#111827] p-5 text-white">
                          <p className="text-xs uppercase tracking-[0.18em] text-white/50">
                            Final payable
                          </p>

                          <p className="mt-3 text-4xl font-semibold tracking-[-0.06em]">
                            {formatCurrency(calculation.netPay)}
                          </p>

                          <div className="mt-4 space-y-1 text-sm leading-6 text-white/65">
                            <p>
                              PAYE mode:{' '}
                              {formatPayeMode(
                                calculation.calculationSettings.payeMode,
                              )}
                            </p>

                            {calculation.calculationSettings.payeTaxYear ? (
                              <p>
                                Tax year:{' '}
                                {
                                  calculation.calculationSettings
                                    .payeTaxYear
                                }{' '}
                                (
                                {
                                  calculation.calculationSettings
                                    .payeTaxYearStartDate
                                }{' '}
                                to{' '}
                                {
                                  calculation.calculationSettings
                                    .payeTaxYearEndDate
                                }
                                )
                              </p>
                            ) : null}

                            <p>
                              UIF cap:{' '}
                              {formatCurrency(
                                calculation.calculationSettings.uifMonthlyCap,
                              )}
                            </p>
                          </div>
                        </section>
                      </div>

                      {calculation.calculationSettings.payeMode ===
                      'AUTO_SARS_ANNUALISED' ? (
                        <div className="border-t border-black/10 bg-[#f8fafc] p-6">
                          <h3 className="text-sm font-semibold text-[#111827]">
                            Automatic PAYE details
                          </h3>

                          <div className="mt-4 grid gap-3 md:grid-cols-3">
                            <InfoBlock
                              label="Annual taxable income"
                              value={formatCurrency(
                                calculation.calculationSettings
                                  .payeAnnualTaxableIncome,
                              )}
                            />

                            <InfoBlock
                              label="Annual tax before rebate"
                              value={formatCurrency(
                                calculation.calculationSettings
                                  .payeAnnualTaxBeforeRebate,
                              )}
                            />

                            <InfoBlock
                              label="Annual tax after rebate"
                              value={formatCurrency(
                                calculation.calculationSettings
                                  .payeAnnualTaxAfterRebate,
                              )}
                            />
                          </div>
                        </div>
                      ) : null}
                    </section>
                  ) : null}

                  {generatedPayslip ? (
                    <section className="border border-black/10 bg-white">
                      <div className="flex flex-col gap-4 border-b border-black/10 px-6 py-5 xl:flex-row xl:items-center xl:justify-between">
                        <div>
                          <h2 className="text-lg font-semibold tracking-[-0.03em]">
                            Payslip preview
                          </h2>

                          <p className="mt-1 text-sm text-gray-500">
                            {generatedPayslip.title} ·{' '}
                            {generatedPayslip.employeeName}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={openPayslip}
                            className="inline-flex items-center justify-center gap-2 border border-black/10 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition hover:border-black hover:text-black"
                          >
                            <FileText size={15} />
                            Open
                          </button>

                          <button
                            type="button"
                            onClick={printPayslip}
                            className="inline-flex items-center justify-center gap-2 border border-black/10 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition hover:border-black hover:text-black"
                          >
                            <Printer size={15} />
                            Print / Save PDF
                          </button>

                          <button
                            type="button"
                            onClick={savePayslip}
                            disabled={savingPayslip}
                            className="inline-flex items-center justify-center gap-2 border border-black bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {savingPayslip ? (
                              <Loader2 className="animate-spin" size={15} />
                            ) : (
                              <Save size={15} />
                            )}
                            Save payslip
                          </button>
                        </div>
                      </div>

                      <div className="space-y-4 p-6">
                        {savedPayslip ? (
                          <div className="flex flex-col gap-4 border border-emerald-200 bg-emerald-50 p-4 md:flex-row md:items-center md:justify-between">
                            <div>
                              <p className="text-sm font-semibold text-emerald-800">
                                Payslip saved to employee documents
                              </p>

                              <p className="mt-1 text-sm text-emerald-700">
                                {savedPayslip.originalName}
                              </p>
                            </div>

                            <Link
                              href={`/dashboard/employees/${savedPayslip.employeeId}/documents`}
                              className="inline-flex items-center justify-center gap-2 border border-emerald-700 bg-white px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-700 hover:text-white"
                            >
                              <ExternalLink size={15} />
                              Open employee documents
                            </Link>
                          </div>
                        ) : null}

                        <iframe
                          title="Generated payslip preview"
                          srcDoc={generatedPayslip.html}
                          className="h-[760px] w-full border border-black/10 bg-white"
                        />
                      </div>
                    </section>
                  ) : null}

                  <section className="border border-emerald-200 bg-emerald-50 p-5">
                    <p className="text-sm font-semibold text-emerald-800">
                      PAYE calculation mode
                    </p>

                    <p className="mt-1 text-sm leading-6 text-emerald-700">
                      {autoPaye
                        ? 'Automatic PAYE is active. MedCNX calculates PAYE using the selected pay period and tax-year rules.'
                        : 'Manual PAYE is active. HR controls the PAYE value entered for this calculation.'}
                    </p>
                  </section>
                </div>
              )}
            </section>
          </section>
        )}
      </div>
    </DashboardShell>
  );
}

function InputGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-black/10 bg-[#f8fafc] p-4">
      <h3 className="mb-4 text-sm font-semibold text-[#111827]">{title}</h3>

      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function MoneyInput({
  label,
  value,
  onChange,
  required,
  step = '0.01',
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  step?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-gray-700">
        {label} {required ? <span className="text-red-500">*</span> : null}
      </span>

      <input
        type="number"
        min="0"
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-black disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
      />
    </label>
  );
}

function SummaryCard({
  title,
  value,
  helper,
  icon,
  dark,
}: {
  title: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
  dark?: boolean;
}) {
  return (
    <div
      className={`border p-5 ${
        dark
          ? 'border-[#111827] bg-[#111827] text-white'
          : 'border-black/10 bg-white text-[#111827]'
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <p
          className={`text-xs uppercase tracking-[0.18em] ${
            dark ? 'text-white/50' : 'text-gray-400'
          }`}
        >
          {title}
        </p>

        <div className={dark ? 'text-white/60' : 'text-gray-400'}>{icon}</div>
      </div>

      <p className="mt-3 text-2xl font-semibold tracking-[-0.05em]">{value}</p>

      <p className={`mt-1 text-sm ${dark ? 'text-white/60' : 'text-gray-500'}`}>
        {helper}
      </p>
    </div>
  );
}

function BreakdownCard({
  title,
  rows,
  totalLabel,
  totalValue,
}: {
  title: string;
  rows: [string, number][];
  totalLabel: string;
  totalValue: number;
}) {
  return (
    <section className="border border-black/10 bg-[#f8fafc] p-5">
      <h3 className="text-sm font-semibold text-[#111827]">{title}</h3>

      <div className="mt-4 space-y-3">
        {rows.map(([label, value]) => (
          <div
            key={`${title}-${label}`}
            className="flex items-center justify-between gap-4 border-b border-black/5 pb-3 text-sm"
          >
            <span className="text-gray-500">{label}</span>
            <span className="font-medium text-[#111827]">
              {formatCurrency(value)}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-4 border border-black/10 bg-white p-4 text-sm">
        <span className="font-semibold text-[#111827]">{totalLabel}</span>

        <span className="font-semibold text-[#111827]">
          {formatCurrency(totalValue)}
        </span>
      </div>
    </section>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-black/10 bg-white p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-gray-400">
        {label}
      </p>

      <p className="mt-2 break-words text-sm font-semibold text-[#111827]">
        {value}
      </p>
    </div>
  );
}