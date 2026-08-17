'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  FilePlus2,
  Loader2,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  Upload,
  UserRound,
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
  employmentStatus: string;
  department?: {
    id: string;
    name: string;
  } | null;
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

function employeeLabel(employee: Employee) {
  return `${employee.firstName} ${employee.lastName} · ${employee.employeeNumber}`;
}

function formatFileSize(file?: File | null) {
  if (!file) {
    return 'No file selected';
  }

  if (file.size < 1024) {
    return `${file.size} B`;
  }

  if (file.size < 1024 * 1024) {
    return `${(file.size / 1024).toFixed(1)} KB`;
  }

  return `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadDocumentPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('OTHER');
  const [expiryDate, setExpiryDate] = useState('');
  const [visibleToEmployee, setVisibleToEmployee] = useState(true);
  const [isConfidential, setIsConfidential] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [uploading, setUploading] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadedDocumentId, setUploadedDocumentId] = useState('');
  const [uploadedEmployeeId, setUploadedEmployeeId] = useState('');

  useEffect(() => {
    loadEmployees();
  }, []);

  const selectedEmployee = useMemo(() => {
    return employees.find((employee) => employee.id === employeeId) ?? null;
  }, [employees, employeeId]);

  const filteredEmployees = useMemo(() => {
    const query = employeeSearch.trim().toLowerCase();

    if (!query) {
      return employees;
    }

    return employees.filter((employee) => {
      const fullName =
        `${employee.firstName} ${employee.lastName}`.toLowerCase();

      return (
        fullName.includes(query) ||
        employee.employeeNumber.toLowerCase().includes(query) ||
        employee.email?.toLowerCase().includes(query) ||
        employee.jobTitle?.toLowerCase().includes(query) ||
        employee.department?.name.toLowerCase().includes(query)
      );
    });
  }, [employees, employeeSearch]);

  async function loadEmployees() {
    setLoadingEmployees(true);
    setError('');

    try {
      const response = await api.get<Employee[]>('/employees');

      setEmployees(response.data);

      if (response.data.length > 0) {
        setEmployeeId(response.data[0].id);
      }
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ?? 'Could not load employees.';

      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally {
      setLoadingEmployees(false);
    }
  }

  function resetFormAfterUpload() {
    setTitle('');
    setDescription('');
    setCategory('OTHER');
    setExpiryDate('');
    setVisibleToEmployee(true);
    setIsConfidential(false);
    setFile(null);

    const fileInput = document.getElementById(
      'employee-document-file',
    ) as HTMLInputElement | null;

    if (fileInput) {
      fileInput.value = '';
    }
  }

  async function uploadDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError('');
    setSuccess('');
    setUploadedDocumentId('');
    setUploadedEmployeeId('');

    if (!employeeId) {
      setError('Please choose an employee.');
      return;
    }

    if (!file) {
      setError('Please choose a file to upload.');
      return;
    }

    if (!title.trim()) {
      setError('Please enter a document title.');
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();

      formData.append('file', file);
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      formData.append('category', category);
      formData.append('visibleToEmployee', String(visibleToEmployee));
      formData.append('isConfidential', String(isConfidential));

      if (expiryDate) {
        formData.append('expiryDate', expiryDate);
      }

      const response = await api.post(
        `/employees/${employeeId}/documents`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        },
      );

      setUploadedDocumentId(response.data?.document?.id ?? '');
      setUploadedEmployeeId(employeeId);
      setSuccess(response.data?.message ?? 'Document uploaded successfully.');
      resetFormAfterUpload();
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ?? 'Could not upload document.';

      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <DashboardShell activePage="documents">
      <div className="space-y-8">
        <section className="flex flex-col gap-5 border-b border-black/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              href="/dashboard/documents"
              className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-black"
            >
              <ArrowLeft size={15} />
              Back to documents
            </Link>

            <p className="mb-2 text-sm uppercase tracking-[0.25em] text-gray-400">
              Upload document
            </p>

            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#111827]">
              Upload employee document
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              Upload existing employee files such as contracts, ID documents,
              certificates, medical records, training records and disciplinary
              documents.
            </p>
          </div>

          <button
            type="button"
            onClick={loadEmployees}
            className="inline-flex items-center justify-center gap-2 border border-black/10 bg-white px-5 py-3 text-sm font-medium text-gray-600 transition hover:border-black hover:text-black"
          >
            <RefreshCw size={16} />
            Refresh employees
          </button>
        </section>

        {error ? (
          <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <div className="flex items-start gap-3">
              <CheckCircle2 size={17} className="mt-0.5 shrink-0" />

              <div>
                <p className="font-medium">{success}</p>

                {uploadedEmployeeId ? (
                  <Link
                    href={`/dashboard/employees/${uploadedEmployeeId}/documents`}
                    className="mt-2 inline-flex text-sm font-medium underline underline-offset-4"
                  >
                    Open employee documents
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {loadingEmployees ? (
          <div className="flex min-h-[520px] items-center justify-center border border-black/10 bg-white">
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <Loader2 className="animate-spin" size={18} />
              Loading employees...
            </div>
          </div>
        ) : (
          <section className="grid gap-6 xl:grid-cols-[380px_1fr]">
            <aside className="space-y-6">
              <section className="border border-black/10 bg-[#111827] p-6 text-white">
                <div className="flex h-12 w-12 items-center justify-center border border-white/15 bg-white/10">
                  <UserRound size={20} />
                </div>

                <h2 className="mt-5 text-lg font-semibold tracking-[-0.03em]">
                  Selected employee
                </h2>

                {selectedEmployee ? (
                  <div className="mt-4 space-y-3 text-sm text-white/70">
                    <InfoRow
                      label="Name"
                      value={`${selectedEmployee.firstName} ${selectedEmployee.lastName}`}
                      dark
                    />

                    <InfoRow
                      label="Employee no."
                      value={selectedEmployee.employeeNumber}
                      dark
                    />

                    <InfoRow
                      label="Job title"
                      value={selectedEmployee.jobTitle ?? 'Not set'}
                      dark
                    />

                    <InfoRow
                      label="Department"
                      value={selectedEmployee.department?.name ?? 'Not set'}
                      dark
                    />
                  </div>
                ) : (
                  <p className="mt-4 text-sm leading-6 text-white/60">
                    Choose an employee to attach this document to their profile.
                  </p>
                )}
              </section>

              <section className="border border-black/10 bg-white p-6">
                <div className="flex h-11 w-11 items-center justify-center border border-black/10 bg-[#f8fafc] text-gray-500">
                  <Upload size={19} />
                </div>

                <h2 className="mt-5 text-lg font-semibold tracking-[-0.03em] text-[#111827]">
                  File selected
                </h2>

                <p className="mt-2 break-words text-sm leading-6 text-gray-500">
                  {file ? file.name : 'No file selected yet.'}
                </p>

                <p className="mt-2 text-sm font-medium text-[#111827]">
                  {formatFileSize(file)}
                </p>
              </section>

              <section className="border border-black/10 bg-white p-6">
                <div className="flex h-11 w-11 items-center justify-center border border-black/10 bg-[#f8fafc] text-gray-500">
                  <ShieldAlert size={19} />
                </div>

                <h2 className="mt-5 text-lg font-semibold tracking-[-0.03em] text-[#111827]">
                  Visibility rules
                </h2>

                <p className="mt-2 text-sm leading-6 text-gray-500">
                  Use confidentiality and employee visibility carefully. Sensitive
                  documents can be hidden from employees while remaining
                  accessible to HR.
                </p>
              </section>
            </aside>

            <form
              onSubmit={uploadDocument}
              className="border border-black/10 bg-white"
            >
              <div className="border-b border-black/10 px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center border border-black/10 bg-[#111827] text-white">
                    <FilePlus2 size={18} />
                  </div>

                  <div>
                    <h2 className="text-lg font-semibold tracking-[-0.03em] text-[#111827]">
                      Document details
                    </h2>

                    <p className="mt-1 text-sm text-gray-500">
                      Choose the employee, upload the file, and set document
                      controls.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-6 p-6">
                <section className="grid gap-4">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-[#111827]">
                      Search employee
                    </span>

                    <div className="relative">
                      <Search
                        size={16}
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                      />

                      <input
                        value={employeeSearch}
                        onChange={(event) =>
                          setEmployeeSearch(event.target.value)
                        }
                        placeholder="Search by name, number, department..."
                        className="w-full border border-black/10 bg-[#f8fafc] py-3 pl-11 pr-4 text-sm outline-none transition focus:border-black"
                      />
                    </div>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-[#111827]">
                      Employee <span className="text-red-500">*</span>
                    </span>

                    <select
                      value={employeeId}
                      onChange={(event) => setEmployeeId(event.target.value)}
                      className="w-full border border-black/10 bg-[#f8fafc] px-4 py-3 text-sm outline-none transition focus:border-black"
                    >
                      {filteredEmployees.length === 0 ? (
                        <option value="">No employees found</option>
                      ) : (
                        filteredEmployees.map((employee) => (
                          <option key={employee.id} value={employee.id}>
                            {employeeLabel(employee)}
                          </option>
                        ))
                      )}
                    </select>
                  </label>
                </section>

                <section className="grid gap-5 md:grid-cols-2">
                  <label className="block md:col-span-2">
                    <span className="mb-2 block text-sm font-medium text-[#111827]">
                      File <span className="text-red-500">*</span>
                    </span>

                    <input
                      id="employee-document-file"
                      type="file"
                      onChange={(event) => {
                        setFile(event.target.files?.[0] ?? null);
                      }}
                      className="w-full border border-black/10 bg-[#f8fafc] px-4 py-3 text-sm outline-none transition file:mr-4 file:border-0 file:bg-black file:px-4 file:py-2 file:text-sm file:font-medium file:text-white focus:border-black"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-[#111827]">
                      Document title <span className="text-red-500">*</span>
                    </span>

                    <input
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="Example: Signed employment contract"
                      className="w-full border border-black/10 bg-[#f8fafc] px-4 py-3 text-sm outline-none transition focus:border-black"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-[#111827]">
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
                    <span className="mb-2 block text-sm font-medium text-[#111827]">
                      Expiry date
                    </span>

                    <input
                      type="date"
                      value={expiryDate}
                      onChange={(event) => setExpiryDate(event.target.value)}
                      className="w-full border border-black/10 bg-[#f8fafc] px-4 py-3 text-sm outline-none transition focus:border-black"
                    />
                  </label>

                  <label className="block md:col-span-2">
                    <span className="mb-2 block text-sm font-medium text-[#111827]">
                      Description
                    </span>

                    <textarea
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      rows={4}
                      placeholder="Optional notes about this document..."
                      className="w-full resize-none border border-black/10 bg-[#f8fafc] px-4 py-3 text-sm outline-none transition focus:border-black"
                    />
                  </label>
                </section>

                <section className="grid gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setVisibleToEmployee(!visibleToEmployee)}
                    className={`border p-5 text-left transition ${
                      visibleToEmployee
                        ? 'border-black bg-[#111827] text-white'
                        : 'border-black/10 bg-white text-[#111827] hover:border-black'
                    }`}
                  >
                    <p className="text-sm font-semibold">
                      Visible to employee
                    </p>

                    <p
                      className={`mt-2 text-sm leading-6 ${
                        visibleToEmployee ? 'text-white/65' : 'text-gray-500'
                      }`}
                    >
                      Employee can view this document in their portal.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsConfidential(!isConfidential)}
                    className={`border p-5 text-left transition ${
                      isConfidential
                        ? 'border-black bg-[#111827] text-white'
                        : 'border-black/10 bg-white text-[#111827] hover:border-black'
                    }`}
                  >
                    <p className="text-sm font-semibold">
                      Confidential document
                    </p>

                    <p
                      className={`mt-2 text-sm leading-6 ${
                        isConfidential ? 'text-white/65' : 'text-gray-500'
                      }`}
                    >
                      Mark this file as sensitive HR information.
                    </p>
                  </button>
                </section>

                <div className="flex flex-col gap-3 border-t border-black/10 pt-6 md:flex-row md:items-center md:justify-between">
                  <p className="text-sm text-gray-500">
                    Uploading attaches this file to the selected employee’s
                    document profile.
                  </p>

                  <button
                    type="submit"
                    disabled={uploading}
                    className="inline-flex items-center justify-center gap-2 border border-black bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {uploading ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <Save size={16} />
                    )}
                    {uploading ? 'Uploading...' : 'Upload document'}
                  </button>
                </div>
              </div>
            </form>
          </section>
        )}
      </div>
    </DashboardShell>
  );
}

function InfoRow({
  label,
  value,
  dark,
}: {
  label: string;
  value: string;
  dark?: boolean;
}) {
  return (
    <div
      className={`border px-3 py-3 ${
        dark
          ? 'border-white/10 bg-white/5'
          : 'border-black/10 bg-[#f8fafc]'
      }`}
    >
      <p
        className={`text-xs uppercase tracking-[0.16em] ${
          dark ? 'text-white/40' : 'text-gray-400'
        }`}
      >
        {label}
      </p>

      <p
        className={`mt-1 break-words text-sm font-medium ${
          dark ? 'text-white' : 'text-[#111827]'
        }`}
      >
        {value}
      </p>
    </div>
  );
}