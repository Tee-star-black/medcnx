'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  Loader2,
  Save,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { Button } from '@/components/ui/Button';
import { FeedbackBanner } from '@/components/ui/FeedbackBanner';
import { FormField } from '@/components/ui/FormField';
import { PageHeader } from '@/components/ui/PageHeader';
import { api } from '@/lib/api';

type Employee = {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  idNumber?: string | null;
  passportNumber?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  nationality?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
  jobTitle?: string | null;
  employmentType?: string | null;
  employmentStatus: string;
  startDate?: string | null;
  endDate?: string | null;
  department?: { id: string; name: string } | null;
};

function dateInput(value?: string | null) {
  return value ? value.slice(0, 10) : '';
}

function formatDate(value?: string | null) {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(new Date(value));
}

function humanise(value?: string | null) {
  if (!value) return 'Not set';
  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function optional(value: string) {
  return value.trim() || undefined;
}

export default function EditEmployeePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const employeeId = params.id;

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    employeeNumber: '', firstName: '', lastName: '', email: '', phone: '',
    idNumber: '', passportNumber: '', dateOfBirth: '', gender: '', nationality: '',
    emergencyContactName: '', emergencyContactPhone: '', emergencyContactRelation: '',
  });

  useEffect(() => {
    void loadEmployee();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  async function loadEmployee() {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get<Employee>(`/employees/${employeeId}`);
      setEmployee(data);
      setForm({
        employeeNumber: data.employeeNumber ?? '',
        firstName: data.firstName ?? '',
        lastName: data.lastName ?? '',
        email: data.email ?? '',
        phone: data.phone ?? '',
        idNumber: data.idNumber ?? '',
        passportNumber: data.passportNumber ?? '',
        dateOfBirth: dateInput(data.dateOfBirth),
        gender: data.gender ?? '',
        nationality: data.nationality ?? '',
        emergencyContactName: data.emergencyContactName ?? '',
        emergencyContactPhone: data.emergencyContactPhone ?? '',
        emergencyContactRelation: data.emergencyContactRelation ?? '',
      });
    } catch (requestError: any) {
      const message = requestError?.response?.data?.message ?? 'Could not load employee profile.';
      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally {
      setLoading(false);
    }
  }

  function setField(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!form.employeeNumber.trim() || !form.firstName.trim() || !form.lastName.trim()) {
      setError('Employee number, first name and last name are required.');
      return;
    }

    setSaving(true);
    try {
      await api.patch(`/employees/${employeeId}`, {
        employeeNumber: form.employeeNumber.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: optional(form.email),
        phone: optional(form.phone),
        idNumber: optional(form.idNumber),
        passportNumber: optional(form.passportNumber),
        dateOfBirth: form.dateOfBirth || undefined,
        gender: optional(form.gender),
        nationality: optional(form.nationality),
        emergencyContactName: optional(form.emergencyContactName),
        emergencyContactPhone: optional(form.emergencyContactPhone),
        emergencyContactRelation: optional(form.emergencyContactRelation),
      });
      setSuccess('Employee profile details updated.');
      await loadEmployee();
    } catch (requestError: any) {
      const message = requestError?.response?.data?.message ?? 'Could not update employee profile.';
      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <DashboardShell activePage="employees">
        <div className="flex min-h-[420px] items-center justify-center border border-[var(--border)] bg-[var(--surface)] text-sm font-medium text-[var(--muted)]">
          <Loader2 className="mr-3 animate-spin text-[var(--accent)]" size={18} /> Loading employee editor...
        </div>
      </DashboardShell>
    );
  }

  if (!employee) {
    return (
      <DashboardShell activePage="employees">
        <FeedbackBanner tone="error" title="Employee unavailable" message={error || 'Employee profile could not be loaded.'} />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell activePage="employees">
      <form ref={formRef} onSubmit={submit} className="space-y-6">
        <PageHeader
          category="Employee profile"
          title={`Edit ${employee.firstName} ${employee.lastName}`}
          description="Update personal, contact and identity information. Employment structure and lifecycle changes remain controlled through dedicated audited workflows."
          primaryAction={{
            label: saving ? 'Saving...' : 'Save profile',
            onClick: () => formRef.current?.requestSubmit(),
            icon: saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />,
          }}
          secondaryAction={{
            label: 'Back to profile',
            onClick: () => router.push(`/dashboard/employees/${employeeId}`),
            icon: <ArrowLeft size={16} />,
          }}
        />

        {error ? <FeedbackBanner tone="error" title="Profile update failed" message={error} /> : null}
        {success ? <FeedbackBanner tone="success" title="Profile updated" message={success} /> : null}

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-6">
            <section className="border border-[var(--border)] bg-[var(--surface)]">
              <SectionHeader icon={<UserRound size={18} />} title="Personal & contact details" description="Editable information that does not alter the employee's employment structure." />
              <div className="grid gap-5 p-6 md:grid-cols-2">
                <Field id="employeeNumber" label="Employee number" required value={form.employeeNumber} onChange={(value) => setField('employeeNumber', value)} />
                <div />
                <Field id="firstName" label="First name" required value={form.firstName} onChange={(value) => setField('firstName', value)} />
                <Field id="lastName" label="Last name" required value={form.lastName} onChange={(value) => setField('lastName', value)} />
                <Field id="email" label="Email" type="email" value={form.email} onChange={(value) => setField('email', value)} />
                <Field id="phone" label="Phone" value={form.phone} onChange={(value) => setField('phone', value)} />
                <Field id="dateOfBirth" label="Date of birth" type="date" value={form.dateOfBirth} onChange={(value) => setField('dateOfBirth', value)} />
                <Field id="nationality" label="Nationality" value={form.nationality} onChange={(value) => setField('nationality', value)} />
                <Field id="idNumber" label="ID number" value={form.idNumber} onChange={(value) => setField('idNumber', value)} />
                <Field id="passportNumber" label="Passport number" value={form.passportNumber} onChange={(value) => setField('passportNumber', value)} />
                <Field id="gender" label="Gender" value={form.gender} onChange={(value) => setField('gender', value)} />
              </div>
            </section>

            <section className="border border-[var(--border)] bg-[var(--surface)]">
              <SectionHeader icon={<ShieldCheck size={18} />} title="Emergency contact" description="Emergency contact details remain independent from employment lifecycle changes." />
              <div className="grid gap-5 p-6 md:grid-cols-2">
                <Field id="emergencyContactName" label="Contact name" value={form.emergencyContactName} onChange={(value) => setField('emergencyContactName', value)} />
                <Field id="emergencyContactRelation" label="Relationship" value={form.emergencyContactRelation} onChange={(value) => setField('emergencyContactRelation', value)} />
                <Field id="emergencyContactPhone" label="Contact phone" value={form.emergencyContactPhone} onChange={(value) => setField('emergencyContactPhone', value)} />
              </div>
            </section>

            <div className="flex justify-end border-t border-[var(--border)] pt-5">
              <Button type="submit" variant="primary" icon={<Save size={16} />} loading={saving}>Save profile details</Button>
            </div>
          </div>

          <aside className="space-y-6">
            <section className="border border-[var(--border-strong)] bg-[var(--surface)]">
              <SectionHeader icon={<BriefcaseBusiness size={18} />} title="Employment structure" description="Read-only here. Use the employee profile for audited employment changes." />
              <div className="divide-y divide-[var(--border)] px-6">
                <ReadOnly label="Job title" value={employee.jobTitle ?? 'Not set'} />
                <ReadOnly label="Department" value={employee.department?.name ?? 'Unassigned'} />
                <ReadOnly label="Employment type" value={humanise(employee.employmentType)} />
                <ReadOnly label="Employment status" value={humanise(employee.employmentStatus)} />
                <ReadOnly label="Start date" value={formatDate(employee.startDate)} />
                <ReadOnly label="End date" value={formatDate(employee.endDate)} />
              </div>
              <div className="border-t border-[var(--border)] bg-[var(--surface-soft)] p-5">
                <Button type="button" variant="secondary" className="w-full" onClick={() => router.push(`/dashboard/employees/${employeeId}`)}>Open employment actions</Button>
              </div>
            </section>

            <section className="border border-[var(--border)] bg-[var(--surface-soft)] p-5">
              <div className="flex items-start gap-3">
                <CalendarDays className="mt-0.5 shrink-0 text-[var(--accent)]" size={18} />
                <div>
                  <p className="text-sm font-extrabold text-[var(--text)]">Why these fields are locked</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Promotions, transfers, employment-type changes, suspension, reactivation, resignation and termination must retain effective dates and audit history.</p>
                </div>
              </div>
            </section>
          </aside>
        </section>
      </form>
    </DashboardShell>
  );
}

function Field({ id, label, value, onChange, type = 'text', required = false }: { id: string; label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return (
    <FormField label={label} htmlFor={id} required={required}>
      <input id={id} type={type} required={required} className="field-input" value={value} onChange={(event) => onChange(event.target.value)} />
    </FormField>
  );
}

function SectionHeader({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 border-b border-[var(--border)] px-6 py-5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[var(--border-strong)] bg-[var(--surface-soft)] text-[var(--accent)]">{icon}</div>
      <div>
        <h2 className="text-lg font-black tracking-[-0.03em] text-[var(--text)]">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{description}</p>
      </div>
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 py-4 sm:grid-cols-[130px_1fr] sm:items-baseline">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--muted)]">{label}</p>
      <p className="text-sm font-bold text-[var(--text)]">{value}</p>
    </div>
  );
}
