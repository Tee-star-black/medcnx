'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Building2,
  CalendarClock,
  CalendarDays,
  FileText,
  Loader2,
  RefreshCw,
  ReceiptText,
  UsersRound,
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
  employmentStatus?: string;
  department?: {
    id: string;
    name: string;
  } | null;
};

type Department = {
  id: string;
  name: string;
  description?: string | null;
};

type LeaveRequest = {
  id: string;
  leaveType: string;
  status: string;
  startDate: string;
  endDate: string;
  employee?: Employee | null;
};

type EmployeeDocument = {
  id: string;
  category: string;
  title: string;
  visibleToEmployee: boolean;
  isConfidential: boolean;
  expiryDate?: string | null;
  createdAt: string;
};

type AttendanceRecord = {
  id: string;
  employeeId: string;
  clockInAt: string;
  clockOutAt?: string | null;
  status: string;
  employee?: Employee | null;
};

type AuditLog = {
  id: string;
  action: string;
  entity?: string;
  entityType?: string;
  message?: string | null;
  description?: string | null;
  createdAt: string;
  actor?: {
    firstName?: string;
    lastName?: string;
    email?: string;
  } | null;
};

function todayInputValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
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

function formatDateTime(value?: string | null) {
  if (!value) {
    return 'Not set';
  }

  return new Intl.DateTimeFormat('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function daysBetween(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const difference = end.getTime() - start.getTime();

  return Math.max(1, Math.floor(difference / (1000 * 60 * 60 * 24)) + 1);
}

function getDurationMinutes(record: AttendanceRecord) {
  if (!record.clockOutAt) {
    return 0;
  }

  const clockIn = new Date(record.clockInAt).getTime();
  const clockOut = new Date(record.clockOutAt).getTime();

  if (Number.isNaN(clockIn) || Number.isNaN(clockOut) || clockOut <= clockIn) {
    return 0;
  }

  return Math.floor((clockOut - clockIn) / (1000 * 60));
}

function formatDuration(minutes: number) {
  if (minutes <= 0) {
    return '0h 0m';
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return `${hours}h ${remainingMinutes}m`;
}

function employeeName(employee?: Employee | null) {
  if (!employee) {
    return 'Unknown employee';
  }

  return `${employee.firstName} ${employee.lastName}`;
}

function auditActorName(log: AuditLog) {
  if (!log.actor) {
    return 'System';
  }

  const fullName = [log.actor.firstName, log.actor.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();

  return fullName || log.actor.email || 'System';
}

export default function ReportsDashboardPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(
    [],
  );
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const [date, setDate] = useState(todayInputValue());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadReports() {
    setLoading(true);
    setError('');

    try {
      const [
        employeesResponse,
        departmentsResponse,
        leaveResponse,
        documentsResponse,
        attendanceResponse,
        auditResponse,
      ] = await Promise.all([
        api.get<Employee[]>('/employees'),
        api.get<Department[]>('/departments'),
        api.get<LeaveRequest[]>('/leave'),
        api.get<EmployeeDocument[]>('/employees/documents'),
        api.get<AttendanceRecord[]>('/attendance', {
          params: {
            date,
          },
        }),
        api.get<AuditLog[]>('/audit-logs'),
      ]);

      setEmployees(employeesResponse.data);
      setDepartments(departmentsResponse.data);
      setLeaveRequests(leaveResponse.data);
      setDocuments(documentsResponse.data);
      setAttendanceRecords(attendanceResponse.data);
      setAuditLogs(auditResponse.data);
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ?? 'Could not load reports.';

      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally {
      setLoading(false);
    }
  }

  const activeEmployees = employees.filter(
    (employee) => employee.employmentStatus === 'ACTIVE',
  );

  const pendingLeave = leaveRequests.filter(
    (request) => request.status === 'PENDING',
  );

  const approvedLeave = leaveRequests.filter(
    (request) => request.status === 'APPROVED',
  );

  const approvedLeaveDays = approvedLeave.reduce((total, request) => {
    return total + daysBetween(request.startDate, request.endDate);
  }, 0);

  const payslips = documents.filter((document) => document.category === 'PAYSLIP');

  const visiblePayslips = payslips.filter(
    (document) => document.visibleToEmployee,
  );

  const expiringDocuments = documents.filter((document) => {
    if (!document.expiryDate) {
      return false;
    }

    const expiryDate = new Date(document.expiryDate);
    const today = new Date();
    const nextThirtyDays = new Date();

    today.setHours(0, 0, 0, 0);
    nextThirtyDays.setDate(today.getDate() + 30);
    nextThirtyDays.setHours(23, 59, 59, 999);

    return expiryDate >= today && expiryDate <= nextThirtyDays;
  });

  const expiredDocuments = documents.filter((document) => {
    if (!document.expiryDate) {
      return false;
    }

    const expiryDate = new Date(document.expiryDate);
    const today = new Date();

    today.setHours(0, 0, 0, 0);

    return expiryDate < today;
  });

  const clockedIn = attendanceRecords.filter(
    (record) => record.status === 'CLOCKED_IN',
  );

  const clockedOut = attendanceRecords.filter(
    (record) => record.status === 'CLOCKED_OUT',
  );

  const attendanceMinutes = attendanceRecords.reduce((total, record) => {
    return total + getDurationMinutes(record);
  }, 0);

  const departmentBreakdown = useMemo(() => {
    return departments
      .map((department) => {
        const count = employees.filter(
          (employee) => employee.department?.id === department.id,
        ).length;

        return {
          id: department.id,
          name: department.name,
          count,
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [departments, employees]);

  const leaveByType = useMemo(() => {
    const grouped = leaveRequests.reduce<Record<string, number>>(
      (result, request) => {
        result[request.leaveType] = (result[request.leaveType] ?? 0) + 1;
        return result;
      },
      {},
    );

    return Object.entries(grouped)
      .map(([type, count]) => ({
        type,
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [leaveRequests]);

  const recentAuditLogs = auditLogs.slice(0, 6);

  return (
    <DashboardShell activePage="reports">
      <div className="space-y-8">
        <section className="flex flex-col gap-5 border-b border-black/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-sm uppercase tracking-[0.25em] text-gray-400">
              HR intelligence
            </p>

            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#111827]">
              Reports dashboard
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              A high-level overview of employees, leave, documents, payslips,
              attendance and system activity.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="border border-black/10 bg-white px-4 py-3 text-sm text-[#111827] outline-none transition focus:border-black"
            />

            <button
              type="button"
              onClick={loadReports}
              className="inline-flex items-center justify-center gap-2 border border-black bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-white hover:text-black"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </section>

        {error ? (
          <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="flex min-h-[520px] items-center justify-center border border-black/10 bg-white">
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <Loader2 className="animate-spin" size={18} />
              Loading reports...
            </div>
          </div>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <ReportCard
                title="Total employees"
                value={String(employees.length)}
                helper={`${activeEmployees.length} active employees`}
                icon={<UsersRound size={18} />}
              />

              <ReportCard
                title="Departments"
                value={String(departments.length)}
                helper="Organisational units"
                icon={<Building2 size={18} />}
              />

              <ReportCard
                title="Pending leave"
                value={String(pendingLeave.length)}
                helper={`${approvedLeaveDays} approved leave days`}
                icon={<CalendarDays size={18} />}
              />

              <ReportCard
                title="Attendance today"
                value={String(attendanceRecords.length)}
                helper={`${clockedIn.length} clocked in now`}
                icon={<CalendarClock size={18} />}
              />
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <ReportCard
                title="Documents"
                value={String(documents.length)}
                helper={`${expiringDocuments.length} expiring soon`}
                icon={<FileText size={18} />}
              />

              <ReportCard
                title="Expired docs"
                value={String(expiredDocuments.length)}
                helper="Requires HR attention"
                icon={<FileText size={18} />}
              />

              <ReportCard
                title="Payslips"
                value={String(payslips.length)}
                helper={`${visiblePayslips.length} visible to employees`}
                icon={<ReceiptText size={18} />}
              />

              <ReportCard
                title="Hours today"
                value={formatDuration(attendanceMinutes)}
                helper={`${clockedOut.length} completed shifts`}
                icon={<BarChart3 size={18} />}
              />
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <Panel
                title="Department breakdown"
                description="Employees grouped by department."
              >
                {departmentBreakdown.length === 0 ? (
                  <EmptyState message="No department data available." />
                ) : (
                  <div className="space-y-3">
                    {departmentBreakdown.map((department) => {
                      const percentage =
                        employees.length === 0
                          ? 0
                          : Math.round((department.count / employees.length) * 100);

                      return (
                        <div
                          key={department.id}
                          className="border border-black/10 bg-[#f8fafc] p-4"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="text-sm font-medium text-[#111827]">
                                {department.name}
                              </p>

                              <p className="mt-1 text-xs text-gray-500">
                                {department.count} employee
                                {department.count === 1 ? '' : 's'}
                              </p>
                            </div>

                            <span className="text-sm font-semibold text-gray-500">
                              {percentage}%
                            </span>
                          </div>

                          <div className="mt-3 h-2 border border-black/10 bg-white">
                            <div
                              className="h-full bg-[#111827]"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Panel>

              <Panel title="Leave by type" description="All leave requests grouped by category.">
                {leaveByType.length === 0 ? (
                  <EmptyState message="No leave data available." />
                ) : (
                  <div className="space-y-3">
                    {leaveByType.map((item) => {
                      const percentage =
                        leaveRequests.length === 0
                          ? 0
                          : Math.round((item.count / leaveRequests.length) * 100);

                      return (
                        <div
                          key={item.type}
                          className="border border-black/10 bg-[#f8fafc] p-4"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="text-sm font-medium text-[#111827]">
                                {item.type.replaceAll('_', ' ')}
                              </p>

                              <p className="mt-1 text-xs text-gray-500">
                                {item.count} request{item.count === 1 ? '' : 's'}
                              </p>
                            </div>

                            <span className="text-sm font-semibold text-gray-500">
                              {percentage}%
                            </span>
                          </div>

                          <div className="mt-3 h-2 border border-black/10 bg-white">
                            <div
                              className="h-full bg-[#111827]"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Panel>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1fr_420px]">
              <Panel
                title="Attendance snapshot"
                description={`Daily attendance activity for ${formatDate(date)}.`}
              >
                {attendanceRecords.length === 0 ? (
                  <EmptyState message="No attendance records for selected date." />
                ) : (
                  <div className="space-y-3">
                    {attendanceRecords.slice(0, 8).map((record) => (
                      <div
                        key={record.id}
                        className="flex flex-col gap-3 border border-black/10 bg-[#f8fafc] p-4 md:flex-row md:items-center md:justify-between"
                      >
                        <div>
                          <p className="text-sm font-medium text-[#111827]">
                            {employeeName(record.employee)}
                          </p>

                          <p className="mt-1 text-xs text-gray-500">
                            {record.employee?.employeeNumber ?? 'No employee number'} ·{' '}
                            {record.employee?.department?.name ?? 'No department'}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className="border border-black/10 bg-white px-3 py-2 text-gray-500">
                            In: {formatDateTime(record.clockInAt)}
                          </span>

                          <span className="border border-black/10 bg-white px-3 py-2 text-gray-500">
                            Out: {formatDateTime(record.clockOutAt)}
                          </span>

                          <span className="border border-black/10 bg-white px-3 py-2 text-gray-500">
                            {record.status.replaceAll('_', ' ')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>

              <Panel title="Recent activity" description="Latest audit log entries.">
                {recentAuditLogs.length === 0 ? (
                  <EmptyState message="No audit activity yet." />
                ) : (
                  <div className="space-y-3">
                    {recentAuditLogs.map((log) => (
                      <div
                        key={log.id}
                        className="border border-black/10 bg-[#f8fafc] p-4"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-black/10 bg-white text-gray-500">
                            <Activity size={15} />
                          </div>

                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[#111827]">
                              {log.action}{' '}
                              {log.entity ?? log.entityType ?? 'record'}
                            </p>

                            <p className="mt-1 text-xs leading-5 text-gray-500">
                              {log.message ?? log.description ?? 'System activity recorded.'}
                            </p>

                            <p className="mt-2 text-xs text-gray-400">
                              {auditActorName(log)} · {formatDateTime(log.createdAt)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            </section>
          </>
        )}
      </div>
    </DashboardShell>
  );
}

function ReportCard({
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

      <p className="mt-4 text-3xl font-semibold tracking-[-0.06em] text-[#111827]">
        {value}
      </p>

      <p className="mt-2 text-sm text-gray-500">{helper}</p>
    </div>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-black/10 bg-white">
      <div className="border-b border-black/10 px-6 py-5">
        <h2 className="text-lg font-semibold tracking-[-0.03em] text-[#111827]">
          {title}
        </h2>

        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>

      <div className="p-6">{children}</div>
    </section>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="border border-dashed border-black/15 bg-[#f8fafc] px-5 py-12 text-center">
      <BarChart3 size={30} className="mx-auto text-gray-300" />

      <p className="mt-4 text-sm font-medium text-[#111827]">{message}</p>
    </div>
  );
}