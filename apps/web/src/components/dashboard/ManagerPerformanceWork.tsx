'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ClipboardCheck,
  Flag,
  Loader2,
  RefreshCw,
  Target,
  TrendingUp,
} from 'lucide-react';
import { api } from '@/lib/api';

type EmployeeSummary = {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  jobTitle?: string | null;
};

type ManagerPerformanceOverview = {
  metrics: {
    assignedReviews: number;
    overdueReviews: number;
    activeGoals: number;
    activeDevelopmentPlans: number;
  };
  reviews: Array<{
    id: string;
    employeeId: string;
    status: string;
    reviewerType: string;
    updatedAt: string;
    employee: EmployeeSummary;
    cycle: {
      id: string;
      name: string;
      dueDate: string;
    };
  }>;
  goals: Array<{
    id: string;
    employeeId: string;
    title: string;
    status: string;
    priority: string;
    progress: number;
    targetDate?: string | null;
    employee: EmployeeSummary;
  }>;
  developmentPlans: Array<{
    id: string;
    employeeId: string;
    title: string;
    status: string;
    targetDate?: string | null;
    employee: EmployeeSummary;
  }>;
};

function formatDate(value?: string | null) {
  if (!value) return 'No due date';
  return new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function formatStatus(value: string) {
  return value.replaceAll('_', ' ');
}

function readError(error: unknown, fallback: string) {
  const responseError = error as {
    response?: { data?: { message?: string | string[] } };
  };
  const message = responseError.response?.data?.message ?? fallback;
  return Array.isArray(message) ? message.join(' ') : String(message);
}

export function ManagerPerformanceWork() {
  const [data, setData] = useState<ManagerPerformanceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadPerformanceWork() {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<ManagerPerformanceOverview>(
        '/performance/manager/overview',
      );
      setData(response.data);
    } catch (requestError: unknown) {
      setError(readError(requestError, 'Could not load manager performance work.'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPerformanceWork();
  }, []);

  const upcomingGoals = useMemo(() => data?.goals.slice(0, 5) ?? [], [data]);

  return (
    <section className="border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-xs)]">
      <div className="flex flex-col gap-4 border-b border-[var(--border)] px-5 py-5 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[var(--accent)]">
            Performance attention
          </p>
          <h3 className="mt-2 text-xl font-black tracking-[-0.035em] text-[var(--text)]">
            Team performance work
          </h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Review assignments, active goals and development plans for your current direct reports.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadPerformanceWork()}
          disabled={loading}
          className="inline-flex h-10 items-center justify-center gap-2 border border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 text-sm font-bold text-[var(--text)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin" size={15} /> : <RefreshCw size={15} />}
          Refresh
        </button>
      </div>

      {error ? (
        <div className="border-b border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      ) : null}

      <div className="grid gap-0 border-b border-[var(--border)] sm:grid-cols-2 xl:grid-cols-4">
        <MiniMetric label="Assigned reviews" value={data?.metrics.assignedReviews ?? 0} />
        <MiniMetric label="Overdue reviews" value={data?.metrics.overdueReviews ?? 0} />
        <MiniMetric label="Active goals" value={data?.metrics.activeGoals ?? 0} />
        <MiniMetric label="Development plans" value={data?.metrics.activeDevelopmentPlans ?? 0} />
      </div>

      <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-2">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCheck size={17} className="text-[var(--accent)]" />
            <h4 className="text-sm font-black text-[var(--text)]">Assigned reviews</h4>
          </div>

          {loading && !data ? (
            <div className="mt-4 flex min-h-28 items-center justify-center text-sm text-[var(--muted)]">
              <Loader2 className="mr-2 animate-spin" size={16} />
              Loading performance work...
            </div>
          ) : data?.reviews.length ? (
            <div className="mt-4 space-y-3">
              {data.reviews.slice(0, 5).map((review) => (
                <Link
                  key={review.id}
                  href={`/employee/performance?reviewId=${review.id}`}
                  className="block border border-[var(--border)] bg-[var(--surface-soft)] p-4 transition hover:border-[var(--accent)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-black text-[var(--text)]">
                        {review.employee.firstName} {review.employee.lastName}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {review.cycle.name} · {formatStatus(review.status)}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-[var(--muted)]">
                      Due {formatDate(review.cycle.dueDate)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState text="No active review assignments for your direct reports." />
          )}
        </div>

        <div>
          <div className="flex items-center gap-2">
            <Target size={17} className="text-[var(--accent)]" />
            <h4 className="text-sm font-black text-[var(--text)]">Active goals</h4>
          </div>

          {upcomingGoals.length ? (
            <div className="mt-4 space-y-3">
              {upcomingGoals.map((goal) => (
                <Link
                  key={goal.id}
                  href={`/dashboard/my-team/${goal.employee.id}`}
                  className="block border border-[var(--border)] bg-[var(--surface-soft)] p-4 transition hover:border-[var(--accent)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-black text-[var(--text)]">{goal.title}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {goal.employee.firstName} {goal.employee.lastName} · {goal.priority}
                      </p>
                    </div>
                    <span className="text-xs font-black text-[var(--accent)]">{goal.progress}%</span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden bg-[var(--border)]">
                    <div
                      className="h-full bg-[var(--accent)]"
                      style={{ width: `${Math.max(0, Math.min(100, goal.progress))}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs font-semibold text-[var(--muted)]">
                    Target {formatDate(goal.targetDate)}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState text="No active goals for your current direct reports." />
          )}
        </div>
      </div>

      {data?.developmentPlans.length ? (
        <div className="border-t border-[var(--border)] px-5 py-5 sm:px-6">
          <div className="flex items-center gap-2">
            <TrendingUp size={17} className="text-[var(--accent)]" />
            <h4 className="text-sm font-black text-[var(--text)]">Development plans</h4>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.developmentPlans.slice(0, 6).map((plan) => (
              <Link
                key={plan.id}
                href={`/dashboard/my-team/${plan.employee.id}`}
                className="border border-[var(--border)] bg-[var(--surface-soft)] p-4 transition hover:border-[var(--accent)]"
              >
                <Flag size={15} className="text-[var(--accent)]" />
                <p className="mt-3 font-black text-[var(--text)]">{plan.title}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {plan.employee.firstName} {plan.employee.lastName} · {formatStatus(plan.status)}
                </p>
                <p className="mt-2 text-xs font-semibold text-[var(--muted)]">
                  Target {formatDate(plan.targetDate)}
                </p>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-b border-[var(--border)] p-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--text)]">{value}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="mt-4 border border-dashed border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 py-8 text-center text-sm text-[var(--muted)]">
      {text}
    </div>
  );
}
