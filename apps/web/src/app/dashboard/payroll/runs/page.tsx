'use client';

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  WalletCards,
  XCircle,
} from 'lucide-react';

import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { api } from '@/lib/api';
import { can } from '@/lib/permissions';
import type { AuthUser } from '@/types/auth';

type PayrollRunStatus =
  | 'DRAFT'
  | 'CALCULATED'
  | 'AI_AUDITED'
  | 'HR_REVIEWED'
  | 'FINANCE_REVIEWED'
  | 'PENDING_CEO_APPROVAL'
  | 'CEO_APPROVED'
  | 'PAYMENT_PROCESSING'
  | 'PAID'
  | 'COMPLETED'
  | 'FINALISED'
  | 'REJECTED'
  | 'CANCELLED';

type PayrollRun = {
  id: string;
  title: string;
  periodMonth: number;
  periodYear: number;
  status: PayrollRunStatus;
  employeeCount: number;
  itemCount: number;
  totalGrossPay: number;
  totalDeductions: number;
  totalNetPay: number;
  notes?: string | null;
  createdAt: string;
};

type CreatePayrollRunResponse = {
  message: string;
  payrollRun: PayrollRun;
};

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const statusLabels: Record<PayrollRunStatus, string> = {
  DRAFT: 'Draft',
  CALCULATED: 'Calculated',
  AI_AUDITED: 'Audit complete',
  HR_REVIEWED: 'HR reviewed',
  FINANCE_REVIEWED: 'Finance reviewed',
  PENDING_CEO_APPROVAL: 'Awaiting approval',
  CEO_APPROVED: 'Approved',
  PAYMENT_PROCESSING: 'Payment processing',
  PAID: 'Paid',
  COMPLETED: 'Completed',
  FINALISED: 'Finalised',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

function readSavedUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const value = window.localStorage.getItem('medcnx_user');
  if (!value) return null;
  try {
    return JSON.parse(value) as AuthUser;
  } catch {
    window.localStorage.removeItem('medcnx_user');
    return null;
  }
}

function formatCurrency(value?: number | null) {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function messageFrom(error: unknown, fallback: string) {
  const response = error as { response?: { data?: { message?: string | string[] } } };
  const message = response.response?.data?.message;
  return Array.isArray(message) ? message.join(' ') : message ?? fallback;
}

function statusStyle(status: PayrollRunStatus) {
  if (['FINALISED', 'COMPLETED', 'PAID', 'CEO_APPROVED'].includes(status)) {
    return 'border-[var(--success-border)] bg-[var(--success-bg)] text-[var(--success-text)]';
  }
  if (status === 'REJECTED' || status === 'CANCELLED') {
    return 'border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger-text)]';
  }
  if (status === 'DRAFT') {
    return 'border-[var(--warning-border)] bg-[var(--warning-bg)] text-[var(--warning-text)]';
  }
  return 'border-[var(--info-border)] bg-[var(--info-bg)] text-[var(--info-text)]';
}

export default function PayrollRunsPage() {
  const now = new Date();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [periodMonth, setPeriodMonth] = useState(now.getMonth() + 1);
  const [periodYear, setPeriodYear] = useState(now.getFullYear());
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | PayrollRunStatus>('ALL');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [workingRunId, setWorkingRunId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    setUser(readSavedUser());
    void loadPayrollRuns();
  }, []);

  const canCreate = can(user, 'payroll:create');
  const canDeleteDraft = can(user, 'payroll:delete-draft');
  const canExport = can(user, 'payroll:export');

  const filteredRuns = useMemo(() => {
    const search = query.trim().toLowerCase();
    return runs.filter((run) => {
      const matchesStatus = statusFilter === 'ALL' || run.status === statusFilter;
      const matchesSearch = !search ||
        run.title.toLowerCase().includes(search) ||
        months[run.periodMonth - 1].toLowerCase().includes(search) ||
        String(run.periodYear).includes(search);
      return matchesStatus && matchesSearch;
    });
  }, [query, runs, statusFilter]);

  const activeRuns = runs.filter((run) => !['FINALISED', 'CANCELLED', 'REJECTED'].includes(run.status));
  const finalisedRuns = runs.filter((run) => run.status === 'FINALISED');
  const totalNetPay = runs.reduce((sum, run) => sum + Number(run.totalNetPay ?? 0), 0);

  async function loadPayrollRuns() {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<PayrollRun[]>('/payroll/runs');
      setRuns(response.data);
    } catch (requestError) {
      setError(messageFrom(requestError, 'Could not load payroll runs.'));
    } finally {
      setLoading(false);
    }
  }

  async function createPayrollRun(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCreate) return;
    setCreating(true);
    setError('');
    setSuccess('');
    try {
      const response = await api.post<CreatePayrollRunResponse>('/payroll/runs', {
        title: title.trim() || undefined,
        periodMonth,
        periodYear,
        notes: notes.trim() || undefined,
      });
      setRuns((current) => [response.data.payrollRun, ...current]);
      setTitle('');
      setNotes('');
      setSuccess(response.data.message);
    } catch (requestError) {
      setError(messageFrom(requestError, 'Could not create payroll run.'));
    } finally {
      setCreating(false);
    }
  }

  async function deleteRun(run: PayrollRun) {
    if (!window.confirm(`Delete “${run.title}”? This action cannot be undone.`)) return;
    setWorkingRunId(run.id);
    setError('');
    setSuccess('');
    try {
      const response = await api.delete<{ message: string }>(`/payroll/runs/${run.id}`);
      setRuns((current) => current.filter((item) => item.id !== run.id));
      setSuccess(response.data.message);
    } catch (requestError) {
      setError(messageFrom(requestError, 'Could not delete payroll run.'));
    } finally {
      setWorkingRunId('');
    }
  }

  async function downloadRegister(run: PayrollRun) {
    setWorkingRunId(`export-${run.id}`);
    setError('');
    setSuccess('');
    try {
      const response = await api.get(`/payroll/runs/${run.id}/export`, {
        responseType: 'blob',
      });
      const disposition = String(response.headers['content-disposition'] ?? '');
      const fileName =
        disposition.match(/filename="?([^";]+)"?/i)?.[1] ??
        `payroll-register-${run.periodYear}-${String(run.periodMonth).padStart(2, '0')}.csv`;
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = window.document.createElement('a');
      link.href = url;
      link.download = fileName;
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setSuccess(`${run.title} downloaded successfully.`);
    } catch (requestError) {
      setError(messageFrom(requestError, 'Could not download the payroll register.'));
    } finally {
      setWorkingRunId('');
    }
  }

  return (
    <DashboardShell activePage="payroll" user={user}>
      <div className="space-y-7">
        <section className="border border-[var(--border)] bg-[var(--surface)] px-6 py-7 sm:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Link href="/dashboard/payroll" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)] hover:text-[var(--text)]">
                <ArrowLeft size={16} /> Back to payroll
              </Link>
              <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--accent)]">Payroll register</p>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.05em] text-[var(--text)] sm:text-4xl">Payroll runs</h1>
              <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-[var(--muted)]">
                Create payroll periods and track every run through calculation, review, approval and finalisation.
              </p>
            </div>
            <button type="button" onClick={() => void loadPayrollRuns()} disabled={loading}
              className="inline-flex h-11 items-center justify-center gap-2 border border-[var(--border-strong)] bg-[var(--surface)] px-5 text-sm font-semibold text-[var(--text)] hover:bg-[var(--surface-soft)] disabled:opacity-60">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh register
            </button>
          </div>
        </section>

        {error ? <div role="alert" className="border border-[var(--danger-border)] bg-[var(--danger-bg)] px-5 py-4 text-sm font-semibold text-[var(--danger-text)]">{error}</div> : null}
        {success ? <div role="status" className="border border-[var(--success-border)] bg-[var(--success-bg)] px-5 py-4 text-sm font-semibold text-[var(--success-text)]">{success}</div> : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="All runs" value={String(runs.length)} helper="Payroll periods on record" icon={<WalletCards size={19} />} />
          <StatCard label="Active workflow" value={String(activeRuns.length)} helper="Runs still in progress" icon={<Clock3 size={19} />} />
          <StatCard label="Finalised" value={String(finalisedRuns.length)} helper="Completed and locked" icon={<CheckCircle2 size={19} />} />
          <StatCard label="Net payroll" value={formatCurrency(totalNetPay)} helper="Across the current register" icon={<ShieldCheck size={19} />} strong />
        </section>

        <section className={`grid gap-6 ${canCreate ? 'xl:grid-cols-[360px_minmax(0,1fr)]' : ''}`}>
          {canCreate ? (
            <form onSubmit={createPayrollRun} className="h-fit border border-[var(--border)] bg-[var(--surface)]">
              <div className="border-b border-[var(--border)] px-6 py-5">
                <div className="flex h-10 w-10 items-center justify-center bg-[var(--accent)] text-[var(--accent-text)]"><Plus size={18} /></div>
                <h2 className="mt-5 text-lg font-black text-[var(--text)]">Create payroll run</h2>
                <p className="mt-1 text-sm font-medium leading-6 text-[var(--muted)]">Open a new draft period for payroll preparation.</p>
              </div>
              <div className="space-y-4 p-6">
                <Field label="Run title">
                  <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160}
                    placeholder={`${months[periodMonth - 1]} ${periodYear} Payroll Run`} className="control" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Month">
                    <select value={periodMonth} onChange={(event) => setPeriodMonth(Number(event.target.value))} className="control">
                      {months.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
                    </select>
                  </Field>
                  <Field label="Year">
                    <input type="number" min={2000} max={2100} value={periodYear} onChange={(event) => setPeriodYear(Number(event.target.value))} className="control" required />
                  </Field>
                </div>
                <Field label="Notes">
                  <textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} rows={4} placeholder="Optional payroll notes" className="control resize-none" />
                </Field>
                <button type="submit" disabled={creating}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 border border-[var(--accent)] bg-[var(--accent)] px-5 text-sm font-bold text-[var(--accent-text)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
                  {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  {creating ? 'Creating payroll run…' : 'Create payroll run'}
                </button>
              </div>
            </form>
          ) : null}

          <div className="border border-[var(--border)] bg-[var(--surface)]">
            <div className="border-b border-[var(--border)] p-5 sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="text-lg font-black text-[var(--text)]">Payroll run register</h2>
                  <p className="mt-1 text-sm font-medium text-[var(--muted)]">Open a run to continue its controlled workflow.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)_190px]">
                  <label className="relative">
                    <span className="sr-only">Search payroll runs</span>
                    <Search size={16} className="pointer-events-none absolute left-3 top-3.5 text-[var(--muted)]" />
                    <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search runs" className="control pl-10" />
                  </label>
                  <label>
                    <span className="sr-only">Filter by status</span>
                    <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'ALL' | PayrollRunStatus)} className="control">
                      <option value="ALL">All statuses</option>
                      {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex min-h-96 items-center justify-center gap-3 text-sm font-semibold text-[var(--muted)]"><Loader2 size={19} className="animate-spin" /> Loading payroll runs…</div>
            ) : filteredRuns.length === 0 ? (
              <div className="m-6 border border-dashed border-[var(--border-strong)] bg-[var(--surface-soft)] px-6 py-14 text-center">
                <CalendarDays size={32} className="mx-auto text-[var(--muted)]" />
                <p className="mt-4 font-bold text-[var(--text)]">No payroll runs found</p>
                <p className="mt-1 text-sm font-medium text-[var(--muted)]">Create a run or adjust the current filters.</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {filteredRuns.map((run) => (
                  <article key={run.id} className="p-5 sm:p-6">
                    <div className="flex flex-col gap-5 2xl:flex-row 2xl:items-start 2xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-base font-black text-[var(--text)]">{run.title}</h3>
                          <span className={`inline-flex border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${statusStyle(run.status)}`}>{statusLabels[run.status]}</span>
                        </div>
                        <p className="mt-1 text-xs font-semibold text-[var(--muted)]">{months[run.periodMonth - 1]} {run.periodYear} · Created {formatDate(run.createdAt)}</p>
                        <div className="mt-5 grid gap-px border border-[var(--border)] bg-[var(--border)] sm:grid-cols-4">
                          <Metric label="Employees" value={String(run.employeeCount || run.itemCount)} />
                          <Metric label="Gross pay" value={formatCurrency(run.totalGrossPay)} />
                          <Metric label="Deductions" value={formatCurrency(run.totalDeductions)} />
                          <Metric label="Net pay" value={formatCurrency(run.totalNetPay)} />
                        </div>
                        {run.notes ? <p className="mt-4 text-sm font-medium leading-6 text-[var(--muted)]">{run.notes}</p> : null}
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Link href={`/dashboard/payroll/runs/${run.id}`} className="inline-flex h-10 items-center justify-center gap-2 border border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-bold text-[var(--accent-text)] hover:opacity-90">
                          Open run <ArrowRight size={15} />
                        </Link>
                        {canExport && run.itemCount > 0 ? (
                          <button
                            type="button"
                            onClick={() => void downloadRegister(run)}
                            disabled={workingRunId === `export-${run.id}`}
                            className="inline-flex h-10 items-center justify-center gap-2 border border-[var(--border-strong)] bg-[var(--surface)] px-4 text-sm font-bold text-[var(--text)] transition hover:bg-[var(--surface-soft)] disabled:opacity-60"
                          >
                            {workingRunId === `export-${run.id}` ? (
                              <Loader2 size={15} className="animate-spin" />
                            ) : (
                              <Download size={15} />
                            )}
                            Download register
                          </button>
                        ) : null}
                        {canDeleteDraft && run.status === 'DRAFT' ? (
                          <button type="button" onClick={() => void deleteRun(run)} disabled={workingRunId === run.id}
                            className="inline-flex h-10 items-center justify-center gap-2 border border-[var(--danger-border)] bg-[var(--surface)] px-4 text-sm font-bold text-[var(--danger-border)] hover:bg-[var(--danger-bg)] hover:text-[var(--danger-text)] disabled:opacity-60">
                            {workingRunId === run.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} Delete draft
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm font-bold text-[var(--text)]">{label}</span>{children}</label>;
}

function StatCard({ label, value, helper, icon, strong = false }: { label: string; value: string; helper: string; icon: ReactNode; strong?: boolean }) {
  return (
    <div className={`border p-5 ${strong ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-text)]' : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text)]'}`}>
      <div className="flex items-center justify-between gap-4"><p className={`text-[10px] font-bold uppercase tracking-[0.18em] ${strong ? 'opacity-70' : 'text-[var(--muted)]'}`}>{label}</p>{icon}</div>
      <p className="mt-3 text-2xl font-black tracking-[-0.04em]">{value}</p>
      <p className={`mt-1 text-sm font-medium ${strong ? 'opacity-70' : 'text-[var(--muted)]'}`}>{helper}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="bg-[var(--surface-soft)] p-3"><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">{label}</p><p className="mt-1.5 text-sm font-black text-[var(--text)]">{value}</p></div>;
}
