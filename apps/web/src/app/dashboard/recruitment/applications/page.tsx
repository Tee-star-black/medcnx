'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { AxiosError } from 'axios';
import Link from 'next/link';
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  Plus,
  Search,
  UserCheck,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { EmptyState } from '@/components/ui/EmptyState';
import { FeedbackBanner } from '@/components/ui/FeedbackBanner';
import { FormField } from '@/components/ui/FormField';
import { PageHeader } from '@/components/ui/PageHeader';
import { api } from '@/lib/api';

type ApplicationStatus =
  | 'APPLIED'
  | 'SCREENING'
  | 'INTERVIEW'
  | 'OFFER'
  | 'HIRED'
  | 'REJECTED'
  | 'WITHDRAWN';
type JobStatus = 'OPEN' | 'ON_HOLD' | 'CLOSED';

type Candidate = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  currentRole?: string | null;
};
type Job = {
  id: string;
  title: string;
  reference?: string | null;
  status: JobStatus;
  employmentType?: string | null;
};
type Application = {
  id: string;
  jobId: string;
  candidateId: string;
  status: ApplicationStatus;
  appliedAt: string;
  interviewDate?: string | null;
  offerDate?: string | null;
  decisionDate?: string | null;
  expectedSalary?: number | null;
  rating?: number | null;
  notes?: string | null;
  candidate: Candidate;
  job: Job;
};
type HireResponse = {
  employee: {
    id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
  };
  recruitmentJobClosed: boolean;
};
type ApiErrorPayload = { message?: string | string[] };

const inputClass =
  'h-11 w-full border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] outline-none transition focus:border-[var(--accent)]';

function errorMessage(error: unknown, fallback: string) {
  const message = (error as AxiosError<ApiErrorPayload>).response?.data?.message;
  return Array.isArray(message) ? message.join(' ') : message || fallback;
}

function statusClass(status: ApplicationStatus) {
  const classes: Record<ApplicationStatus, string> = {
    APPLIED: 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]',
    SCREENING: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300',
    INTERVIEW: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300',
    OFFER: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
    HIRED: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
    REJECTED: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300',
    WITHDRAWN: 'border-[var(--border)] bg-[var(--surface-soft)] text-[var(--muted)]',
  };
  return classes[status];
}

function formatStatus(status: ApplicationStatus) {
  return status.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(new Date(value));
}

export default function RecruitmentApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | 'ALL'>('ALL');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    jobId: '',
    candidateId: '',
    expectedSalary: '',
    rating: '',
    notes: '',
  });
  const [hireTarget, setHireTarget] = useState<Application | null>(null);
  const [hireForm, setHireForm] = useState({
    employeeNumber: '',
    startDate: '',
    employmentType: '',
    reason: '',
  });
  const [hiredEmployeeId, setHiredEmployeeId] = useState<string | null>(null);

  useEffect(() => {
    void loadWorkspace();
  }, []);

  async function loadWorkspace() {
    setLoading(true);
    setError('');
    try {
      const [applicationsResponse, candidatesResponse, jobsResponse] = await Promise.all([
        api.get<Application[]>('/recruitment/applications'),
        api.get<Candidate[]>('/recruitment/candidates'),
        api.get<Job[]>('/recruitment/jobs'),
      ]);
      setApplications(applicationsResponse.data);
      setCandidates(candidatesResponse.data);
      setJobs(jobsResponse.data);
    } catch (requestError: unknown) {
      setError(errorMessage(requestError, 'Could not load the recruitment pipeline.'));
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return applications.filter((application) => {
      if (statusFilter !== 'ALL' && application.status !== statusFilter) return false;
      if (!search) return true;
      return [
        application.candidate.firstName,
        application.candidate.lastName,
        application.candidate.email,
        application.job.title,
        application.job.reference,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
    });
  }, [applications, query, statusFilter]);

  const stageCounts = useMemo(
    () =>
      applications.reduce<Record<ApplicationStatus, number>>(
        (counts, application) => {
          counts[application.status] += 1;
          return counts;
        },
        {
          APPLIED: 0,
          SCREENING: 0,
          INTERVIEW: 0,
          OFFER: 0,
          HIRED: 0,
          REJECTED: 0,
          WITHDRAWN: 0,
        },
      ),
    [applications],
  );

  async function updateStatus(application: Application, status: ApplicationStatus) {
    setBusyId(application.id);
    setError('');
    setSuccess('');
    try {
      const payload: Record<string, unknown> = { status };
      if (status === 'INTERVIEW') payload.interviewDate = new Date().toISOString();
      if (status === 'OFFER') payload.offerDate = new Date().toISOString();
      await api.patch(`/recruitment/applications/${application.id}/status`, payload);
      setSuccess(
        `${application.candidate.firstName} ${application.candidate.lastName} moved to ${status.toLowerCase()}.`,
      );
      await loadWorkspace();
    } catch (requestError: unknown) {
      setError(errorMessage(requestError, 'Could not update this application.'));
    } finally {
      setBusyId(null);
    }
  }

  async function createApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyId('create');
    setError('');
    setSuccess('');
    try {
      await api.post('/recruitment/applications', {
        jobId: createForm.jobId,
        candidateId: createForm.candidateId,
        expectedSalary: createForm.expectedSalary
          ? Number(createForm.expectedSalary)
          : undefined,
        rating: createForm.rating ? Number(createForm.rating) : undefined,
        notes: createForm.notes.trim() || undefined,
      });
      setCreateOpen(false);
      setCreateForm({
        jobId: '',
        candidateId: '',
        expectedSalary: '',
        rating: '',
        notes: '',
      });
      setSuccess('Application added to the pipeline.');
      await loadWorkspace();
    } catch (requestError: unknown) {
      setError(errorMessage(requestError, 'Could not create application.'));
    } finally {
      setBusyId(null);
    }
  }

  function openHire(application: Application) {
    setHireTarget(application);
    setHiredEmployeeId(null);
    setHireForm({
      employeeNumber: '',
      startDate: new Date().toISOString().slice(0, 10),
      employmentType: application.job.employmentType ?? '',
      reason: 'Offer accepted.',
    });
  }

  async function hireCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hireTarget) return;
    setBusyId(hireTarget.id);
    setError('');
    setSuccess('');
    try {
      const response = await api.post<HireResponse>(
        `/recruitment/applications/${hireTarget.id}/hire`,
        {
          employeeNumber: hireForm.employeeNumber.trim(),
          startDate: hireForm.startDate,
          employmentType: hireForm.employmentType.trim() || undefined,
          reason: hireForm.reason.trim() || undefined,
        },
      );
      setHiredEmployeeId(response.data.employee.id);
      setSuccess(
        `${response.data.employee.firstName} ${response.data.employee.lastName} is now an employee${response.data.recruitmentJobClosed ? '; the recruitment job was also closed.' : '.'}`,
      );
      await loadWorkspace();
    } catch (requestError: unknown) {
      setError(errorMessage(requestError, 'Could not hire this candidate.'));
    } finally {
      setBusyId(null);
    }
  }

  function closeCreateDrawer() {
    if (busyId === 'create') return;
    setCreateOpen(false);
  }

  function closeHireDrawer() {
    if (hireTarget && busyId === hireTarget.id) return;
    setHireTarget(null);
  }

  return (
    <DashboardShell activePage="recruitment">
      <div className="space-y-6">
        <PageHeader
          category="Recruitment operations"
          title="Applications pipeline"
          description="Move candidates through screening, interview and offer. Hiring remains a controlled conversion that creates the employee record and position assignment."
          primaryAction={{
            label: 'Add application',
            onClick: () => setCreateOpen(true),
            icon: <Plus size={16} />,
          }}
          secondaryAction={{
            label: 'Candidates',
            href: '/dashboard/recruitment/candidates',
          }}
        />

        {error ? (
          <FeedbackBanner tone="error" title="Pipeline operation failed" message={error} />
        ) : null}
        {success ? (
          <FeedbackBanner tone="success" title="Pipeline updated" message={success} />
        ) : null}

        <section className="grid gap-0 border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-xs)] sm:grid-cols-2 xl:grid-cols-5">
          <StageMetric label="Applied" value={stageCounts.APPLIED} />
          <StageMetric label="Screening" value={stageCounts.SCREENING} />
          <StageMetric label="Interview" value={stageCounts.INTERVIEW} />
          <StageMetric label="Offer" value={stageCounts.OFFER} />
          <StageMetric label="Hired" value={stageCounts.HIRED} />
        </section>

        <section className="border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-xs)]">
          <div className="grid gap-4 border-b border-[var(--border)] bg-[var(--surface-soft)] p-5 md:grid-cols-[1fr_220px] sm:p-6">
            <label className="flex min-h-11 items-center gap-2 border border-[var(--border-strong)] bg-[var(--surface)] px-3 focus-within:border-[var(--accent)]">
              <Search size={16} className="shrink-0 text-[var(--muted)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search candidate or job"
                className="min-w-0 flex-1 bg-transparent text-sm font-medium text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
              />
            </label>
            <select
              className={inputClass}
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as ApplicationStatus | 'ALL')
              }
            >
              <option value="ALL">All stages</option>
              {(
                [
                  'APPLIED',
                  'SCREENING',
                  'INTERVIEW',
                  'OFFER',
                  'HIRED',
                  'REJECTED',
                  'WITHDRAWN',
                ] as ApplicationStatus[]
              ).map((status) => (
                <option key={status} value={status}>
                  {formatStatus(status)}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="flex min-h-80 items-center justify-center gap-3 text-sm font-medium text-[var(--muted)]">
              <Loader2 size={18} className="animate-spin text-[var(--accent)]" />
              Loading applications...
            </div>
          ) : !filtered.length ? (
            <div className="p-5 sm:p-6">
              <EmptyState
                title="No applications match this view"
                description="Adjust the search or stage filter, or add a new application to the recruitment pipeline."
                action={
                  query || statusFilter !== 'ALL' ? (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setQuery('');
                        setStatusFilter('ALL');
                      }}
                    >
                      Clear filters
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      icon={<Plus size={15} />}
                      onClick={() => setCreateOpen(true)}
                    >
                      Add application
                    </Button>
                  )
                }
              />
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {filtered.map((application) => (
                <article
                  key={application.id}
                  className="grid gap-5 px-5 py-5 transition hover:bg-[var(--surface-soft)] sm:px-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(220px,0.8fr)_140px_minmax(260px,auto)] xl:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[var(--accent)] bg-[var(--accent)] text-xs font-black text-[var(--accent-text)]">
                        {application.candidate.firstName.charAt(0)}
                        {application.candidate.lastName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate font-black text-[var(--text)]">
                          {application.candidate.firstName} {application.candidate.lastName}
                        </h3>
                        <p className="mt-1 truncate text-sm font-medium text-[var(--muted)]">
                          {application.candidate.currentRole ||
                            application.candidate.email ||
                            'Candidate profile'}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`mt-3 inline-flex border px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] ${statusClass(application.status)}`}
                    >
                      {formatStatus(application.status)}
                    </span>
                  </div>

                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--muted)]">
                      Vacancy
                    </p>
                    <p className="mt-1 text-sm font-black text-[var(--text)]">
                      {application.job.title}
                    </p>
                    <p className="mt-1 text-xs font-medium text-[var(--muted)]">
                      {application.job.reference || 'No reference'} · Job {application.job.status}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--muted)]">
                      Applied
                    </p>
                    <p className="mt-1 text-sm font-bold text-[var(--text)]">
                      {formatDate(application.appliedAt)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    <StageActions
                      application={application}
                      busy={busyId === application.id}
                      updateStatus={updateStatus}
                      openHire={openHire}
                    />
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <Drawer
        open={createOpen}
        title="Add application"
        description="Assign an existing candidate to an open recruitment job."
        onClose={closeCreateDrawer}
        footer={
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" disabled={busyId === 'create'} onClick={closeCreateDrawer}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="create-application-form"
              variant="primary"
              loading={busyId === 'create'}
              icon={<CheckCircle2 size={16} />}
            >
              Add application
            </Button>
          </div>
        }
      >
        <form id="create-application-form" onSubmit={createApplication} className="space-y-5">
          <FormField label="Candidate" htmlFor="application-candidate">
            <select
              id="application-candidate"
              required
              className={inputClass}
              value={createForm.candidateId}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  candidateId: event.target.value,
                }))
              }
            >
              <option value="">Select candidate</option>
              {candidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.firstName} {candidate.lastName}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Open job" htmlFor="application-job">
            <select
              id="application-job"
              required
              className={inputClass}
              value={createForm.jobId}
              onChange={(event) =>
                setCreateForm((current) => ({ ...current, jobId: event.target.value }))
              }
            >
              <option value="">Select job</option>
              {jobs
                .filter((job) => job.status === 'OPEN')
                .map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title}
                    {job.reference ? ` (${job.reference})` : ''}
                  </option>
                ))}
            </select>
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Expected salary" htmlFor="application-salary">
              <input
                id="application-salary"
                type="number"
                min={0}
                className={inputClass}
                value={createForm.expectedSalary}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    expectedSalary: event.target.value,
                  }))
                }
              />
            </FormField>
            <FormField label="Rating" htmlFor="application-rating">
              <select
                id="application-rating"
                className={inputClass}
                value={createForm.rating}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, rating: event.target.value }))
                }
              >
                <option value="">Not rated</option>
                {[1, 2, 3, 4, 5].map((rating) => (
                  <option key={rating} value={rating}>
                    {rating}/5
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <FormField label="Notes" htmlFor="application-notes">
            <textarea
              id="application-notes"
              rows={5}
              maxLength={2000}
              className={`${inputClass} h-auto min-h-28 py-3`}
              value={createForm.notes}
              onChange={(event) =>
                setCreateForm((current) => ({ ...current, notes: event.target.value }))
              }
            />
          </FormField>
        </form>
      </Drawer>

      <Drawer
        open={Boolean(hireTarget)}
        title="Hire candidate"
        description="Convert the accepted offer into an employee record and position assignment."
        onClose={closeHireDrawer}
        footer={
          hireTarget && !hiredEmployeeId ? (
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" disabled={busyId === hireTarget.id} onClick={closeHireDrawer}>
                Cancel
              </Button>
              <Button
                type="submit"
                form="hire-candidate-form"
                variant="primary"
                loading={busyId === hireTarget.id}
                icon={<UserCheck size={16} />}
              >
                Hire candidate
              </Button>
            </div>
          ) : null
        }
      >
        {hireTarget ? (
          hiredEmployeeId ? (
            <div className="space-y-5">
              <FeedbackBanner
                tone="success"
                title="Employee created"
                message="The candidate has been converted to an employee through the recruitment hiring workflow."
              />
              <Link
                href={`/dashboard/employees/${hiredEmployeeId}`}
                className="inline-flex min-h-11 items-center justify-center gap-2 border border-[var(--accent)] bg-[var(--accent)] px-5 text-sm font-extrabold text-[var(--accent-text)] hover:bg-[var(--accent-hover)]"
              >
                <ExternalLink size={15} />
                View employee
              </Link>
            </div>
          ) : (
            <form id="hire-candidate-form" onSubmit={hireCandidate} className="space-y-5">
              <div className="border border-[var(--border-strong)] bg-[var(--surface-soft)] p-4">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--accent)]">
                  Accepted candidate
                </p>
                <p className="mt-2 font-black text-[var(--text)]">
                  {hireTarget.candidate.firstName} {hireTarget.candidate.lastName}
                </p>
                <p className="mt-1 text-sm font-medium text-[var(--muted)]">
                  {hireTarget.job.title}
                  {hireTarget.job.reference ? ` · ${hireTarget.job.reference}` : ''}
                </p>
              </div>

              <FormField label="Employee number" htmlFor="hire-employee-number">
                <input
                  id="hire-employee-number"
                  required
                  maxLength={80}
                  className={inputClass}
                  value={hireForm.employeeNumber}
                  onChange={(event) =>
                    setHireForm((current) => ({
                      ...current,
                      employeeNumber: event.target.value,
                    }))
                  }
                />
              </FormField>

              <FormField label="Start date" htmlFor="hire-start-date">
                <input
                  id="hire-start-date"
                  required
                  type="date"
                  className={inputClass}
                  value={hireForm.startDate}
                  onChange={(event) =>
                    setHireForm((current) => ({ ...current, startDate: event.target.value }))
                  }
                />
              </FormField>

              <FormField label="Employment type" htmlFor="hire-employment-type">
                <input
                  id="hire-employment-type"
                  maxLength={100}
                  className={inputClass}
                  value={hireForm.employmentType}
                  onChange={(event) =>
                    setHireForm((current) => ({
                      ...current,
                      employmentType: event.target.value,
                    }))
                  }
                />
              </FormField>

              <FormField label="Reason / notes" htmlFor="hire-reason">
                <textarea
                  id="hire-reason"
                  rows={4}
                  maxLength={500}
                  className={`${inputClass} h-auto min-h-24 py-3`}
                  value={hireForm.reason}
                  onChange={(event) =>
                    setHireForm((current) => ({ ...current, reason: event.target.value }))
                  }
                />
              </FormField>

              <FeedbackBanner
                tone="warning"
                title="Controlled conversion"
                message="Hiring creates an Employee record and, when the job is linked to an approved position, an active position assignment. This is not a reversible status-only action."
              />
            </form>
          )
        ) : null}
      </Drawer>
    </DashboardShell>
  );
}

function StageMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-b border-[var(--border)] p-4 last:border-b-0 sm:border-r sm:last:border-r-0 xl:border-b-0">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--text)]">
        {value}
      </p>
    </div>
  );
}

function StageActions({
  application,
  busy,
  updateStatus,
  openHire,
}: {
  application: Application;
  busy: boolean;
  updateStatus: (application: Application, status: ApplicationStatus) => Promise<void>;
  openHire: (application: Application) => void;
}) {
  if (application.status === 'HIRED') {
    return <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">Employee created</span>;
  }
  if (application.status === 'REJECTED' || application.status === 'WITHDRAWN') {
    return <span className="text-sm font-medium text-[var(--muted)]">Read only</span>;
  }

  return (
    <>
      {application.status === 'APPLIED' ? (
        <Button disabled={busy} onClick={() => void updateStatus(application, 'SCREENING')}>
          Start screening
        </Button>
      ) : null}
      {application.status === 'SCREENING' ? (
        <Button disabled={busy} onClick={() => void updateStatus(application, 'INTERVIEW')}>
          Move to interview
        </Button>
      ) : null}
      {application.status === 'INTERVIEW' ? (
        <Button disabled={busy} onClick={() => void updateStatus(application, 'OFFER')}>
          Move to offer
        </Button>
      ) : null}
      {application.status === 'OFFER' && application.job.status === 'OPEN' ? (
        <Button
          variant="primary"
          disabled={busy}
          icon={<UserCheck size={15} />}
          onClick={() => openHire(application)}
        >
          Hire candidate
        </Button>
      ) : null}
      {['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER'].includes(application.status) ? (
        <Button
          variant="danger"
          disabled={busy}
          onClick={() => void updateStatus(application, 'REJECTED')}
        >
          Reject
        </Button>
      ) : null}
    </>
  );
}
