'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { AxiosError } from 'axios';
import Link from 'next/link';
import {
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  LayoutList,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  TriangleAlert,
  UsersRound,
  X,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { api } from '@/lib/api';

type StaffingStatus =
  | 'FULLY_STAFFED'
  | 'RECRUITMENT_IN_PROGRESS'
  | 'VACANCY_UNPLANNED';

type VacancyPosition = {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  level?: string | null;
  employmentCategory?: string | null;
  approvedHeadcount: number;
  currentHeadcount: number;
  vacancies: number;
  recruitingOpenings: number;
  unplannedVacancies: number;
  staffingStatus: StaffingStatus;
  department?: { id: string; name: string } | null;
};

type VacancyPlan = {
  totals: {
    approvedHeadcount: number;
    currentHeadcount: number;
    vacancies: number;
    recruitingOpenings: number;
    unplannedVacancies: number;
  };
  positions: VacancyPosition[];
};

type RecruitmentForm = {
  reference: string;
  plannedOpenings: string;
  location: string;
  openingDate: string;
  closingDate: string;
  description: string;
};

type ApiErrorPayload = {
  message?: string | string[];
};

const emptyRecruitmentForm: RecruitmentForm = {
  reference: '',
  plannedOpenings: '1',
  location: '',
  openingDate: new Date().toISOString().slice(0, 10),
  closingDate: '',
  description: '',
};

function statusLabel(status: StaffingStatus) {
  if (status === 'FULLY_STAFFED') return 'Fully staffed';
  if (status === 'RECRUITMENT_IN_PROGRESS') return 'Recruitment in progress';
  return 'Vacancy unplanned';
}

function statusClass(status: StaffingStatus) {
  if (status === 'FULLY_STAFFED') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (status === 'RECRUITMENT_IN_PROGRESS') {
    return 'border-blue-200 bg-blue-50 text-blue-700';
  }

  return 'border-amber-200 bg-amber-50 text-amber-800';
}

function errorMessage(error: unknown, fallback: string) {
  const message = (error as AxiosError<ApiErrorPayload>).response?.data?.message;
  return Array.isArray(message) ? message.join(' ') : message || fallback;
}

export default function RecruitmentJobsPage() {
  const [plan, setPlan] = useState<VacancyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | StaffingStatus>('ALL');
  const [selectedPosition, setSelectedPosition] = useState<VacancyPosition | null>(null);
  const [form, setForm] = useState<RecruitmentForm>(emptyRecruitmentForm);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadPlan();
  }, []);

  async function loadPlan() {
    setLoading(true);
    setError('');

    try {
      const response = await api.get<VacancyPlan>('/positions/vacancy-plan');
      setPlan(response.data);
    } catch (requestError: unknown) {
      setError(errorMessage(requestError, 'Could not load workforce vacancy planning.'));
    } finally {
      setLoading(false);
    }
  }

  const positions = useMemo(() => {
    const search = query.trim().toLowerCase();

    return (plan?.positions ?? []).filter((position) => {
      const matchesStatus = statusFilter === 'ALL' || position.staffingStatus === statusFilter;
      const matchesSearch =
        !search ||
        position.title.toLowerCase().includes(search) ||
        position.code.toLowerCase().includes(search) ||
        position.department?.name?.toLowerCase().includes(search);

      return matchesStatus && matchesSearch;
    });
  }, [plan, query, statusFilter]);

  function openRecruitment(position: VacancyPosition) {
    setSelectedPosition(position);
    setForm({
      ...emptyRecruitmentForm,
      plannedOpenings: String(Math.min(Math.max(position.unplannedVacancies, 1), 1)),
      description: position.description ?? '',
    });
    setError('');
    setSuccess('');
  }

  function closeRecruitment() {
    if (submitting) return;
    setSelectedPosition(null);
    setForm(emptyRecruitmentForm);
  }

  async function submitRecruitment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPosition) return;

    const plannedOpenings = Number(form.plannedOpenings);
    if (!Number.isInteger(plannedOpenings) || plannedOpenings < 1) {
      setError('Planned openings must be a whole number greater than zero.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      await api.post(`/positions/${selectedPosition.id}/recruitment-job`, {
        reference: form.reference.trim() || undefined,
        plannedOpenings,
        location: form.location.trim() || undefined,
        openingDate: form.openingDate || undefined,
        closingDate: form.closingDate || undefined,
        description: form.description.trim() || undefined,
      });

      setSuccess(`Recruitment opened for ${selectedPosition.title}.`);
      setSelectedPosition(null);
      setForm(emptyRecruitmentForm);
      await loadPlan();
    } catch (requestError: unknown) {
      setError(errorMessage(requestError, 'Could not open recruitment for this position.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DashboardShell activePage="recruitment">
      <div className="space-y-7">
        <section className="flex flex-col gap-5 border-b border-black/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              href="/dashboard/recruitment"
              className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-black"
            >
              <ArrowLeft size={15} />
              Recruitment overview
            </Link>

            <p className="mb-2 text-sm uppercase tracking-[0.25em] text-gray-400">
              Workforce planning
            </p>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#111827]">
              Positions & vacancies
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
              Compare approved establishment with current occupancy and recruitment already in progress. Open recruitment only against real approved vacancies.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard/positions"
              className="inline-flex items-center justify-center gap-2 border border-black/10 bg-white px-4 py-3 text-sm font-medium text-gray-600 transition hover:border-black hover:text-black"
            >
              <LayoutList size={16} />
              Position catalogue
            </Link>
            <button
              type="button"
              onClick={loadPlan}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 border border-black/10 bg-white px-5 py-3 text-sm font-medium text-gray-600 transition hover:border-black hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Refresh
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
              Loading workforce plan...
            </div>
          </div>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <Metric label="Approved" value={plan?.totals.approvedHeadcount ?? 0} helper="Establishment seats" />
              <Metric label="Filled" value={plan?.totals.currentHeadcount ?? 0} helper="Current assignments" />
              <Metric label="Vacancies" value={plan?.totals.vacancies ?? 0} helper="Approved gaps" />
              <Metric label="Recruiting" value={plan?.totals.recruitingOpenings ?? 0} helper="Open planned seats" />
              <Metric
                label="Unplanned"
                value={plan?.totals.unplannedVacancies ?? 0}
                helper="Need recruitment plan"
                emphasis={(plan?.totals.unplannedVacancies ?? 0) > 0}
              />
            </section>

            <section className="border border-black/10 bg-white">
              <div className="grid gap-4 border-b border-black/10 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search position, code or department..."
                    className="h-11 w-full border border-black/10 bg-[#f8fafc] pl-10 pr-3 text-sm outline-none transition focus:border-black"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  {(['ALL', 'VACANCY_UNPLANNED', 'RECRUITMENT_IN_PROGRESS', 'FULLY_STAFFED'] as const).map(
                    (status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setStatusFilter(status)}
                        className={`border px-3 py-2 text-xs font-medium transition ${
                          statusFilter === status
                            ? 'border-black bg-black text-white'
                            : 'border-black/10 bg-white text-gray-600 hover:border-black'
                        }`}
                      >
                        {status === 'ALL' ? 'All' : statusLabel(status)}
                      </button>
                    ),
                  )}
                </div>
              </div>

              {!positions.length ? (
                <div className="px-6 py-16 text-center">
                  <BriefcaseBusiness size={34} className="mx-auto text-gray-300" />
                  <p className="mt-4 text-sm font-medium text-[#111827]">No positions match this view</p>
                  <p className="mt-1 text-sm text-gray-500">Adjust the search or staffing filter.</p>
                </div>
              ) : (
                <div className="divide-y divide-black/10">
                  {positions.map((position) => (
                    <article key={position.id} className="p-5 transition hover:bg-[#fbfcfd]">
                      <div className="grid gap-5 xl:grid-cols-[1.2fr_repeat(4,110px)_180px] xl:items-center">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`border px-2 py-1 text-[11px] font-medium ${statusClass(position.staffingStatus)}`}>
                              {statusLabel(position.staffingStatus)}
                            </span>
                            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">
                              {position.code}
                            </span>
                          </div>
                          <h2 className="mt-2 text-base font-semibold text-[#111827]">{position.title}</h2>
                          <p className="mt-1 flex items-center gap-2 text-sm text-gray-500">
                            <Building2 size={14} />
                            {position.department?.name ?? 'No department assigned'}
                            {position.employmentCategory ? ` · ${position.employmentCategory.replaceAll('_', ' ')}` : ''}
                          </p>
                        </div>

                        <Count label="Approved" value={position.approvedHeadcount} />
                        <Count label="Filled" value={position.currentHeadcount} />
                        <Count label="Vacant" value={position.vacancies} />
                        <Count label="Recruiting" value={position.recruitingOpenings} />

                        <div className="xl:text-right">
                          {position.unplannedVacancies > 0 ? (
                            <button
                              type="button"
                              onClick={() => openRecruitment(position)}
                              className="inline-flex w-full items-center justify-center gap-2 border border-black bg-black px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white hover:text-black xl:w-auto"
                            >
                              <Plus size={15} />
                              Open recruitment
                            </button>
                          ) : position.staffingStatus === 'RECRUITMENT_IN_PROGRESS' ? (
                            <span className="inline-flex items-center gap-2 text-sm font-medium text-blue-700">
                              <UsersRound size={16} />
                              Covered by recruitment
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700">
                              <CheckCircle2 size={16} />
                              No action needed
                            </span>
                          )}
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

      {selectedPosition ? (
        <div className="fixed inset-0 z-[80] flex justify-end bg-black/35" role="presentation" onMouseDown={closeRecruitment}>
          <aside
            className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="open-recruitment-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-black/10 bg-white px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Approved vacancy</p>
                <h2 id="open-recruitment-title" className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[#111827]">
                  Open recruitment
                </h2>
              </div>
              <button type="button" onClick={closeRecruitment} className="flex h-9 w-9 items-center justify-center border border-black/10 text-gray-500 hover:border-black hover:text-black">
                <X size={17} />
              </button>
            </div>

            <form onSubmit={submitRecruitment} className="space-y-6 p-6">
              <div className="border border-black/10 bg-[#f8fafc] p-4">
                <p className="text-sm font-semibold text-[#111827]">{selectedPosition.title}</p>
                <p className="mt-1 text-sm text-gray-500">{selectedPosition.code} · {selectedPosition.department?.name ?? 'No department'}</p>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <Count label="Vacant" value={selectedPosition.vacancies} />
                  <Count label="Recruiting" value={selectedPosition.recruitingOpenings} />
                  <Count label="Available" value={selectedPosition.unplannedVacancies} />
                </div>
              </div>

              <Field label="Reference">
                <input value={form.reference} onChange={(event) => setForm((current) => ({ ...current, reference: event.target.value }))} maxLength={80} placeholder="e.g. VAC-SRN-2026-01" className="field-input" />
              </Field>

              <Field label="Planned openings" required>
                <input type="number" min={1} max={selectedPosition.unplannedVacancies} value={form.plannedOpenings} onChange={(event) => setForm((current) => ({ ...current, plannedOpenings: event.target.value }))} className="field-input" required />
              </Field>

              <Field label="Location">
                <input value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} maxLength={160} placeholder="e.g. Johannesburg Practice" className="field-input" />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Opening date">
                  <input type="date" value={form.openingDate} onChange={(event) => setForm((current) => ({ ...current, openingDate: event.target.value }))} className="field-input" />
                </Field>
                <Field label="Closing date">
                  <input type="date" value={form.closingDate} min={form.openingDate || undefined} onChange={(event) => setForm((current) => ({ ...current, closingDate: event.target.value }))} className="field-input" />
                </Field>
              </div>

              <Field label="Description">
                <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} maxLength={2000} rows={6} className="field-input resize-y" />
              </Field>

              <div className="border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-800">
                This recruitment job will remain linked to the approved position. MedCNX will prevent planned openings from exceeding the remaining establishment vacancy.
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-black/10 pt-5 sm:flex-row sm:justify-end">
                <button type="button" onClick={closeRecruitment} disabled={submitting} className="border border-black/10 bg-white px-5 py-3 text-sm font-medium text-gray-600 hover:border-black disabled:opacity-50">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="inline-flex items-center justify-center gap-2 border border-black bg-black px-5 py-3 text-sm font-medium text-white hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-60">
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <BriefcaseBusiness size={16} />}
                  Create recruitment job
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

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[#111827]">
        {label}{required ? ' *' : ''}
      </span>
      {children}
    </label>
  );
}
