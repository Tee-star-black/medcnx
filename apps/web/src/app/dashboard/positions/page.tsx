'use client';

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import type { AxiosError } from 'axios';
import Link from 'next/link';
import {
  Archive,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  TriangleAlert,
  X,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { api } from '@/lib/api';

type Department = {
  id: string;
  name: string;
};

type Position = {
  id: string;
  departmentId?: string | null;
  code: string;
  title: string;
  description?: string | null;
  level?: string | null;
  employmentCategory?: string | null;
  approvedHeadcount: number;
  active: boolean;
  currentHeadcount: number;
  vacancies: number;
  department?: Department | null;
};

type PositionForm = {
  code: string;
  title: string;
  departmentId: string;
  description: string;
  level: string;
  employmentCategory: string;
  approvedHeadcount: string;
};

type ApiErrorPayload = {
  message?: string | string[];
};

const emptyForm: PositionForm = {
  code: '',
  title: '',
  departmentId: '',
  description: '',
  level: '',
  employmentCategory: '',
  approvedHeadcount: '1',
};

const inputClass =
  'h-11 w-full border border-black/10 bg-[#f8fafc] px-3 text-sm text-[#111827] outline-none transition focus:border-black';

function apiErrorMessage(error: unknown, fallback: string) {
  const message = (error as AxiosError<ApiErrorPayload>).response?.data?.message;
  return Array.isArray(message) ? message.join(' ') : message || fallback;
}

function categoryLabel(value?: string | null) {
  if (!value) return 'Not specified';
  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function PositionsPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Position | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<PositionForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    void loadWorkspace();
  }, []);

  async function loadWorkspace() {
    setLoading(true);
    setError('');

    try {
      const [positionsResponse, departmentsResponse] = await Promise.all([
        api.get<Position[]>('/positions'),
        api.get<Department[]>('/departments'),
      ]);
      setPositions(positionsResponse.data);
      setDepartments(departmentsResponse.data);
    } catch (requestError: unknown) {
      setError(apiErrorMessage(requestError, 'Could not load the position catalogue.'));
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();

    return positions.filter((position) => {
      if (!showArchived && !position.active) return false;
      if (!search) return true;

      return (
        position.code.toLowerCase().includes(search) ||
        position.title.toLowerCase().includes(search) ||
        position.department?.name?.toLowerCase().includes(search) ||
        position.level?.toLowerCase().includes(search)
      );
    });
  }, [positions, query, showArchived]);

  const totals = useMemo(() => {
    const active = positions.filter((position) => position.active);
    return {
      positions: active.length,
      approved: active.reduce((total, position) => total + position.approvedHeadcount, 0),
      filled: active.reduce((total, position) => total + position.currentHeadcount, 0),
      vacancies: active.reduce((total, position) => total + position.vacancies, 0),
    };
  }, [positions]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setSuccess('');
    setFormOpen(true);
  }

  function openEdit(position: Position) {
    setEditing(position);
    setForm({
      code: position.code,
      title: position.title,
      departmentId: position.departmentId ?? '',
      description: position.description ?? '',
      level: position.level ?? '',
      employmentCategory: position.employmentCategory ?? '',
      approvedHeadcount: String(position.approvedHeadcount),
    });
    setError('');
    setSuccess('');
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) return;
    setFormOpen(false);
    setEditing(null);
    setForm(emptyForm);
  }

  async function savePosition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const approvedHeadcount = Number(form.approvedHeadcount);
    if (!Number.isInteger(approvedHeadcount) || approvedHeadcount < 0) {
      setError('Approved headcount must be a whole number of zero or more.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    const payload = {
      code: form.code.trim(),
      title: form.title.trim(),
      departmentId: form.departmentId || undefined,
      description: form.description.trim() || undefined,
      level: form.level.trim() || undefined,
      employmentCategory: form.employmentCategory.trim() || undefined,
      approvedHeadcount,
    };

    try {
      if (editing) {
        await api.patch(`/positions/${editing.id}`, payload);
        setSuccess(`Position ${form.title.trim()} updated.`);
      } else {
        await api.post('/positions', payload);
        setSuccess(`Position ${form.title.trim()} created.`);
      }

      setFormOpen(false);
      setEditing(null);
      setForm(emptyForm);
      await loadWorkspace();
    } catch (requestError: unknown) {
      setError(apiErrorMessage(requestError, 'Could not save this position.'));
    } finally {
      setSaving(false);
    }
  }

  async function archivePosition(position: Position) {
    const confirmed = window.confirm(
      `Archive ${position.code} - ${position.title}? This is only allowed when there are no active occupants or open recruitment jobs.`,
    );
    if (!confirmed) return;

    setArchivingId(position.id);
    setError('');
    setSuccess('');

    try {
      await api.post(`/positions/${position.id}/archive`);
      setSuccess(`Position ${position.title} archived.`);
      await loadWorkspace();
    } catch (requestError: unknown) {
      setError(apiErrorMessage(requestError, 'Could not archive this position.'));
    } finally {
      setArchivingId(null);
    }
  }

  return (
    <DashboardShell activePage="recruitment">
      <div className="space-y-7">
        <section className="flex flex-col gap-5 border-b border-black/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-sm uppercase tracking-[0.25em] text-gray-400">Workforce establishment</p>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#111827]">Position catalogue</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
              Define approved organisational roles independently of the employees who occupy them. Headcount and vacancy planning derive from this catalogue.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard/recruitment/jobs"
              className="inline-flex items-center justify-center gap-2 border border-black/10 bg-white px-4 py-3 text-sm font-medium text-gray-600 transition hover:border-black hover:text-black"
            >
              <BriefcaseBusiness size={16} />
              Vacancy planning
            </Link>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center justify-center gap-2 border border-black bg-black px-4 py-3 text-sm font-medium text-white transition hover:bg-white hover:text-black"
            >
              <Plus size={16} />
              Create position
            </button>
          </div>
        </section>

        {error ? (
          <div className="flex items-start gap-3 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <TriangleAlert size={17} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {success ? (
          <div className="flex items-start gap-3 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
            <span>{success}</span>
          </div>
        ) : null}

        {loading ? (
          <div className="flex min-h-[520px] items-center justify-center border border-black/10 bg-white">
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <Loader2 className="animate-spin" size={18} />
              Loading position catalogue...
            </div>
          </div>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Metric label="Active positions" value={totals.positions} helper="Approved role definitions" />
              <Metric label="Approved seats" value={totals.approved} helper="Total establishment" />
              <Metric label="Filled seats" value={totals.filled} helper="Active assignments" />
              <Metric label="Vacancies" value={totals.vacancies} helper="Approved unfilled seats" emphasis={totals.vacancies > 0} />
            </section>

            <section className="border border-black/10 bg-white">
              <div className="grid gap-4 border-b border-black/10 p-5 lg:grid-cols-[1fr_auto_auto] lg:items-center">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search code, title, department or level..."
                    className="h-11 w-full border border-black/10 bg-[#f8fafc] pl-10 pr-3 text-sm outline-none transition focus:border-black"
                  />
                </div>

                <label className="flex h-11 items-center gap-2 border border-black/10 bg-white px-4 text-sm text-gray-600">
                  <input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />
                  Show archived
                </label>

                <button
                  type="button"
                  onClick={loadWorkspace}
                  className="inline-flex h-11 items-center justify-center gap-2 border border-black/10 bg-white px-4 text-sm font-medium text-gray-600 hover:border-black hover:text-black"
                >
                  <RefreshCw size={15} />
                  Refresh
                </button>
              </div>

              {!filtered.length ? (
                <div className="px-6 py-16 text-center">
                  <BriefcaseBusiness size={34} className="mx-auto text-gray-300" />
                  <p className="mt-4 text-sm font-medium text-[#111827]">No positions match this view</p>
                  <p className="mt-1 text-sm text-gray-500">Create a position or adjust the search filters.</p>
                </div>
              ) : (
                <div className="divide-y divide-black/10">
                  {filtered.map((position) => (
                    <article key={position.id} className={`p-5 ${position.active ? '' : 'bg-gray-50 opacity-70'}`}>
                      <div className="grid gap-5 xl:grid-cols-[1.4fr_repeat(3,110px)_260px] xl:items-center">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`border px-2 py-1 text-[11px] font-medium ${position.active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-gray-100 text-gray-500'}`}>
                              {position.active ? 'Active' : 'Archived'}
                            </span>
                            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">{position.code}</span>
                          </div>
                          <Link href={`/dashboard/positions/${position.id}`} className="mt-2 inline-block text-base font-semibold text-[#111827] hover:underline">
                            {position.title}
                          </Link>
                          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                            <Building2 size={14} />
                            {position.department?.name ?? 'No department'}
                            {position.level ? ` · ${position.level}` : ''}
                            {` · ${categoryLabel(position.employmentCategory)}`}
                          </p>
                        </div>

                        <Count label="Approved" value={position.approvedHeadcount} />
                        <Count label="Filled" value={position.currentHeadcount} />
                        <Count label="Vacant" value={position.vacancies} />

                        <div className="flex flex-wrap gap-2 xl:justify-end">
                          <Link
                            href={`/dashboard/positions/${position.id}`}
                            className="inline-flex items-center gap-2 border border-black/10 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:border-black hover:text-black"
                          >
                            View details
                          </Link>
                          {position.active ? (
                            <>
                              <button
                                type="button"
                                onClick={() => openEdit(position)}
                                className="inline-flex items-center gap-2 border border-black/10 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:border-black hover:text-black"
                              >
                                <Pencil size={14} />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => archivePosition(position)}
                                disabled={archivingId === position.id}
                                className="inline-flex items-center gap-2 border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                              >
                                {archivingId === position.id ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
                                Archive
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {formOpen ? (
        <div className="fixed inset-0 z-[80] flex justify-end bg-black/35" role="presentation" onMouseDown={closeForm}>
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="position-form-title"
            className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-black/10 bg-white px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Workforce establishment</p>
                <h2 id="position-form-title" className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[#111827]">
                  {editing ? 'Edit position' : 'Create position'}
                </h2>
              </div>
              <button type="button" onClick={closeForm} className="flex h-9 w-9 items-center justify-center border border-black/10 text-gray-500 hover:border-black hover:text-black">
                <X size={17} />
              </button>
            </div>

            <form onSubmit={savePosition} className="space-y-5 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Position code" required>
                  <input className={inputClass} value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} minLength={2} maxLength={50} required placeholder="e.g. SRN-001" />
                </Field>
                <Field label="Approved headcount" required>
                  <input className={inputClass} type="number" min={0} value={form.approvedHeadcount} onChange={(event) => setForm((current) => ({ ...current, approvedHeadcount: event.target.value }))} required />
                </Field>
              </div>

              <Field label="Position title" required>
                <input className={inputClass} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} minLength={2} maxLength={150} required placeholder="e.g. Senior Registered Nurse" />
              </Field>

              <Field label="Department">
                <select className={inputClass} value={form.departmentId} onChange={(event) => setForm((current) => ({ ...current, departmentId: event.target.value }))}>
                  <option value="">No department</option>
                  {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                </select>
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Level">
                  <input className={inputClass} value={form.level} onChange={(event) => setForm((current) => ({ ...current, level: event.target.value }))} maxLength={100} placeholder="e.g. Professional" />
                </Field>
                <Field label="Employment category">
                  <select className={inputClass} value={form.employmentCategory} onChange={(event) => setForm((current) => ({ ...current, employmentCategory: event.target.value }))}>
                    <option value="">Not specified</option>
                    <option value="FULL_TIME">Full time</option>
                    <option value="PART_TIME">Part time</option>
                    <option value="CONTRACT">Contract</option>
                    <option value="TEMPORARY">Temporary</option>
                    <option value="CASUAL">Casual</option>
                  </select>
                </Field>
              </div>

              <Field label="Description">
                <textarea
                  className={`${inputClass} h-auto min-h-32 resize-y py-3`}
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  maxLength={500}
                  rows={5}
                  placeholder="Describe the organisational purpose and responsibilities of this position."
                />
              </Field>

              <div className="border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-800">
                Approved headcount defines how many employees may occupy this role. Recruitment planning uses the difference between approved headcount and active assignments.
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-black/10 pt-5 sm:flex-row sm:justify-end">
                <button type="button" onClick={closeForm} disabled={saving} className="border border-black/10 bg-white px-5 py-3 text-sm font-medium text-gray-600 hover:border-black disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 border border-black bg-black px-5 py-3 text-sm font-medium text-white hover:bg-white hover:text-black disabled:opacity-50">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  {editing ? 'Save changes' : 'Create position'}
                </button>
              </div>
            </form>
          </aside>
        </div>
      ) : null}
    </DashboardShell>
  );
}

function Metric({ label, value, helper, emphasis }: { label: string; value: number; helper: string; emphasis?: boolean }) {
  return (
    <div className={`border p-5 ${emphasis ? 'border-amber-200 bg-amber-50' : 'border-black/10 bg-white'}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#111827]">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{helper}</p>
    </div>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-[#111827]">{value}</p>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[#111827]">{label}{required ? ' *' : ''}</span>
      {children}
    </label>
  );
}
