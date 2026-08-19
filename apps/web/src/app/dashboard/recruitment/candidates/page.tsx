'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { AxiosError } from 'axios';
import Link from 'next/link';
import { CheckCircle2, Loader2, Plus, Search, Users } from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { EmptyState } from '@/components/ui/EmptyState';
import { FeedbackBanner } from '@/components/ui/FeedbackBanner';
import { FormField } from '@/components/ui/FormField';
import { PageHeader } from '@/components/ui/PageHeader';
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

const inputClass =
  'h-11 w-full border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] outline-none transition focus:border-[var(--accent)]';

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
      [
        candidate.firstName,
        candidate.lastName,
        candidate.email,
        candidate.currentCompany,
        candidate.currentRole,
        candidate.location,
      ]
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

  function closeForm() {
    if (saving) return;
    setFormOpen(false);
  }

  return (
    <DashboardShell activePage="recruitment">
      <div className="space-y-6">
        <PageHeader
          category="Recruitment operations"
          title="Candidates"
          description="Maintain the organisation candidate pool independently from individual job applications, while keeping each candidate ready for pipeline assignment."
          primaryAction={{
            label: 'Add candidate',
            onClick: () => setFormOpen(true),
            icon: <Plus size={16} />,
          }}
          secondaryAction={{
            label: 'Applications',
            href: '/dashboard/recruitment/applications',
          }}
        />

        {error ? (
          <FeedbackBanner tone="error" title="Candidate operation failed" message={error} />
        ) : null}
        {success ? (
          <FeedbackBanner tone="success" title="Candidate saved" message={success} />
        ) : null}

        <section className="border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-xs)]">
          <div className="flex flex-col gap-4 border-b border-[var(--border)] px-5 py-5 sm:px-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[var(--accent)]">
                Talent pool
              </p>
              <h2 className="mt-2 text-xl font-black tracking-[-0.035em] text-[var(--text)]">
                Candidate records
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {candidates.length} candidate{candidates.length === 1 ? '' : 's'} currently available for recruitment workflows.
              </p>
            </div>

            <label className="flex min-h-11 w-full items-center gap-2 border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 focus-within:border-[var(--accent)] md:w-96">
              <Search size={16} className="shrink-0 text-[var(--muted)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search candidates"
                className="min-w-0 flex-1 bg-transparent text-sm font-medium text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
              />
            </label>
          </div>

          {loading ? (
            <div className="flex min-h-72 items-center justify-center gap-3 text-sm font-medium text-[var(--muted)]">
              <Loader2 size={18} className="animate-spin text-[var(--accent)]" />
              Loading candidates...
            </div>
          ) : !filtered.length ? (
            <div className="p-5 sm:p-6">
              <EmptyState
                icon={<Users size={22} />}
                title={query ? 'No matching candidates' : 'No candidates yet'}
                description={
                  query
                    ? 'No candidate records match the current search. Clear or adjust the search terms.'
                    : 'Add the first candidate to begin building the organisation recruitment pool.'
                }
                action={
                  query ? (
                    <Button variant="secondary" onClick={() => setQuery('')}>
                      Clear search
                    </Button>
                  ) : (
                    <Button variant="primary" icon={<Plus size={15} />} onClick={() => setFormOpen(true)}>
                      Add candidate
                    </Button>
                  )
                }
              />
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {filtered.map((candidate) => (
                <article
                  key={candidate.id}
                  className="grid gap-5 px-5 py-5 transition hover:bg-[var(--surface-soft)] sm:px-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(220px,0.8fr)_auto] lg:items-center"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center border border-[var(--accent)] bg-[var(--accent)] text-xs font-black text-[var(--accent-text)]">
                      {candidate.firstName.charAt(0)}
                      {candidate.lastName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-black text-[var(--text)]">
                        {candidate.firstName} {candidate.lastName}
                      </h3>
                      <p className="mt-1 text-sm font-medium text-[var(--muted)]">
                        {candidate.currentRole || 'Role not supplied'}
                        {candidate.currentCompany ? ` · ${candidate.currentCompany}` : ''}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {candidate.email || candidate.phone || 'No contact details'}
                        {candidate.location ? ` · ${candidate.location}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                    <CandidateMeta label="Source" value={candidate.source || 'Not specified'} />
                    <CandidateMeta label="Applications" value={String(candidate.applicationCount)} />
                  </div>

                  <Link
                    href={`/dashboard/recruitment/applications?candidateId=${candidate.id}`}
                    className="inline-flex min-h-10 items-center justify-center border border-[var(--border-strong)] bg-[var(--surface)] px-4 text-sm font-extrabold text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  >
                    View applications
                  </Link>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <Drawer
        open={formOpen}
        title="Add candidate"
        description="Create a reusable candidate record for one or more recruitment applications."
        onClose={closeForm}
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={closeForm} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="candidate-form"
              variant="primary"
              loading={saving}
              icon={<CheckCircle2 size={16} />}
            >
              Save candidate
            </Button>
          </div>
        }
      >
        <form id="candidate-form" onSubmit={createCandidate} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="First name" htmlFor="candidate-first-name" required>
              <input
                id="candidate-first-name"
                required
                maxLength={120}
                className={inputClass}
                value={form.firstName}
                onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
              />
            </FormField>
            <FormField label="Last name" htmlFor="candidate-last-name" required>
              <input
                id="candidate-last-name"
                required
                maxLength={120}
                className={inputClass}
                value={form.lastName}
                onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
              />
            </FormField>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="Email" htmlFor="candidate-email" optional>
              <input
                id="candidate-email"
                type="email"
                maxLength={160}
                className={inputClass}
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              />
            </FormField>
            <FormField label="Phone" htmlFor="candidate-phone" optional>
              <input
                id="candidate-phone"
                maxLength={80}
                className={inputClass}
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              />
            </FormField>
          </div>

          <FormField label="Current role" htmlFor="candidate-role" optional>
            <input
              id="candidate-role"
              maxLength={160}
              className={inputClass}
              value={form.currentRole}
              onChange={(event) => setForm((current) => ({ ...current, currentRole: event.target.value }))}
            />
          </FormField>

          <FormField label="Current company" htmlFor="candidate-company" optional>
            <input
              id="candidate-company"
              maxLength={160}
              className={inputClass}
              value={form.currentCompany}
              onChange={(event) => setForm((current) => ({ ...current, currentCompany: event.target.value }))}
            />
          </FormField>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="Location" htmlFor="candidate-location" optional>
              <input
                id="candidate-location"
                maxLength={160}
                className={inputClass}
                value={form.location}
                onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
              />
            </FormField>
            <FormField
              label="Source"
              htmlFor="candidate-source"
              optional
              hint="Referral, agency, LinkedIn, careers site, etc."
            >
              <input
                id="candidate-source"
                maxLength={120}
                className={inputClass}
                value={form.source}
                onChange={(event) => setForm((current) => ({ ...current, source: event.target.value }))}
              />
            </FormField>
          </div>

          <FormField label="Notes" htmlFor="candidate-notes" optional>
            <textarea
              id="candidate-notes"
              rows={5}
              maxLength={2000}
              className="w-full border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-3 text-sm text-[var(--text)] outline-none transition focus:border-[var(--accent)]"
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            />
          </FormField>
        </form>
      </Drawer>
    </DashboardShell>
  );
}

function CandidateMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold text-[var(--text)]">{value}</p>
    </div>
  );
}
