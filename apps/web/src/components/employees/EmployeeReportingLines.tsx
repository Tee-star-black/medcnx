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
} from 'lucide-react';
import {
  Button,
  Drawer,
  EmptyState,
  FeedbackBanner,
  FormField,
} from '@/components/ui';
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
  if (typeof error === 'object' && error !== null && 'response' in error) {
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
          `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`),
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
      setError(getErrorMessage(requestError, 'Could not load reporting-line information.'));
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
      setError(getErrorMessage(requestError, 'Could not update manager assignment.'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="med-card p-6">
        <div className="flex items-center gap-3 text-sm font-semibold text-[var(--muted)]">
          <Loader2 className="animate-spin" size={17} />
          Loading reporting lines...
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="med-card overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-[var(--border)] px-6 py-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[var(--border-strong)] bg-[var(--surface-soft)] text-[var(--accent)]">
              <UsersRound size={18} />
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--accent)]">
                Organisation structure
              </p>
              <h2 className="mt-1 text-lg font-black tracking-[-0.03em] text-[var(--text)]">
                Reporting lines
              </h2>
              <p className="mt-1 text-sm font-medium text-[var(--muted)]">
                Current manager, direct reports and effective-dated manager history.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              icon={<RefreshCw size={15} />}
              onClick={() => void loadReportingLines()}
            >
              Refresh
            </Button>
            <Button
              type="button"
              variant="primary"
              icon={<UserRoundCog size={15} />}
              onClick={openManagerDrawer}
            >
              Change manager
            </Button>
          </div>
        </div>

        {error ? (
          <div className="border-b border-[var(--border)] p-4">
            <FeedbackBanner tone="error" title="Reporting line update failed" message={error} />
          </div>
        ) : null}

        {success ? (
          <div className="border-b border-[var(--border)] p-4">
            <FeedbackBanner tone="success" title="Reporting line updated" message={success} />
          </div>
        ) : null}

        <div className="grid gap-0 lg:grid-cols-2">
          <div className="space-y-6 border-b border-[var(--border)] p-6 lg:border-b-0 lg:border-r">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--muted)]">
                Current manager
              </p>
              {context?.manager ? (
                <Link
                  href={`/dashboard/employees/${context.manager.id}`}
                  className="mt-3 flex items-center justify-between border border-[var(--border-strong)] bg-[var(--surface-soft)] p-4 transition hover:border-[var(--accent)]"
                >
                  <div>
                    <p className="text-sm font-extrabold text-[var(--text)]">
                      {context.manager.firstName} {context.manager.lastName}
                    </p>
                    <p className="mt-1 text-xs font-medium text-[var(--muted)]">
                      {context.manager.employeeNumber} · {context.manager.jobTitle ?? 'No job title'}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-[var(--accent)]" />
                </Link>
              ) : (
                <div className="mt-3">
                  <EmptyState
                    icon={<UserRoundCog size={18} />}
                    title="No manager assigned"
                    description="This employee currently has no direct manager in the reporting hierarchy."
                  />
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--muted)]">
                  Direct reports
                </p>
                <span className="border border-[var(--border)] bg-[var(--surface-soft)] px-2 py-1 text-xs font-extrabold text-[var(--text-soft)]">
                  {context?.directReports.length ?? 0}
                </span>
              </div>

              <div className="mt-3 space-y-2">
                {context?.directReports.length ? (
                  context.directReports.map((report) => (
                    <Link
                      key={report.id}
                      href={`/dashboard/employees/${report.id}`}
                      className="flex items-center justify-between border border-[var(--border)] bg-[var(--surface)] p-3 transition hover:border-[var(--accent)] hover:bg-[var(--surface-soft)]"
                    >
                      <div>
                        <p className="text-sm font-extrabold text-[var(--text)]">
                          {report.firstName} {report.lastName}
                        </p>
                        <p className="mt-1 text-xs font-medium text-[var(--muted)]">
                          {report.employeeNumber} · {report.jobTitle ?? 'No job title'}
                        </p>
                      </div>
                      <ChevronRight size={15} className="text-[var(--accent)]" />
                    </Link>
                  ))
                ) : (
                  <p className="border border-dashed border-[var(--border-strong)] bg-[var(--surface-soft)] p-4 text-sm font-medium text-[var(--muted)]">
                    No active direct reports.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="flex items-center gap-2">
              <History size={16} className="text-[var(--accent)]" />
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--muted)]">
                Manager history
              </p>
            </div>

            <div className="mt-3 space-y-3">
              {context?.history.length ? (
                context.history.map((assignment) => (
                  <article
                    key={assignment.id}
                    className="border border-[var(--border)] bg-[var(--surface-soft)] p-4"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-extrabold text-[var(--text)]">
                          {assignment.manager
                            ? `${assignment.manager.firstName} ${assignment.manager.lastName}`
                            : 'No manager'}
                        </p>
                        <p className="mt-1 text-xs font-medium text-[var(--muted)]">
                          {assignment.manager?.jobTitle ??
                            (assignment.managerId
                              ? 'Historical manager'
                              : 'Reporting line removed')}
                        </p>
                      </div>
                      <span
                        className={`w-fit border-l-[3px] px-2 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] ${
                          assignment.effectiveTo
                            ? 'border-[var(--border-strong)] bg-[var(--surface)] text-[var(--muted)]'
                            : 'border-emerald-600 bg-emerald-50 text-emerald-800'
                        }`}
                      >
                        {assignment.effectiveTo ? 'Former' : 'Current'}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-[var(--muted)]">
                      <CalendarDays size={13} />
                      {formatDate(assignment.effectiveFrom)} - {formatDate(assignment.effectiveTo)}
                    </div>

                    {assignment.reason ? (
                      <p className="mt-3 border-t border-[var(--border)] pt-3 text-xs font-medium leading-5 text-[var(--muted)]">
                        {assignment.reason}
                      </p>
                    ) : null}
                  </article>
                ))
              ) : (
                <p className="border border-dashed border-[var(--border-strong)] bg-[var(--surface-soft)] p-4 text-sm font-medium text-[var(--muted)]">
                  No manager history recorded yet.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <Drawer
        open={drawerOpen}
        title="Change manager"
        description="The previous assignment will be closed and preserved in employment history."
        onClose={() => {
          if (!saving) setDrawerOpen(false);
        }}
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={() => setDrawerOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              loading={saving}
              onClick={() => void saveManagerChange()}
            >
              Save change
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          <FormField label="Manager" htmlFor="manager">
            <select
              id="manager"
              value={form.managerId}
              onChange={(event) =>
                setForm((current) => ({ ...current, managerId: event.target.value }))
              }
              className="control"
            >
              <option value="">No manager</option>
              {managerOptions.map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.firstName} {manager.lastName} · {manager.jobTitle ?? manager.employeeNumber}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Effective date" htmlFor="manager-effective-date" required>
            <input
              id="manager-effective-date"
              type="date"
              max={todayDateInput()}
              value={form.effectiveDate}
              onChange={(event) =>
                setForm((current) => ({ ...current, effectiveDate: event.target.value }))
              }
              className="control"
            />
          </FormField>

          <FormField
            label="Reason"
            htmlFor="manager-reason"
            required
            hint={`${form.reason.length}/500 · This reason is preserved in the audit trail.`}
          >
            <textarea
              id="manager-reason"
              value={form.reason}
              onChange={(event) =>
                setForm((current) => ({ ...current, reason: event.target.value }))
              }
              rows={5}
              maxLength={500}
              placeholder="e.g. Team restructure, promotion, interim reporting change"
              className="control resize-none"
            />
          </FormField>

          <FeedbackBanner
            tone="info"
            title="Hierarchy safeguards remain active"
            message="Reporting cycles, self-management and invalid assignments are blocked by the API."
          />
        </div>
      </Drawer>
    </>
  );
}
