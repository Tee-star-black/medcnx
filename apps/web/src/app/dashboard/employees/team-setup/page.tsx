'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Loader2,
  RefreshCw,
  Search,
  UserRoundCog,
  UsersRound,
  X,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { api } from '@/lib/api';
import type { AuthUser } from '@/types/auth';

type Employee = {
  id: string;
  managerId?: string | null;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  jobTitle?: string | null;
  employmentType?: string | null;
  employmentStatus: string;
  department?: { id: string; name: string } | null;
};

function todayIsoDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function fullName(employee: Employee) {
  return `${employee.firstName} ${employee.lastName}`.trim();
}

function readError(error: any, fallback: string) {
  const message = error?.response?.data?.message ?? fallback;
  return Array.isArray(message) ? message.join(' ') : String(message);
}

export default function TeamSetupPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [managerId, setManagerId] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(todayIsoDate());
  const [reason, setReason] = useState('Team reporting structure update');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function loadEmployees() {
    setLoading(true);
    setError('');
    try {
      const [meResponse, employeesResponse] = await Promise.all([
        api.get<AuthUser>('/auth/me'),
        api.get<Employee[]>('/employees'),
      ]);
      setUser(meResponse.data);
      setEmployees(employeesResponse.data);
    } catch (requestError: any) {
      setError(readError(requestError, 'Could not load reporting structure data.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadEmployees();
  }, []);

  const assignableEmployees = useMemo(
    () =>
      employees.filter(
        (employee) =>
          !['TERMINATED', 'RESIGNED'].includes(employee.employmentStatus),
      ),
    [employees],
  );

  const manager = useMemo(
    () => employees.find((employee) => employee.id === managerId) ?? null,
    [employees, managerId],
  );

  const currentTeam = useMemo(
    () =>
      assignableEmployees
        .filter((employee) => employee.managerId === managerId)
        .sort((a, b) => fullName(a).localeCompare(fullName(b))),
    [assignableEmployees, managerId],
  );

  const candidates = useMemo(() => {
    const normalisedQuery = query.trim().toLowerCase();
    return assignableEmployees
      .filter((employee) => employee.id !== managerId && employee.managerId !== managerId)
      .filter((employee) => {
        if (!normalisedQuery) return true;
        return [
          fullName(employee),
          employee.employeeNumber,
          employee.jobTitle ?? '',
          employee.department?.name ?? '',
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalisedQuery);
      })
      .sort((a, b) => fullName(a).localeCompare(fullName(b)));
  }, [assignableEmployees, managerId, query]);

  function managerNameFor(employee: Employee) {
    if (!employee.managerId) return 'Unassigned';
    const currentManager = employees.find((item) => item.id === employee.managerId);
    return currentManager ? fullName(currentManager) : 'Assigned manager';
  }

  function toggleSelection(employeeId: string) {
    setSelectedIds((current) =>
      current.includes(employeeId)
        ? current.filter((id) => id !== employeeId)
        : [...current, employeeId],
    );
  }

  async function assignSelected() {
    if (!managerId || selectedIds.length === 0) return;
    if (reason.trim().length < 3) {
      setError('Enter a reason of at least 3 characters.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    const failures: string[] = [];
    let completed = 0;

    for (const employeeId of selectedIds) {
      const employee = employees.find((item) => item.id === employeeId);
      try {
        await api.post(`/employees/${employeeId}/employment/manager`, {
          managerId,
          effectiveDate,
          reason: reason.trim(),
        });
        completed += 1;
      } catch (requestError: any) {
        failures.push(
          `${employee ? fullName(employee) : employeeId}: ${readError(requestError, 'assignment failed')}`,
        );
      }
    }

    await loadEmployees();
    setSelectedIds([]);
    setSaving(false);

    if (completed > 0) {
      setSuccess(`${completed} employee${completed === 1 ? '' : 's'} assigned to ${manager ? fullName(manager) : 'the selected manager'}.`);
    }
    if (failures.length > 0) {
      setError(failures.join(' '));
    }
  }

  async function removeFromTeam(employee: Employee) {
    if (!window.confirm(`Remove ${fullName(employee)} from ${manager ? fullName(manager) : 'this manager'}'s team?`)) {
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.post(`/employees/${employee.id}/employment/manager`, {
        managerId: null,
        effectiveDate,
        reason: reason.trim() || 'Removed from reporting team',
      });
      setSuccess(`${fullName(employee)} removed from the team.`);
      await loadEmployees();
    } catch (requestError: any) {
      setError(readError(requestError, 'Could not remove employee from the team.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardShell user={user} activePage="employees">
      <div className="mx-auto max-w-7xl space-y-7">
        <section className="border-b border-[var(--border)] pb-6">
          <Link
            href="/dashboard/employees"
            className="inline-flex items-center gap-2 text-sm font-bold text-[var(--muted)] transition hover:text-[var(--accent)]"
          >
            <ArrowLeft size={16} />
            Back to Employees
          </Link>

          <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[var(--accent)]">
                Reporting structure
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.05em] text-[var(--text)] sm:text-4xl">
                Team setup
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                Select a manager, review their current direct reports, and assign or remove employees using the effective-dated reporting workflow.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadEmployees()}
              disabled={loading || saving}
              className="inline-flex h-11 items-center justify-center gap-2 border border-[var(--border-strong)] bg-[var(--surface)] px-4 text-sm font-bold text-[var(--text)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
              Refresh
            </button>
          </div>
        </section>

        {error ? (
          <div className="border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
            {success}
          </div>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[360px_1fr]">
          <aside className="space-y-5 border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-xs)]">
            <div>
              <label className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--muted)]">
                Manager
              </label>
              <select
                value={managerId}
                onChange={(event) => {
                  setManagerId(event.target.value);
                  setSelectedIds([]);
                  setSuccess('');
                  setError('');
                }}
                disabled={loading || saving}
                className="mt-2 h-11 w-full border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 text-sm font-bold text-[var(--text)] outline-none focus:border-[var(--accent)]"
              >
                <option value="">Select a manager</option>
                {assignableEmployees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {fullName(employee)} · {employee.jobTitle ?? employee.employeeNumber}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <label>
                <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--muted)]">
                  Effective date
                </span>
                <input
                  type="date"
                  value={effectiveDate}
                  onChange={(event) => setEffectiveDate(event.target.value)}
                  className="mt-2 h-11 w-full border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 text-sm font-semibold text-[var(--text)] outline-none focus:border-[var(--accent)]"
                />
              </label>

              <label>
                <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--muted)]">
                  Change reason
                </span>
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={3}
                  maxLength={500}
                  className="mt-2 w-full resize-none border border-[var(--border-strong)] bg-[var(--surface-soft)] p-3 text-sm font-medium text-[var(--text)] outline-none focus:border-[var(--accent)]"
                />
              </label>
            </div>

            {manager ? (
              <div className="border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center border border-[var(--accent)] bg-[var(--accent)] text-sm font-black text-[var(--accent-text)]">
                    {manager.firstName.charAt(0)}{manager.lastName.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-[var(--text)]">{fullName(manager)}</p>
                    <p className="mt-0.5 truncate text-xs text-[var(--muted)]">{manager.jobTitle ?? 'Job title not set'}</p>
                  </div>
                </div>
                <div className="mt-4 border-t border-[var(--border)] pt-4 text-sm text-[var(--muted)]">
                  <span className="font-black text-[var(--text)]">{currentTeam.length}</span> current direct report{currentTeam.length === 1 ? '' : 's'}
                </div>
              </div>
            ) : null}
          </aside>

          <div className="space-y-6">
            {!managerId ? (
              <div className="flex min-h-[420px] items-center justify-center border border-dashed border-[var(--border-strong)] bg-[var(--surface)] p-8 text-center">
                <div>
                  <UserRoundCog className="mx-auto text-[var(--accent)]" size={28} />
                  <p className="mt-4 text-lg font-black text-[var(--text)]">Select a manager to build a team</p>
                  <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[var(--muted)]">
                    MedCNX derives teams from current manager assignments, so there is no duplicate team record to keep in sync.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <section className="border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-xs)]">
                  <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
                    <div>
                      <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--accent)]">Current team</p>
                      <h2 className="mt-1 text-lg font-black text-[var(--text)]">Direct reports</h2>
                    </div>
                    <span className="text-sm font-bold text-[var(--muted)]">{currentTeam.length}</span>
                  </div>
                  <div className="p-5">
                    {currentTeam.length === 0 ? (
                      <div className="border border-dashed border-[var(--border-strong)] bg-[var(--surface-soft)] px-5 py-10 text-center text-sm text-[var(--muted)]">
                        This manager does not have any direct reports yet.
                      </div>
                    ) : (
                      <div className="grid gap-3 lg:grid-cols-2">
                        {currentTeam.map((employee) => (
                          <div key={employee.id} className="flex items-center justify-between gap-4 border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-sm font-black text-[var(--text)]">{fullName(employee)}</p>
                                <StatusBadge status={employee.employmentStatus} />
                              </div>
                              <p className="mt-1 truncate text-xs text-[var(--muted)]">{employee.employeeNumber} · {employee.jobTitle ?? 'Job title not set'}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => void removeFromTeam(employee)}
                              disabled={saving}
                              className="flex h-9 w-9 shrink-0 items-center justify-center border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] transition hover:border-red-400 hover:text-red-600 disabled:opacity-50"
                              aria-label={`Remove ${fullName(employee)} from team`}
                              title="Remove from team"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>

                <section className="border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-xs)]">
                  <div className="flex flex-col gap-4 border-b border-[var(--border)] px-5 py-4 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--accent)]">Assign employees</p>
                      <h2 className="mt-1 text-lg font-black text-[var(--text)]">Available workforce</h2>
                      <p className="mt-1 text-sm text-[var(--muted)]">Employees already on another team can be reassigned here; their previous assignment is closed in history.</p>
                    </div>
                    <label className="flex h-10 items-center gap-2 border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 md:w-72">
                      <Search size={16} className="text-[var(--muted)]" />
                      <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search employees"
                        className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                      />
                    </label>
                  </div>

                  <div className="p-5">
                    {candidates.length === 0 ? (
                      <div className="border border-dashed border-[var(--border-strong)] bg-[var(--surface-soft)] px-5 py-10 text-center text-sm text-[var(--muted)]">
                        No assignable employees match this view.
                      </div>
                    ) : (
                      <div className="grid gap-3 lg:grid-cols-2">
                        {candidates.map((employee) => {
                          const selected = selectedIds.includes(employee.id);
                          return (
                            <button
                              key={employee.id}
                              type="button"
                              onClick={() => toggleSelection(employee.id)}
                              disabled={saving}
                              className={`flex items-center justify-between gap-4 border p-4 text-left transition ${selected ? 'border-[var(--accent)] bg-[var(--surface-soft)]' : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]'}`}
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-black text-[var(--text)]">{fullName(employee)}</p>
                                <p className="mt-1 truncate text-xs text-[var(--muted)]">{employee.employeeNumber} · {employee.jobTitle ?? 'Job title not set'}</p>
                                <p className="mt-1 truncate text-xs font-semibold text-[var(--muted)]">Current manager: {managerNameFor(employee)}</p>
                              </div>
                              <span className={`flex h-8 w-8 shrink-0 items-center justify-center border ${selected ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-text)]' : 'border-[var(--border-strong)] text-transparent'}`}>
                                <Check size={15} />
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-3 border-t border-[var(--border)] bg-[var(--surface-soft)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-semibold text-[var(--muted)]">
                      {selectedIds.length} employee{selectedIds.length === 1 ? '' : 's'} selected
                    </p>
                    <button
                      type="button"
                      onClick={() => void assignSelected()}
                      disabled={saving || selectedIds.length === 0 || !effectiveDate || reason.trim().length < 3}
                      className="inline-flex h-11 items-center justify-center gap-2 border border-[var(--accent)] bg-[var(--accent)] px-5 text-sm font-black text-[var(--accent-text)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {saving ? <Loader2 className="animate-spin" size={16} /> : <UsersRound size={17} />}
                      Assign selected to team
                    </button>
                  </div>
                </section>
              </>
            )}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
