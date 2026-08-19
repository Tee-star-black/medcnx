'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Loader2,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { api } from '@/lib/api';

type EmploymentHistoryEvent = {
  id: string;
  eventType: string;
  effectiveDate: string;
  reason?: string | null;
  previous?: Record<string, unknown>;
  next?: Record<string, unknown>;
  previousEmploymentStatus?: string;
  nextEmploymentStatus?: string;
  departmentId?: string;
  managerId?: string;
  jobTitle?: string;
  employmentType?: string;
  changedByUserId?: string | null;
  message: string;
  recordedAt: string;
};

type Props = {
  employeeId: string;
  refreshKey?: string | null;
};

type ApiError = {
  response?: {
    data?: {
      message?: string | string[];
    };
  };
};

function readError(error: unknown, fallback: string) {
  const message = (error as ApiError).response?.data?.message;
  return Array.isArray(message) ? message.join(' ') : message || fallback;
}

function formatDate(value?: string | null) {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(new Date(value));
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function label(value?: unknown) {
  if (value === null || value === undefined || value === '') return 'Not set';
  return String(value).replaceAll('_', ' ');
}

function eventLabel(eventType: string) {
  const labels: Record<string, string> = {
    HIRED: 'Hired',
    PROMOTED: 'Promotion',
    TRANSFERRED: 'Department transfer',
    MANAGER_CHANGED: 'Manager changed',
    EMPLOYMENT_TYPE_CHANGED: 'Employment type changed',
    SUSPENDED: 'Suspended',
    REACTIVATED: 'Reactivated',
    RESIGNED: 'Resignation',
    TERMINATED: 'Termination',
  };
  return labels[eventType] ?? label(eventType);
}

function eventIcon(eventType: string) {
  if (eventType === 'PROMOTED') return <BriefcaseBusiness size={16} />;
  if (eventType === 'TRANSFERRED') return <Building2 size={16} />;
  if (eventType === 'MANAGER_CHANGED') return <UserRound size={16} />;
  if (eventType === 'HIRED') return <ShieldCheck size={16} />;
  return <CalendarDays size={16} />;
}

function snapshotChanges(event: EmploymentHistoryEvent) {
  const previous = event.previous ?? {};
  const next = event.next ?? {};
  const fields = [
    ['jobTitle', 'Job title'],
    ['departmentId', 'Department'],
    ['managerId', 'Manager'],
    ['employmentType', 'Employment type'],
    ['employmentStatus', 'Employment status'],
  ] as const;

  return fields
    .map(([key, fieldLabel]) => ({
      key,
      label: fieldLabel,
      previous: previous[key],
      next: next[key],
    }))
    .filter((change) => change.previous !== change.next);
}

export function EmployeeEmploymentHistory({ employeeId, refreshKey }: Props) {
  const [events, setEvents] = useState<EmploymentHistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  async function loadHistory(background = false) {
    if (background) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const response = await api.get<EmploymentHistoryEvent[]>(
        `/employees/${employeeId}/history`,
      );
      setEvents(response.data);
    } catch (requestError: unknown) {
      setError(readError(requestError, 'Could not load employment history.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, refreshKey]);

  const sortedEvents = useMemo(
    () =>
      [...events].sort(
        (left, right) =>
          new Date(right.effectiveDate).getTime() -
          new Date(left.effectiveDate).getTime(),
      ),
    [events],
  );

  return (
    <section className="border border-black/10 bg-white">
      <div className="flex flex-col gap-4 border-b border-black/10 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.03em] text-[#111827]">
            Employment history
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Audited lifecycle events with effective and recorded dates.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadHistory(true)}
          disabled={loading || refreshing}
          className="inline-flex items-center justify-center gap-2 border border-black/10 bg-white px-4 py-2 text-sm text-gray-600 transition hover:border-black hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          Refresh history
        </button>
      </div>

      {loading ? (
        <div className="flex min-h-48 items-center justify-center gap-3 p-6 text-sm text-gray-500">
          <Loader2 size={18} className="animate-spin" />
          Loading employment history...
        </div>
      ) : error ? (
        <div className="p-6">
          <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        </div>
      ) : sortedEvents.length === 0 ? (
        <div className="p-6">
          <div className="border border-dashed border-black/15 bg-[#f8fafc] px-5 py-12 text-center text-sm text-gray-500">
            No employment history has been recorded yet.
          </div>
        </div>
      ) : (
        <div className="divide-y divide-black/10">
          {sortedEvents.map((event) => {
            const changes = snapshotChanges(event);
            return (
              <article key={event.id} className="grid gap-5 p-6 lg:grid-cols-[190px_1fr]">
                <div>
                  <div className="inline-flex items-center gap-2 border border-black/10 bg-[#f8fafc] px-3 py-2 text-xs font-semibold text-[#111827]">
                    {eventIcon(event.eventType)}
                    {eventLabel(event.eventType)}
                  </div>
                  <p className="mt-3 text-xs uppercase tracking-[0.14em] text-gray-400">
                    Effective
                  </p>
                  <p className="mt-1 text-sm font-medium text-[#111827]">
                    {formatDate(event.effectiveDate)}
                  </p>
                  <p className="mt-3 text-xs text-gray-400">
                    Recorded {formatDateTime(event.recordedAt)}
                  </p>
                </div>

                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#111827]">
                    {event.message}
                  </p>
                  {event.reason ? (
                    <p className="mt-2 text-sm leading-6 text-gray-600">
                      {event.reason}
                    </p>
                  ) : null}

                  {changes.length ? (
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {changes.map((change) => (
                        <div
                          key={change.key}
                          className="border border-black/10 bg-[#f8fafc] px-3 py-3"
                        >
                          <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-gray-400">
                            {change.label}
                          </p>
                          <div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
                            <span className="min-w-0 truncate">
                              {label(change.previous)}
                            </span>
                            <ArrowRight size={13} className="shrink-0 text-gray-400" />
                            <span className="min-w-0 truncate font-medium text-[#111827]">
                              {label(change.next)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-gray-400">
                    {event.changedByUserId ? (
                      <span>Changed by user {event.changedByUserId}</span>
                    ) : (
                      <span>System-recorded event</span>
                    )}
                    <span>Event ID {event.id}</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
