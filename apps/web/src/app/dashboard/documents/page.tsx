'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  Eye,
  EyeOff,
  FilePlus2,
  FileText,
  FolderOpen,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Upload,
  Users,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { FeedbackBanner, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';

type EmployeeDocument = {
  id: string;
  employeeId: string;
  category: string;
  title: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  visibleToEmployee: boolean;
  isConfidential: boolean;
  expiryDate?: string | null;
  createdAt: string;
  employee?: {
    id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    email?: string | null;
    jobTitle?: string | null;
    department?: {
      id: string;
      name: string;
    } | null;
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

function formatCategory(category: string) {
  return category
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getEmployeeName(document: EmployeeDocument) {
  if (!document.employee) {
    return 'Unassigned employee';
  }

  return `${document.employee.firstName} ${document.employee.lastName}`;
}

function isExpired(expiryDate?: string | null) {
  if (!expiryDate) {
    return false;
  }

  const expiry = new Date(expiryDate);
  const today = new Date();

  today.setHours(0, 0, 0, 0);

  return expiry < today;
}

function isExpiringSoon(expiryDate?: string | null) {
  if (!expiryDate || isExpired(expiryDate)) {
    return false;
  }

  const expiry = new Date(expiryDate);
  const today = new Date();
  const nextThirtyDays = new Date();

  today.setHours(0, 0, 0, 0);
  nextThirtyDays.setDate(today.getDate() + 30);
  nextThirtyDays.setHours(23, 59, 59, 999);

  return expiry >= today && expiry <= nextThirtyDays;
}

export default function DocumentsDashboardPage() {
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [visibilityFilter, setVisibilityFilter] = useState('ALL');
  const [error, setError] = useState('');

  useEffect(() => {
    loadDocuments();
  }, []);

  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();

    return documents.filter((document) => {
      const matchesCategory =
        categoryFilter === 'ALL' ? true : document.category === categoryFilter;

      const matchesVisibility =
        visibilityFilter === 'ALL'
          ? true
          : visibilityFilter === 'VISIBLE'
            ? document.visibleToEmployee
            : visibilityFilter === 'HIDDEN'
              ? !document.visibleToEmployee
              : visibilityFilter === 'CONFIDENTIAL'
                ? document.isConfidential
                : true;

      const employeeName = getEmployeeName(document).toLowerCase();

      const matchesSearch = !query
        ? true
        : document.title.toLowerCase().includes(query) ||
          document.originalName.toLowerCase().includes(query) ||
          document.category.toLowerCase().includes(query) ||
          employeeName.includes(query) ||
          document.employee?.employeeNumber.toLowerCase().includes(query) ||
          document.employee?.email?.toLowerCase().includes(query) ||
          document.employee?.department?.name.toLowerCase().includes(query);

      return matchesCategory && matchesVisibility && matchesSearch;
    });
  }, [documents, search, categoryFilter, visibilityFilter]);

  const generatedDocuments = documents.filter(
    (document) => document.mimeType === 'text/html',
  );

  const uploadedDocuments = documents.filter(
    (document) => document.mimeType !== 'text/html',
  );

  const confidentialDocuments = documents.filter(
    (document) => document.isConfidential,
  );

  const visibleDocuments = documents.filter(
    (document) => document.visibleToEmployee,
  );

  const expiredDocuments = documents.filter((document) =>
    isExpired(document.expiryDate),
  );

  const expiringSoonDocuments = documents.filter((document) =>
    isExpiringSoon(document.expiryDate),
  );

  const categories = useMemo(() => {
    return Array.from(new Set(documents.map((document) => document.category))).sort();
  }, [documents]);

  async function loadDocuments() {
    setLoading(true);
    setError('');

    try {
      const response = await api.get<EmployeeDocument[]>('/employees/documents');
      setDocuments(response.data);
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ?? 'Could not load documents.';

      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardShell activePage="documents">
      <div className="space-y-8">
        <PageHeader
          category="Documents"
          title="Document register"
          description="Manage uploaded and generated employee records, confidential files and document expiry dates."
          primaryAction={{
            label: "Generate document",
            href: "/dashboard/documents/generated",
            icon: <Sparkles size={16} />,
          }}
          secondaryAction={{
            label: "Template management",
            href: "/dashboard/documents/templates",
            icon: <FileText size={16} />,
          }}
          tools={
            <button
              type="button"
              onClick={loadDocuments}
              className="inline-flex min-h-10 items-center justify-center gap-2 border border-[var(--border-strong)] bg-[var(--surface)] px-4 text-sm font-bold text-[var(--text-soft)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
              title="Refresh document register"
              aria-label="Refresh document register"
            >
              <RefreshCw size={16} />
              Refresh register
            </button>
          }
        />

        {error ? (
          <FeedbackBanner
            tone="error"
            title="Document register unavailable"
            message={`${error} Your filters and existing records have not been changed.`}
            actions={
              <button
                type="button"
                onClick={loadDocuments}
                className="border border-current px-4 py-2 text-sm font-extrabold"
              >
                Try again
              </button>
            }
          />
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="All documents"
            value={String(documents.length)}
            helper="Total employee files"
            icon={<FileText size={18} />}
          />

          <StatCard
            title="Uploaded"
            value={String(uploadedDocuments.length)}
            helper="Manually uploaded files"
            icon={<Upload size={18} />}
          />

          <StatCard
            title="Generated"
            value={String(generatedDocuments.length)}
            helper="System-created HR docs"
            icon={<Sparkles size={18} />}
          />

          <StatCard
            title="Expiry alerts"
            value={String(expiredDocuments.length + expiringSoonDocuments.length)}
            helper={`${expiredDocuments.length} expired, ${expiringSoonDocuments.length} soon`}
            icon={<AlertTriangle size={18} />}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[360px_1fr]">
          <aside className="space-y-6">
            <section className="border border-black/10 bg-[#111827] p-6 text-white">
              <div className="flex h-11 w-11 items-center justify-center border border-white/15 bg-white/10">
                <Archive size={19} />
              </div>

              <h2 className="mt-5 text-lg font-semibold tracking-[-0.03em]">
                Document workflows
              </h2>

              <p className="mt-2 text-sm leading-6 text-white/70">
                Upload existing files or generate new HR documents linked to
                employee profiles.
              </p>

              <div className="mt-6 grid gap-3">
                <Link
                  href="/dashboard/documents/upload"
                  className="inline-flex items-center justify-center gap-2 border border-white bg-white px-4 py-3 text-sm font-medium text-[#111827] transition hover:bg-transparent hover:text-white"
                >
                  <FilePlus2 size={16} />
                  Upload employee document
                </Link>

                <Link
                  href="/dashboard/documents/generated"
                  className="inline-flex items-center justify-center gap-2 border border-white/20 bg-white/10 px-4 py-3 text-sm font-medium text-white transition hover:border-white"
                >
                  <Sparkles size={16} />
                  Generate HR document
                </Link>

                <Link
                  href="/dashboard/employees"
                  className="inline-flex items-center justify-center gap-2 border border-white/20 bg-white/10 px-4 py-3 text-sm font-medium text-white transition hover:border-white"
                >
                  <Users size={16} />
                  Employee profiles
                </Link>
              </div>

              <p className="mt-4 text-xs leading-5 text-white/50">
                To upload a file, open an employee profile, go to their
                Documents tab, and upload the file there.
              </p>
            </section>

            <section className="border border-black/10 bg-white p-6">
              <div className="flex h-11 w-11 items-center justify-center border border-black/10 bg-[#f8fafc] text-gray-500">
                <ShieldAlert size={19} />
              </div>

              <h2 className="mt-5 text-lg font-semibold tracking-[-0.03em]">
                Confidential files
              </h2>

              <p className="mt-2 text-sm leading-6 text-gray-500">
                {confidentialDocuments.length} document
                {confidentialDocuments.length === 1 ? '' : 's'} marked as
                confidential HR records.
              </p>
            </section>

            <section className="border border-black/10 bg-white p-6">
              <div className="flex h-11 w-11 items-center justify-center border border-black/10 bg-[#f8fafc] text-gray-500">
                <Eye size={19} />
              </div>

              <h2 className="mt-5 text-lg font-semibold tracking-[-0.03em]">
                Employee visibility
              </h2>

              <p className="mt-2 text-sm leading-6 text-gray-500">
                {visibleDocuments.length} document
                {visibleDocuments.length === 1 ? '' : 's'} are visible to
                employees in their portal.
              </p>
            </section>
          </aside>

          <section className="border border-black/10 bg-white">
            <div className="grid gap-4 border-b border-black/10 px-6 py-5 xl:grid-cols-[1fr_auto]">
              <div>
                <h2 className="text-lg font-semibold tracking-[-0.03em]">
                  Document register
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  {filteredDocuments.length} document
                  {filteredDocuments.length === 1 ? '' : 's'} shown.
                </p>
              </div>

              <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px]">
                <div className="relative">
                  <Search
                    size={16}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search document or employee..."
                    className="w-full min-w-[240px] border border-black/10 bg-[#f8fafc] py-3 pl-11 pr-4 text-sm outline-none transition focus:border-black"
                  />
                </div>

                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  className="w-full border border-black/10 bg-[#f8fafc] px-4 py-3 text-sm outline-none transition focus:border-black"
                >
                  <option value="ALL">All categories</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {formatCategory(category)}
                    </option>
                  ))}
                </select>

                <select
                  value={visibilityFilter}
                  onChange={(event) => setVisibilityFilter(event.target.value)}
                  className="w-full border border-black/10 bg-[#f8fafc] px-4 py-3 text-sm outline-none transition focus:border-black"
                >
                  <option value="ALL">All visibility</option>
                  <option value="VISIBLE">Visible</option>
                  <option value="HIDDEN">Hidden</option>
                  <option value="CONFIDENTIAL">Confidential</option>
                </select>
              </div>
            </div>

            <div className="p-6">
              {loading ? (
                <div className="flex min-h-[420px] items-center justify-center">
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <Loader2 className="animate-spin" size={18} />
                    Loading documents...
                  </div>
                </div>
              ) : filteredDocuments.length === 0 ? (
                <div className="border border-dashed border-black/15 bg-[#f8fafc] px-5 py-14 text-center">
                  <FolderOpen size={32} className="mx-auto text-gray-300" />

                  <p className="mt-4 text-sm font-medium text-[#111827]">
                    No documents found
                  </p>

                  <p className="mt-1 text-sm text-gray-500">
                    Upload an employee file, generate an HR document or adjust
                    your filters.
                  </p>

                  <Link
                    href="/dashboard/employees"
                    className="mt-5 inline-flex items-center justify-center gap-2 border border-black bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-white hover:text-black"
                  >
                    Choose employee to upload
                    <ArrowRight size={15} />
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredDocuments.map((document) => {
                    const expired = isExpired(document.expiryDate);
                    const expiringSoon = isExpiringSoon(document.expiryDate);

                    return (
                      <article
                        key={document.id}
                        className="border border-black/10 bg-[#f8fafc] p-5"
                      >
                        <div className="grid gap-5 2xl:grid-cols-[1fr_auto]">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center border border-black/10 bg-white text-gray-500">
                                <FileText size={17} />
                              </div>

                              <div>
                                <h3 className="text-sm font-semibold text-[#111827]">
                                  {document.title}
                                </h3>

                                <p className="mt-1 text-xs text-gray-500">
                                  {document.originalName} ·{' '}
                                  {formatFileSize(document.sizeBytes)}
                                </p>
                              </div>

                              <span className="border border-black/10 bg-white px-2 py-1 text-[11px] font-medium text-gray-500">
                                {formatCategory(document.category)}
                              </span>

                              {document.mimeType === 'text/html' ? (
                                <span className="inline-flex items-center gap-1 border border-violet-200 bg-violet-50 px-2 py-1 text-[11px] font-medium text-violet-700">
                                  <Sparkles size={12} />
                                  Generated
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700">
                                  <Upload size={12} />
                                  Uploaded
                                </span>
                              )}

                              {document.visibleToEmployee ? (
                                <span className="inline-flex items-center gap-1 border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">
                                  <Eye size={12} />
                                  Visible
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] font-medium text-gray-500">
                                  <EyeOff size={12} />
                                  Hidden
                                </span>
                              )}

                              {document.isConfidential ? (
                                <span className="inline-flex items-center gap-1 border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700">
                                  <ShieldAlert size={12} />
                                  Confidential
                                </span>
                              ) : null}

                              {expired ? (
                                <span className="border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700">
                                  Expired
                                </span>
                              ) : expiringSoon ? (
                                <span className="border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700">
                                  Expiring soon
                                </span>
                              ) : null}
                            </div>

                            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                              <InfoBlock
                                label="Employee"
                                value={getEmployeeName(document)}
                              />

                              <InfoBlock
                                label="Added"
                                value={formatDate(document.createdAt)}
                              />

                              <InfoBlock
                                label="Expiry"
                                value={formatDate(document.expiryDate)}
                              />
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 2xl:justify-end">
                            {document.employee ? (
                              <Link
                                href={`/dashboard/employees/${document.employee.id}/documents`}
                                className="inline-flex items-center justify-center gap-2 border border-black/10 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition hover:border-black hover:text-black"
                              >
                                <FolderOpen size={15} />
                                Open profile docs
                              </Link>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </section>
      </div>
    </DashboardShell>
  );
}

function StatCard({
  title,
  value,
  helper,
  icon,
}: {
  title: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="border border-black/10 bg-white p-5">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs uppercase tracking-[0.18em] text-gray-400">
          {title}
        </p>

        <div className="text-gray-400">{icon}</div>
      </div>

      <p className="mt-3 text-2xl font-semibold tracking-[-0.05em] text-[#111827]">
        {value}
      </p>

      <p className="mt-1 text-sm text-gray-500">{helper}</p>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border border-black/10 bg-white p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-gray-400">
        {label}
      </p>

      <p className="mt-2 break-words text-sm font-medium leading-6 text-[#111827]">
        {value}
      </p>
    </div>
  );
}
