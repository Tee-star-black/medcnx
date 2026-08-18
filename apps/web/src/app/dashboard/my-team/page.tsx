'use client';

import { useEffect, useState } from 'react';
import {
  BriefcaseBusiness,
  Loader2,
  RefreshCw,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
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

export default function MyTeamPage() {
  const [context, setContext] = useState<ManagerContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadTeam();
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

  return (
    <DashboardShell activePage="my-team">
      <div className="space-y-6">
        <section className="flex flex-col gap-4 border-b border-[var(--border)] pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
              Manager workspace
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.05em] text-[var(--text)]">
              Your reporting line
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Review your current manager and the employees who report directly to you.
            </p>
          </div>

          <button
            type="button"
            onClick={loadTeam}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-2.5 text-sm font-bold text-[var(--text)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
            Refresh
          </button>
        </section>

        {error ? (
          <div className="border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        ) : null}

        {loading && !context ? (
          <div className="flex min-h-[360px] items-center justify-center border border-[var(--border)] bg-[var(--surface)]">
            <div className="flex items-center gap-3 text-sm text-[var(--muted)]">
              <Loader2 className="animate-spin" size={18} />
              Loading your team...
            </div>
          </div>
        ) : null}

        {context ? (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              <MetricCard
                label="Direct reports"
                value={String(context.directReports.length)}
                helper="Active employees reporting to you"
                icon={<UsersRound size={18} />}
              />
              <MetricCard
                label="Your manager"
                value={
                  context.manager
                    ? `${context.manager.firstName} ${context.manager.lastName}`
                    : 'No manager assigned'
                }
                helper={context.manager?.jobTitle ?? 'Current reporting line'}
                icon={<UserRoundCheck size={18} />}
              />
              <MetricCard
                label="Your role"
                value={context.employee.jobTitle ?? 'Not set'}
                helper={context.employee.employeeNumber}
                icon={<BriefcaseBusiness size={18} />}
              />
            </section>

            <section className="border border-[var(--border)] bg-[var(--surface)]">
              <div className="border-b border-[var(--border)] px-6 py-5">
                <h3 className="text-lg font-black tracking-[-0.03em] text-[var(--text)]">
                  Direct reports
                </h3>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Your immediate team based on the current effective reporting structure.
                </p>
              </div>

              <div className="p-6">
                {context.directReports.length === 0 ? (
                  <div className="border border-dashed border-[var(--border-strong)] bg-[var(--surface-soft)] px-5 py-12 text-center">
                    <UsersRound className="mx-auto text-[var(--muted)]" size={24} />
                    <p className="mt-3 text-sm font-bold text-[var(--text)]">
                      No direct reports assigned.
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      This workspace will populate automatically when employees are assigned to you.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                    {context.directReports.map((employee) => (
                      <article
                        key={employee.id}
                        className="border border-[var(--border)] bg-[var(--surface-soft)] p-5"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center border border-[var(--accent)] bg-[var(--accent)] text-xs font-black text-[var(--accent-text)]">
                              {employee.firstName.charAt(0)}
                              {employee.lastName.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-[var(--text)]">
                                {employee.firstName} {employee.lastName}
                              </p>
                              <p className="mt-1 truncate text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                                {employee.employeeNumber}
                              </p>
                            </div>
                          </div>
                          <StatusBadge status={employee.employmentStatus} />
                        </div>

                        <div className="mt-5 border-t border-[var(--border)] pt-4">
                          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                            Job title
                          </p>
                          <p className="mt-1 text-sm font-semibold text-[var(--text)]">
                            {employee.jobTitle ?? 'Not set'}
                          </p>
                        </div>
                      </article>
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

function MetricCard({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
}) {
  return (
    <article className="border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
          {label}
        </p>
        <span className="text-[var(--accent)]">{icon}</span>
      </div>
      <p className="mt-4 text-xl font-black tracking-[-0.04em] text-[var(--text)]">
        {value}
      </p>
      <p className="mt-1 text-sm text-[var(--muted)]">{helper}</p>
    </article>
  );
}
