'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Download,
  Loader2,
  ReceiptText,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { EmployeeShell } from '@/components/employee/EmployeeShell';
import { api } from '@/lib/api';

type EmployeeDocument = {
  id: string;
  category: string;
  title: string;
  description?: string | null;
  fileName: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  isConfidential: boolean;
  visibleToEmployee: boolean;
  expiryDate?: string | null;
  createdAt: string;
  updatedAt: string;
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

function formatMonthYear(value?: string | null) {
  if (!value) {
    return 'No period set';
  }

  return new Intl.DateTimeFormat('en-ZA', {
    year: 'numeric',
    month: 'long',
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

export default function EmployeePayslipsPage() {
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadPayslips();
  }, []);

  const payslips = useMemo(() => {
    return documents
      .filter((document) => document.category === 'PAYSLIP')
      .sort((a, b) => {
        const dateA = new Date(a.expiryDate ?? a.createdAt).getTime();
        const dateB = new Date(b.expiryDate ?? b.createdAt).getTime();

        return dateB - dateA;
      });
  }, [documents]);

  const filteredPayslips = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return payslips;
    }

    return payslips.filter((payslip) => {
      return (
        payslip.title.toLowerCase().includes(query) ||
        payslip.originalName.toLowerCase().includes(query) ||
        payslip.description?.toLowerCase().includes(query) ||
        formatMonthYear(payslip.expiryDate).toLowerCase().includes(query)
      );
    });
  }, [payslips, search]);

  const latestPayslip = payslips[0];

  async function loadPayslips() {
    setLoading(true);
    setError('');

    try {
      const response = await api.get<EmployeeDocument[]>(
        '/employees/me/documents',
      );

      setDocuments(response.data);
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ??
        'Could not load your payslips.';

      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally {
      setLoading(false);
    }
  }

  async function downloadPayslip(payslip: EmployeeDocument) {
    setError('');
    setDownloadingId(payslip.id);

    try {
      const response = await api.get(
        `/employees/documents/${payslip.id}/download`,
        {
          responseType: 'blob',
        },
      );

      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));

      const link = window.document.createElement('a');
      link.href = blobUrl;
      link.download = payslip.originalName;
      window.document.body.appendChild(link);
      link.click();

      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ??
        'Could not download payslip. Please try again.';

      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <EmployeeShell>
      <div className="space-y-8">
        <section className="flex flex-col gap-5 border-b border-black/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-sm uppercase tracking-[0.25em] text-gray-400">
              Payroll documents
            </p>

            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#111827]">
              My payslips
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              View and download payslips shared with you by HR.
            </p>
          </div>

          <button
            type="button"
            onClick={loadPayslips}
            className="border border-black bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-white hover:text-black"
          >
            Refresh payslips
          </button>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <StatCard title="Available payslips" value={String(payslips.length)} />

          <StatCard
            title="Latest period"
            value={
              latestPayslip
                ? formatMonthYear(latestPayslip.expiryDate)
                : 'None'
            }
          />

          <StatCard
            title="Last uploaded"
            value={latestPayslip ? formatDate(latestPayslip.createdAt) : 'None'}
          />
        </section>

        <section className="border border-black/10 bg-white">
          <div className="grid gap-4 border-b border-black/10 px-6 py-5 lg:grid-cols-[1fr_auto]">
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search payslips by title, month, file name..."
                className="w-full border border-black/10 bg-[#f8fafc] py-3 pl-11 pr-4 text-sm text-[#111827] outline-none transition focus:border-black"
              />
            </div>

            <div className="flex items-center gap-2 border border-black/10 bg-[#f8fafc] px-4 py-3 text-sm text-gray-500">
              <Calendar size={16} />
              Payroll archive
            </div>
          </div>

          {error ? (
            <div className="mx-6 mt-5 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="p-6">
            {loading ? (
              <div className="flex min-h-[280px] items-center justify-center">
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <Loader2 className="animate-spin" size={18} />
                  Loading payslips...
                </div>
              </div>
            ) : filteredPayslips.length === 0 ? (
              <div className="border border-dashed border-black/15 bg-[#f8fafc] px-5 py-14 text-center">
                <ShieldCheck size={32} className="mx-auto text-gray-300" />

                <p className="mt-4 text-sm font-medium text-[#111827]">
                  {payslips.length === 0
                    ? 'No payslips shared yet'
                    : 'No matching payslips found'}
                </p>

                <p className="mt-1 text-sm text-gray-500">
                  {payslips.length === 0
                    ? 'Payslips uploaded by HR will appear here.'
                    : 'Try changing the search term.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPayslips.map((payslip) => (
                  <article
                    key={payslip.id}
                    className="border border-black/10 bg-[#f8fafc] p-5"
                  >
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center border border-black/10 bg-white text-gray-500">
                            <ReceiptText size={17} />
                          </div>

                          <div>
                            <h2 className="text-sm font-semibold text-[#111827]">
                              {payslip.title}
                            </h2>

                            <p className="mt-1 text-xs text-gray-500">
                              {payslip.originalName}
                            </p>
                          </div>

                          <span className="border border-black/10 bg-white px-2 py-1 text-[11px] font-medium text-gray-500">
                            {formatMonthYear(payslip.expiryDate)}
                          </span>
                        </div>

                        {payslip.description ? (
                          <p className="mt-4 max-w-4xl text-sm leading-6 text-gray-500">
                            {payslip.description}
                          </p>
                        ) : null}

                        <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-400">
                          <span>{formatFileSize(payslip.sizeBytes)}</span>
                          <span>Uploaded {formatDate(payslip.createdAt)}</span>
                          <span>Visible to employee</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => downloadPayslip(payslip)}
                        disabled={downloadingId === payslip.id}
                        className="inline-flex shrink-0 items-center justify-center gap-2 border border-black bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {downloadingId === payslip.id ? (
                          <>
                            <Loader2 className="animate-spin" size={15} />
                            Downloading
                          </>
                        ) : (
                          <>
                            <Download size={15} />
                            Download
                          </>
                        )}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </EmployeeShell>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="border border-black/10 bg-white p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-gray-400">
        {title}
      </p>

      <p className="mt-3 text-2xl font-semibold tracking-[-0.05em] text-[#111827]">
        {value}
      </p>
    </div>
  );
}