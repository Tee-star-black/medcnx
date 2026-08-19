'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  History,
  Loader2,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { Button, EmptyState, FeedbackBanner } from '@/components/ui';
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
    POSITION_CHANGED: 'Position changed',
  };
  return labels[eventType] ?? label(eventType);
}

function eventIcon(eventType: string) {
  if (eventType === 'PROMOTED' || eventType === 'POSITION_CHANGED') {
    return <BriefcaseBusiness size={16} />;
  }
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
    <section className="med-card overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-[var(--border)] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[var(--border-strong)] bg-[var(--surface-soft)] text-[var(--accent)]">
            <History size={18} />
          </div>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--accent)]">
              Audit trail
            </p>
            <h2 className="mt-1 text-lg font-black tracking-[-0.03em] text-[var(--text)]">
              Employment history
            </h2>
            <p className="mt-1 text-sm font-medium text-[var(--muted)]">
              Effective-dated employment events with their recorded audit time.
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="secondary"
          icon={<RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />}
          onClick={() => void loadHistory(true)}
          disabled={loading || refreshing}
        >
          Refresh history
        </Button>
      </div>

      {loading ? (
        <div className="flex min-h-48 items-center justify-center gap-3 px-6 py-12 text-sm font-semibold text-[var(--muted)]">
          <Loader2 size={18} className="animate-spin" />
          Loading employment history...
        </div>
      ) : error ? (
        <div className="p-6">
          <FeedbackBanner
            tone="error"
            title="Employment history unavailable"
            message={error}
          />
        </div>
      ) : sortedEvents.length === 0 ? (
        <div className="p-6">
          <EmptyState
            icon={<History size={20} />}
            title="No employment history yet"
            description="Audited lifecycle and employment structure changes will appear here once they are recorded."
          />
        </div>
      ) : (
        <div>
          {sortedEvents.map((event, index) => {
            const changes = snapshotChanges(event);
            return (
              <article
                key={event.id}
                className={`relative grid gap-5 px-6 py-6 lg:grid-cols-[210px_1fr] ${
                  index === 0 ? '' : 'border-t border-[var(--border)]'
                }`}
              >
                <div className="relative lg:pr-5">
                  <div className="inline-flex items-center gap-2 border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 py-2 text-xs font-extrabold uppercase tracking-[0.08em] text-[var(--text-soft)]">
                    <span className="text-[var(--accent)]">{eventIcon(event.eventType)}</span>
                    {eventLabel(event.eventType)}
                  </div>

                  <div className="mt-4 border-l-2 border-[var(--accent)] pl-3">
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--muted)]">
                      Effective
                    </p>
                    <p className="mt-1 text-sm font-black text-[var(--text)]">
                      {formatDate(event.effectiveDate)}
                    </p>
                  </div>

                  <p className="mt-3 text-xs font-medium leading-5 text-[var(--muted)]">
                    Recorded {formatDateTime(event.recordedAt)}
                  </p>
                </div>

                <div className="min-w-0 lg:border-l lg:border-[var(--border)] lg:pl-6">
                  <p className="text-sm font-extrabold leading-6 text-[var(--text)]">
                    {event.message}
                  </p>

                  {event.reason ? (
                    <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[var(--muted)]">
                      {event.reason}
                    </p>
                  ) : null}

                  {changes.length ? (
                    <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {changes.map((change) => (
                        <div
                          key={change.key}
                          className="border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-3"
                        >
                          <p className="text-[11px] font-extrabold uppercase tracking-[0.13em] text-[var(--muted)]">
                            {change.label}
                          </p>
                          <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-[var(--text-soft)]">
                            <span className="min-w-0 truncate">
                              {label(change.previous)}
                            </span>
                            <ArrowRight size={13} className="shrink-0 text-[var(--accent)]" />
                            <span className="min-w-0 truncate font-extrabold text-[var(--text)]">
                              {label(change.next)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-[var(--border)] pt-3 text-xs font-medium text-[var(--muted)]">
                    <span>
                      {event.changedByUserId
                        ? `Changed by user ${event.changedByUserId}`
                        : 'System-recorded event'}
                    </span>
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
