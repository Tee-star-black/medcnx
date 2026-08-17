'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Download,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  Upload,
  UserRound,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { api } from '@/lib/api';

type Employee = {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  jobTitle?: string | null;
  employmentStatus: string;
  department?: {
    id: string;
    name: string;
  } | null;
};

type EmployeeDocument = {
  id: string;
  employeeId: string;
  category: string;
  title: string;
  originalName: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  visibleToEmployee: boolean;
  isConfidential: boolean;
  expiryDate?: string | null;
  createdAt: string;
  updatedAt: string;
};

const documentCategories = [
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'ID_DOCUMENT', label: 'ID document' },
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'CERTIFICATE', label: 'Certificate' },
  { value: 'MEDICAL', label: 'Medical' },
  { value: 'TRAINING', label: 'Training' },
  { value: 'POLICY', label: 'Policy' },
  { value: 'DISCIPLINARY', label: 'Disciplinary' },
  { value: 'PAYSLIP', label: 'Payslip' },
  { value: 'OTHER', label: 'Other' },
];

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

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatCategory(category: string) {
  return category
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
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

export default function EmployeeDocumentsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const employeeId = params.id;

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('CONTRACT');
  const [expiryDate, setExpiryDate] = useState('');
  const [visibleToEmployee, setVisibleToEmployee] = useState(true);
  const [isConfidentialDocument, setIsConfidentialDocument] = useState(false);
  const [documentFile, setDocumentFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [downloadingDocumentId, setDownloadingDocumentId] = useState<
    string | null
  >(null);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadPageData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();

    return documents.filter((document) => {
      const matchesCategory =
        categoryFilter === 'ALL' ? true : document.category === categoryFilter;

      const matchesSearch = !query
        ? true
        : document.title.toLowerCase().includes(query) ||
          document.originalName.toLowerCase().includes(query) ||
          document.category.toLowerCase().includes(query) ||
          document.mimeType.toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [documents, search, categoryFilter]);

  const visibleCount = documents.filter(
    (document) => document.visibleToEmployee,
  ).length;

  const confidentialCount = documents.filter(
    (document) => document.isConfidential,
  ).length;

  const expiredCount = documents.filter((document) =>
    isExpired(document.expiryDate),
  ).length;

  const expiringSoonCount = documents.filter((document) =>
    isExpiringSoon(document.expiryDate),
  ).length;

  async function loadPageData() {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const [employeeResponse, documentsResponse] = await Promise.all([
        api.get<Employee>(`/employees/${employeeId}`),
        api.get<EmployeeDocument[]>(`/employees/${employeeId}/documents`),
      ]);

      setEmployee(employeeResponse.data);
      setDocuments(documentsResponse.data);
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ??
        'Could not load employee documents.';

      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally {
      setLoading(false);
    }
  }

  async function uploadDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError('');
    setSuccess('');

    if (!documentFile) {
      setError('Please choose a document to upload.');
      return;
    }

    if (!title.trim()) {
      setError('Please enter a document title.');
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();

      formData.append('title', title.trim());
      formData.append('category', category);
      formData.append('visibleToEmployee', String(visibleToEmployee));
      formData.append('isConfidential', String(isConfidentialDocument));

      if (expiryDate) {
        formData.append('expiryDate', expiryDate);
      }

      formData.append('document', documentFile);

      await api.post(`/employees/${employeeId}/documents`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setSuccess('Document uploaded successfully.');
      setTitle('');
      setCategory('CONTRACT');
      setExpiryDate('');
      setVisibleToEmployee(true);
      setIsConfidentialDocument(false);
      setDocumentFile(null);

      await loadPageData();
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ?? 'Could not upload document.';

      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally {
      setUploading(false);
    }
  }

  async function downloadDocument(document: EmployeeDocument) {
    setError('');
    setSuccess('');
    setDownloadingDocumentId(document.id);

    try {
      const response = await api.get(
        `/employees/documents/${document.id}/download`,
        {
          responseType: 'blob',
        },
      );

      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));

      const link = window.document.createElement('a');
      link.href = blobUrl;
      link.download = document.originalName;
      window.document.body.appendChild(link);
      link.click();

      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ?? 'Could not download document.';

      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally {
      setDownloadingDocumentId(null);
    }
  }

  async function updateDocumentVisibility(
    document: EmployeeDocument,
    visible: boolean,
  ) {
    setError('');
    setSuccess('');
    setActionId(document.id);

    try {
      await api.patch(`/employees/documents/${document.id}`, {
        visibleToEmployee: visible,
      });

      setSuccess(
        visible
          ? 'Document is now visible to the employee.'
          : 'Document is now hidden from the employee.',
      );

      await loadPageData();
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ??
        'Could not update document visibility.';

      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally {
      setActionId(null);
    }
  }

  async function updateDocumentConfidentiality(
    document: EmployeeDocument,
    confidential: boolean,
  ) {
    setError('');
    setSuccess('');
    setActionId(document.id);

    try {
      await api.patch(`/employees/documents/${document.id}`, {
        isConfidential: confidential,
      });

      setSuccess(
        confidential
          ? 'Document marked as confidential.'
          : 'Document confidentiality removed.',
      );

      await loadPageData();
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ??
        'Could not update confidentiality.';

      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally {
      setActionId(null);
    }
  }

  async function deleteDocument(document: EmployeeDocument) {
    const confirmed = window.confirm(
      `Delete "${document.title}"?\n\nThis will remove the document record from MedCNX.`,
    );

    if (!confirmed) {
      return;
    }

    setError('');
    setSuccess('');
    setActionId(document.id);

    try {
      await api.delete(`/employees/documents/${document.id}`);

      setSuccess('Document deleted successfully.');
      await loadPageData();
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ?? 'Could not delete document.';

      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally {
      setActionId(null);
    }
  }

  if (loading) {
    return (
      <DashboardShell activePage="employees">
        <div className="flex min-h-[520px] items-center justify-center border border-black/10 bg-white">
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <Loader2 className="animate-spin" size={18} />
            Loading employee documents...
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (!employee) {
    return (
      <DashboardShell activePage="employees">
        <div className="border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error || 'Employee not found.'}
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell activePage="employees">
      <div className="space-y-8">
        <section className="flex flex-col gap-5 border-b border-black/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <button
              type="button"
              onClick={() => router.push(`/dashboard/employees/${employee.id}`)}
              className="mb-5 inline-flex items-center gap-2 text-sm text-gray-500 transition hover:text-black"
            >
              <ArrowLeft size={15} />
              Back to profile
            </button>

            <p className="mb-2 text-sm uppercase tracking-[0.25em] text-gray-400">
              Employee documents
            </p>

            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#111827]">
              {employee.firstName} {employee.lastName}
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              Manage contracts, ID documents, certificates, medical documents,
              policies, payslips and other employee files.
            </p>
          </div>

          <button
            type="button"
            onClick={loadPageData}
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

        {success ? (
          <div className="border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-4">
          <StatCard
            title="Documents"
            value={String(documents.length)}
            helper="All files"
          />

          <StatCard
            title="Visible"
            value={String(visibleCount)}
            helper="Employee can view"
          />

          <StatCard
            title="Confidential"
            value={String(confidentialCount)}
            helper="Restricted HR files"
          />

          <StatCard
            title="Expiry alerts"
            value={String(expiredCount + expiringSoonCount)}
            helper={`${expiredCount} expired, ${expiringSoonCount} soon`}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[420px_1fr]">
          <form
            onSubmit={uploadDocument}
            className="border border-black/10 bg-white"
          >
            <div className="border-b border-black/10 px-6 py-5">
              <h2 className="text-lg font-semibold tracking-[-0.03em]">
                Upload document
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Add a new document to this employee profile.
              </p>
            </div>

            <div className="space-y-5 p-6">
              <label className="block">
                <span className="mb-2 block text-sm font-medium">
                  Document title <span className="text-red-500">*</span>
                </span>

                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Employment contract"
                  className="w-full border border-black/10 bg-[#f8fafc] px-4 py-3 text-sm outline-none transition focus:border-black"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium">
                  Category
                </span>

                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="w-full border border-black/10 bg-[#f8fafc] px-4 py-3 text-sm outline-none transition focus:border-black"
                >
                  {documentCategories.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium">
                  Expiry date
                </span>

                <input
                  type="date"
                  value={expiryDate}
                  onChange={(event) => setExpiryDate(event.target.value)}
                  className="w-full border border-black/10 bg-[#f8fafc] px-4 py-3 text-sm outline-none transition focus:border-black"
                />
              </label>

              <div className="space-y-3">
                <label className="flex items-start gap-3 border border-black/10 bg-[#f8fafc] p-4">
                  <input
                    type="checkbox"
                    checked={visibleToEmployee}
                    onChange={(event) =>
                      setVisibleToEmployee(event.target.checked)
                    }
                    className="mt-1 h-4 w-4"
                  />

                  <span>
                    <span className="block text-sm font-medium text-[#111827]">
                      Visible to employee
                    </span>

                    <span className="mt-1 block text-sm leading-6 text-gray-500">
                      Employee can view this document in their portal.
                    </span>
                  </span>
                </label>

                <label className="flex items-start gap-3 border border-black/10 bg-[#f8fafc] p-4">
                  <input
                    type="checkbox"
                    checked={isConfidentialDocument}
                    onChange={(event) =>
                      setIsConfidentialDocument(event.target.checked)
                    }
                    className="mt-1 h-4 w-4"
                  />

                  <span>
                    <span className="block text-sm font-medium text-[#111827]">
                      Confidential HR document
                    </span>

                    <span className="mt-1 block text-sm leading-6 text-gray-500">
                      Mark this as sensitive HR information.
                    </span>
                  </span>
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium">
                  File <span className="text-red-500">*</span>
                </span>

                <input
                  type="file"
                  onChange={(event) =>
                    setDocumentFile(event.target.files?.[0] ?? null)
                  }
                  className="w-full border border-dashed border-black/15 bg-[#f8fafc] px-4 py-4 text-sm outline-none transition file:mr-4 file:border-0 file:bg-black file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
                />
              </label>

              {documentFile ? (
                <div className="border border-black/10 bg-[#f8fafc] px-4 py-3 text-sm text-gray-500">
                  Selected file: {documentFile.name}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={uploading}
                className="inline-flex w-full items-center justify-center gap-2 border border-black bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                {uploading ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    Upload document
                  </>
                )}
              </button>
            </div>
          </form>

          <section className="border border-black/10 bg-white">
            <div className="grid gap-4 border-b border-black/10 px-6 py-5 xl:grid-cols-[1fr_auto]">
              <div>
                <h2 className="text-lg font-semibold tracking-[-0.03em]">
                  Employee files
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  {filteredDocuments.length} document
                  {filteredDocuments.length === 1 ? '' : 's'} shown.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-[1fr_180px]">
                <div className="relative">
                  <Search
                    size={16}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search documents..."
                    className="w-full min-w-[240px] border border-black/10 bg-[#f8fafc] py-3 pl-11 pr-4 text-sm outline-none transition focus:border-black"
                  />
                </div>

                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  className="w-full border border-black/10 bg-[#f8fafc] px-4 py-3 text-sm outline-none transition focus:border-black"
                >
                  <option value="ALL">All categories</option>
                  {documentCategories.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-6">
              {filteredDocuments.length === 0 ? (
                <div className="border border-dashed border-black/15 bg-[#f8fafc] px-5 py-14 text-center">
                  <FileText size={32} className="mx-auto text-gray-300" />

                  <p className="mt-4 text-sm font-medium text-[#111827]">
                    No documents found
                  </p>

                  <p className="mt-1 text-sm text-gray-500">
                    Upload a document or adjust your filters.
                  </p>
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
                          <div className="min-w-0 flex-1">
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

                                <div className="mt-4 grid gap-3 text-sm text-gray-500 sm:grid-cols-2 xl:grid-cols-3">
                                <InfoBlock
                                    label="Uploaded"
                                    value={formatDate(document.createdAt)}
                                />

                                <InfoBlock
                                    label="Expiry"
                                    value={formatDate(document.expiryDate)}
                                />

                                <InfoBlock
                                    label="Type"
                                    value={document.mimeType}
                                    wide
                                />
                                </div>
                          </div>

                         <div className="flex shrink-0 flex-wrap gap-2 xl:justify-end">
                            <button
                              type="button"
                              onClick={() => downloadDocument(document)}
                              disabled={downloadingDocumentId === document.id}
                              className="inline-flex items-center justify-center gap-2 border border-black/10 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition hover:border-black hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {downloadingDocumentId === document.id ? (
                                <Loader2 className="animate-spin" size={15} />
                              ) : (
                                <Download size={15} />
                              )}
                              Download
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                updateDocumentVisibility(
                                  document,
                                  !document.visibleToEmployee,
                                )
                              }
                              disabled={actionId === document.id}
                              className="inline-flex items-center justify-center gap-2 border border-black/10 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition hover:border-black hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {document.visibleToEmployee ? (
                                <EyeOff size={15} />
                              ) : (
                                <Eye size={15} />
                              )}
                              {document.visibleToEmployee ? 'Hide' : 'Show'}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                updateDocumentConfidentiality(
                                  document,
                                  !document.isConfidential,
                                )
                              }
                              disabled={actionId === document.id}
                              className="inline-flex items-center justify-center gap-2 border border-black/10 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition hover:border-black hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <ShieldAlert size={15} />
                              {document.isConfidential
                                ? 'Unmark'
                                : 'Confidential'}
                            </button>

                            <button
                              type="button"
                              onClick={() => deleteDocument(document)}
                              disabled={actionId === document.id}
                              className="inline-flex items-center justify-center gap-2 border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition hover:border-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {actionId === document.id ? (
                                <Loader2 className="animate-spin" size={15} />
                              ) : (
                                <Trash2 size={15} />
                              )}
                              Delete
                            </button>
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
}: {
  title: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="border border-black/10 bg-white p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-gray-400">
        {title}
      </p>

      <p className="mt-3 text-2xl font-semibold tracking-[-0.05em] text-[#111827]">
        {value}
      </p>

      <p className="mt-1 text-sm text-gray-500">{helper}</p>
    </div>
  );
}

function InfoBlock({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div
      className={`min-w-0 border border-black/10 bg-white p-4 ${
        wide ? 'sm:col-span-2 xl:col-span-1' : ''
      }`}
    >
      <p className="text-xs uppercase tracking-[0.16em] text-gray-400">
        {label}
      </p>

      <p className="mt-2 break-words text-sm font-medium leading-6 text-[#111827]">
        {value}
      </p>
    </div>
  );
}