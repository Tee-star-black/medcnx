'use client';

import Link from 'next/link';
import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  BriefcaseBusiness,
  ChevronRight,
  CircleUserRound,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { ManagerAttendanceExceptions } from '@/components/dashboard/ManagerAttendanceExceptions';
import { ManagerLeaveApprovals } from '@/components/dashboard/ManagerLeaveApprovals';
import { ManagerPerformanceWork } from '@/components/dashboard/ManagerPerformanceWork';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { api } from '@/lib/api';

type EmployeeSummary = {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  jobTitle?: string | null;
  employmentStatus: string;
  departmentId?: string | null;
};

type ManagerContext = {
  employee: {
    id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    jobTitle?: string | null;
    managerId?: string | null;
  };
  manager: EmployeeSummary | null;
  directReports: EmployeeSummary[];
};

const statusOptions = ['ALL', 'ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'INACTIVE'];

function normaliseStatus(status: string) {
  return status.replaceAll('_', ' ');
}

export default function MyTeamPage() {
  const [context, setContext] = useState<ManagerContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    void loadTeam();
  }, []);

  async function loadTeam() {
    setLoading(true);
    setError('');

    try {
      const response = await api.get<ManagerContext>('/employees/me/manager-context');
      setContext(response.data);
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ?? 'Could not load your team workspace.';
      setError(Array.isArray(message) ? message.join(' ') : message);
      setContext(null);
    } finally {
      setLoading(false);
    }
  }

  const metrics = useMemo(() => {
    const reports = context?.directReports ?? [];

    return {
      total: reports.length,
      active: reports.filter((employee) => employee.employmentStatus === 'ACTIVE').length,
      onLeave: reports.filter((employee) => employee.employmentStatus === 'ON_LEAVE').length,
      exceptions: reports.filter((employee) =>
        ['SUSPENDED', 'INACTIVE'].includes(employee.employmentStatus),
      ).length,
    };
  }, [context]);

  const filteredReports = useMemo(() => {
    const reports = context?.directReports ?? [];
    const normalisedQuery = query.trim().toLowerCase();

    return reports.filter((employee) => {
      const matchesStatus =
        statusFilter === 'ALL' || employee.employmentStatus === statusFilter;

      if (!matchesStatus) {
        return false;
      }

      if (!normalisedQuery) {
        return true;
      }

      return [
        employee.firstName,
        employee.lastName,
        employee.employeeNumber,
        employee.jobTitle ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalisedQuery);
    });
  }, [context, query, statusFilter]);

  return (
    <DashboardShell activePage="my-team">
      <div className="space-y-7">
        <section className="overflow-hidden border border-[var(--border-strong)] bg-[var(--surface)] shadow-[var(--shadow-xs)]">
          <div className="grid gap-0 xl:grid-cols-[1fr_320px]">
            <div className="relative overflow-hidden p-6 sm:p-8">
              <div className="absolute right-0 top-0 h-32 w-32 translate-x-12 -translate-y-12 border border-[var(--accent)] opacity-20" />
              <div className="absolute right-10 top-10 h-20 w-20 border border-[var(--accent)] opacity-10" />

              <div className="relative max-w-3xl">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-[var(--accent)]">
                  Manager workspace
                </p>
                <h2 className="mt-3 text-3xl font-black tracking-[-0.055em] text-[var(--text)] sm:text-4xl">
                  {context
                    ? `${context.employee.firstName}'s team`
                    : 'Your team'}
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                  A focused view of your current reporting line. See who reports to you,
                  who you report to, and the employment status of your immediate team.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void loadTeam()}
                    disabled={loading}
                    className="inline-flex items-center justify-center gap-2 border border-[var(--accent)] bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-[var(--accent-text)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <RefreshCw size={16} />
                    )}
                    Refresh team
                  </button>

                  <Link
                    href="/employee"
                    className="inline-flex items-center justify-center gap-2 border border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 py-2.5 text-sm font-bold text-[var(--text)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  >
                    <CircleUserRound size={16} />
                    My employee portal
                  </Link>
                </div>
              </div>
            </div>

            <div className="border-t border-[var(--border)] bg-[var(--surface-soft)] p-6 xl:border-l xl:border-t-0">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[var(--muted)]">
                Your reporting line
              </p>

              {context ? (
                <div className="mt-5 space-y-5">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                      You
                    </p>
                    <p className="mt-1 text-base font-black text-[var(--text)]">
                      {context.employee.firstName} {context.employee.lastName}
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {context.employee.jobTitle ?? 'Job title not set'} · {context.employee.employeeNumber}
                    </p>
                  </div>

                  <div className="border-t border-[var(--border)] pt-5">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                      Reports to
                    </p>
                    {context.manager ? (
                      <div className="mt-3 flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[var(--accent)] bg-[var(--surface)] text-[var(--accent)]">
                          <UserRoundCheck size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-[var(--text)]">
                            {context.manager.firstName} {context.manager.lastName}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
                            {context.manager.jobTitle ?? 'Job title not set'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        No manager is currently assigned.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-5 h-24 animate-pulse bg-[var(--surface)]" />
              )}
            </div>
          </div>
        </section>

        {error ? (
          <div className="border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        ) : null}

        {loading && !context ? (
          <div className="flex min-h-[420px] items-center justify-center border border-[var(--border)] bg-[var(--surface)]">
            <div className="text-center">
              <Loader2 className="mx-auto animate-spin text-[var(--accent)]" size={26} />
              <p className="mt-4 text-sm font-bold text-[var(--text)]">Loading your team</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Resolving the current effective reporting structure.
              </p>
            </div>
          </div>
        ) : null}

        {context ? (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Direct reports"
                value={String(metrics.total)}
                helper="Current team size"
                icon={<UsersRound size={18} />}
              />
              <MetricCard
                label="Active"
                value={String(metrics.active)}
                helper="Currently active"
                icon={<ShieldCheck size={18} />}
              />
              <MetricCard
                label="On leave"
                value={String(metrics.onLeave)}
                helper="Currently away"
                icon={<UserRoundCheck size={18} />}
              />
              <MetricCard
                label="Exceptions"
                value={String(metrics.exceptions)}
                helper="Suspended or inactive"
                icon={<BriefcaseBusiness size={18} />}
              />
            </section>

            <ManagerLeaveApprovals />
            <ManagerAttendanceExceptions />
            <ManagerPerformanceWork />

            <section className="border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-xs)]">
              <div className="border-b border-[var(--border)] px-5 py-5 sm:px-6">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                  <div>
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[var(--accent)]">
                      Immediate team
                    </p>
                    <h3 className="mt-2 text-xl font-black tracking-[-0.035em] text-[var(--text)]">
                      Direct reports
                    </h3>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      Employees currently assigned directly to you in the effective reporting structure.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <label className="flex min-w-0 items-center gap-2 border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 focus-within:border-[var(--accent)] sm:w-72">
                      <Search size={16} className="shrink-0 text-[var(--muted)]" />
                      <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search team"
                        className="h-10 min-w-0 flex-1 bg-transparent text-sm font-medium text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
                      />
                    </label>

                    <select
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value)}
                      className="h-10 border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 text-sm font-bold text-[var(--text)] outline-none focus:border-[var(--accent)]"
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status === 'ALL' ? 'All statuses' : normaliseStatus(status)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="p-5 sm:p-6">
                {context.directReports.length === 0 ? (
                  <EmptyTeam />
                ) : filteredReports.length === 0 ? (
                  <div className="border border-dashed border-[var(--border-strong)] bg-[var(--surface-soft)] px-5 py-12 text-center">
                    <Search className="mx-auto text-[var(--muted)]" size={22} />
                    <p className="mt-3 text-sm font-bold text-[var(--text)]">
                      No team members match those filters.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setQuery('');
                        setStatusFilter('ALL');
                      }}
                      className="mt-4 text-sm font-bold text-[var(--accent)] hover:underline"
                    >
                      Clear filters
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                    {filteredReports.map((employee) => (
                      <TeamMemberCard key={employee.id} employee={employee} />
                    ))}
                  </div>
                )}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </DashboardShell>
  );
}

function TeamMemberCard({ employee }: { employee: EmployeeSummary }) {
  return (
    <Link
      href={`/dashboard/my-team/${employee.id}`}
      className="group block border border-[var(--border)] bg-[var(--surface-soft)] p-5 transition hover:border-[var(--accent)] hover:bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-ring)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-[var(--accent)] bg-[var(--accent)] text-xs font-black text-[var(--accent-text)]">
            {employee.firstName.charAt(0)}
            {employee.lastName.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-black tracking-[-0.025em] text-[var(--text)]">
              {employee.firstName} {employee.lastName}
            </p>
            <p className="mt-1 truncate text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
              {employee.employeeNumber}
            </p>
          </div>
        </div>
        <StatusBadge status={employee.employmentStatus} />
      </div>

      <div className="mt-5 grid gap-4 border-t border-[var(--border)] pt-4 sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--muted)]">
            Role
          </p>
          <p className="mt-1 text-sm font-bold text-[var(--text)]">
            {employee.jobTitle ?? 'Not set'}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--muted)]">
            Status
          </p>
          <p className="mt-1 text-sm font-bold text-[var(--text)]">
            {normaliseStatus(employee.employmentStatus)}
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-[var(--border)] pt-4 text-xs font-bold text-[var(--muted)]">
        <span>Direct report</span>
        <span className="inline-flex items-center gap-1 text-[var(--accent)] transition group-hover:translate-x-0.5">
          Open team member <ChevronRight size={14} />
        </span>
      </div>
    </Link>
  );
}

function EmptyTeam() {
  return (
    <div className="border border-dashed border-[var(--border-strong)] bg-[var(--surface-soft)] px-5 py-14 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--accent)]">
        <UsersRound size={22} />
      </div>
      <p className="mt-4 text-base font-black text-[var(--text)]">No direct reports assigned</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
        This workspace will populate automatically when an employee is assigned to you through the effective-dated manager workflow.
      </p>
    </div>
  );
}

function MetricCard({
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
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[var(--muted)]">
            {label}
          </p>
          <p className="mt-3 text-3xl font-black tracking-[-0.055em] text-[var(--text)]">
            {value}
          </p>
          <p className="mt-1 text-sm font-medium text-[var(--muted)]">{helper}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--accent)]">
          {icon}
        </div>
      </div>
    </article>
  );
}
