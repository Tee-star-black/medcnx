'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  SearchCheck,
  UserPlus,
  UsersRound,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { StatCard } from '@/components/dashboard/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { FeedbackBanner } from '@/components/ui/FeedbackBanner';
import { PageHeader } from '@/components/ui/PageHeader';
import { api } from '@/lib/api';

type RecruitmentOverview = {
  totals: {
    totalJobs: number;
    openJobs: number;
    candidates: number;
    applications: number;
    screeningApplications: number;
    interviewApplications: number;
    offerApplications: number;
    hiredApplications: number;
  };
  recentApplications: JobApplication[];
};

type JobApplicationStatus =
  | 'APPLIED'
  | 'SCREENING'
  | 'INTERVIEW'
  | 'OFFER'
  | 'HIRED'
  | 'REJECTED'
  | 'WITHDRAWN';

type JobApplication = {
  id: string;
  organisationId: string;
  jobId: string;
  candidateId: string;
  status: JobApplicationStatus;
  appliedAt: string;
  interviewDate?: string | null;
  offerDate?: string | null;
  decisionDate?: string | null;
  expectedSalary?: number | null;
  rating?: number | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  job?: {
    id: string;
    title: string;
    reference?: string | null;
    status?: string;
  } | null;
  candidate?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
    currentRole?: string | null;
  } | null;
};

function formatDate(value?: string | null) {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(new Date(value));
}

function formatStatus(status: string) {
  return status
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusClass(status: JobApplicationStatus) {
  if (status === 'HIRED') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300';
  }
  if (status === 'REJECTED' || status === 'WITHDRAWN') {
    return 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300';
  }
  if (status === 'OFFER') {
    return 'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950/50 dark:text-violet-300';
  }
  if (status === 'INTERVIEW') {
    return 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300';
  }
  if (status === 'SCREENING') {
    return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300';
  }
  return 'border-[var(--border-strong)] bg-[var(--surface)] text-[var(--muted)]';
}

function candidateName(application: JobApplication) {
  if (!application.candidate) return 'Unknown candidate';
  return `${application.candidate.firstName} ${application.candidate.lastName}`;
}

export default function RecruitmentPage() {
  const [overview, setOverview] = useState<RecruitmentOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void loadRecruitmentOverview();
  }, []);

  const totals = overview?.totals;
  const pipelineTotal = useMemo(() => {
    if (!totals) return 0;
    return (
      totals.screeningApplications +
      totals.interviewApplications +
      totals.offerApplications
    );
  }, [totals]);

  async function loadRecruitmentOverview() {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<RecruitmentOverview>('/recruitment');
      setOverview(response.data);
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ??
        'Could not load recruitment dashboard.';
      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardShell activePage="recruitment">
      <div className="space-y-6">
        <PageHeader
          category="Recruitment operations"
          title="Hiring pipeline"
          description="Manage approved vacancies, candidate records and application stages from one auditable recruitment workspace."
          primaryAction={{
            label: 'Manage jobs',
            href: '/dashboard/recruitment/jobs',
            icon: <BriefcaseBusiness size={16} />,
          }}
          secondaryAction={{
            label: loading ? 'Refreshing...' : 'Refresh',
            onClick: () => void loadRecruitmentOverview(),
            icon: loading ? <Loader2 className="animate-spin" size={16} /> : <Clock3 size={16} />,
          }}
        />

        {error ? (
          <FeedbackBanner
            tone="error"
            title="Recruitment data unavailable"
            message={error}
          />
        ) : null}

        {loading && !overview ? (
          <section className="flex min-h-[420px] items-center justify-center border border-[var(--border)] bg-[var(--surface)]">
            <div className="text-center">
              <Loader2 className="mx-auto animate-spin text-[var(--accent)]" size={26} />
              <p className="mt-4 text-sm font-extrabold text-[var(--text)]">
                Loading recruitment workspace
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Resolving vacancies, candidates and pipeline activity.
              </p>
            </div>
          </section>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                title="Open jobs"
                value={String(totals?.openJobs ?? 0)}
                description={`${totals?.totalJobs ?? 0} total vacancies`}
                icon={<BriefcaseBusiness size={18} />}
              />
              <StatCard
                title="Candidates"
                value={String(totals?.candidates ?? 0)}
                description="Candidate records"
                icon={<UsersRound size={18} />}
              />
              <StatCard
                title="Applications"
                value={String(totals?.applications ?? 0)}
                description={`${pipelineTotal} active in pipeline`}
                icon={<FileText size={18} />}
              />
              <StatCard
                title="Hired"
                value={String(totals?.hiredApplications ?? 0)}
                description="Successful applications"
                icon={<CheckCircle2 size={18} />}
              />
            </section>

            <section className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
              <aside className="space-y-4">
                <section className="border border-[var(--border-strong)] bg-[var(--surface)] shadow-[var(--shadow-xs)]">
                  <div className="border-b border-[var(--border)] px-5 py-5">
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[var(--accent)]">
                      Hiring workflow
                    </p>
                    <h2 className="mt-2 text-xl font-black tracking-[-0.035em] text-[var(--text)]">
                      Recruitment controls
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                      Move from authorised vacancy to candidate decision without losing the operational trail.
                    </p>
                  </div>

                  <nav className="divide-y divide-[var(--border)]">
                    <WorkflowLink
                      href="/dashboard/recruitment/jobs"
                      icon={<BriefcaseBusiness size={17} />}
                      title="Jobs & vacancies"
                      helper="Openings and hiring demand"
                    />
                    <WorkflowLink
                      href="/dashboard/recruitment/candidates"
                      icon={<UserPlus size={17} />}
                      title="Candidate records"
                      helper="People in the talent pool"
                    />
                    <WorkflowLink
                      href="/dashboard/recruitment/applications"
                      icon={<SearchCheck size={17} />}
                      title="Applications"
                      helper="Stage movement and decisions"
                    />
                  </nav>
                </section>

                <section className="border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-xs)]">
                  <div className="border-b border-[var(--border)] px-5 py-4">
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--muted)]">
                      Active pipeline
                    </p>
                  </div>
                  <div className="divide-y divide-[var(--border)]">
                    <MiniMetric
                      label="Screening"
                      value={String(totals?.screeningApplications ?? 0)}
                    />
                    <MiniMetric
                      label="Interview"
                      value={String(totals?.interviewApplications ?? 0)}
                    />
                    <MiniMetric
                      label="Offer"
                      value={String(totals?.offerApplications ?? 0)}
                    />
                  </div>
                </section>
              </aside>

              <section className="border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-xs)]">
                <div className="flex flex-col gap-4 border-b border-[var(--border)] px-5 py-5 sm:px-6 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[var(--accent)]">
                      Pipeline activity
                    </p>
                    <h2 className="mt-2 text-xl font-black tracking-[-0.035em] text-[var(--text)]">
                      Recent applications
                    </h2>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      Latest candidate applications and their current hiring stage.
                    </p>
                  </div>
                  <Link
                    href="/dashboard/recruitment/applications"
                    className="inline-flex min-h-10 items-center justify-center gap-2 border border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-extrabold text-[var(--accent-text)] hover:bg-[var(--accent-hover)]"
                  >
                    Open pipeline
                    <ArrowRight size={15} />
                  </Link>
                </div>

                <div className="p-5 sm:p-6">
                  {!overview?.recentApplications?.length ? (
                    <EmptyState
                      icon={<SearchCheck size={22} />}
                      title="No applications yet"
                      description="Create an approved job opening, add a candidate and submit the first application to begin the hiring pipeline."
                      action={
                        <Link
                          href="/dashboard/recruitment/jobs"
                          className="inline-flex min-h-10 items-center justify-center gap-2 border border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-extrabold text-[var(--accent-text)]"
                        >
                          Open jobs
                          <ArrowRight size={14} />
                        </Link>
                      }
                    />
                  ) : (
                    <div className="divide-y divide-[var(--border)] border border-[var(--border)]">
                      {overview.recentApplications.map((application) => (
                        <article
                          key={application.id}
                          className="grid gap-4 bg-[var(--surface)] p-5 transition hover:bg-[var(--surface-soft)] xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[var(--border-strong)] bg-[var(--surface-soft)] text-[var(--accent)]">
                                <UsersRound size={17} />
                              </div>
                              <div className="min-w-0">
                                <h3 className="truncate text-sm font-extrabold text-[var(--text)]">
                                  {candidateName(application)}
                                </h3>
                                <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
                                  {application.job?.title ?? 'Unknown job'} · Applied {formatDate(application.appliedAt)}
                                </p>
                              </div>
                              <span
                                className={`border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] ${statusClass(
                                  application.status,
                                )}`}
                              >
                                {formatStatus(application.status)}
                              </span>
                            </div>
                            {application.notes ? (
                              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                                {application.notes}
                              </p>
                            ) : null}
                          </div>

                          <Link
                            href="/dashboard/recruitment/applications"
                            className="inline-flex min-h-10 items-center justify-center gap-2 border border-[var(--border-strong)] bg-[var(--surface)] px-4 text-sm font-bold text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                          >
                            Review
                            <ArrowRight size={14} />
                          </Link>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </section>
          </>
        )}
      </div>
    </DashboardShell>
  );
}

function WorkflowLink({
  href,
  icon,
  title,
  helper,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  helper: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 px-5 py-4 transition hover:bg-[var(--surface-soft)]"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-[var(--border-strong)] bg-[var(--surface-soft)] text-[var(--accent)] group-hover:border-[var(--accent)]">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold text-[var(--text)]">{title}</p>
        <p className="mt-0.5 text-xs text-[var(--muted)]">{helper}</p>
      </div>
      <ArrowRight size={15} className="shrink-0 text-[var(--muted)] group-hover:text-[var(--accent)]" />
    </Link>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--muted)]">
        {label}
      </p>
      <p className="text-xl font-black tabular-nums text-[var(--text)]">{value}</p>
    </div>
  );
}
