'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Download,
  Eye,
  EyeOff,
  Loader2,
  ReceiptText,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { api } from '@/lib/api';

type Employee = {
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
};

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
  employee: Employee;
};

const months = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

function currentYear() {
  return String(new Date().getFullYear());
}

function currentMonth() {
  return String(new Date().getMonth() + 1).padStart(2, '0');
}

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

function buildPayslipTitle(
  employee: Employee | undefined,
  month: string,
  year: string,
) {
  const monthLabel = months.find((item) => item.value === month)?.label ?? month;

  const employeeName = employee
    ? `${employee.firstName} ${employee.lastName}`
    : 'Employee';

  return `${employeeName} Payslip - ${monthLabel} ${year}`;
}

function buildPeriodDate(month: string, year: string) {
  return `${year}-${month}-01`;
}

export default function DashboardPayslipsPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);

  const [employeeId, setEmployeeId] = useState('');
  const [month, setMonth] = useState(currentMonth());
  const [year, setYear] = useState(currentYear());
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [visibilityActionId, setVisibilityActionId] = useState<string | null>(
    null,
  );
  const [deleteActionId, setDeleteActionId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadPageData();
  }, []);

  const selectedEmployee = useMemo(() => {
    return employees.find((employee) => employee.id === employeeId);
  }, [employees, employeeId]);

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
      const employeeName =
        `${payslip.employee.firstName} ${payslip.employee.lastName}`.toLowerCase();

      return (
        payslip.title.toLowerCase().includes(query) ||
        payslip.originalName.toLowerCase().includes(query) ||
        employeeName.includes(query) ||
        payslip.employee.employeeNumber.toLowerCase().includes(query) ||
        payslip.employee.email?.toLowerCase().includes(query) ||
        formatMonthYear(payslip.expiryDate).toLowerCase().includes(query)
      );
    });
  }, [payslips, search]);

  async function loadPageData() {
    setLoading(true);
    setError('');

    try {
      const [employeesResponse, documentsResponse] = await Promise.all([
        api.get<Employee[]>('/employees'),
        api.get<EmployeeDocument[]>('/employees/documents'),
      ]);

      setEmployees(employeesResponse.data);
      setDocuments(documentsResponse.data);

      if (!employeeId && employeesResponse.data.length > 0) {
        setEmployeeId(employeesResponse.data[0].id);
      }
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ??
        'Could not load payslip data.';

      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally {
      setLoading(false);
    }
  }

  async function uploadPayslip(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError('');
    setSuccess('');

    if (!employeeId) {
      setError('Please select an employee.');
      return;
    }

    if (!file) {
      setError('Please select a payslip file.');
      return;
    }

    const employee = employees.find((item) => item.id === employeeId);

    if (!employee) {
      setError('Selected employee could not be found.');
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();

      formData.append('title', buildPayslipTitle(employee, month, year));
      formData.append('description', description.trim());
      formData.append('category', 'PAYSLIP');
      formData.append('visibleToEmployee', 'true');
      formData.append('isConfidential', 'true');
      formData.append('expiryDate', buildPeriodDate(month, year));
      formData.append('document', file);

      await api.post(`/employees/${employeeId}/documents`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setSuccess('Payslip uploaded successfully.');
      setDescription('');
      setFile(null);

      const fileInput = window.document.getElementById(
        'payslip-file-input',
      ) as HTMLInputElement | null;

      if (fileInput) {
        fileInput.value = '';
      }

      await loadPageData();
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ?? 'Could not upload payslip.';

      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally {
      setUploading(false);
    }
  }

  async function downloadPayslip(payslip: EmployeeDocument) {
    setError('');
    setSuccess('');
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
        requestError?.response?.data?.message ?? 'Could not download payslip.';

      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally {
      setDownloadingId(null);
    }
  }

  async function togglePayslipVisibility(payslip: EmployeeDocument) {
    setError('');
    setSuccess('');
    setVisibilityActionId(payslip.id);

    try {
      await api.patch(`/employees/documents/${payslip.id}`, {
        visibleToEmployee: !payslip.visibleToEmployee,
      });

      setSuccess(
        payslip.visibleToEmployee
          ? 'Payslip hidden from employee.'
          : 'Payslip is now visible to employee.',
      );

      await loadPageData();
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ??
        'Could not update payslip visibility.';

      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally {
      setVisibilityActionId(null);
    }
  }

  async function deletePayslip(payslip: EmployeeDocument) {
    const confirmed = window.confirm(
      `Delete this payslip?\n\n${payslip.title}\n\nThis action cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setError('');
    setSuccess('');
    setDeleteActionId(payslip.id);

    try {
      await api.delete(`/employees/documents/${payslip.id}`);

      setSuccess('Payslip deleted successfully.');
      await loadPageData();
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ?? 'Could not delete payslip.';

      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally {
      setDeleteActionId(null);
    }
  }

  return (
    <DashboardShell activePage="payslips">
      <div className="space-y-8">
        <section className="flex flex-col gap-5 border-b border-black/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-sm uppercase tracking-[0.25em] text-gray-400">
              Payroll documents
            </p>

            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#111827]">
              Payslip management
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              Upload employee payslips, control employee visibility and remove
              incorrect uploads.
            </p>
          </div>

          <button
            type="button"
            onClick={loadPageData}
            className="border border-black bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-white hover:text-black"
          >
            Refresh payslips
          </button>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <StatCard title="Total payslips" value={String(payslips.length)} />

          <StatCard
            title="Visible"
            value={String(
              payslips.filter((payslip) => payslip.visibleToEmployee).length,
            )}
          />

          <StatCard
            title="Hidden"
            value={String(
              payslips.filter((payslip) => !payslip.visibleToEmployee).length,
            )}
          />

          <StatCard
            title="Employees"
            value={String(
              new Set(payslips.map((payslip) => payslip.employee.id)).size,
            )}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[420px_1fr]">
          <form
            onSubmit={uploadPayslip}
            className="border border-black/10 bg-white"
          >
            <div className="flex items-start justify-between gap-5 border-b border-black/10 px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold tracking-[-0.03em]">
                  Upload payslip
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Select an employee, payroll period and payslip file.
                </p>
              </div>

              <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-black/10 bg-[#111827] text-white">
                <ReceiptText size={18} />
              </div>
            </div>

            <div className="space-y-5 p-6">
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

              <label className="block">
                <span className="mb-2 block text-sm font-medium">
                  Employee
                </span>

                <select
                  value={employeeId}
                  onChange={(event) => setEmployeeId(event.target.value)}
                  className="w-full border border-black/10 bg-[#f8fafc] px-4 py-3 text-sm outline-none transition focus:border-black"
                >
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.firstName} {employee.lastName} ·{' '}
                      {employee.employeeNumber}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium">
                    Month
                  </span>

                  <select
                    value={month}
                    onChange={(event) => setMonth(event.target.value)}
                    className="w-full border border-black/10 bg-[#f8fafc] px-4 py-3 text-sm outline-none transition focus:border-black"
                  >
                    {months.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium">
                    Year
                  </span>

                  <input
                    value={year}
                    onChange={(event) => setYear(event.target.value)}
                    className="w-full border border-black/10 bg-[#f8fafc] px-4 py-3 text-sm outline-none transition focus:border-black"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium">
                  Payslip file
                </span>

                <input
                  id="payslip-file-input"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(event) =>
                    setFile(event.target.files?.[0] ?? null)
                  }
                  className="w-full border border-dashed border-black/15 bg-[#f8fafc] px-4 py-4 text-sm outline-none transition file:mr-4 file:border-0 file:bg-black file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
                />

                <p className="mt-2 text-xs text-gray-500">
                  PDF is recommended. The payslip is uploaded as confidential
                  and visible to the selected employee by default.
                </p>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium">Notes</span>

                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={4}
                  placeholder="Optional payroll note..."
                  className="w-full resize-none border border-black/10 bg-[#f8fafc] px-4 py-3 text-sm outline-none transition focus:border-black"
                />
              </label>

              <div className="border border-black/10 bg-[#f8fafc] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-gray-400">
                  Payslip title
                </p>

                <p className="mt-2 text-sm font-medium text-[#111827]">
                  {buildPayslipTitle(selectedEmployee, month, year)}
                </p>
              </div>

              <button
                type="submit"
                disabled={uploading || loading}
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
                    Upload payslip
                  </>
                )}
              </button>
            </div>
          </form>

          <section className="border border-black/10 bg-white">
            <div className="grid gap-4 border-b border-black/10 px-6 py-5 lg:grid-cols-[1fr_auto]">
              <div>
                <h2 className="text-lg font-semibold tracking-[-0.03em]">
                  Uploaded payslips
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  {payslips.length} payslip
                  {payslips.length === 1 ? '' : 's'} available.
                </p>
              </div>

              <div className="relative">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search payslips..."
                  className="w-full min-w-[280px] border border-black/10 bg-[#f8fafc] py-3 pl-11 pr-4 text-sm text-[#111827] outline-none transition focus:border-black"
                />
              </div>
            </div>

            <div className="p-6">
              {loading ? (
                <div className="flex min-h-[360px] items-center justify-center">
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <Loader2 className="animate-spin" size={18} />
                    Loading payslips...
                  </div>
                </div>
              ) : filteredPayslips.length === 0 ? (
                <div className="border border-dashed border-black/15 bg-[#f8fafc] px-5 py-14 text-center">
                  <ReceiptText size={32} className="mx-auto text-gray-300" />

                  <p className="mt-4 text-sm font-medium text-[#111827]">
                    {payslips.length === 0
                      ? 'No payslips uploaded yet'
                      : 'No matching payslips found'}
                  </p>

                  <p className="mt-1 text-sm text-gray-500">
                    Upload a payslip and it will appear here.
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
                              <h3 className="text-sm font-semibold text-[#111827]">
                                {payslip.title}
                              </h3>

                              <p className="mt-1 text-xs text-gray-500">
                                {payslip.originalName}
                              </p>
                            </div>

                            <span className="border border-black/10 bg-white px-2 py-1 text-[11px] font-medium text-gray-500">
                              {formatMonthYear(payslip.expiryDate)}
                            </span>

                            <span
                              className={`border px-2 py-1 text-[11px] font-medium ${
                                payslip.visibleToEmployee
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  : 'border-amber-200 bg-amber-50 text-amber-700'
                              }`}
                            >
                              {payslip.visibleToEmployee
                                ? 'Visible'
                                : 'Hidden'}
                            </span>
                          </div>

                          {payslip.description ? (
                            <p className="mt-4 max-w-3xl text-sm leading-6 text-gray-500">
                              {payslip.description}
                            </p>
                          ) : null}

                          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-gray-400">
                            <span>
                              {payslip.employee.firstName}{' '}
                              {payslip.employee.lastName}
                            </span>

                            <span>{payslip.employee.employeeNumber}</span>

                            {payslip.employee.department ? (
                              <span>{payslip.employee.department.name}</span>
                            ) : null}

                            <span>{formatFileSize(payslip.sizeBytes)}</span>
                            <span>
                              Uploaded {formatDate(payslip.createdAt)}
                            </span>

                            <span
                              className={
                                payslip.visibleToEmployee
                                  ? 'text-emerald-600'
                                  : 'text-amber-600'
                              }
                            >
                              {payslip.visibleToEmployee
                                ? 'Visible to employee'
                                : 'Hidden from employee'}
                            </span>
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
                          <button
                            type="button"
                            onClick={() => downloadPayslip(payslip)}
                            disabled={downloadingId === payslip.id}
                            className="inline-flex items-center justify-center gap-2 border border-black bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {downloadingId === payslip.id ? (
                              <>
                                <Loader2
                                  className="animate-spin"
                                  size={15}
                                />
                                Downloading
                              </>
                            ) : (
                              <>
                                <Download size={15} />
                                Download
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => togglePayslipVisibility(payslip)}
                            disabled={visibilityActionId === payslip.id}
                            className="inline-flex items-center justify-center gap-2 border border-black/10 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition hover:border-black hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {visibilityActionId === payslip.id ? (
                              <>
                                <Loader2
                                  className="animate-spin"
                                  size={15}
                                />
                                Updating
                              </>
                            ) : payslip.visibleToEmployee ? (
                              <>
                                <EyeOff size={15} />
                                Hide
                              </>
                            ) : (
                              <>
                                <Eye size={15} />
                                Show
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => deletePayslip(payslip)}
                            disabled={deleteActionId === payslip.id}
                            className="inline-flex items-center justify-center gap-2 border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition hover:border-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {deleteActionId === payslip.id ? (
                              <>
                                <Loader2
                                  className="animate-spin"
                                  size={15}
                                />
                                Deleting
                              </>
                            ) : (
                              <>
                                <Trash2 size={15} />
                                Delete
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        </section>
      </div>
    </DashboardShell>
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