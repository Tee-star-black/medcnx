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
import { Button, FeedbackBanner } from '@/components/ui';
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
    return 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300';
  }
  if (status === 'PENDING' || status === 'CLOCKED_IN' || status === 'ON_LEAVE') {
    return 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300';
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
    return 'border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300';
  }
  return 'border-[var(--border-strong)] bg-[var(--surface-soft)] text-[var(--muted)]';
}

const actionLinkClass =
  'inline-flex min-h-11 items-center justify-center gap-2 border border-[var(--border-strong)] bg-[var(--surface)] px-4 text-sm font-extrabold text-[var(--text-soft)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]';

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
        <div className="flex min-h-[520px] items-center justify-center border border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-center gap-3 text-sm font-semibold text-[var(--muted)]">
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
        <FeedbackBanner
          tone="error"
          title="Employee profile unavailable"
          message={error || 'Employee profile not found.'}
        />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell activePage="employees">
      <div className="space-y-8">
        <section className="relative overflow-hidden border border-[var(--border-strong)] bg-[var(--surface)] shadow-[var(--shadow-xs)]">
          <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-[var(--accent)]" />
          <div className="grid gap-6 px-6 py-7 lg:grid-cols-[1fr_auto] lg:items-end lg:px-8">
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => router.push('/dashboard/employees')}
                className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-[var(--muted)] transition hover:text-[var(--accent)]"
              >
                <ArrowLeft size={15} />
                Back to employees
              </button>
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[var(--accent)]">
                Employee profile
              </p>
              <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h1 className="text-3xl font-black tracking-[-0.045em] text-[var(--text)] sm:text-4xl">
                    {employee.firstName} {employee.lastName}
                  </h1>
                  <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-[var(--muted)]">
                    {employee.employeeNumber} · {employee.jobTitle ?? 'No job title'} ·{' '}
                    {employee.department?.name ?? 'Unassigned department'}
                  </p>
                </div>
                <StatusBadge status={employee.employmentStatus} />
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:w-[360px]">
              <Button
                variant="secondary"
                icon={<RefreshCw size={16} />}
                onClick={() => void loadEmployeeProfile()}
              >
                Refresh
              </Button>
              <Link href={`/dashboard/employees/${employee.id}/edit`} className={`${actionLinkClass} border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] hover:text-[var(--accent-text)]`}>
                <UserRound size={16} />
                Edit profile
              </Link>
              <Link href={`/dashboard/employees/${employee.id}/payroll`} className={actionLinkClass}>
                <WalletCards size={16} />
                Payroll profile
              </Link>
              <Link href={`/dashboard/performance?employeeId=${employee.id}`} className={actionLinkClass}>
                <Target size={16} />
                Performance
              </Link>
              <Link href={`/dashboard/documents/generated?employeeId=${employee.id}`} className={`${actionLinkClass} sm:col-span-2`}>
                <FileText size={16} />
                Generate document
              </Link>
            </div>
          </div>
        </section>

        {error ? (
          <FeedbackBanner tone="error" title="Profile action failed" message={error} />
        ) : null}
        {success ? (
          <FeedbackBanner tone="success" title="Employment record updated" message={success} />
        ) : null}

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <ProfileMetric title="Documents" value={String(normalDocuments.length)} helper="Employee files" icon={<FileText size={18} />} />
          <ProfileMetric title="Payslips" value={String(payslips.length)} helper="Payroll documents" icon={<ReceiptText size={18} />} />
          <ProfileMetric title="Leave" value={`${approvedLeaveDays} days`} helper={`${pendingLeaveCount} pending requests`} icon={<CalendarDays size={18} />} />
          <ProfileMetric title="Attendance" value={formatDuration(attendanceMinutes)} helper={`${attendanceRecords.length} records`} icon={<CalendarClock size={18} />} />
          <ProfileMetric title="Performance" value={String(performance?.reviews.length ?? 0)} helper={`${performance?.goals.length ?? 0} active goals`} icon={<TrendingUp size={18} />} />
        </section>

        <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-6">
            <EmployeeReportingLines employeeId={employee.id} />
            <EmployeeEmploymentHistory employeeId={employee.id} refreshKey={String(historyRefreshKey)} />
          </div>

          <aside className="space-y-6 2xl:sticky 2xl:top-6 2xl:self-start">
            <SectionPanel
              eyebrow="Employment record"
              title="Profile summary"
              description="Core employment identity and service details."
            >
              <div className="flex items-center gap-4 border-b border-[var(--border)] pb-5">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center border border-[var(--brand-navy)] bg-[var(--brand-navy)] text-xl font-black text-white dark:border-[var(--accent)] dark:bg-[var(--surface-soft)] dark:text-[var(--accent)]">
                  {employee.firstName.charAt(0)}{employee.lastName.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-black text-[var(--text)]">{employee.firstName} {employee.lastName}</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--muted)]">{employee.employeeNumber}</p>
                </div>
              </div>
              <div>
                <SummaryItem icon={<BriefcaseBusiness size={15} />} label="Job title" value={employee.jobTitle ?? 'Not set'} />
                <SummaryItem icon={<ShieldCheck size={15} />} label="Department" value={employee.department?.name ?? 'Unassigned'} />
                <SummaryItem icon={<CalendarDays size={15} />} label="Start date" value={formatDate(employee.startDate)} />
                <SummaryItem icon={<CalendarDays size={15} />} label="End date" value={formatDate(employee.endDate)} />
                <SummaryItem icon={<UserRound size={15} />} label="Employment type" value={employee.employmentType ?? 'Not set'} />
              </div>
            </SectionPanel>

            <SectionPanel
              eyebrow="Controlled workflow"
              title="Lifecycle actions"
              description="Effective-dated employment transitions with reasons and audit history."
            >
              <EmployeeLifecycleActions
                employee={employee}
                onChanged={handleLifecycleChanged}
                onError={setError}
              />
            </SectionPanel>

            <SectionPanel
              eyebrow="Employee contact"
              title="Contact details"
              description="Current communication and location details."
            >
              <SummaryItem icon={<Mail size={15} />} label="Email" value={employee.email ?? 'Not set'} />
              <SummaryItem icon={<Phone size={15} />} label="Phone" value={employee.phone ?? 'Not set'} />
              <SummaryItem
                icon={<MapPin size={15} />}
                label="Location"
                value={[employee.city, employee.province, employee.country].filter(Boolean).join(', ') || 'Not set'}
              />
            </SectionPanel>
          </aside>
        </div>

        <section className="grid gap-6 xl:grid-cols-2">
          <OperationalPanel
            title="Performance & development"
            description="Final reviews, active goals and development actions."
            actionHref={`/dashboard/performance?employeeId=${employee.id}`}
            actionLabel="Open performance"
          >
            {!performance ||
            (performance.reviews.length === 0 && performance.goals.length === 0 && performance.developmentPlans.length === 0) ? (
              <InlineEmptyState message="No performance records yet." />
            ) : (
              <div className="grid gap-3 md:grid-cols-3">
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
          </OperationalPanel>

          <OperationalPanel title="Recent documents" description="Latest employee documents excluding payslips." actionHref={`/dashboard/employees/${employee.id}/documents`} actionLabel="Manage documents">
            {latestDocuments.length === 0 ? (
              <InlineEmptyState message="No documents uploaded yet." />
            ) : (
              <div className="divide-y divide-[var(--border)] border border-[var(--border)]">
                {latestDocuments.map((document) => (
                  <DocumentRow key={document.id} document={document} downloadingDocumentId={downloadingDocumentId} onDownload={downloadDocument} />
                ))}
              </div>
            )}
          </OperationalPanel>

          <OperationalPanel title="Recent payslips" description="Latest payroll documents for this employee." actionHref="/dashboard/payslips" actionLabel="View payslips">
            {latestPayslips.length === 0 ? (
              <InlineEmptyState message="No payslips uploaded yet." />
            ) : (
              <div className="divide-y divide-[var(--border)] border border-[var(--border)]">
                {latestPayslips.map((document) => (
                  <DocumentRow key={document.id} document={document} downloadingDocumentId={downloadingDocumentId} onDownload={downloadDocument} />
                ))}
              </div>
            )}
          </OperationalPanel>

          <OperationalPanel title="Leave history" description="Recent leave requests for this employee." actionHref="/dashboard/leave" actionLabel="Open leave">
            {latestLeave.length === 0 ? (
              <InlineEmptyState message="No leave requests yet." />
            ) : (
              <div className="divide-y divide-[var(--border)] border border-[var(--border)]">
                {latestLeave.map((request) => (
                  <article key={request.id} className="bg-[var(--surface)] p-4 hover:bg-[var(--surface-soft)]">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-extrabold text-[var(--text)]">{formatLeaveType(request.leaveType)}</p>
                          <span className={`border px-2 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] ${getBadgeClass(request.status)}`}>{formatStatus(request.status)}</span>
                        </div>
                        <p className="mt-2 text-sm font-medium text-[var(--muted)]">
                          {formatDate(request.startDate)} - {formatDate(request.endDate)} · {getLeaveDays(request)} day{getLeaveDays(request) === 1 ? '' : 's'}
                        </p>
                      </div>
                      <p className="text-xs font-semibold text-[var(--muted-soft)]">Submitted {formatDate(request.createdAt)}</p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </OperationalPanel>

          <OperationalPanel title="Attendance history" description="Recent attendance records for this employee." actionHref="/dashboard/attendance" actionLabel="Open attendance">
            {latestAttendance.length === 0 ? (
              <InlineEmptyState message="No attendance records yet." />
            ) : (
              <div className="divide-y divide-[var(--border)] border border-[var(--border)]">
                {latestAttendance.map((record) => (
                  <article key={record.id} className="bg-[var(--surface)] p-4 hover:bg-[var(--surface-soft)]">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-extrabold text-[var(--text)]">{formatDate(record.clockInAt)}</p>
                          <span className={`border px-2 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] ${getBadgeClass(record.status)}`}>{formatStatus(record.status)}</span>
                          {record.policyStatus ? (
                            <span className={`border px-2 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] ${getBadgeClass(record.policyStatus)}`}>{formatStatus(record.policyStatus)}</span>
                          ) : null}
                        </div>
                        <p className="mt-2 text-sm font-medium text-[var(--muted)]">
                          In {formatTime(record.clockInAt)} · Out {formatTime(record.clockOutAt)} · Worked {formatDuration(getDurationMinutes(record))}
                        </p>
                      </div>
                      <p className="text-xs font-semibold text-[var(--muted-soft)]">Late by {record.lateByMinutes ?? 0} min</p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </OperationalPanel>
        </section>
      </div>
    </DashboardShell>
  );
}

function ProfileMetric({ title, value, helper, icon }: { title: string; value: string; helper: string; icon: React.ReactNode }) {
  return (
    <article className="relative overflow-hidden border border-[var(--border-strong)] bg-[var(--surface)] px-5 py-4 shadow-[var(--shadow-xs)]">
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-[var(--accent)]" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--muted)]">{title}</p>
          <p className="mt-2 text-2xl font-black tracking-[-0.045em] tabular-nums text-[var(--text)]">{value}</p>
          <p className="mt-1 text-xs font-semibold text-[var(--muted)]">{helper}</p>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--accent)]">{icon}</div>
      </div>
    </article>
  );
}

function SummaryItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex gap-3 border-b border-[var(--border)] py-3 last:border-b-0">
      <div className="mt-0.5 text-[var(--accent)]">{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p>
        <p className="mt-1 break-words text-sm font-bold text-[var(--text)]">{value}</p>
      </div>
    </div>
  );
}

function SectionPanel({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-xs)]">
      <div className="border-b border-[var(--border)] bg-[var(--surface-soft)] px-6 py-5">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--accent)]">{eyebrow}</p>
        <h2 className="mt-2 text-lg font-black tracking-[-0.03em] text-[var(--text)]">{title}</h2>
        <p className="mt-1 text-sm font-medium leading-6 text-[var(--muted)]">{description}</p>
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

function OperationalPanel({ title, description, actionHref, actionLabel, children }: { title: string; description: string; actionHref: string; actionLabel: string; children: React.ReactNode }) {
  return (
    <section className="border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-xs)]">
      <div className="flex flex-col gap-4 border-b border-[var(--border)] bg-[var(--surface-soft)] px-6 py-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-black tracking-[-0.03em] text-[var(--text)]">{title}</h2>
          <p className="mt-1 text-sm font-medium text-[var(--muted)]">{description}</p>
        </div>
        <Link href={actionHref} className={actionLinkClass}>
          {actionLabel}
        </Link>
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

function DocumentRow({ document, downloadingDocumentId, onDownload }: { document: EmployeeDocument; downloadingDocumentId: string | null; onDownload: (document: EmployeeDocument) => void }) {
  return (
    <article className="flex flex-col gap-3 bg-[var(--surface)] p-4 transition hover:bg-[var(--surface-soft)] md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-extrabold text-[var(--text)]">{document.title}</p>
          <span className="border border-[var(--border-strong)] bg-[var(--surface-soft)] px-2 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--muted)]">{formatLeaveType(document.category)}</span>
          {document.visibleToEmployee ? (
            <span className="border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">Visible</span>
          ) : (
            <span className="border border-[var(--border-strong)] bg-[var(--surface-soft)] px-2 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--muted)]">Hidden</span>
          )}
        </div>
        <p className="mt-2 truncate text-sm font-medium text-[var(--muted)]">{document.originalName} · {formatFileSize(document.sizeBytes)}</p>
      </div>
      <Button
        variant="secondary"
        icon={downloadingDocumentId === document.id ? <Loader2 className="animate-spin" size={15} /> : <Download size={15} />}
        disabled={downloadingDocumentId === document.id}
        onClick={() => onDownload(document)}
      >
        Download
      </Button>
    </article>
  );
}

function InlineEmptyState({ message }: { message: string }) {
  return (
    <div className="border border-dashed border-[var(--border-strong)] bg-[var(--surface-soft)] px-5 py-10 text-center">
      <p className="text-sm font-bold text-[var(--muted)]">{message}</p>
    </div>
  );
}

function PerformanceTile({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <article className="border border-[var(--border)] bg-[var(--surface-soft)] p-4">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--muted)]">{label}</p>
      <p className="mt-3 text-xl font-black tracking-[-0.04em] text-[var(--text)]">{value}</p>
      <p className="mt-1 text-xs font-semibold text-[var(--muted)]">{helper}</p>
    </article>
  );
}
