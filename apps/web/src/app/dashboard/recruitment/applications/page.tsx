'use client';

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import type { AxiosError } from 'axios';
import Link from 'next/link';
import { CheckCircle2, ExternalLink, Loader2, Plus, Search, TriangleAlert, UserCheck, X } from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { api } from '@/lib/api';

type ApplicationStatus = 'APPLIED' | 'SCREENING' | 'INTERVIEW' | 'OFFER' | 'HIRED' | 'REJECTED' | 'WITHDRAWN';
type JobStatus = 'OPEN' | 'ON_HOLD' | 'CLOSED';

type Candidate = { id: string; firstName: string; lastName: string; email?: string | null; phone?: string | null; currentRole?: string | null };
type Job = { id: string; title: string; reference?: string | null; status: JobStatus; employmentType?: string | null };
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
type HireResponse = { employee: { id: string; employeeNumber: string; firstName: string; lastName: string }; recruitmentJobClosed: boolean };
type ApiErrorPayload = { message?: string | string[] };

const inputClass = 'h-11 w-full border border-black/10 bg-[#f8fafc] px-3 text-sm outline-none transition focus:border-black';

function errorMessage(error: unknown, fallback: string) {
  const message = (error as AxiosError<ApiErrorPayload>).response?.data?.message;
  return Array.isArray(message) ? message.join(' ') : message || fallback;
}

function statusClass(status: ApplicationStatus) {
  const classes: Record<ApplicationStatus, string> = {
    APPLIED: 'border-slate-200 bg-slate-50 text-slate-700',
    SCREENING: 'border-blue-200 bg-blue-50 text-blue-700',
    INTERVIEW: 'border-violet-200 bg-violet-50 text-violet-700',
    OFFER: 'border-amber-200 bg-amber-50 text-amber-700',
    HIRED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    REJECTED: 'border-red-200 bg-red-50 text-red-700',
    WITHDRAWN: 'border-gray-200 bg-gray-50 text-gray-500',
  };
  return classes[status];
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
  const [createForm, setCreateForm] = useState({ jobId: '', candidateId: '', expectedSalary: '', rating: '', notes: '' });
  const [hireTarget, setHireTarget] = useState<Application | null>(null);
  const [hireForm, setHireForm] = useState({ employeeNumber: '', startDate: '', employmentType: '', reason: '' });
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
      return [application.candidate.firstName, application.candidate.lastName, application.candidate.email, application.job.title, application.job.reference]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
    });
  }, [applications, query, statusFilter]);

  async function updateStatus(application: Application, status: ApplicationStatus) {
    setBusyId(application.id);
    setError('');
    setSuccess('');
    try {
      const payload: Record<string, unknown> = { status };
      if (status === 'INTERVIEW') payload.interviewDate = new Date().toISOString();
      if (status === 'OFFER') payload.offerDate = new Date().toISOString();
      await api.patch(`/recruitment/applications/${application.id}/status`, payload);
      setSuccess(`${application.candidate.firstName} ${application.candidate.lastName} moved to ${status.toLowerCase()}.`);
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
        expectedSalary: createForm.expectedSalary ? Number(createForm.expectedSalary) : undefined,
        rating: createForm.rating ? Number(createForm.rating) : undefined,
        notes: createForm.notes.trim() || undefined,
      });
      setCreateOpen(false);
      setCreateForm({ jobId: '', candidateId: '', expectedSalary: '', rating: '', notes: '' });
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
    setHireForm({ employeeNumber: '', startDate: new Date().toISOString().slice(0, 10), employmentType: application.job.employmentType ?? '', reason: 'Offer accepted.' });
  }

  async function hireCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hireTarget) return;
    setBusyId(hireTarget.id);
    setError('');
    setSuccess('');
    try {
      const response = await api.post<HireResponse>(`/recruitment/applications/${hireTarget.id}/hire`, {
        employeeNumber: hireForm.employeeNumber.trim(),
        startDate: hireForm.startDate,
        employmentType: hireForm.employmentType.trim() || undefined,
        reason: hireForm.reason.trim() || undefined,
      });
      setHiredEmployeeId(response.data.employee.id);
      setSuccess(`${response.data.employee.firstName} ${response.data.employee.lastName} is now an employee${response.data.recruitmentJobClosed ? '; the recruitment job was also closed.' : '.'}`);
      await loadWorkspace();
    } catch (requestError: unknown) {
      setError(errorMessage(requestError, 'Could not hire this candidate.'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <DashboardShell activePage="recruitment">
      <div className="space-y-7">
        <section className="flex flex-col gap-5 border-b border-black/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-sm uppercase tracking-[0.25em] text-gray-400">Recruitment</p>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#111827]">Applications pipeline</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">Move candidates through screening, interview and offer. Hiring is a controlled conversion that creates the employee record and position assignment.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard/recruitment/candidates" className="border border-black/10 bg-white px-4 py-3 text-sm font-medium text-gray-600 hover:border-black hover:text-black">Candidates</Link>
            <button type="button" onClick={() => setCreateOpen(true)} className="inline-flex items-center gap-2 border border-black bg-black px-4 py-3 text-sm font-medium text-white hover:bg-white hover:text-black"><Plus size={16} />Add application</button>
          </div>
        </section>

        {error ? <div className="flex gap-3 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><TriangleAlert size={17} />{error}</div> : null}
        {success ? <div className="flex gap-3 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"><CheckCircle2 size={17} />{success}</div> : null}

        <section className="border border-black/10 bg-white">
          <div className="grid gap-4 border-b border-black/10 p-5 md:grid-cols-[1fr_220px]">
            <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input className={`${inputClass} pl-10`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search candidate or job..." /></div>
            <select className={inputClass} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ApplicationStatus | 'ALL')}><option value="ALL">All stages</option>{(['APPLIED','SCREENING','INTERVIEW','OFFER','HIRED','REJECTED','WITHDRAWN'] as ApplicationStatus[]).map((status) => <option key={status} value={status}>{status}</option>)}</select>
          </div>

          {loading ? <div className="flex min-h-80 items-center justify-center gap-3 text-sm text-gray-500"><Loader2 size={18} className="animate-spin" />Loading applications...</div> : !filtered.length ? <div className="px-6 py-16 text-center text-sm text-gray-500">No applications match this view.</div> : (
            <div className="divide-y divide-black/10">
              {filtered.map((application) => (
                <article key={application.id} className="grid gap-5 p-5 xl:grid-cols-[1.3fr_1fr_150px_300px] xl:items-center">
                  <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-[#111827]">{application.candidate.firstName} {application.candidate.lastName}</h3><span className={`border px-2 py-1 text-[11px] font-semibold ${statusClass(application.status)}`}>{application.status}</span></div><p className="mt-1 text-sm text-gray-500">{application.candidate.currentRole || application.candidate.email || 'Candidate profile'}</p></div>
                  <div><p className="text-sm font-medium text-[#111827]">{application.job.title}</p><p className="mt-1 text-xs text-gray-400">{application.job.reference || 'No reference'} · Job {application.job.status}</p></div>
                  <div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">Applied</p><p className="mt-1 text-sm text-gray-600">{new Date(application.appliedAt).toLocaleDateString()}</p></div>
                  <div className="flex flex-wrap gap-2 xl:justify-end"><StageActions application={application} busy={busyId === application.id} updateStatus={updateStatus} openHire={openHire} /></div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {createOpen ? (
        <Drawer title="Add application" close={() => setCreateOpen(false)}>
          <form onSubmit={createApplication} className="space-y-4">
            <Field label="Candidate"><select required className={inputClass} value={createForm.candidateId} onChange={(event) => setCreateForm((current) => ({ ...current, candidateId: event.target.value }))}><option value="">Select candidate</option>{candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.firstName} {candidate.lastName}</option>)}</select></Field>
            <Field label="Open job"><select required className={inputClass} value={createForm.jobId} onChange={(event) => setCreateForm((current) => ({ ...current, jobId: event.target.value }))}><option value="">Select job</option>{jobs.filter((job) => job.status === 'OPEN').map((job) => <option key={job.id} value={job.id}>{job.title}{job.reference ? ` (${job.reference})` : ''}</option>)}</select></Field>
            <div className="grid gap-4 sm:grid-cols-2"><Field label="Expected salary"><input type="number" min={0} className={inputClass} value={createForm.expectedSalary} onChange={(event) => setCreateForm((current) => ({ ...current, expectedSalary: event.target.value }))} /></Field><Field label="Rating"><select className={inputClass} value={createForm.rating} onChange={(event) => setCreateForm((current) => ({ ...current, rating: event.target.value }))}><option value="">Not rated</option>{[1,2,3,4,5].map((rating) => <option key={rating} value={rating}>{rating}/5</option>)}</select></Field></div>
            <Field label="Notes"><textarea rows={5} maxLength={2000} className={`${inputClass} h-auto min-h-28 py-3`} value={createForm.notes} onChange={(event) => setCreateForm((current) => ({ ...current, notes: event.target.value }))} /></Field>
            <Actions busy={busyId === 'create'} submitLabel="Add application" cancel={() => setCreateOpen(false)} />
          </form>
        </Drawer>
      ) : null}

      {hireTarget ? (
        <Drawer title="Hire candidate" close={() => setHireTarget(null)}>
          {hiredEmployeeId ? <div className="space-y-4"><div className="border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">The candidate has been converted to an employee.</div><Link href={`/dashboard/employees/${hiredEmployeeId}`} className="inline-flex items-center gap-2 border border-black bg-black px-5 py-3 text-sm font-medium text-white"><ExternalLink size={15} />View employee</Link></div> : (
            <form onSubmit={hireCandidate} className="space-y-4">
              <div className="border border-black/10 bg-[#f8fafc] p-4"><p className="font-semibold">{hireTarget.candidate.firstName} {hireTarget.candidate.lastName}</p><p className="mt-1 text-sm text-gray-500">{hireTarget.job.title}{hireTarget.job.reference ? ` · ${hireTarget.job.reference}` : ''}</p></div>
              <Field label="Employee number"><input required maxLength={80} className={inputClass} value={hireForm.employeeNumber} onChange={(event) => setHireForm((current) => ({ ...current, employeeNumber: event.target.value }))} /></Field>
              <Field label="Start date"><input required type="date" className={inputClass} value={hireForm.startDate} onChange={(event) => setHireForm((current) => ({ ...current, startDate: event.target.value }))} /></Field>
              <Field label="Employment type"><input maxLength={100} className={inputClass} value={hireForm.employmentType} onChange={(event) => setHireForm((current) => ({ ...current, employmentType: event.target.value }))} /></Field>
              <Field label="Reason / notes"><textarea rows={4} maxLength={500} className={`${inputClass} h-auto min-h-24 py-3`} value={hireForm.reason} onChange={(event) => setHireForm((current) => ({ ...current, reason: event.target.value }))} /></Field>
              <div className="border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">Hiring creates an Employee record and, when the job is linked to an approved position, an active position assignment. This is not a reversible status-only action.</div>
              <Actions busy={busyId === hireTarget.id} submitLabel="Hire candidate" cancel={() => setHireTarget(null)} icon={<UserCheck size={16} />} />
            </form>
          )}
        </Drawer>
      ) : null}
    </DashboardShell>
  );
}

function StageActions({ application, busy, updateStatus, openHire }: { application: Application; busy: boolean; updateStatus: (application: Application, status: ApplicationStatus) => Promise<void>; openHire: (application: Application) => void }) {
  if (application.status === 'HIRED') return <span className="text-sm font-medium text-emerald-700">Employee created</span>;
  if (application.status === 'REJECTED' || application.status === 'WITHDRAWN') return <span className="text-sm text-gray-400">Read only</span>;
  const buttonClass = 'border border-black/10 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:border-black hover:text-black disabled:opacity-50';
  return <>{application.status === 'APPLIED' ? <button disabled={busy} onClick={() => void updateStatus(application, 'SCREENING')} className={buttonClass}>Start screening</button> : null}{application.status === 'SCREENING' ? <button disabled={busy} onClick={() => void updateStatus(application, 'INTERVIEW')} className={buttonClass}>Move to interview</button> : null}{application.status === 'INTERVIEW' ? <button disabled={busy} onClick={() => void updateStatus(application, 'OFFER')} className={buttonClass}>Move to offer</button> : null}{application.status === 'OFFER' && application.job.status === 'OPEN' ? <button disabled={busy} onClick={() => openHire(application)} className="border border-emerald-700 bg-emerald-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Hire candidate</button> : null}{['APPLIED','SCREENING','INTERVIEW','OFFER'].includes(application.status) ? <button disabled={busy} onClick={() => void updateStatus(application, 'REJECTED')} className="border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-50">Reject</button> : null}</>;
}

function Drawer({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  return <div className="fixed inset-0 z-[80] flex justify-end bg-black/35" onMouseDown={close}><aside role="dialog" aria-modal="true" className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><div className="sticky top-0 z-10 flex items-center justify-between border-b border-black/10 bg-white px-6 py-5"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Recruitment</p><h2 className="mt-1 text-xl font-semibold">{title}</h2></div><button type="button" onClick={close} className="flex h-9 w-9 items-center justify-center border border-black/10"><X size={17} /></button></div><div className="p-6">{children}</div></aside></div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block"><span className="mb-2 block text-sm font-medium text-[#111827]">{label}</span>{children}</label>; }
function Actions({ busy, submitLabel, cancel, icon }: { busy: boolean; submitLabel: string; cancel: () => void; icon?: ReactNode }) { return <div className="flex justify-end gap-3 border-t border-black/10 pt-5"><button type="button" onClick={cancel} disabled={busy} className="border border-black/10 px-5 py-3 text-sm font-medium disabled:opacity-50">Cancel</button><button type="submit" disabled={busy} className="inline-flex items-center gap-2 border border-black bg-black px-5 py-3 text-sm font-medium text-white disabled:opacity-50">{busy ? <Loader2 size={16} className="animate-spin" /> : icon || <CheckCircle2 size={16} />}{submitLabel}</button></div>; }
