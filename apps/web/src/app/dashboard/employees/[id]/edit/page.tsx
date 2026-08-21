'use client';

import { useEffect, useState } from 'react';
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
  department?: {
    id: string;
    name: string;
  } | null;
};

function toDateInputValue(value?: string | null) {
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

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed || undefined;
}

export default function EditEmployeePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const employeeId = params.id;

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [employeeNumber, setEmployeeNumber] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [passportNumber, setPassportNumber] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [nationality, setNationality] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [emergencyContactRelation, setEmergencyContactRelation] = useState('');

  useEffect(() => {
    void loadEmployee();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  async function loadEmployee() {
    setLoading(true);
    setError('');

    try {
      const response = await api.get<Employee>(`/employees/${employeeId}`);
      const current = response.data;
      setEmployee(current);
      setEmployeeNumber(current.employeeNumber ?? '');
      setFirstName(current.firstName ?? '');
      setLastName(current.lastName ?? '');
      setEmail(current.email ?? '');
      setPhone(current.phone ?? '');
      setIdNumber(current.idNumber ?? '');
      setPassportNumber(current.passportNumber ?? '');
      setDateOfBirth(toDateInputValue(current.dateOfBirth));
      setGender(current.gender ?? '');
      setNationality(current.nationality ?? '');
      setEmergencyContactName(current.emergencyContactName ?? '');
      setEmergencyContactPhone(current.emergencyContactPhone ?? '');
      setEmergencyContactRelation(current.emergencyContactRelation ?? '');
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ?? 'Could not load employee profile.';
      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally {
      setLoading(false);
    }
  }

  async function updateEmployee(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!employeeNumber.trim() || !firstName.trim() || !lastName.trim()) {
      setError('Employee number, first name and last name are required.');
      return;
    }

    setSaving(true);

    try {
      await api.patch(`/employees/${employeeId}`, {
        employeeNumber: employeeNumber.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: optionalText(email),
        phone: optionalText(phone),
        idNumber: optionalText(idNumber),
        passportNumber: optionalText(passportNumber),
        dateOfBirth: dateOfBirth || undefined,
        gender: optionalText(gender),
        nationality: optionalText(nationality),
        emergencyContactName: optionalText(emergencyContactName),
        emergencyContactPhone: optionalText(emergencyContactPhone),
        emergencyContactRelation: optionalText(emergencyContactRelation),
      });

      setSuccess('Employee profile details updated.');
      await loadEmployee();
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ?? 'Could not update employee profile.';
      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <DashboardShell activePage="employees">
        <div className="flex min-h-[420px] items-center justify-center border border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-center gap-3 text-sm font-medium text-[var(--muted)]">
            <Loader2 className="animate-spin text-[var(--accent)]" size={18} />
            Loading employee editor...
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (!employee) {
    return (
      <DashboardShell activePage="employees">
        <FeedbackBanner
          tone="error"
          title="Employee unavailable"
          message={error || 'Employee profile could not be loaded.'}
        />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell activePage="employees">
      <form onSubmit={updateEmployee} className="space-y-6">
        <PageHeader
          category="Employee profile"
          title={`Edit ${employee.firstName} ${employee.lastName}`}
          description="Update personal, contact and identity information. Employment structure and lifecycle changes are controlled through dedicated audited workflows."
          primaryAction={{
            label: saving ? 'Saving...' : 'Save profile',
            onClick: () => undefined,
            icon: saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />,
          }}
          secondaryAction={{
            label: 'Back to profile',
            onClick: () => router.push(`/dashboard/employees/${employeeId}`),
            icon: <ArrowLeft size={16} />,
          }}
        />

        {error ? (
          <FeedbackBanner tone="error" title="Profile update failed" message={error} />
        ) : null}
        {success ? (
          <FeedbackBanner tone="success" title="Profile updated" message={success} />
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-6">
            <section className="border border-[var(--border)] bg-[var(--surface)]">
              <SectionHeader
                icon={<UserRound size={18} />}
                title="Personal & contact details"
                description="Editable profile information that does not change the employee's employment structure."
              />
              <div className="grid gap-5 p-6 md:grid-cols-2">
                <FormField label="Employee number" required>
                  <input className="field-input" value={employeeNumber} onChange={(event) => setEmployeeNumber(event.target.value)} />
                </FormField>
                <div />
                <FormField label="First name" required>
                  <input className="field-input" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
                </FormField>
                <FormField label="Last name" required>
                  <input className="field-input" value={lastName} onChange={(event) => setLastName(event.target.value)} />
                </FormField>
                <FormField label="Email">
                  <input type="email" className="field-input" value={email} onChange={(event) => setEmail(event.target.value)} />
                </FormField>
                <FormField label="Phone">
                  <input className="field-input" value={phone} onChange={(event) => setPhone(event.target.value)} />
                </FormField>
                <FormField label="Date of birth">
                  <input type="date" className="field-input" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} />
                </FormField>
                <FormField label="Nationality">
                  <input className="field-input" value={nationality} onChange={(event) => setNationality(event.target.value)} />
                </FormField>
                <FormField label="ID number">
                  <input className="field-input" value={idNumber} onChange={(event) => setIdNumber(event.target.value)} />
                </FormField>
                <FormField label="Passport number">
                  <input className="field-input" value={passportNumber} onChange={(event) => setPassportNumber(event.target.value)} />
                </FormField>
                <FormField label="Gender">
                  <input className="field-input" value={gender} onChange={(event) => setGender(event.target.value)} />
                </FormField>
              </div>
            </section>

            <section className="border border-[var(--border)] bg-[var(--surface)]">
              <SectionHeader
                icon={<ShieldCheck size={18} />}
                title="Emergency contact"
                description="Maintain emergency contact details independently from employment changes."
              />
              <div className="grid gap-5 p-6 md:grid-cols-2">
                <FormField label="Contact name">
                  <input className="field-input" value={emergencyContactName} onChange={(event) => setEmergencyContactName(event.target.value)} />
                </FormField>
                <FormField label="Relationship">
                  <input className="field-input" value={emergencyContactRelation} onChange={(event) => setEmergencyContactRelation(event.target.value)} />
                </FormField>
                <FormField label="Contact phone">
                  <input className="field-input" value={emergencyContactPhone} onChange={(event) => setEmergencyContactPhone(event.target.value)} />
                </FormField>
              </div>
            </section>

            <div className="flex justify-end border-t border-[var(--border)] pt-5">
              <Button type="submit" variant="primary" icon={<Save size={16} />} loading={saving}>
                Save profile details
              </Button>
            </div>
          </div>

          <aside className="space-y-6">
            <section className="border border-[var(--border-strong)] bg-[var(--surface)]">
              <SectionHeader
                icon={<BriefcaseBusiness size={18} />}
                title="Employment structure"
                description="Read-only here. Use the employee profile workflows for audited employment changes."
              />
              <div className="divide-y divide-[var(--border)] p-6 pt-2">
                <ReadOnlyField label="Job title" value={employee.jobTitle ?? 'Not set'} />
                <ReadOnlyField label="Department" value={employee.department?.name ?? 'Unassigned'} />
                <ReadOnlyField label="Employment type" value={humanise(employee.employmentType)} />
                <ReadOnlyField label="Employment status" value={humanise(employee.employmentStatus)} />
                <ReadOnlyField label="Start date" value={formatDate(employee.startDate)} />
                <ReadOnlyField label="End date" value={formatDate(employee.endDate)} />
              </div>
              <div className="border-t border-[var(--border)] bg-[var(--surface-soft)] p-5">
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={() => router.push(`/dashboard/employees/${employeeId}`)}
                >
                  Open employment actions
                </Button>
              </div>
            </section>

            <section className="border border-[var(--border)] bg-[var(--surface-soft)] p-5">
              <div className="flex items-start gap-3">
                <CalendarDays className="mt-0.5 shrink-0 text-[var(--accent)]" size={18} />
                <div>
                  <p className="text-sm font-extrabold text-[var(--text)]">Why these fields are locked</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                    Promotions, transfers, employment-type changes, suspension, reactivation, resignation and termination must retain their effective dates and audit history.
                  </p>
                </div>
              </div>
            </section>
          </aside>
        </section>
      </form>
    </DashboardShell>
  );
}

function SectionHeader({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-[var(--border)] px-6 py-5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[var(--border-strong)] bg-[var(--surface-soft)] text-[var(--accent)]">
        {icon}
      </div>
      <div>
        <h2 className="text-lg font-black tracking-[-0.03em] text-[var(--text)]">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{description}</p>
      </div>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 py-4 sm:grid-cols-[130px_1fr] sm:items-baseline">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--muted)]">{label}</p>
      <p className="text-sm font-bold text-[var(--text)]">{value}</p>
    </div>
  );
}
