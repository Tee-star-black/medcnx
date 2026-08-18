'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { AxiosError } from 'axios';
import Link from 'next/link';
import { CheckCircle2, Loader2, Plus, Search, TriangleAlert, Users, X } from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { api } from '@/lib/api';

type Candidate = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  currentCompany?: string | null;
  currentRole?: string | null;
  location?: string | null;
  source?: string | null;
  notes?: string | null;
  applicationCount: number;
};

type CandidateForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  currentCompany: string;
  currentRole: string;
  location: string;
  source: string;
  notes: string;
};

type ApiErrorPayload = { message?: string | string[] };

const emptyForm: CandidateForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  currentCompany: '',
  currentRole: '',
  location: '',
  source: '',
  notes: '',
};

const inputClass = 'h-11 w-full border border-black/10 bg-[#f8fafc] px-3 text-sm outline-none transition focus:border-black';

function errorMessage(error: unknown, fallback: string) {
  const message = (error as AxiosError<ApiErrorPayload>).response?.data?.message;
  return Array.isArray(message) ? message.join(' ') : message || fallback;
}

export default function RecruitmentCandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<CandidateForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    void loadCandidates();
  }, []);

  async function loadCandidates() {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<Candidate[]>('/recruitment/candidates');
      setCandidates(response.data);
    } catch (requestError: unknown) {
      setError(errorMessage(requestError, 'Could not load candidates.'));
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return candidates;
    return candidates.filter((candidate) =>
      [candidate.firstName, candidate.lastName, candidate.email, candidate.currentCompany, candidate.currentRole, candidate.location]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search)),
    );
  }, [candidates, query]);

  async function createCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    const payload = Object.fromEntries(
      Object.entries(form).map(([key, value]) => [key, value.trim() || undefined]),
    );

    try {
      await api.post('/recruitment/candidates', payload);
      setForm(emptyForm);
      setFormOpen(false);
      setSuccess('Candidate added to the recruitment pool.');
      await loadCandidates();
    } catch (requestError: unknown) {
      setError(errorMessage(requestError, 'Could not create candidate.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardShell activePage="recruitment">
      <div className="space-y-7">
        <section className="flex flex-col gap-5 border-b border-black/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-sm uppercase tracking-[0.25em] text-gray-400">Recruitment</p>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#111827]">Candidates</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">Maintain the organisation candidate pool independently from individual job applications.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard/recruitment/applications" className="border border-black/10 bg-white px-4 py-3 text-sm font-medium text-gray-600 hover:border-black hover:text-black">Applications</Link>
            <button type="button" onClick={() => setFormOpen(true)} className="inline-flex items-center gap-2 border border-black bg-black px-4 py-3 text-sm font-medium text-white hover:bg-white hover:text-black">
              <Plus size={16} /> Add candidate
            </button>
          </div>
        </section>

        {error ? <div className="flex gap-3 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><TriangleAlert size={17} />{error}</div> : null}
        {success ? <div className="flex gap-3 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"><CheckCircle2 size={17} />{success}</div> : null}

        <section className="border border-black/10 bg-white">
          <div className="flex flex-col gap-4 border-b border-black/10 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-semibold text-[#111827]">Candidate pool</h2>
              <p className="text-sm text-gray-500">{candidates.length} candidate{candidates.length === 1 ? '' : 's'}</p>
            </div>
            <div className="relative w-full md:w-96">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search candidates..." className={`${inputClass} pl-10`} />
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-72 items-center justify-center gap-3 text-sm text-gray-500"><Loader2 size={18} className="animate-spin" />Loading candidates...</div>
          ) : !filtered.length ? (
            <div className="px-6 py-16 text-center"><Users size={34} className="mx-auto text-gray-300" /><p className="mt-4 text-sm font-medium">No candidates found</p></div>
          ) : (
            <div className="divide-y divide-black/10">
              {filtered.map((candidate) => (
                <article key={candidate.id} className="grid gap-4 p-5 lg:grid-cols-[1.4fr_1fr_140px] lg:items-center">
                  <div>
                    <h3 className="font-semibold text-[#111827]">{candidate.firstName} {candidate.lastName}</h3>
                    <p className="mt-1 text-sm text-gray-500">{candidate.currentRole || 'Role not supplied'}{candidate.currentCompany ? ` · ${candidate.currentCompany}` : ''}</p>
                    <p className="mt-1 text-xs text-gray-400">{candidate.email || candidate.phone || 'No contact details'}{candidate.location ? ` · ${candidate.location}` : ''}</p>
                  </div>
                  <div className="text-sm text-gray-500">
                    <p><span className="font-medium text-gray-700">Source:</span> {candidate.source || 'Not specified'}</p>
                    <p className="mt-1"><span className="font-medium text-gray-700">Applications:</span> {candidate.applicationCount}</p>
                  </div>
                  <div className="lg:text-right">
                    <Link href={`/dashboard/recruitment/applications?candidateId=${candidate.id}`} className="inline-flex border border-black/10 px-3 py-2 text-sm font-medium text-gray-600 hover:border-black hover:text-black">View applications</Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {formOpen ? (
        <div className="fixed inset-0 z-[80] flex justify-end bg-black/35" onMouseDown={() => !saving && setFormOpen(false)}>
          <aside className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <div className="sticky top-0 flex items-center justify-between border-b border-black/10 bg-white px-6 py-5">
              <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Recruitment</p><h2 className="mt-1 text-xl font-semibold">Add candidate</h2></div>
              <button type="button" onClick={() => setFormOpen(false)} className="flex h-9 w-9 items-center justify-center border border-black/10"><X size={17} /></button>
            </div>
            <form onSubmit={createCandidate} className="space-y-4 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First name"><input required maxLength={120} className={inputClass} value={form.firstName} onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} /></Field>
                <Field label="Last name"><input required maxLength={120} className={inputClass} value={form.lastName} onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} /></Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Email"><input type="email" maxLength={160} className={inputClass} value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></Field>
                <Field label="Phone"><input maxLength={80} className={inputClass} value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} /></Field>
              </div>
              <Field label="Current role"><input maxLength={160} className={inputClass} value={form.currentRole} onChange={(event) => setForm((current) => ({ ...current, currentRole: event.target.value }))} /></Field>
              <Field label="Current company"><input maxLength={160} className={inputClass} value={form.currentCompany} onChange={(event) => setForm((current) => ({ ...current, currentCompany: event.target.value }))} /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Location"><input maxLength={160} className={inputClass} value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} /></Field>
                <Field label="Source"><input maxLength={120} className={inputClass} value={form.source} onChange={(event) => setForm((current) => ({ ...current, source: event.target.value }))} placeholder="Referral, agency, LinkedIn..." /></Field>
              </div>
              <Field label="Notes"><textarea rows={5} maxLength={2000} className={`${inputClass} h-auto min-h-28 py-3`} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></Field>
              <div className="flex justify-end gap-3 border-t border-black/10 pt-5">
                <button type="button" onClick={() => setFormOpen(false)} className="border border-black/10 px-5 py-3 text-sm font-medium">Cancel</button>
                <button type="submit" disabled={saving} className="inline-flex items-center gap-2 border border-black bg-black px-5 py-3 text-sm font-medium text-white disabled:opacity-50">{saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}Save candidate</button>
              </div>
            </form>
          </aside>
        </div>
      ) : null}
    </DashboardShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm font-medium text-[#111827]">{label}</span>{children}</label>;
}
