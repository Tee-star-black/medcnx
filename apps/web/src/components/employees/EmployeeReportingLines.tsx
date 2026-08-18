'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronRight,
  History,
  Loader2,
  RefreshCw,
  UserRoundCog,
  UsersRound,
  X,
} from 'lucide-react';
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

type ManagerAssignment = {
  id: string;
  organisationId: string;
  employeeId: string;
  managerId?: string | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
  reason?: string | null;
  assignedByUserId?: string | null;
  createdAt: string;
  manager?: EmployeeSummary | null;
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
  history: ManagerAssignment[];
};

type ManagerForm = {
  managerId: string;
  effectiveDate: string;
  reason: string;
};

function todayDateInput() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function formatDate(value?: string | null) {
  if (!value) return 'Current';
  return new Intl.DateTimeFormat('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(new Date(value));
}

function getErrorMessage(error: unknown, fallback: string) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error
  ) {
    const response = (error as {
      response?: { data?: { message?: string | string[] } };
    }).response;
    const message = response?.data?.message;
    if (Array.isArray(message)) return message.join(' ');
    if (typeof message === 'string') return message;
  }
  return fallback;
}

export function EmployeeReportingLines({ employeeId }: { employeeId: string }) {
  const [context, setContext] = useState<ManagerContext | null>(null);
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState<ManagerForm>({
    managerId: '',
    effectiveDate: todayDateInput(),
    reason: '',
  });

  useEffect(() => {
    void loadReportingLines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  const managerOptions = useMemo(
    () =>
      employees
        .filter(
          (employee) =>
            employee.id !== employeeId &&
            employee.employmentStatus !== 'TERMINATED' &&
            employee.employmentStatus !== 'RESIGNED',
        )
        .sort((a, b) =>
          `${a.firstName} ${a.lastName}`.localeCompare(
            `${b.firstName} ${b.lastName}`,
          ),
        ),
    [employeeId, employees],
  );

  async function loadReportingLines() {
    setLoading(true);
    setError('');

    try {
      const [contextResponse, employeesResponse] = await Promise.all([
        api.get<ManagerContext>(`/employees/${employeeId}/manager-context`),
        api.get<EmployeeSummary[]>('/employees'),
      ]);
      setContext(contextResponse.data);
      setEmployees(employeesResponse.data);
    } catch (requestError: unknown) {
      setError(
        getErrorMessage(
          requestError,
          'Could not load reporting-line information.',
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  function openManagerDrawer() {
    setError('');
    setSuccess('');
    setForm({
      managerId: context?.manager?.id ?? '',
      effectiveDate: todayDateInput(),
      reason: '',
    });
    setDrawerOpen(true);
  }

  async function saveManagerChange() {
    if (!context) return;

    const nextManagerId = form.managerId || null;
    const currentManagerId = context.manager?.id ?? null;

    if (nextManagerId === currentManagerId) {
      setError('Choose a different manager, or remove the current manager.');
      return;
    }
    if (!form.effectiveDate) {
      setError('An effective date is required.');
      return;
    }
    if (form.reason.trim().length < 3) {
      setError('Provide a short reason for the reporting-line change.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await api.post(`/employees/${employeeId}/employment/manager`, {
        managerId: nextManagerId ?? undefined,
        effectiveDate: form.effectiveDate,
        reason: form.reason.trim(),
      });
      setDrawerOpen(false);
      setSuccess(
        nextManagerId
          ? 'Manager assignment updated successfully.'
          : 'Manager assignment removed successfully.',
      );
      await loadReportingLines();
    } catch (requestError: unknown) {
      setError(
        getErrorMessage(requestError, 'Could not update manager assignment.'),
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="border border-black/10 bg-white p-6">
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <Loader2 className="animate-spin" size={17} />
          Loading reporting lines...
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="border border-black/10 bg-white">
        <div className="flex flex-col gap-4 border-b border-black/10 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <UsersRound size={18} className="text-gray-400" />
              <h2 className="text-lg font-semibold tracking-[-0.03em] text-[#111827]">
                Reporting lines
              </h2>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Current manager, direct reports and effective-dated manager history.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadReportingLines()}
              className="inline-flex items-center gap-2 border border-black/10 bg-white px-4 py-2 text-sm text-gray-600 transition hover:border-black hover:text-black"
            >
              <RefreshCw size={15} />
              Refresh
            </button>
            <button
              type="button"
              onClick={openManagerDrawer}
              className="inline-flex items-center gap-2 border border-black bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-white hover:text-black"
            >
              <UserRoundCog size={15} />
              Change manager
            </button>
          </div>
        </div>

        {error ? (
          <div className="border-b border-red-200 bg-red-50 px-6 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="border-b border-emerald-200 bg-emerald-50 px-6 py-3 text-sm text-emerald-700">
            {success}
          </div>
        ) : null}

        <div className="grid gap-6 p-6 lg:grid-cols-2">
          <div className="space-y-5">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-gray-400">
                Current manager
              </p>
              {context?.manager ? (
                <Link
                  href={`/dashboard/employees/${context.manager.id}`}
                  className="mt-3 flex items-center justify-between border border-black/10 bg-[#f8fafc] p-4 transition hover:border-black"
                >
                  <div>
                    <p className="text-sm font-semibold text-[#111827]">
                      {context.manager.firstName} {context.manager.lastName}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {context.manager.employeeNumber} ·{' '}
                      {context.manager.jobTitle ?? 'No job title'}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-gray-400" />
                </Link>
              ) : (
                <div className="mt-3 border border-dashed border-black/15 bg-[#f8fafc] p-5 text-sm text-gray-500">
                  No direct manager assigned.
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.16em] text-gray-400">
                  Direct reports
                </p>
                <span className="text-xs font-medium text-gray-500">
                  {context?.directReports.length ?? 0}
                </span>
              </div>

              <div className="mt-3 space-y-2">
                {context?.directReports.length ? (
                  context.directReports.map((report) => (
                    <Link
                      key={report.id}
                      href={`/dashboard/employees/${report.id}`}
                      className="flex items-center justify-between border border-black/10 bg-white p-3 transition hover:border-black"
                    >
                      <div>
                        <p className="text-sm font-medium text-[#111827]">
                          {report.firstName} {report.lastName}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {report.employeeNumber} · {report.jobTitle ?? 'No job title'}
                        </p>
                      </div>
                      <ChevronRight size={15} className="text-gray-400" />
                    </Link>
                  ))
                ) : (
                  <div className="border border-dashed border-black/15 bg-[#f8fafc] p-5 text-sm text-gray-500">
                    No active direct reports.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <History size={16} className="text-gray-400" />
              <p className="text-xs uppercase tracking-[0.16em] text-gray-400">
                Manager history
              </p>
            </div>

            <div className="mt-3 space-y-3">
              {context?.history.length ? (
                context.history.map((assignment) => (
                  <article
                    key={assignment.id}
                    className="border border-black/10 bg-[#f8fafc] p-4"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-[#111827]">
                          {assignment.manager
                            ? `${assignment.manager.firstName} ${assignment.manager.lastName}`
                            : 'No manager'}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {assignment.manager?.jobTitle ??
                            (assignment.managerId ? 'Historical manager' : 'Reporting line removed')}
                        </p>
                      </div>
                      <span
                        className={`w-fit border px-2 py-1 text-[11px] font-medium ${
                          assignment.effectiveTo
                            ? 'border-gray-200 bg-white text-gray-500'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {assignment.effectiveTo ? 'Former' : 'Current'}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                      <CalendarDays size={13} />
                      {formatDate(assignment.effectiveFrom)} -{' '}
                      {formatDate(assignment.effectiveTo)}
                    </div>

                    {assignment.reason ? (
                      <p className="mt-3 text-xs leading-5 text-gray-500">
                        {assignment.reason}
                      </p>
                    ) : null}
                  </article>
                ))
              ) : (
                <div className="border border-dashed border-black/15 bg-[#f8fafc] p-5 text-sm text-gray-500">
                  No manager history recorded yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <button
            type="button"
            aria-label="Close manager drawer"
            className="absolute inset-0 cursor-default"
            onClick={() => !saving && setDrawerOpen(false)}
          />

          <aside className="relative z-10 flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-black/10 px-6 py-5">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-gray-400">
                  Reporting line
                </p>
                <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[#111827]">
                  Change manager
                </h3>
                <p className="mt-2 text-sm leading-6 text-gray-500">
                  The previous assignment will be closed and preserved in history.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                disabled={saving}
                className="border border-black/10 p-2 text-gray-500 transition hover:border-black hover:text-black disabled:opacity-50"
              >
                <X size={17} />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-[0.14em] text-gray-500">
                  Manager
                </span>
                <select
                  value={form.managerId}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      managerId: event.target.value,
                    }))
                  }
                  className="mt-2 w-full border border-black/15 bg-white px-3 py-3 text-sm outline-none transition focus:border-black"
                >
                  <option value="">No manager</option>
                  {managerOptions.map((manager) => (
                    <option key={manager.id} value={manager.id}>
                      {manager.firstName} {manager.lastName} ·{' '}
                      {manager.jobTitle ?? manager.employeeNumber}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-medium uppercase tracking-[0.14em] text-gray-500">
                  Effective date
                </span>
                <input
                  type="date"
                  value={form.effectiveDate}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      effectiveDate: event.target.value,
                    }))
                  }
                  className="mt-2 w-full border border-black/15 bg-white px-3 py-3 text-sm outline-none transition focus:border-black"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium uppercase tracking-[0.14em] text-gray-500">
                  Reason
                </span>
                <textarea
                  value={form.reason}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      reason: event.target.value,
                    }))
                  }
                  rows={5}
                  maxLength={500}
                  placeholder="e.g. Team restructure, promotion, interim reporting change"
                  className="mt-2 w-full resize-none border border-black/15 bg-white px-3 py-3 text-sm outline-none transition focus:border-black"
                />
                <span className="mt-1 block text-right text-xs text-gray-400">
                  {form.reason.length}/500
                </span>
              </label>

              <div className="border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-800">
                Reporting cycles, self-management and cross-organisation assignments are blocked by the API.
              </div>
            </div>

            <div className="flex gap-3 border-t border-black/10 px-6 py-5">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                disabled={saving}
                className="flex-1 border border-black/10 bg-white px-4 py-3 text-sm font-medium text-gray-600 transition hover:border-black hover:text-black disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveManagerChange()}
                disabled={saving}
                className="flex flex-1 items-center justify-center gap-2 border border-black bg-black px-4 py-3 text-sm font-medium text-white transition hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : null}
                Save change
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
