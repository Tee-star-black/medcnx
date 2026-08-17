'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Banknote,
  Building2,
  Calculator,
  CheckCircle2,
  Loader2,
  Save,
  ShieldCheck,
  Sparkles,
  UserRound,
  WalletCards,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { api } from '@/lib/api';

type CompensationProfile = {
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
  medicalSchemeMembers: number;
  taxDirectiveMode: string;
  taxDirectiveReference: string | null;
  taxDirectiveValue: number | null;
  taxDirectiveValidFrom: string | null;
  taxDirectiveValidTo: string | null;
  defaultAllowances: number;
  defaultOtherDeductions: number;
  bankName: string | null;
  bankAccountNumber: string | null;
  paymentReference: string | null;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type EmployeeSummary = {
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

type CompensationResponse = {
  employee: EmployeeSummary;
  profile: CompensationProfile;
};

type FormState = {
  paymentFrequency: string;
  basicSalary: string;
  autoPaye: boolean;
  uifEnabled: boolean;
  pensionEmployee: string;
  pensionEmployer: string;
  medicalAidEmployee: string;
  medicalAidEmployer: string;
  medicalSchemeMembers: string;
  taxDirectiveMode: string;
  taxDirectiveReference: string;
  taxDirectiveValue: string;
  taxDirectiveValidFrom: string;
  taxDirectiveValidTo: string;
  defaultAllowances: string;
  defaultOtherDeductions: string;
  bankName: string;
  bankAccountNumber: string;
  paymentReference: string;
  notes: string;
};

const defaultForm: FormState = {
  paymentFrequency: 'MONTHLY',
  basicSalary: '0',
  autoPaye: true,
  uifEnabled: true,
  pensionEmployee: '0',
  pensionEmployer: '0',
  medicalAidEmployee: '0',
  medicalAidEmployer: '0',
  medicalSchemeMembers: '0',
  taxDirectiveMode: 'NONE',
  taxDirectiveReference: '',
  taxDirectiveValue: '0',
  taxDirectiveValidFrom: '',
  taxDirectiveValidTo: '',
  defaultAllowances: '0',
  defaultOtherDeductions: '0',
  bankName: '',
  bankAccountNumber: '',
  paymentReference: '',
  notes: '',
};

function money(value: string | number) {
  const amount = typeof value === 'string' ? Number(value || 0) : value;

  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
  }).format(Number.isFinite(amount) ? amount : 0);
}

function toInputValue(value: unknown) {
  if (value === null || value === undefined) {
    return '0';
  }

  return String(value);
}

function toTextValue(value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value);
}

function toNumber(value: string) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : 0;
}

function formatDate(value?: string | null) {
  if (!value) {
    return 'Not saved yet';
  }

  return new Intl.DateTimeFormat('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export default function EmployeePayrollProfilePage() {
  const params = useParams<{ id: string }>();
  const employeeId = params.id;

  const [employee, setEmployee] = useState<EmployeeSummary | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadProfile();
  }, [employeeId]);

  const grossDefault = useMemo(() => {
    return toNumber(form.basicSalary) + toNumber(form.defaultAllowances);
  }, [form.basicSalary, form.defaultAllowances]);

  const defaultDeductions = useMemo(() => {
    return (
      toNumber(form.pensionEmployee) +
      toNumber(form.medicalAidEmployee) +
      toNumber(form.defaultOtherDeductions)
    );
  }, [
    form.pensionEmployee,
    form.medicalAidEmployee,
    form.defaultOtherDeductions,
  ]);

  const estimatedNetBeforePayeAndUif = useMemo(() => {
    return Math.max(grossDefault - defaultDeductions, 0);
  }, [grossDefault, defaultDeductions]);

  async function loadProfile() {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await api.get<CompensationResponse>(
        `/payroll/employees/${employeeId}/compensation`,
      );

      const nextProfile = response.data.profile;

      setEmployee(response.data.employee);
      setProfileId(nextProfile.id);
      setLastUpdatedAt(nextProfile.updatedAt);

      setForm({
        paymentFrequency: nextProfile.paymentFrequency ?? 'MONTHLY',
        basicSalary: toInputValue(nextProfile.basicSalary),
        autoPaye: Boolean(nextProfile.autoPaye),
        uifEnabled: Boolean(nextProfile.uifEnabled),
        pensionEmployee: toInputValue(nextProfile.pensionEmployee),
        pensionEmployer: toInputValue(nextProfile.pensionEmployer),
        medicalAidEmployee: toInputValue(nextProfile.medicalAidEmployee),
        medicalAidEmployer: toInputValue(nextProfile.medicalAidEmployer),
        medicalSchemeMembers: toInputValue(
          nextProfile.medicalSchemeMembers,
        ),
        taxDirectiveMode: nextProfile.taxDirectiveMode ?? 'NONE',
        taxDirectiveReference: toTextValue(
          nextProfile.taxDirectiveReference,
        ),
        taxDirectiveValue: toInputValue(nextProfile.taxDirectiveValue),
        taxDirectiveValidFrom:
          nextProfile.taxDirectiveValidFrom?.slice(0, 10) ?? '',
        taxDirectiveValidTo:
          nextProfile.taxDirectiveValidTo?.slice(0, 10) ?? '',
        defaultAllowances: toInputValue(nextProfile.defaultAllowances),
        defaultOtherDeductions: toInputValue(
          nextProfile.defaultOtherDeductions,
        ),
        bankName: toTextValue(nextProfile.bankName),
        bankAccountNumber: toTextValue(nextProfile.bankAccountNumber),
        paymentReference: toTextValue(nextProfile.paymentReference),
        notes: toTextValue(nextProfile.notes),
      });
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ??
        'Could not load compensation profile.';

      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally {
      setLoading(false);
    }
  }

  function updateField(name: keyof FormState, value: string | boolean) {
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        paymentFrequency: form.paymentFrequency,
        basicSalary: toNumber(form.basicSalary),
        autoPaye: form.autoPaye,
        uifEnabled: form.uifEnabled,
        pensionEmployee: toNumber(form.pensionEmployee),
        pensionEmployer: toNumber(form.pensionEmployer),
        medicalAidEmployee: toNumber(form.medicalAidEmployee),
        medicalAidEmployer: toNumber(form.medicalAidEmployer),
        medicalSchemeMembers: Math.max(
          0,
          Math.trunc(toNumber(form.medicalSchemeMembers)),
        ),
        taxDirectiveMode: form.taxDirectiveMode,
        taxDirectiveReference: form.taxDirectiveReference,
        taxDirectiveValue:
          form.taxDirectiveMode === 'NONE'
            ? undefined
            : toNumber(form.taxDirectiveValue),
        taxDirectiveValidFrom: form.taxDirectiveValidFrom || undefined,
        taxDirectiveValidTo: form.taxDirectiveValidTo || undefined,
        defaultAllowances: toNumber(form.defaultAllowances),
        defaultOtherDeductions: toNumber(form.defaultOtherDeductions),
        bankName: form.bankName,
        bankAccountNumber: form.bankAccountNumber,
        paymentReference: form.paymentReference,
        notes: form.notes,
      };

      const response = await api.patch<{
        message: string;
        profile: CompensationProfile;
      }>(`/payroll/employees/${employeeId}/compensation`, payload);

      setProfileId(response.data.profile.id);
      setLastUpdatedAt(response.data.profile.updatedAt);
      setSuccess(response.data.message);
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ??
        'Could not save compensation profile.';

      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardShell activePage="employees">
      <div className="space-y-8">
        <section className="flex flex-col gap-5 border-b border-black/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              href={`/dashboard/employees/${employeeId}`}
              className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-black"
            >
              <ArrowLeft size={15} />
              Back to employee profile
            </Link>

            <p className="mb-2 text-sm uppercase tracking-[0.25em] text-gray-400">
              Compensation profile
            </p>

            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#111827]">
              Employee payroll profile
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              Store salary, PAYE mode, UIF settings, deductions and default
              payroll values for this employee.
            </p>
          </div>

          <div className="border border-black/10 bg-white px-5 py-4">
            <p className="text-xs uppercase tracking-[0.18em] text-gray-400">
              Profile status
            </p>

            <p className="mt-2 text-sm font-semibold text-[#111827]">
              {profileId ? 'Saved profile' : 'Not saved yet'}
            </p>

            <p className="mt-1 text-xs text-gray-500">
              Updated: {formatDate(lastUpdatedAt)}
            </p>
          </div>
        </section>

        {error ? (
          <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="flex items-center gap-2 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <CheckCircle2 size={16} />
            {success}
          </div>
        ) : null}

        {loading ? (
          <div className="flex min-h-[420px] items-center justify-center border border-black/10 bg-white">
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <Loader2 className="animate-spin" size={18} />
              Loading compensation profile...
            </div>
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
            <aside className="space-y-6">
              <section className="border border-black/10 bg-[#111827] p-6 text-white">
                <div className="flex h-12 w-12 items-center justify-center border border-white/15 bg-white/10">
                  <UserRound size={20} />
                </div>

                <h2 className="mt-5 text-lg font-semibold tracking-[-0.03em]">
                  {employee
                    ? `${employee.firstName} ${employee.lastName}`
                    : 'Employee'}
                </h2>

                <div className="mt-4 space-y-3 text-sm text-white/70">
                  <InfoRow
                    label="Employee no."
                    value={employee?.employeeNumber ?? 'Not set'}
                    dark
                  />

                  <InfoRow
                    label="Job title"
                    value={employee?.jobTitle ?? 'Not set'}
                    dark
                  />

                  <InfoRow
                    label="Department"
                    value={employee?.department?.name ?? 'Not set'}
                    dark
                  />

                  <InfoRow
                    label="Email"
                    value={employee?.email ?? 'Not set'}
                    dark
                  />
                </div>
              </section>

              <section className="border border-black/10 bg-white p-6">
                <div className="flex h-11 w-11 items-center justify-center border border-black/10 bg-[#f8fafc] text-gray-500">
                  <Calculator size={19} />
                </div>

                <h2 className="mt-5 text-lg font-semibold tracking-[-0.03em] text-[#111827]">
                  Default payroll estimate
                </h2>

                <div className="mt-5 space-y-3">
                  <MiniAmount label="Gross default" value={grossDefault} />

                  <MiniAmount
                    label="Default deductions"
                    value={defaultDeductions}
                  />

                  <MiniAmount
                    label="Before PAYE/UIF"
                    value={estimatedNetBeforePayeAndUif}
                    strong
                  />
                </div>

                <p className="mt-4 text-xs leading-5 text-gray-500">
                  This is only a default estimate. Final net pay is calculated
                  during payroll using PAYE, UIF and any monthly adjustments.
                </p>
              </section>

              <section className="border border-black/10 bg-white p-6">
                <div className="flex h-11 w-11 items-center justify-center border border-black/10 bg-[#f8fafc] text-gray-500">
                  <Sparkles size={19} />
                </div>

                <h2 className="mt-5 text-lg font-semibold tracking-[-0.03em] text-[#111827]">
                  Payroll automation ready
                </h2>

                <p className="mt-2 text-sm leading-6 text-gray-500">
                  Once saved, this profile can be used to preload payroll runs
                  and later support bulk payroll processing.
                </p>
              </section>
            </aside>

            <form onSubmit={saveProfile} className="space-y-6">
              <section className="border border-black/10 bg-white">
                <div className="border-b border-black/10 px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center border border-black/10 bg-[#f8fafc] text-gray-500">
                      <WalletCards size={18} />
                    </div>

                    <div>
                      <h2 className="text-lg font-semibold tracking-[-0.03em] text-[#111827]">
                        Salary settings
                      </h2>

                      <p className="mt-1 text-sm text-gray-500">
                        Set the employee’s standard pay details.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-5 p-6 md:grid-cols-2">
                  <SelectField
                    label="Payment frequency"
                    value={form.paymentFrequency}
                    onChange={(value) => updateField('paymentFrequency', value)}
                    options={[
                      { value: 'MONTHLY', label: 'Monthly' },
                      { value: 'FORTNIGHTLY', label: 'Fortnightly' },
                      { value: 'WEEKLY', label: 'Weekly' },
                    ]}
                  />

                  <InputField
                    label="Basic salary"
                    type="number"
                    value={form.basicSalary}
                    onChange={(value) => updateField('basicSalary', value)}
                  />

                  <InputField
                    label="Default allowances"
                    type="number"
                    value={form.defaultAllowances}
                    onChange={(value) =>
                      updateField('defaultAllowances', value)
                    }
                  />

                  <InputField
                    label="Default other deductions"
                    type="number"
                    value={form.defaultOtherDeductions}
                    onChange={(value) =>
                      updateField('defaultOtherDeductions', value)
                    }
                  />
                </div>
              </section>

              <section className="border border-black/10 bg-white">
                <div className="border-b border-black/10 px-6 py-5">
                  <h2 className="text-lg font-semibold tracking-[-0.03em] text-[#111827]">
                    SARS tax directive
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Apply only the original, valid SARS directive for this
                    employee and tax period.
                  </p>
                </div>

                <div className="grid gap-5 p-6 md:grid-cols-2">
                  <SelectField
                    label="Directive method"
                    value={form.taxDirectiveMode}
                    onChange={(value) =>
                      updateField('taxDirectiveMode', value)
                    }
                    options={[
                      { value: 'NONE', label: 'No directive' },
                      {
                        value: 'FIXED_PERCENTAGE',
                        label: 'Fixed percentage',
                      },
                      { value: 'FIXED_AMOUNT', label: 'Fixed amount' },
                    ]}
                  />

                  <InputField
                    label="SARS directive reference"
                    value={form.taxDirectiveReference}
                    onChange={(value) =>
                      updateField('taxDirectiveReference', value)
                    }
                  />

                  {form.taxDirectiveMode !== 'NONE' ? (
                    <>
                      <InputField
                        label={
                          form.taxDirectiveMode === 'FIXED_PERCENTAGE'
                            ? 'Directive percentage'
                            : 'Directive amount'
                        }
                        type="number"
                        value={form.taxDirectiveValue}
                        onChange={(value) =>
                          updateField('taxDirectiveValue', value)
                        }
                      />

                      <InputField
                        label="Valid from"
                        type="date"
                        value={form.taxDirectiveValidFrom}
                        onChange={(value) =>
                          updateField('taxDirectiveValidFrom', value)
                        }
                      />

                      <InputField
                        label="Valid to"
                        type="date"
                        value={form.taxDirectiveValidTo}
                        onChange={(value) =>
                          updateField('taxDirectiveValidTo', value)
                        }
                      />
                    </>
                  ) : null}
                </div>
              </section>

              <section className="border border-black/10 bg-white">
                <div className="border-b border-black/10 px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center border border-black/10 bg-[#f8fafc] text-gray-500">
                      <ShieldCheck size={18} />
                    </div>

                    <div>
                      <h2 className="text-lg font-semibold tracking-[-0.03em] text-[#111827]">
                        Tax and statutory settings
                      </h2>

                      <p className="mt-1 text-sm text-gray-500">
                        Choose PAYE and UIF defaults.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 p-6 md:grid-cols-2">
                  <ToggleCard
                    title="Automatic PAYE"
                    description="Use SARS annualised PAYE during payroll runs."
                    checked={form.autoPaye}
                    onChange={(value) => updateField('autoPaye', value)}
                  />

                  <ToggleCard
                    title="UIF enabled"
                    description="Apply UIF employee and employer calculation during payroll."
                    checked={form.uifEnabled}
                    onChange={(value) => updateField('uifEnabled', value)}
                  />
                </div>
              </section>

              <section className="border border-black/10 bg-white">
                <div className="border-b border-black/10 px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center border border-black/10 bg-[#f8fafc] text-gray-500">
                      <Banknote size={18} />
                    </div>

                    <div>
                      <h2 className="text-lg font-semibold tracking-[-0.03em] text-[#111827]">
                        Benefits and deductions
                      </h2>

                      <p className="mt-1 text-sm text-gray-500">
                        Store recurring monthly employee and employer values.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-5 p-6 md:grid-cols-2">
                  <InputField
                    label="Pension employee"
                    type="number"
                    value={form.pensionEmployee}
                    onChange={(value) => updateField('pensionEmployee', value)}
                  />

                  <InputField
                    label="Pension employer"
                    type="number"
                    value={form.pensionEmployer}
                    onChange={(value) => updateField('pensionEmployer', value)}
                  />

                  <InputField
                    label="Medical aid employee"
                    type="number"
                    value={form.medicalAidEmployee}
                    onChange={(value) =>
                      updateField('medicalAidEmployee', value)
                    }
                  />

                  <InputField
                    label="Medical aid employer"
                    type="number"
                    value={form.medicalAidEmployer}
                    onChange={(value) =>
                      updateField('medicalAidEmployer', value)
                    }
                  />

                  <InputField
                    label="Medical scheme members"
                    type="number"
                    value={form.medicalSchemeMembers}
                    onChange={(value) =>
                      updateField('medicalSchemeMembers', value)
                    }
                  />
                </div>
              </section>

              <section className="border border-black/10 bg-white">
                <div className="border-b border-black/10 px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center border border-black/10 bg-[#f8fafc] text-gray-500">
                      <Building2 size={18} />
                    </div>

                    <div>
                      <h2 className="text-lg font-semibold tracking-[-0.03em] text-[#111827]">
                        Payment details
                      </h2>

                      <p className="mt-1 text-sm text-gray-500">
                        Optional bank and payroll reference information.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-5 p-6 md:grid-cols-2">
                  <InputField
                    label="Bank name"
                    value={form.bankName}
                    onChange={(value) => updateField('bankName', value)}
                  />

                  <InputField
                    label="Bank account number"
                    value={form.bankAccountNumber}
                    onChange={(value) =>
                      updateField('bankAccountNumber', value)
                    }
                  />

                  <InputField
                    label="Payment reference"
                    value={form.paymentReference}
                    onChange={(value) =>
                      updateField('paymentReference', value)
                    }
                  />

                  <TextareaField
                    label="Notes"
                    value={form.notes}
                    onChange={(value) => updateField('notes', value)}
                  />
                </div>
              </section>

              <div className="sticky bottom-0 z-20 border border-[var(--border-strong)] bg-[var(--surface)] p-4 shadow-[0_-4px_12px_rgba(16,42,58,0.05)]">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <p className="text-sm text-gray-500">
                    Save this profile before running payroll for this employee.
                  </p>

                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center justify-center gap-2 border border-black bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <Save size={16} />
                    )}
                    {saving ? 'Saving...' : 'Save compensation profile'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function InfoRow({
  label,
  value,
  dark,
}: {
  label: string;
  value: string;
  dark?: boolean;
}) {
  return (
    <div
      className={`border px-3 py-3 ${
        dark
          ? 'border-white/10 bg-white/5'
          : 'border-black/10 bg-[#f8fafc]'
      }`}
    >
      <p
        className={`text-xs uppercase tracking-[0.16em] ${
          dark ? 'text-white/40' : 'text-gray-400'
        }`}
      >
        {label}
      </p>

      <p
        className={`mt-1 break-words text-sm font-medium ${
          dark ? 'text-white' : 'text-[#111827]'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function MiniAmount({
  label,
  value,
  strong,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 border px-3 py-3 ${
        strong
          ? 'border-black bg-[#111827] text-white'
          : 'border-black/10 bg-[#f8fafc] text-[#111827]'
      }`}
    >
      <span className={strong ? 'text-sm text-white/70' : 'text-sm text-gray-500'}>
        {label}
      </span>

      <span className="text-sm font-semibold">{money(value)}</span>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'number' | 'date';
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[#111827]">
        {label}
      </span>

      <input
        type={type}
        min={type === 'number' ? 0 : undefined}
        step={type === 'number' ? '0.01' : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full border border-black/10 bg-white px-3 text-sm text-[#111827] outline-none transition focus:border-black"
      />
    </label>
  );
}

function TextareaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block md:col-span-2">
      <span className="mb-2 block text-sm font-medium text-[#111827]">
        {label}
      </span>

      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="w-full resize-none border border-black/10 bg-white px-3 py-3 text-sm text-[#111827] outline-none transition focus:border-black"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[#111827]">
        {label}
      </span>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full border border-black/10 bg-white px-3 text-sm text-[#111827] outline-none transition focus:border-black"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleCard({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`border p-5 text-left transition ${
        checked
          ? 'border-black bg-[#111827] text-white'
          : 'border-black/10 bg-white text-[#111827] hover:border-black'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>

          <p
            className={`mt-2 text-sm leading-6 ${
              checked ? 'text-white/65' : 'text-gray-500'
            }`}
          >
            {description}
          </p>
        </div>

        <span
          className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center border ${
            checked ? 'border-white bg-white text-[#111827]' : 'border-black/20'
          }`}
        >
          {checked ? <CheckCircle2 size={14} /> : null}
        </span>
      </div>
    </button>
  );
}
