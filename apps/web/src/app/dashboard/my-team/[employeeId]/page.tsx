'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  UserRound,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { api } from '@/lib/api';

type DirectReportDetail = {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
  employmentType?: string | null;
  employmentStatus: string;
  startDate?: string | null;
  endDate?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  managerId?: string | null;
  department?: {
    id: string;
    name: string;
  } | null;
};

function formatDate(value?: string | null) {
  if (!value) return 'Not set';

  return new Intl.DateTimeFormat('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(new Date(value));
}

function formatValue(value?: string | null) {
  return value?.trim() || 'Not set';
}

function formatStatus(value?: string | null) {
  return value ? value.replaceAll('_', ' ') : 'Not set';
}

export default function DirectReportDetailPage() {
  const params = useParams<{ employeeId: string }>();
  const employeeId = params.employeeId;

  const [employee, setEmployee] = useState<DirectReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void loadEmployee();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  async function loadEmployee() {
    setLoading(true);
    setError('');

    try {
      const response = await api.get<DirectReportDetail>(
        `/employees/me/direct-reports/${employeeId}`,
      );
      setEmployee(response.data);
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ??
        'Could not load this team member.';
      setError(Array.isArray(message) ? message.join(' ') : message);
      setEmployee(null);
    } finally {
      setLoading(false);
    }
  }

  if (loading && !employee) {
    return (
      <DashboardShell activePage="my-team">
        <div className="flex min-h-[520px] items-center justify-center border border-[var(--border)] bg-[var(--surface)]">
          <div className="text-center">
            <Loader2 className="mx-auto animate-spin text-[var(--accent)]" size={26} />
            <p className="mt-4 text-sm font-bold text-[var(--text)]">
              Loading team member
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Verifying the active reporting relationship.
            </p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (!employee) {
    return (
      <DashboardShell activePage="my-team">
        <div className="space-y-5">
          <Link
            href="/dashboard/my-team"
            className="inline-flex items-center gap-2 text-sm font-bold text-[var(--muted)] transition hover:text-[var(--accent)]"
          >
            <ArrowLeft size={16} />
            Back to My Team
          </Link>
          <div className="border border-red-200 bg-red-50 px-5 py-5 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error || 'Direct report not found.'}
          </div>
        </div>
      </DashboardShell>
    );
  }

  const location = [employee.city, employee.province, employee.country]
    .filter(Boolean)
    .join(', ');

  return (
    <DashboardShell activePage="my-team">
      <div className="space-y-7">
        <section className="border-b border-[var(--border)] pb-6">
          <Link
            href="/dashboard/my-team"
            className="inline-flex items-center gap-2 text-sm font-bold text-[var(--muted)] transition hover:text-[var(--accent)]"
          >
            <ArrowLeft size={16} />
            Back to My Team
          </Link>

          <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center border border-[var(--accent)] bg-[var(--accent)] text-lg font-black text-[var(--accent-text)]">
                {employee.firstName.charAt(0)}
                {employee.lastName.charAt(0)}
              </div>

              <div className="min-w-0">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[var(--accent)]">
                  Direct report
                </p>
                <h2 className="mt-1 truncate text-3xl font-black tracking-[-0.05em] text-[var(--text)]">
                  {employee.firstName} {employee.lastName}
                </h2>
                <p className="mt-2 text-sm font-medium text-[var(--muted)]">
                  {employee.employeeNumber} · {employee.jobTitle ?? 'No job title'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={employee.employmentStatus} />
              <button
                type="button"
                onClick={() => void loadEmployee()}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-2.5 text-sm font-bold text-[var(--text)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <RefreshCw size={16} />
                )}
                Refresh
              </button>
            </div>
          </div>
        </section>

        {error ? (
          <div className="border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Role"
            value={employee.jobTitle ?? 'Not set'}
            helper={formatStatus(employee.employmentType)}
            icon={<BriefcaseBusiness size={18} />}
          />
          <SummaryCard
            label="Department"
            value={employee.department?.name ?? 'Unassigned'}
            helper="Current department"
            icon={<Building2 size={18} />}
          />
          <SummaryCard
            label="Start date"
            value={formatDate(employee.startDate)}
            helper="Employment start"
            icon={<CalendarDays size={18} />}
          />
          <SummaryCard
            label="Status"
            value={formatStatus(employee.employmentStatus)}
            helper={employee.endDate ? `Ended ${formatDate(employee.endDate)}` : 'Current employment state'}
            icon={<UserRound size={18} />}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-xs)]">
            <div className="border-b border-[var(--border)] px-6 py-5">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[var(--accent)]">
                Team member details
              </p>
              <h3 className="mt-2 text-lg font-black tracking-[-0.03em] text-[var(--text)]">
                Contact and work information
              </h3>
            </div>

            <div className="grid gap-0 sm:grid-cols-2">
              <DetailRow
                label="Email"
                value={formatValue(employee.email)}
                icon={<Mail size={17} />}
              />
              <DetailRow
                label="Phone"
                value={formatValue(employee.phone)}
                icon={<Phone size={17} />}
              />
              <DetailRow
                label="Location"
                value={location || 'Not set'}
                icon={<MapPin size={17} />}
              />
              <DetailRow
                label="Department"
                value={employee.department?.name ?? 'Unassigned'}
                icon={<Building2 size={17} />}
              />
              <DetailRow
                label="Employment type"
                value={formatStatus(employee.employmentType)}
                icon={<BriefcaseBusiness size={17} />}
              />
              <DetailRow
                label="Employee number"
                value={employee.employeeNumber}
                icon={<UserRound size={17} />}
              />
            </div>
          </section>

          <section className="border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-xs)]">
            <div className="border-b border-[var(--border)] px-6 py-5">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[var(--accent)]">
                Manager scope
              </p>
              <h3 className="mt-2 text-lg font-black tracking-[-0.03em] text-[var(--text)]">
                What you can see here
              </h3>
            </div>

            <div className="space-y-4 p-6 text-sm leading-6 text-[var(--muted)]">
              <p>
                This view is limited to employees who currently report directly to you. It does not grant organisation-wide employee access.
              </p>
              <p>
                Payroll, identity documents, confidential HR files and administrative lifecycle controls are intentionally excluded from this manager view.
              </p>
              <div className="border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                <p className="font-bold text-[var(--text)]">Next manager capabilities</p>
                <p className="mt-1">
                  Leave approvals, attendance exceptions and performance actions will attach here once their manager-scoped APIs are implemented.
                </p>
              </div>
            </div>
          </section>
        </section>
      </div>
    </DashboardShell>
  );
}

function SummaryCard({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: string;
  helper: string;
  icon: ReactNode;
}) {
  return (
    <article className="border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-xs)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[var(--muted)]">
            {label}
          </p>
          <p className="mt-3 truncate text-lg font-black tracking-[-0.035em] text-[var(--text)]">
            {value}
          </p>
          <p className="mt-1 text-xs font-medium text-[var(--muted)]">{helper}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--accent)]">
          {icon}
        </div>
      </div>
    </article>
  );
}

function DetailRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex gap-3 border-b border-[var(--border)] p-5 sm:border-r sm:last:border-r-0">
      <div className="mt-0.5 text-[var(--accent)]">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--muted)]">
          {label}
        </p>
        <p className="mt-1 break-words text-sm font-bold text-[var(--text)]">{value}</p>
      </div>
    </div>
  );
}
