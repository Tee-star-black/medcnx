'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  Clock3,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { api } from '@/lib/api';

type AttendanceException = {
  id: string;
  clockInAt: string;
  clockOutAt?: string | null;
  policyStatus: string;
  lateByMinutes?: number;
  earlyClockOutByMinutes?: number;
  workedMinutes?: number;
  employee: {
    id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    jobTitle?: string | null;
    department?: { id: string; name: string } | null;
  };
};

type AttendanceExceptionResponse = {
  windowDays: number;
  total: number;
  byStatus: Record<string, number>;
  records: AttendanceException[];
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
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

export function ManagerAttendanceExceptions() {
  const [data, setData] = useState<AttendanceExceptionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadExceptions() {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<AttendanceExceptionResponse>(
        '/attendance/manager/exceptions?days=14',
      );
      setData(response.data);
    } catch (requestError: unknown) {
      setError(readError(requestError, 'Could not load attendance exceptions.'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadExceptions();
  }, []);

  const metrics = useMemo(
    () => ({
      late: data?.byStatus.LATE ?? 0,
      short: data?.byStatus.SHORT_SHIFT ?? 0,
      combined: data?.byStatus.LATE_AND_SHORT_SHIFT ?? 0,
      missed: data?.byStatus.MISSED_CLOCK_OUT ?? 0,
    }),
    [data],
  );

  return (
    <section className="border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-xs)]">
      <div className="flex flex-col gap-4 border-b border-[var(--border)] px-5 py-5 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[var(--accent)]">
            Attendance attention
          </p>
          <h3 className="mt-2 text-xl font-black tracking-[-0.035em] text-[var(--text)]">
            Attendance exceptions
          </h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Policy exceptions for current direct reports over the last {data?.windowDays ?? 14} days.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadExceptions()}
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
        <MiniMetric label="Late" value={metrics.late} />
        <MiniMetric label="Short shift" value={metrics.short} />
        <MiniMetric label="Late + short" value={metrics.combined} />
        <MiniMetric label="Missed clock-out" value={metrics.missed} />
      </div>

      <div className="p-5 sm:p-6">
        {loading && !data ? (
          <div className="flex min-h-36 items-center justify-center text-sm text-[var(--muted)]">
            <Loader2 className="mr-2 animate-spin" size={17} />
            Loading attendance exceptions...
          </div>
        ) : data?.records.length ? (
          <div className="space-y-3">
            {data.records.slice(0, 8).map((record) => (
              <Link
                key={record.id}
                href={`/dashboard/my-team/${record.employee.id}`}
                className="flex flex-col gap-3 border border-[var(--border)] bg-[var(--surface-soft)] p-4 transition hover:border-[var(--accent)] sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black text-[var(--text)]">
                      {record.employee.firstName} {record.employee.lastName}
                    </p>
                    <span className="border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      {formatStatus(record.policyStatus)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {record.employee.employeeNumber} · {record.employee.jobTitle ?? 'Job title not set'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-[var(--muted)] sm:justify-end">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarClock size={14} />
                    {formatDateTime(record.clockInAt)}
                  </span>
                  {record.lateByMinutes ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Clock3 size={14} />
                      {record.lateByMinutes} min late
                    </span>
                  ) : null}
                </div>
              </Link>
            ))}

            {data.records.length > 8 ? (
              <p className="pt-2 text-center text-xs font-semibold text-[var(--muted)]">
                Showing 8 of {data.total} exceptions.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="border border-dashed border-[var(--border-strong)] bg-[var(--surface-soft)] px-5 py-10 text-center">
            <AlertTriangle className="mx-auto text-[var(--accent)]" size={22} />
            <p className="mt-3 text-sm font-black text-[var(--text)]">No attendance exceptions</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              No direct-report attendance policy exceptions were found in this window.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-b border-[var(--border)] p-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--text)]">{value}</p>
    </div>
  );
}
