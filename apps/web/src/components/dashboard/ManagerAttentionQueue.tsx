'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Loader2,
  RefreshCw,
  Target,
} from 'lucide-react';
import { api } from '@/lib/api';

type EmployeeSummary = {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  jobTitle?: string | null;
};

type PendingLeaveRequest = {
  id: string;
  employeeId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number | string;
  createdAt: string;
  employee: EmployeeSummary;
};

type AttendanceExceptionResponse = {
  records: Array<{
    id: string;
    clockInAt: string;
    policyStatus: string;
    lateByMinutes?: number;
    employee: EmployeeSummary;
  }>;
};

type PerformanceOverview = {
  reviews: Array<{
    id: string;
    status: string;
    employee: EmployeeSummary;
    cycle: { name: string; dueDate: string };
  }>;
  goals: Array<{
    id: string;
    title: string;
    progress: number;
    targetDate?: string | null;
    employee: EmployeeSummary;
  }>;
};

type QueueKind = 'LEAVE' | 'ATTENDANCE' | 'REVIEW' | 'GOAL';
type QueuePriority = 1 | 2 | 3;

type QueueItem = {
  id: string;
  kind: QueueKind;
  priority: QueuePriority;
  employee: EmployeeSummary;
  title: string;
  detail: string;
  date: string;
  href: string;
};

function startOfToday() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function daysUntil(value: string) {
  const target = new Date(value);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - startOfToday().getTime()) / 86_400_000);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function humanise(value: string) {
  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function readError(error: unknown) {
  const responseError = error as { response?: { data?: { message?: string | string[] } } };
  const message = responseError.response?.data?.message;
  if (!message) return null;
  return Array.isArray(message) ? message.join(' ') : String(message);
}

export function ManagerAttentionQueue() {
  const [leave, setLeave] = useState<PendingLeaveRequest[]>([]);
  const [attendance, setAttendance] = useState<AttendanceExceptionResponse['records']>([]);
  const [performance, setPerformance] = useState<PerformanceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadQueue() {
    setLoading(true);
    setError('');

    const results = await Promise.allSettled([
      api.get<PendingLeaveRequest[]>('/leave/manager/pending'),
      api.get<AttendanceExceptionResponse>('/attendance/manager/exceptions?days=14'),
      api.get<PerformanceOverview>('/performance/manager/overview'),
    ]);

    const messages: string[] = [];

    if (results[0].status === 'fulfilled') {
      setLeave(results[0].value.data);
    } else {
      setLeave([]);
      messages.push(readError(results[0].reason) ?? 'Leave data unavailable.');
    }

    if (results[1].status === 'fulfilled') {
      setAttendance(results[1].value.data.records);
    } else {
      setAttendance([]);
      messages.push(readError(results[1].reason) ?? 'Attendance data unavailable.');
    }

    if (results[2].status === 'fulfilled') {
      setPerformance(results[2].value.data);
    } else {
      setPerformance(null);
      messages.push(readError(results[2].reason) ?? 'Performance data unavailable.');
    }

    if (messages.length === 3) {
      setError('Could not load the manager attention queue.');
    } else if (messages.length > 0) {
      setError('Some attention data could not be loaded.');
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadQueue();
  }, []);

  const items = useMemo<QueueItem[]>(() => {
    const queue: QueueItem[] = [];

    for (const request of leave) {
      const days = daysUntil(request.startDate);
      queue.push({
        id: `leave-${request.id}`,
        kind: 'LEAVE',
        priority: days <= 3 ? 3 : 2,
        employee: request.employee,
        title: `${humanise(request.leaveType)} leave request`,
        detail: `${Number(request.totalDays)} day${Number(request.totalDays) === 1 ? '' : 's'} · starts ${formatDate(request.startDate)}`,
        date: request.createdAt,
        href: `/dashboard/my-team/${request.employeeId}`,
      });
    }

    for (const record of attendance) {
      const priority: QueuePriority =
        record.policyStatus === 'MISSED_CLOCK_OUT'
          ? 3
          : record.policyStatus === 'LATE_AND_SHORT_SHIFT'
            ? 2
            : 1;
      queue.push({
        id: `attendance-${record.id}`,
        kind: 'ATTENDANCE',
        priority,
        employee: record.employee,
        title: humanise(record.policyStatus),
        detail: record.lateByMinutes
          ? `${record.lateByMinutes} minutes late · ${formatDate(record.clockInAt)}`
          : formatDate(record.clockInAt),
        date: record.clockInAt,
        href: `/dashboard/my-team/${record.employee.id}`,
      });
    }

    for (const review of performance?.reviews ?? []) {
      const dueIn = daysUntil(review.cycle.dueDate);
      queue.push({
        id: `review-${review.id}`,
        kind: 'REVIEW',
        priority: dueIn < 0 ? 3 : dueIn <= 7 ? 2 : 1,
        employee: review.employee,
        title: review.cycle.name,
        detail: `${humanise(review.status)} · due ${formatDate(review.cycle.dueDate)}`,
        date: review.cycle.dueDate,
        href: `/employee/performance?reviewId=${review.id}`,
      });
    }

    for (const goal of performance?.goals ?? []) {
      if (!goal.targetDate) continue;
      const dueIn = daysUntil(goal.targetDate);
      if (dueIn > 7) continue;
      queue.push({
        id: `goal-${goal.id}`,
        kind: 'GOAL',
        priority: dueIn < 0 ? 2 : 1,
        employee: goal.employee,
        title: goal.title,
        detail: `${goal.progress}% complete · target ${formatDate(goal.targetDate)}`,
        date: goal.targetDate,
        href: `/dashboard/my-team/${goal.employee.id}`,
      });
    }

    return queue
      .sort((a, b) => b.priority - a.priority || new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 10);
  }, [attendance, leave, performance]);

  const counts = useMemo(
    () => ({
      urgent: items.filter((item) => item.priority === 3).length,
      high: items.filter((item) => item.priority === 2).length,
      normal: items.filter((item) => item.priority === 1).length,
    }),
    [items],
  );

  return (
    <section className="border border-[var(--border-strong)] bg-[var(--surface)] shadow-[var(--shadow-xs)]">
      <div className="flex flex-col gap-4 border-b border-[var(--border)] px-5 py-5 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[var(--accent)]">
            Needs your attention
          </p>
          <h3 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--text)]">
            Manager action centre
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
            Prioritised leave, attendance and performance items across your current direct reports.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadQueue()}
          disabled={loading}
          className="inline-flex h-10 items-center justify-center gap-2 border border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 text-sm font-bold text-[var(--text)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin" size={15} /> : <RefreshCw size={15} />}
          Refresh queue
        </button>
      </div>

      {error ? (
        <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          {error}
        </div>
      ) : null}

      <div className="grid gap-0 border-b border-[var(--border)] sm:grid-cols-3">
        <QueueMetric label="Urgent" value={counts.urgent} helper="Act first" />
        <QueueMetric label="High priority" value={counts.high} helper="Review soon" />
        <QueueMetric label="Standard" value={counts.normal} helper="Keep moving" />
      </div>

      <div className="p-5 sm:p-6">
        {loading && items.length === 0 ? (
          <div className="flex min-h-36 items-center justify-center text-sm text-[var(--muted)]">
            <Loader2 className="mr-2 animate-spin" size={17} />
            Building your attention queue...
          </div>
        ) : items.length ? (
          <div className="space-y-3">
            {items.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="group flex flex-col gap-3 border border-[var(--border)] bg-[var(--surface-soft)] p-4 transition hover:border-[var(--accent)] sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--accent)]">
                    <QueueIcon kind={item.kind} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black text-[var(--text)]">{item.title}</p>
                      <PriorityBadge priority={item.priority} />
                    </div>
                    <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
                      {item.employee.firstName} {item.employee.lastName} · {item.employee.employeeNumber}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{item.detail}</p>
                  </div>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-black text-[var(--accent)]">
                  Open <ChevronRight className="transition group-hover:translate-x-0.5" size={14} />
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="border border-dashed border-[var(--border-strong)] bg-[var(--surface-soft)] px-5 py-12 text-center">
            <CheckCircle2 className="mx-auto text-[var(--accent)]" size={24} />
            <p className="mt-3 text-sm font-black text-[var(--text)]">Nothing needs immediate attention</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              No pending leave, attendance exceptions, assigned reviews or near-term goals are currently queued.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function QueueMetric({ label, value, helper }: { label: string; value: number; helper: string }) {
  return (
    <div className="border-b border-[var(--border)] p-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--muted)]">{label}</p>
      <div className="mt-2 flex items-end gap-2">
        <p className="text-2xl font-black tracking-[-0.04em] text-[var(--text)]">{value}</p>
        <p className="pb-0.5 text-xs font-semibold text-[var(--muted)]">{helper}</p>
      </div>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: QueuePriority }) {
  const label = priority === 3 ? 'Urgent' : priority === 2 ? 'High' : 'Standard';
  const className =
    priority === 3
      ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300'
      : priority === 2
        ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300'
        : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]';

  return (
    <span className={`border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.12em] ${className}`}>
      {label}
    </span>
  );
}

function QueueIcon({ kind }: { kind: QueueKind }) {
  if (kind === 'LEAVE') return <CalendarDays size={16} />;
  if (kind === 'ATTENDANCE') return <Clock3 size={16} />;
  if (kind === 'REVIEW') return <ClipboardCheck size={16} />;
  if (kind === 'GOAL') return <Target size={16} />;
  return <AlertTriangle size={16} />;
}
