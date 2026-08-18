'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Check,
  Clock3,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react';
import { ManagerAttentionQueue } from '@/components/dashboard/ManagerAttentionQueue';
import { api } from '@/lib/api';

type PendingLeaveRequest = {
  id: string;
  employeeId: string;
  leaveType: string;
  status: string;
  startDate: string;
  endDate: string;
  totalDays: number | string;
  reason?: string | null;
  createdAt: string;
  employee: {
    id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    jobTitle?: string | null;
    employmentStatus: string;
    department?: {
      id: string;
      name: string;
    } | null;
  };
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(new Date(value));
}

function formatLeaveType(value: string) {
  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function ManagerLeaveApprovals() {
  const [requests, setRequests] = useState<PendingLeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionNote, setRejectionNote] = useState('');

  useEffect(() => {
    void loadRequests();
  }, []);

  async function loadRequests() {
    setLoading(true);
    setError('');

    try {
      const response = await api.get<PendingLeaveRequest[]>('/leave/manager/pending');
      setRequests(response.data);
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ??
        'Could not load pending leave approvals.';
      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally {
      setLoading(false);
    }
  }

  async function approveRequest(request: PendingLeaveRequest) {
    setActionId(request.id);
    setError('');
    setSuccess('');

    try {
      await api.patch(`/leave/manager/${request.id}/approve`);
      setSuccess(
        `${request.employee.firstName} ${request.employee.lastName}'s leave request was approved.`,
      );
      setRequests((current) => current.filter((item) => item.id !== request.id));
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ?? 'Could not approve leave request.';
      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally {
      setActionId(null);
    }
  }

  async function rejectRequest(request: PendingLeaveRequest) {
    const note = rejectionNote.trim();

    if (!note) {
      setError('Enter a rejection reason before rejecting this request.');
      return;
    }

    setActionId(request.id);
    setError('');
    setSuccess('');

    try {
      await api.patch(`/leave/manager/${request.id}/reject`, {
        rejectionNote: note,
      });
      setSuccess(
        `${request.employee.firstName} ${request.employee.lastName}'s leave request was rejected.`,
      );
      setRequests((current) => current.filter((item) => item.id !== request.id));
      setRejectingId(null);
      setRejectionNote('');
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ?? 'Could not reject leave request.';
      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally {
      setActionId(null);
    }
  }

  const totalPendingDays = useMemo(
    () => requests.reduce((sum, request) => sum + Number(request.totalDays), 0),
    [requests],
  );

  return (
    <>
      <ManagerAttentionQueue />

      <section className="border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-xs)]">
        <div className="flex flex-col gap-4 border-b border-[var(--border)] px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[var(--accent)]">
              Manager actions
            </p>
            <h3 className="mt-2 text-xl font-black tracking-[-0.035em] text-[var(--text)]">
              Pending leave approvals
            </h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Review pending leave submitted by employees who currently report directly to you.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadRequests()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 border border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 py-2.5 text-sm font-bold text-[var(--text)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
            Refresh approvals
          </button>
        </div>

        <div className="grid gap-0 border-b border-[var(--border)] sm:grid-cols-2">
          <div className="p-5 sm:border-r sm:border-[var(--border)]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--accent)]">
                <Clock3 size={18} />
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--muted)]">
                  Pending requests
                </p>
                <p className="mt-1 text-2xl font-black text-[var(--text)]">{requests.length}</p>
              </div>
            </div>
          </div>
          <div className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--accent)]">
                <CalendarDays size={18} />
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--muted)]">
                  Pending leave days
                </p>
                <p className="mt-1 text-2xl font-black text-[var(--text)]">{totalPendingDays}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          {error ? (
            <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
              {success}
            </div>
          ) : null}

          {loading && requests.length === 0 ? (
            <div className="flex min-h-48 items-center justify-center border border-dashed border-[var(--border-strong)] bg-[var(--surface-soft)]">
              <div className="text-center">
                <Loader2 className="mx-auto animate-spin text-[var(--accent)]" size={22} />
                <p className="mt-3 text-sm font-bold text-[var(--text)]">Loading approvals</p>
              </div>
            </div>
          ) : requests.length === 0 ? (
            <div className="border border-dashed border-[var(--border-strong)] bg-[var(--surface-soft)] px-5 py-12 text-center">
              <Check className="mx-auto text-[var(--accent)]" size={24} />
              <p className="mt-3 text-sm font-black text-[var(--text)]">
                No leave approvals waiting
              </p>
              <p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-[var(--muted)]">
                Pending leave requests from your current direct reports will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => {
                const isRejecting = rejectingId === request.id;
                const isBusy = actionId === request.id;

                return (
                  <article
                    key={request.id}
                    className="border border-[var(--border)] bg-[var(--surface-soft)] p-5"
                  >
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center border border-[var(--accent)] bg-[var(--accent)] text-xs font-black text-[var(--accent-text)]">
                            {request.employee.firstName.charAt(0)}
                            {request.employee.lastName.charAt(0)}
                          </div>
                          <div>
                            <p className="text-base font-black text-[var(--text)]">
                              {request.employee.firstName} {request.employee.lastName}
                            </p>
                            <p className="mt-0.5 text-xs font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
                              {request.employee.employeeNumber} · {request.employee.jobTitle ?? 'No job title'}
                            </p>
                          </div>
                        </div>

                        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                          <Info label="Leave type" value={formatLeaveType(request.leaveType)} />
                          <Info
                            label="Dates"
                            value={`${formatDate(request.startDate)} - ${formatDate(request.endDate)}`}
                          />
                          <Info label="Duration" value={`${Number(request.totalDays)} day${Number(request.totalDays) === 1 ? '' : 's'}`} />
                          <Info label="Department" value={request.employee.department?.name ?? 'Unassigned'} />
                        </div>

                        {request.reason ? (
                          <div className="mt-4 border-t border-[var(--border)] pt-4">
                            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--muted)]">
                              Employee reason
                            </p>
                            <p className="mt-1 text-sm leading-6 text-[var(--text)]">{request.reason}</p>
                          </div>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2 xl:w-52 xl:flex-col">
                        <button
                          type="button"
                          onClick={() => void approveRequest(request)}
                          disabled={isBusy}
                          className="inline-flex flex-1 items-center justify-center gap-2 border border-emerald-600 bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isBusy && !isRejecting ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />}
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRejectingId(isRejecting ? null : request.id);
                            setRejectionNote('');
                            setError('');
                          }}
                          disabled={isBusy}
                          className="inline-flex flex-1 items-center justify-center gap-2 border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 transition hover:border-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
                        >
                          <X size={15} />
                          Reject
                        </button>
                      </div>
                    </div>

                    {isRejecting ? (
                      <div className="mt-5 border-t border-[var(--border)] pt-5">
                        <label className="block text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--muted)]">
                          Rejection reason
                        </label>
                        <textarea
                          value={rejectionNote}
                          onChange={(event) => setRejectionNote(event.target.value)}
                          rows={3}
                          maxLength={1000}
                          placeholder="Explain why this request is being rejected."
                          className="mt-2 w-full resize-y border border-[var(--border-strong)] bg-[var(--surface)] p-3 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
                        />
                        <div className="mt-3 flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setRejectingId(null);
                              setRejectionNote('');
                            }}
                            disabled={isBusy}
                            className="border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-2 text-sm font-bold text-[var(--text)] disabled:opacity-50"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => void rejectRequest(request)}
                            disabled={isBusy || !rejectionNote.trim()}
                            className="inline-flex items-center gap-2 border border-red-600 bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isBusy ? <Loader2 className="animate-spin" size={15} /> : <X size={15} />}
                            Confirm rejection
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold text-[var(--text)]">{value}</p>
    </div>
  );
}
