'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarClock,
  CalendarDays,
  Download,
  FileText,
  Loader2,
  Mail,
  MapPin,
  Phone,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Target,
  TrendingUp,
  UserRound,
  WalletCards,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { EmployeeEmploymentHistory } from '@/components/employees/EmployeeEmploymentHistory';
import { EmployeeLifecycleActions } from '@/components/employees/EmployeeLifecycleActions';
import { EmployeeReportingLines } from '@/components/employees/EmployeeReportingLines';
import { api } from '@/lib/api';

type Employee = {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
  employmentType?: string | null;
  employmentStatus: string;
  startDate?: string | null;
  endDate?: string | null;
  dateOfBirth?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  postalCode?: string | null;
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
};

type LeaveRequest = {
  id: string;
  employeeId: string;
  leaveType: string;
  status: string;
  startDate: string;
  endDate: string;
  totalDays?: string | number;
  reason?: string | null;
  createdAt: string;
};

type AttendanceRecord = {
  id: string;
  employeeId: string;
  clockInAt: string;
  clockOutAt?: string | null;
  status: string;
  policyStatus?: string;
  workedMinutes?: number;
  lateByMinutes?: number;
  createdAt: string;
};

type PerformanceSummary = {
  reviews: Array<{
    id: string;
    status: string;
    overallScore?: number | string | null;
    finalisedAt?: string | null;
    cycle: {
      name: string;
      template: { name: string };
    };
  }>;
  goals: Array<{
    id: string;
    title: string;
    status: string;
    progress: number;
    targetDate?: string | null;
  }>;
  developmentPlans: Array<{
    id: string;
    title: string;
    status: string;
    targetDate?: string | null;
  }>;
};

function formatDate(value?: string | null) {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(new Date(value));
}

function formatTime(value?: string | null) {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('en-ZA', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatLeaveType(type: string) {
  return type
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatStatus(status?: string | null) {
  if (!status) return 'Not set';
  return status.replaceAll('_', ' ');
}

function getDurationMinutes(record: AttendanceRecord) {
  if (typeof record.workedMinutes === 'number') return record.workedMinutes;
  if (!record.clockOutAt) return 0;
  const clockIn = new Date(record.clockInAt).getTime();
  const clockOut = new Date(record.clockOutAt).getTime();
  if (Number.isNaN(clockIn) || Number.isNaN(clockOut) || clockOut <= clockIn) {
    return 0;
  }
  return Math.floor((clockOut - clockIn) / (1000 * 60));
}

function formatDuration(minutes?: number | null) {
  if (!minutes || minutes <= 0) return '0h 0m';
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function getLeaveDays(request: LeaveRequest) {
  if (request.totalDays !== undefined && request.totalDays !== null) {
    return Number(request.totalDays);
  }
  const start = new Date(request.startDate);
  const end = new Date(request.endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const difference = end.getTime() - start.getTime();
  return Math.max(1, Math.floor(difference / (1000 * 60 * 60 * 24)) + 1);
}

function getBadgeClass(status: string) {
  if (
    status === 'APPROVED' ||
    status === 'COMPLIANT' ||
    status === 'CLOCKED_OUT' ||
    status === 'ACTIVE'
  ) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (status === 'PENDING' || status === 'CLOCKED_IN' || status === 'ON_LEAVE') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  if (
    status === 'REJECTED' ||
    status === 'LATE' ||
    status === 'SHORT_SHIFT' ||
    status === 'LATE_AND_SHORT_SHIFT' ||
    status === 'MISSED_CLOCK_OUT' ||
    status === 'SUSPENDED' ||
    status === 'TERMINATED' ||
    status === 'RESIGNED'
  ) {
    return 'border-red-200 bg-red-50 text-red-700';
  }
  return 'border-gray-200 bg-gray-50 text-gray-600';
}

export default function EmployeeProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const employeeId = params.id;

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [performance, setPerformance] = useState<PerformanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [downloadingDocumentId, setDownloadingDocumentId] = useState<string | null>(null);

  useEffect(() => {
    void loadEmployeeProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  async function loadEmployeeProfile() {
    setLoading(true);
    setError('');
    try {
      const [
        employeeResponse,
        documentsResponse,
        leaveResponse,
        attendanceResponse,
        performanceResponse,
      ] = await Promise.all([
        api.get<Employee>(`/employees/${employeeId}`),
        api.get<EmployeeDocument[]>(`/employees/${employeeId}/documents`),
        api.get<LeaveRequest[]>('/leave'),
        api.get<AttendanceRecord[]>('/attendance', { params: { employeeId } }),
        api.get<PerformanceSummary>(`/performance/employees/${employeeId}`),
      ]);

      setEmployee(employeeResponse.data);
      setDocuments(documentsResponse.data);
      setLeaveRequests(
        leaveResponse.data.filter((request) => request.employeeId === employeeId),
      );
      setAttendanceRecords(attendanceResponse.data);
      setPerformance(performanceResponse.data);
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ?? 'Could not load employee profile.';
      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLifecycleChanged(message: string) {
    setSuccess(message);
    setError('');
    await loadEmployeeProfile();
    setHistoryRefreshKey((current) => current + 1);
  }

  async function downloadDocument(document: EmployeeDocument) {
    setError('');
    setDownloadingDocumentId(document.id);
    try {
      const response = await api.get(`/employees/documents/${document.id}/download`, {
        responseType: 'blob',
      });
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

  const payslips = useMemo(
    () => documents.filter((document) => document.category === 'PAYSLIP'),
    [documents],
  );
  const normalDocuments = useMemo(
    () => documents.filter((document) => document.category !== 'PAYSLIP'),
    [documents],
  );
  const approvedLeaveDays = useMemo(
    () =>
      leaveRequests
        .filter((request) => request.status === 'APPROVED')
        .reduce((total, request) => total + getLeaveDays(request), 0),
    [leaveRequests],
  );
  const pendingLeaveCount = useMemo(
    () => leaveRequests.filter((request) => request.status === 'PENDING').length,
    [leaveRequests],
  );
  const attendanceMinutes = useMemo(
    () =>
      attendanceRecords.reduce(
        (total, record) => total + getDurationMinutes(record),
        0,
      ),
    [attendanceRecords],
  );

  const latestDocuments = normalDocuments.slice(0, 5);
  const latestPayslips = payslips.slice(0, 5);
  const latestLeave = leaveRequests.slice(0, 5);
  const latestAttendance = attendanceRecords.slice(0, 5);

  if (loading) {
    return (
      <DashboardShell activePage="employees">
        <div className="flex min-h-[520px] items-center justify-center border border-black/10 bg-white">
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <Loader2 className="animate-spin" size={18} />
            Loading employee profile...
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (!employee) {
    return (
      <DashboardShell activePage="employees">
        <div className="border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error || 'Employee profile not found.'}
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
              onClick={() => router.push('/dashboard/employees')}
              className="mb-5 inline-flex items-center gap-2 text-sm text-gray-500 transition hover:text-black"
            >
              <ArrowLeft size={15} />
              Back to employees
            </button>
            <p className="mb-2 text-sm uppercase tracking-[0.25em] text-gray-400">
              Employee profile
            </p>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#111827]">
              {employee.firstName} {employee.lastName}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              {employee.employeeNumber} · {employee.jobTitle ?? 'No job title'} ·{' '}
              {employee.department?.name ?? 'Unassigned department'}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void loadEmployeeProfile()}
              className="inline-flex items-center justify-center gap-2 border border-black/10 bg-white px-5 py-3 text-sm font-medium text-gray-600 transition hover:border-black hover:text-black"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
            <Link
              href={`/dashboard/employees/${employee.id}/edit`}
              className="inline-flex items-center justify-center gap-2 border border-black bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-white hover:text-black"
            >
              <UserRound size={16} />
              Edit profile
            </Link>
            <Link
              href={`/dashboard/employees/${employee.id}/payroll`}
              className="inline-flex items-center justify-center gap-2 border border-black bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-white hover:text-black"
            >
              <WalletCards size={15} />
              Payroll profile
            </Link>
            <Link
              href={`/dashboard/performance?employeeId=${employee.id}`}
              className="inline-flex items-center justify-center gap-2 border border-black/10 bg-white px-5 py-3 text-sm font-medium text-gray-600 transition hover:border-black hover:text-black"
            >
              <Target size={16} />
              Performance
            </Link>
            <Link
              href={`/dashboard/documents/generated?employeeId=${employee.id}`}
              className="inline-flex items-center justify-center gap-2 border border-black/10 bg-white px-5 py-3 text-sm font-medium text-gray-600 transition hover:border-black hover:text-black"
            >
              <FileText size={16} />
              Generate document
            </Link>
          </div>
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

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard title="Documents" value={String(normalDocuments.length)} helper="Employee files" icon={<FileText size={18} />} />
          <StatCard title="Payslips" value={String(payslips.length)} helper="Payroll documents" icon={<ReceiptText size={18} />} />
          <StatCard title="Leave" value={`${approvedLeaveDays} days`} helper={`${pendingLeaveCount} pending requests`} icon={<CalendarDays size={18} />} />
          <StatCard title="Attendance" value={formatDuration(attendanceMinutes)} helper={`${attendanceRecords.length} records`} icon={<CalendarClock size={18} />} />
          <StatCard title="Performance" value={String(performance?.reviews.length ?? 0)} helper={`${performance?.goals.length ?? 0} active goals`} icon={<TrendingUp size={18} />} />
        </section>

        <EmployeeReportingLines employeeId={employee.id} />
        <EmployeeEmploymentHistory employeeId={employee.id} refreshKey={String(historyRefreshKey)} />

        <section className="grid gap-6 xl:grid-cols-[380px_1fr]">
          <aside className="space-y-6">
            <section className="border border-black/10 bg-white">
              <div className="border-b border-black/10 px-6 py-5">
                <h2 className="text-lg font-semibold tracking-[-0.03em]">Profile summary</h2>
                <p className="mt-1 text-sm text-gray-500">Core employee details.</p>
              </div>
              <div className="space-y-4 p-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center border border-black/10 bg-[#111827] text-xl font-semibold text-white">
                    {employee.firstName.charAt(0)}{employee.lastName.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#111827]">{employee.firstName} {employee.lastName}</p>
                    <p className="mt-1 text-sm text-gray-500">{employee.employeeNumber}</p>
                    <div className="mt-2"><StatusBadge status={employee.employmentStatus} /></div>
                  </div>
                </div>
                <div className="border-t border-black/10 pt-4">
                  <SummaryItem icon={<BriefcaseBusiness size={15} />} label="Job title" value={employee.jobTitle ?? 'Not set'} />
                  <SummaryItem icon={<ShieldCheck size={15} />} label="Department" value={employee.department?.name ?? 'Unassigned'} />
                  <SummaryItem icon={<CalendarDays size={15} />} label="Start date" value={formatDate(employee.startDate)} />
                  <SummaryItem icon={<CalendarDays size={15} />} label="End date" value={formatDate(employee.endDate)} />
                  <SummaryItem icon={<UserRound size={15} />} label="Employment type" value={employee.employmentType ?? 'Not set'} />
                </div>
              </div>
            </section>

            <section className="border border-black/10 bg-white">
              <div className="border-b border-black/10 px-6 py-5">
                <h2 className="text-lg font-semibold tracking-[-0.03em]">Lifecycle actions</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Controlled employment transitions with effective dates, reasons and audit history.
                </p>
              </div>
              <div className="p-6">
                <EmployeeLifecycleActions
                  employee={employee}
                  onChanged={handleLifecycleChanged}
                  onError={setError}
                />
              </div>
            </section>

            <section className="border border-black/10 bg-white">
              <div className="border-b border-black/10 px-6 py-5">
                <h2 className="text-lg font-semibold tracking-[-0.03em]">Contact details</h2>
              </div>
              <div className="space-y-4 p-6">
                <SummaryItem icon={<Mail size={15} />} label="Email" value={employee.email ?? 'Not set'} />
                <SummaryItem icon={<Phone size={15} />} label="Phone" value={employee.phone ?? 'Not set'} />
                <SummaryItem
                  icon={<MapPin size={15} />}
                  label="Location"
                  value={[employee.city, employee.province, employee.country].filter(Boolean).join(', ') || 'Not set'}
                />
              </div>
            </section>
          </aside>

          <div className="space-y-6">
            <Panel
              title="Performance & development"
              description="Final reviews, active goals and development actions."
              actionHref={`/dashboard/performance?employeeId=${employee.id}`}
              actionLabel="Open performance"
            >
              {!performance ||
              (performance.reviews.length === 0 && performance.goals.length === 0 && performance.developmentPlans.length === 0) ? (
                <EmptyState message="No performance records yet." />
              ) : (
                <div className="grid gap-4 md:grid-cols-3">
                  <PerformanceTile
                    label="Latest review"
                    value={
                      performance.reviews[0]?.overallScore
                        ? `${Number(performance.reviews[0].overallScore).toFixed(1)} / 5`
                        : performance.reviews[0]
                          ? formatStatus(performance.reviews[0].status)
                          : 'Not reviewed'
                    }
                    helper={performance.reviews[0]?.cycle.name ?? 'No completed review cycle'}
                  />
                  <PerformanceTile
                    label="Goals"
                    value={String(performance.goals.length)}
                    helper={
                      performance.goals.length
                        ? `${Math.round(performance.goals.reduce((sum, goal) => sum + goal.progress, 0) / performance.goals.length)}% average progress`
                        : 'No goals assigned'
                    }
                  />
                  <PerformanceTile label="Development" value={String(performance.developmentPlans.length)} helper="Active development actions" />
                </div>
              )}
            </Panel>

            <Panel title="Recent documents" description="Latest employee documents excluding payslips." actionHref={`/dashboard/employees/${employee.id}/documents`} actionLabel="Manage documents">
              {latestDocuments.length === 0 ? (
                <EmptyState message="No documents uploaded yet." />
              ) : (
                <div className="space-y-3">
                  {latestDocuments.map((document) => (
                    <DocumentRow key={document.id} document={document} downloadingDocumentId={downloadingDocumentId} onDownload={downloadDocument} />
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Recent payslips" description="Latest payroll documents for this employee." actionHref="/dashboard/payslips" actionLabel="View payslips">
              {latestPayslips.length === 0 ? (
                <EmptyState message="No payslips uploaded yet." />
              ) : (
                <div className="space-y-3">
                  {latestPayslips.map((document) => (
                    <DocumentRow key={document.id} document={document} downloadingDocumentId={downloadingDocumentId} onDownload={downloadDocument} />
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Leave history" description="Recent leave requests for this employee." actionHref="/dashboard/leave" actionLabel="Open leave">
              {latestLeave.length === 0 ? (
                <EmptyState message="No leave requests yet." />
              ) : (
                <div className="space-y-3">
                  {latestLeave.map((request) => (
                    <article key={request.id} className="border border-black/10 bg-[#f8fafc] p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-[#111827]">{formatLeaveType(request.leaveType)}</p>
                            <span className={`border px-2 py-1 text-[11px] font-medium ${getBadgeClass(request.status)}`}>{formatStatus(request.status)}</span>
                          </div>
                          <p className="mt-2 text-sm text-gray-500">
                            {formatDate(request.startDate)} - {formatDate(request.endDate)} · {getLeaveDays(request)} day{getLeaveDays(request) === 1 ? '' : 's'}
                          </p>
                        </div>
                        <p className="text-xs text-gray-400">Submitted {formatDate(request.createdAt)}</p>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Attendance history" description="Recent attendance records for this employee." actionHref="/dashboard/attendance" actionLabel="Open attendance">
              {latestAttendance.length === 0 ? (
                <EmptyState message="No attendance records yet." />
              ) : (
                <div className="space-y-3">
                  {latestAttendance.map((record) => (
                    <article key={record.id} className="border border-black/10 bg-[#f8fafc] p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-[#111827]">{formatDate(record.clockInAt)}</p>
                            <span className={`border px-2 py-1 text-[11px] font-medium ${getBadgeClass(record.status)}`}>{formatStatus(record.status)}</span>
                            {record.policyStatus ? (
                              <span className={`border px-2 py-1 text-[11px] font-medium ${getBadgeClass(record.policyStatus)}`}>{formatStatus(record.policyStatus)}</span>
                            ) : null}
                          </div>
                          <p className="mt-2 text-sm text-gray-500">
                            In {formatTime(record.clockInAt)} · Out {formatTime(record.clockOutAt)} · Worked {formatDuration(getDurationMinutes(record))}
                          </p>
                        </div>
                        <p className="text-xs text-gray-400">Late by {record.lateByMinutes ?? 0} min</p>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}

function StatCard({ title, value, helper, icon }: { title: string; value: string; helper: string; icon: React.ReactNode }) {
  return (
    <div className="border border-black/10 bg-white p-5">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs uppercase tracking-[0.18em] text-gray-400">{title}</p>
        <div className="text-gray-400">{icon}</div>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-[-0.05em] text-[#111827]">{value}</p>
      <p className="mt-1 text-sm text-gray-500">{helper}</p>
    </div>
  );
}

function SummaryItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex gap-3 border-b border-black/5 py-3 last:border-b-0">
      <div className="mt-0.5 text-gray-400">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-[0.14em] text-gray-400">{label}</p>
        <p className="mt-1 break-words text-sm font-medium text-[#111827]">{value}</p>
      </div>
    </div>
  );
}

function Panel({ title, description, actionHref, actionLabel, children }: { title: string; description: string; actionHref: string; actionLabel: string; children: React.ReactNode }) {
  return (
    <section className="border border-black/10 bg-white">
      <div className="flex flex-col gap-4 border-b border-black/10 px-6 py-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.03em] text-[#111827]">{title}</h2>
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        </div>
        <Link href={actionHref} className="inline-flex items-center justify-center border border-black/10 bg-white px-4 py-2 text-sm text-gray-600 transition hover:border-black hover:text-black">
          {actionLabel}
        </Link>
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

function DocumentRow({ document, downloadingDocumentId, onDownload }: { document: EmployeeDocument; downloadingDocumentId: string | null; onDownload: (document: EmployeeDocument) => void }) {
  return (
    <article className="flex flex-col gap-3 border border-black/10 bg-[#f8fafc] p-4 md:flex-row md:items-center md:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-[#111827]">{document.title}</p>
          <span className="border border-black/10 bg-white px-2 py-1 text-[11px] font-medium text-gray-500">{formatLeaveType(document.category)}</span>
          {document.visibleToEmployee ? (
            <span className="border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">Visible</span>
          ) : (
            <span className="border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] font-medium text-gray-500">Hidden</span>
          )}
        </div>
        <p className="mt-2 text-sm text-gray-500">{document.originalName} · {formatFileSize(document.sizeBytes)}</p>
      </div>
      <button
        type="button"
        onClick={() => onDownload(document)}
        disabled={downloadingDocumentId === document.id}
        className="inline-flex items-center justify-center gap-2 border border-black/10 bg-white px-4 py-2 text-sm text-gray-600 transition hover:border-black hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
      >
        {downloadingDocumentId === document.id ? <Loader2 className="animate-spin" size={15} /> : <Download size={15} />}
        Download
      </button>
    </article>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="border border-dashed border-black/15 bg-[#f8fafc] px-5 py-12 text-center">
      <p className="text-sm font-medium text-[#111827]">{message}</p>
    </div>
  );
}

function PerformanceTile({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <article className="border border-black/10 bg-[#f8fafc] p-4">
      <p className="text-xs uppercase tracking-[0.15em] text-gray-400">{label}</p>
      <p className="mt-3 text-xl font-semibold tracking-[-0.04em] text-[#111827]">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{helper}</p>
    </article>
  );
}
