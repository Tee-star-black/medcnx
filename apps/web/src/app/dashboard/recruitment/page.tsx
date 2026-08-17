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
  RefreshCw,
  SearchCheck,
  UserPlus,
  UsersRound,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
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
  if (!value) {
    return 'Not set';
  }

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
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (status === 'REJECTED' || status === 'WITHDRAWN') {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  if (status === 'OFFER') {
    return 'border-violet-200 bg-violet-50 text-violet-700';
  }

  if (status === 'INTERVIEW') {
    return 'border-blue-200 bg-blue-50 text-blue-700';
  }

  if (status === 'SCREENING') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  return 'border-gray-200 bg-gray-50 text-gray-600';
}

function candidateName(application: JobApplication) {
  if (!application.candidate) {
    return 'Unknown candidate';
  }

  return `${application.candidate.firstName} ${application.candidate.lastName}`;
}

export default function RecruitmentPage() {
  const [overview, setOverview] = useState<RecruitmentOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadRecruitmentOverview();
  }, []);

  const totals = overview?.totals;

  const pipelineTotal = useMemo(() => {
    if (!totals) {
      return 0;
    }

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
      <div className="space-y-8">
        <section className="flex flex-col gap-5 border-b border-black/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-sm uppercase tracking-[0.25em] text-gray-400">
              Recruitment
            </p>

            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#111827]">
              Hiring pipeline
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              Manage vacancies, candidates, applications and hiring stages from
              one recruitment workspace.
            </p>
          </div>

          <button
            type="button"
            onClick={loadRecruitmentOverview}
            className="inline-flex items-center justify-center gap-2 border border-black/10 bg-white px-5 py-3 text-sm font-medium text-gray-600 transition hover:border-black hover:text-black"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </section>

        {error ? (
          <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="flex min-h-[520px] items-center justify-center border border-black/10 bg-white">
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <Loader2 className="animate-spin" size={18} />
              Loading recruitment dashboard...
            </div>
          </div>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                title="Open jobs"
                value={String(totals?.openJobs ?? 0)}
                helper={`${totals?.totalJobs ?? 0} total vacancies`}
                icon={<BriefcaseBusiness size={18} />}
              />

              <StatCard
                title="Candidates"
                value={String(totals?.candidates ?? 0)}
                helper="Candidate records"
                icon={<UsersRound size={18} />}
              />

              <StatCard
                title="Applications"
                value={String(totals?.applications ?? 0)}
                helper={`${pipelineTotal} active in pipeline`}
                icon={<FileText size={18} />}
              />

              <StatCard
                title="Hired"
                value={String(totals?.hiredApplications ?? 0)}
                helper="Successful applications"
                icon={<CheckCircle2 size={18} />}
                dark
              />
            </section>

            <section className="grid gap-6 xl:grid-cols-[360px_1fr]">
              <aside className="space-y-6">
                <section className="border border-black/10 bg-[#111827] p-6 text-white">
                  <div className="flex h-11 w-11 items-center justify-center border border-white/15 bg-white/10">
                    <BriefcaseBusiness size={19} />
                  </div>

                  <h2 className="mt-5 text-lg font-semibold tracking-[-0.03em]">
                    Recruitment workflows
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-white/70">
                    Create vacancies, add candidates and move applications
                    through the hiring pipeline.
                  </p>

                  <div className="mt-6 grid gap-3">
                    <Link
                      href="/dashboard/recruitment/jobs"
                      className="inline-flex items-center justify-center gap-2 border border-white bg-white px-4 py-3 text-sm font-medium text-[#111827] transition hover:bg-transparent hover:text-white"
                    >
                      <BriefcaseBusiness size={16} />
                      Manage jobs
                    </Link>

                    <Link
                      href="/dashboard/recruitment/candidates"
                      className="inline-flex items-center justify-center gap-2 border border-white/20 bg-white/10 px-4 py-3 text-sm font-medium text-white transition hover:border-white"
                    >
                      <UserPlus size={16} />
                      Manage candidates
                    </Link>

                    <Link
                      href="/dashboard/recruitment/applications"
                      className="inline-flex items-center justify-center gap-2 border border-white/20 bg-white/10 px-4 py-3 text-sm font-medium text-white transition hover:border-white"
                    >
                      <SearchCheck size={16} />
                      Applications
                    </Link>
                  </div>
                </section>

                <section className="border border-black/10 bg-white p-6">
                  <div className="flex h-11 w-11 items-center justify-center border border-black/10 bg-[#f8fafc] text-gray-500">
                    <Clock3 size={19} />
                  </div>

                  <h2 className="mt-5 text-lg font-semibold tracking-[-0.03em] text-[#111827]">
                    Active pipeline
                  </h2>

                  <div className="mt-4 space-y-3">
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

              <section className="border border-black/10 bg-white">
                <div className="flex flex-col gap-4 border-b border-black/10 px-6 py-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold tracking-[-0.03em] text-[#111827]">
                      Recent applications
                    </h2>

                    <p className="mt-1 text-sm text-gray-500">
                      Latest candidate applications in the hiring pipeline.
                    </p>
                  </div>

                  <Link
                    href="/dashboard/recruitment/applications"
                    className="inline-flex items-center justify-center gap-2 border border-black bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-white hover:text-black"
                  >
                    View applications
                    <ArrowRight size={15} />
                  </Link>
                </div>

                <div className="p-6">
                  {!overview?.recentApplications?.length ? (
                    <div className="border border-dashed border-black/15 bg-[#f8fafc] px-5 py-14 text-center">
                      <SearchCheck size={34} className="mx-auto text-gray-300" />

                      <p className="mt-4 text-sm font-medium text-[#111827]">
                        No applications yet
                      </p>

                      <p className="mt-1 text-sm text-gray-500">
                        Create a job, add a candidate and submit the first
                        application.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {overview.recentApplications.map((application) => (
                        <article
                          key={application.id}
                          className="border border-black/10 bg-[#f8fafc] p-5"
                        >
                          <div className="grid gap-4 xl:grid-cols-[1fr_auto]">
                            <div>
                              <div className="flex flex-wrap items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center border border-black/10 bg-white text-gray-500">
                                  <UsersRound size={17} />
                                </div>

                                <div>
                                  <h3 className="text-sm font-semibold text-[#111827]">
                                    {candidateName(application)}
                                  </h3>

                                  <p className="mt-1 text-xs text-gray-500">
                                    {application.job?.title ?? 'Unknown job'} ·
                                    Applied {formatDate(application.appliedAt)}
                                  </p>
                                </div>

                                <span
                                  className={`border px-2 py-1 text-[11px] font-medium ${statusClass(
                                    application.status,
                                  )}`}
                                >
                                  {formatStatus(application.status)}
                                </span>
                              </div>

                              {application.notes ? (
                                <p className="mt-4 text-sm leading-6 text-gray-500">
                                  {application.notes}
                                </p>
                              ) : null}
                            </div>

                            <Link
                              href="/dashboard/recruitment/applications"
                              className="inline-flex items-center justify-center gap-2 border border-black/10 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition hover:border-black hover:text-black"
                            >
                              Open pipeline
                              <ArrowRight size={15} />
                            </Link>
                          </div>
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

function StatCard({
  title,
  value,
  helper,
  icon,
  dark,
}: {
  title: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
  dark?: boolean;
}) {
  return (
    <div
      className={`border p-5 ${
        dark
          ? 'border-[#111827] bg-[#111827] text-white'
          : 'border-black/10 bg-white text-[#111827]'
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <p
          className={`text-xs uppercase tracking-[0.18em] ${
            dark ? 'text-white/50' : 'text-gray-400'
          }`}
        >
          {title}
        </p>

        <div className={dark ? 'text-white/60' : 'text-gray-400'}>{icon}</div>
      </div>

      <p className="mt-3 text-2xl font-semibold tracking-[-0.05em]">{value}</p>

      <p className={`mt-1 text-sm ${dark ? 'text-white/60' : 'text-gray-500'}`}>
        {helper}
      </p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border border-black/10 bg-[#f8fafc] p-3">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-sm font-semibold text-[#111827]">{value}</p>
    </div>
  );
}