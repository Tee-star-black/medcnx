'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { AxiosError } from 'axios';
import Link from 'next/link';
import {
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  LayoutList,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  UsersRound,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { EmptyState } from '@/components/ui/EmptyState';
import { FeedbackBanner } from '@/components/ui/FeedbackBanner';
import { FormField } from '@/components/ui/FormField';
import { PageHeader } from '@/components/ui/PageHeader';
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

const inputClass =
  'h-11 w-full border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] outline-none transition focus:border-[var(--accent)]';

function statusLabel(status: StaffingStatus) {
  if (status === 'FULLY_STAFFED') return 'Fully staffed';
  if (status === 'RECRUITMENT_IN_PROGRESS') return 'Recruitment in progress';
  return 'Vacancy unplanned';
}

function statusClass(status: StaffingStatus) {
  if (status === 'FULLY_STAFFED') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300';
  }

  if (status === 'RECRUITMENT_IN_PROGRESS') {
    return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300';
  }

  return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300';
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
    void loadPlan();
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
      <div className="space-y-6">
        <PageHeader
          category="Workforce planning"
          title="Positions & vacancies"
          description="Compare approved establishment with current occupancy and recruitment already in progress. Open recruitment only against real approved vacancies."
          primaryAction={{
            label: loading ? 'Refreshing' : 'Refresh plan',
            onClick: () => void loadPlan(),
            icon: <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />,
          }}
          secondaryAction={{
            label: 'Position catalogue',
            href: '/dashboard/positions',
            icon: <LayoutList size={16} />,
          }}
          tools={
            <Link
              href="/dashboard/recruitment"
              className="text-sm font-extrabold text-[var(--accent)] hover:text-[var(--accent-hover)]"
            >
              Recruitment overview
            </Link>
          }
        />

        {error ? (
          <FeedbackBanner tone="error" title="Vacancy planning failed" message={error} />
        ) : null}

        {success ? (
          <FeedbackBanner tone="success" title="Recruitment opened" message={success} />
        ) : null}

        {loading ? (
          <div className="flex min-h-[520px] items-center justify-center border border-[var(--border)] bg-[var(--surface)]">
            <div className="flex items-center gap-3 text-sm font-medium text-[var(--muted)]">
              <Loader2 className="animate-spin text-[var(--accent)]" size={18} />
              Loading workforce plan...
            </div>
          </div>
        ) : (
          <>
            <section className="grid gap-0 border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-xs)] sm:grid-cols-2 xl:grid-cols-5">
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

            <section className="border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-xs)]">
              <div className="grid gap-4 border-b border-[var(--border)] bg-[var(--surface-soft)] p-5 lg:grid-cols-[1fr_auto] lg:items-center sm:p-6">
                <label className="flex min-h-11 items-center gap-2 border border-[var(--border-strong)] bg-[var(--surface)] px-3 focus-within:border-[var(--accent)]">
                  <Search className="shrink-0 text-[var(--muted)]" size={16} />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search position, code or department"
                    className="min-w-0 flex-1 bg-transparent text-sm font-medium text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
                  />
                </label>

                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      'ALL',
                      'VACANCY_UNPLANNED',
                      'RECRUITMENT_IN_PROGRESS',
                      'FULLY_STAFFED',
                    ] as const
                  ).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setStatusFilter(status)}
                      className={`min-h-10 border px-3 text-xs font-extrabold transition ${
                        statusFilter === status
                          ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-text)]'
                          : 'border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
                      }`}
                    >
                      {status === 'ALL' ? 'All' : statusLabel(status)}
                    </button>
                  ))}
                </div>
              </div>

              {!positions.length ? (
                <div className="p-5 sm:p-6">
                  <EmptyState
                    icon={<BriefcaseBusiness size={22} />}
                    title="No positions match this view"
                    description="Adjust the search or staffing filter to return to the approved establishment list."
                    action={
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setQuery('');
                          setStatusFilter('ALL');
                        }}
                      >
                        Clear filters
                      </Button>
                    }
                  />
                </div>
              ) : (
                <div className="divide-y divide-[var(--border)]">
                  {positions.map((position) => (
                    <article
                      key={position.id}
                      className="px-5 py-5 transition hover:bg-[var(--surface-soft)] sm:px-6"
                    >
                      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_repeat(4,100px)_190px] xl:items-center">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`border px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] ${statusClass(position.staffingStatus)}`}
                            >
                              {statusLabel(position.staffingStatus)}
                            </span>
                            <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--muted)]">
                              {position.code}
                            </span>
                          </div>
                          <h2 className="mt-2 text-base font-black text-[var(--text)]">
                            {position.title}
                          </h2>
                          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm font-medium text-[var(--muted)]">
                            <Building2 size={14} />
                            {position.department?.name ?? 'No department assigned'}
                            {position.employmentCategory
                              ? ` · ${position.employmentCategory.replaceAll('_', ' ')}`
                              : ''}
                          </p>
                        </div>

                        <Count label="Approved" value={position.approvedHeadcount} />
                        <Count label="Filled" value={position.currentHeadcount} />
                        <Count label="Vacant" value={position.vacancies} />
                        <Count label="Recruiting" value={position.recruitingOpenings} />

                        <div className="xl:text-right">
                          {position.unplannedVacancies > 0 ? (
                            <Button
                              variant="primary"
                              icon={<Plus size={15} />}
                              onClick={() => openRecruitment(position)}
                              className="w-full xl:w-auto"
                            >
                              Open recruitment
                            </Button>
                          ) : position.staffingStatus === 'RECRUITMENT_IN_PROGRESS' ? (
                            <span className="inline-flex items-center gap-2 text-sm font-bold text-blue-700 dark:text-blue-300">
                              <UsersRound size={16} />
                              Covered by recruitment
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-300">
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

      <Drawer
        open={Boolean(selectedPosition)}
        title="Open recruitment"
        description="Create a recruitment job against an approved position vacancy."
        onClose={closeRecruitment}
        footer={
          selectedPosition ? (
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" disabled={submitting} onClick={closeRecruitment}>
                Cancel
              </Button>
              <Button
                type="submit"
                form="open-recruitment-form"
                variant="primary"
                loading={submitting}
                icon={<BriefcaseBusiness size={16} />}
              >
                Create recruitment job
              </Button>
            </div>
          ) : null
        }
      >
        {selectedPosition ? (
          <form id="open-recruitment-form" onSubmit={submitRecruitment} className="space-y-5">
            <div className="border border-[var(--border-strong)] bg-[var(--surface-soft)] p-4">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--accent)]">
                Approved vacancy
              </p>
              <p className="mt-2 font-black text-[var(--text)]">{selectedPosition.title}</p>
              <p className="mt-1 text-sm font-medium text-[var(--muted)]">
                {selectedPosition.code} · {selectedPosition.department?.name ?? 'No department'}
              </p>
              <div className="mt-4 grid grid-cols-3 gap-3 border-t border-[var(--border)] pt-4">
                <Count label="Vacant" value={selectedPosition.vacancies} />
                <Count label="Recruiting" value={selectedPosition.recruitingOpenings} />
                <Count label="Available" value={selectedPosition.unplannedVacancies} />
              </div>
            </div>

            <FormField label="Reference" htmlFor="recruitment-reference">
              <input
                id="recruitment-reference"
                value={form.reference}
                onChange={(event) =>
                  setForm((current) => ({ ...current, reference: event.target.value }))
                }
                maxLength={80}
                placeholder="e.g. VAC-SRN-2026-01"
                className={inputClass}
              />
            </FormField>

            <FormField label="Planned openings" htmlFor="recruitment-openings" required>
              <input
                id="recruitment-openings"
                type="number"
                min={1}
                max={selectedPosition.unplannedVacancies}
                value={form.plannedOpenings}
                onChange={(event) =>
                  setForm((current) => ({ ...current, plannedOpenings: event.target.value }))
                }
                className={inputClass}
                required
              />
            </FormField>

            <FormField label="Location" htmlFor="recruitment-location">
              <input
                id="recruitment-location"
                value={form.location}
                onChange={(event) =>
                  setForm((current) => ({ ...current, location: event.target.value }))
                }
                maxLength={160}
                placeholder="e.g. Johannesburg Practice"
                className={inputClass}
              />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Opening date" htmlFor="recruitment-opening-date">
                <input
                  id="recruitment-opening-date"
                  type="date"
                  value={form.openingDate}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, openingDate: event.target.value }))
                  }
                  className={inputClass}
                />
              </FormField>
              <FormField label="Closing date" htmlFor="recruitment-closing-date">
                <input
                  id="recruitment-closing-date"
                  type="date"
                  value={form.closingDate}
                  min={form.openingDate || undefined}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, closingDate: event.target.value }))
                  }
                  className={inputClass}
                />
              </FormField>
            </div>

            <FormField label="Description" htmlFor="recruitment-description">
              <textarea
                id="recruitment-description"
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
                maxLength={2000}
                rows={6}
                className={`${inputClass} h-auto min-h-32 resize-y py-3`}
              />
            </FormField>

            <FeedbackBanner
              tone="info"
              title="Position-linked recruitment"
              message="This recruitment job remains linked to the approved position. MedCNX prevents planned openings from exceeding the remaining establishment vacancy."
            />
          </form>
        ) : null}
      </Drawer>
    </DashboardShell>
  );
}

function Metric({
  label,
  value,
  helper,
  emphasis,
}: {
  label: string;
  value: number;
  helper: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`border-b border-[var(--border)] p-4 last:border-b-0 sm:border-r sm:last:border-r-0 xl:border-b-0 ${
        emphasis ? 'bg-amber-50 dark:bg-amber-950' : 'bg-[var(--surface)]'
      }`}
    >
      <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--text)]">
        {value}
      </p>
      <p className="mt-1 text-xs font-medium text-[var(--muted)]">{helper}</p>
    </div>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-1 text-lg font-black text-[var(--text)]">{value}</p>
    </div>
  );
}
