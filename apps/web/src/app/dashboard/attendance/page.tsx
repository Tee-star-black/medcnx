"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  RefreshCw,
  Search,
  Timer,
  UserCheck,
  UserX,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { api } from "@/lib/api";

type AttendanceStatus = "CLOCKED_IN" | "CLOCKED_OUT" | "MISSED_CLOCK_OUT";

type PolicyStatus =
  | "COMPLIANT"
  | "CLOCKED_IN"
  | "LATE"
  | "SHORT_SHIFT"
  | "LATE_AND_SHORT_SHIFT"
  | "MISSED_CLOCK_OUT";

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

type AttendanceRecord = {
  id: string;
  organisationId: string;
  employeeId: string;
  clockInAt: string;
  clockOutAt?: string | null;
  status: AttendanceStatus;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: Employee | null;

  scheduledClockInTime?: string;
  scheduledClockOutTime?: string;
  expectedMinutes?: number;
  workedMinutes?: number;
  lateByMinutes?: number;
  earlyClockOutByMinutes?: number;
  isLate?: boolean;
  isShortShift?: boolean;
  policyStatus?: PolicyStatus;
  overtimeMinutes?: number;
};

type AttendanceSummary = {
  missingClockIns: number;
  onLeave: number;
  pendingCorrections: number;
  totalWorkedMinutes: number;
  totalOvertimeMinutes: number;
  compliancePercentage: number;
};

type AttendanceCorrection = {
  id: string;
  reasonCategory: string;
  explanation: string;
  requestedDate: string;
  requestedClockInAt?: string | null;
  requestedClockOutAt?: string | null;
  status: string;
  employee: Employee;
};

function todayInputValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-ZA", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(value));
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-ZA", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatTime(value?: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getDurationMinutes(record: AttendanceRecord) {
  if (typeof record.workedMinutes === "number") {
    return record.workedMinutes;
  }

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

function formatDuration(minutes?: number | null) {
  if (!minutes || minutes <= 0) {
    return "0h 0m";
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return `${hours}h ${remainingMinutes}m`;
}

function employeeName(record: AttendanceRecord) {
  if (!record.employee) {
    return "Unassigned employee";
  }

  return `${record.employee.firstName} ${record.employee.lastName}`;
}

function getStatusClass(status: AttendanceStatus) {
  if (status === "CLOCKED_IN") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "CLOCKED_OUT") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}

function getPolicyStatusClass(status?: PolicyStatus) {
  if (status === "COMPLIANT") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "CLOCKED_IN") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (status === "LATE" || status === "SHORT_SHIFT") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (status === "LATE_AND_SHORT_SHIFT" || status === "MISSED_CLOCK_OUT") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-gray-200 bg-gray-50 text-gray-600";
}

function getPolicyIcon(status?: PolicyStatus) {
  if (status === "COMPLIANT") {
    return <CheckCircle2 size={14} />;
  }

  if (status === "CLOCKED_IN") {
    return <Clock size={14} />;
  }

  return <AlertTriangle size={14} />;
}

function formatStatus(status: AttendanceStatus) {
  return status.replaceAll("_", " ");
}

function formatPolicyStatus(status?: PolicyStatus) {
  if (!status) {
    return "NOT ANALYSED";
  }

  return status.replaceAll("_", " ");
}

function downloadCsv(records: AttendanceRecord[]) {
  const headers = [
    "Employee",
    "Employee Number",
    "Department",
    "Job Title",
    "Date",
    "Clock In",
    "Clock Out",
    "Scheduled Clock In",
    "Scheduled Clock Out",
    "Status",
    "Policy Status",
    "Late By Minutes",
    "Early Clock Out By Minutes",
    "Expected Minutes",
    "Worked Minutes",
    "Worked Duration",
    "Notes",
  ];

  const rows = records.map((record) => {
    const durationMinutes = getDurationMinutes(record);

    return [
      employeeName(record),
      record.employee?.employeeNumber ?? "",
      record.employee?.department?.name ?? "",
      record.employee?.jobTitle ?? "",
      formatDate(record.clockInAt),
      formatTime(record.clockInAt),
      record.clockOutAt ? formatTime(record.clockOutAt) : "",
      record.scheduledClockInTime ?? "",
      record.scheduledClockOutTime ?? "",
      record.status,
      record.policyStatus ?? "",
      String(record.lateByMinutes ?? 0),
      String(record.earlyClockOutByMinutes ?? 0),
      String(record.expectedMinutes ?? 0),
      String(durationMinutes),
      formatDuration(durationMinutes),
      record.notes?.replace(/\n/g, " ") ?? "",
    ];
  });

  const csvContent = [headers, ...rows]
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell).replace(/"/g, '""');
          return `"${value}"`;
        })
        .join(","),
    )
    .join("\n");

  const blob = new Blob([csvContent], {
    type: "text/csv;charset=utf-8;",
  });

  const url = window.URL.createObjectURL(blob);
  const link = window.document.createElement("a");

  link.href = url;
  link.download = `attendance-${todayInputValue()}.csv`;
  window.document.body.appendChild(link);
  link.click();

  link.remove();
  window.URL.revokeObjectURL(url);
}

export default function DashboardAttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [corrections, setCorrections] = useState<AttendanceCorrection[]>([]);
  const [date, setDate] = useState(todayInputValue());
  const [employeeId, setEmployeeId] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [policyStatus, setPolicyStatus] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadPageData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadPageData() {
    setLoading(true);
    setError("");

    try {
      const [
        attendanceResponse,
        employeesResponse,
        summaryResponse,
        correctionsResponse,
      ] = await Promise.all([
        api.get<AttendanceRecord[]>("/attendance", {
          params: {
            date: date || undefined,
            employeeId: employeeId === "ALL" ? undefined : employeeId,
            status: status === "ALL" ? undefined : status,
          },
        }),
        api.get<Employee[]>("/employees"),
        api.get<AttendanceSummary>("/attendance/summary", { params: { date } }),
        api.get<AttendanceCorrection[]>("/attendance/corrections", {
          params: { status: "PENDING" },
        }),
      ]);

      setRecords(attendanceResponse.data);
      setEmployees(employeesResponse.data);
      setSummary(summaryResponse.data);
      setCorrections(correctionsResponse.data);
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ??
        "Could not load attendance records.";

      setError(Array.isArray(message) ? message.join(" ") : message);
    } finally {
      setLoading(false);
    }
  }

  async function exportServerReport() {
    setError("");
    try {
      const response = await api.get("/attendance/report/export", {
        params: { dateFrom: date, dateTo: date },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `medcnx-attendance-report-${date}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message ??
          "Could not export attendance report.",
      );
    }
  }

  async function reviewCorrection(id: string, decision: "approve" | "reject") {
    const comments = window.prompt(
      decision === "approve"
        ? "Optional approval comments:"
        : "Enter the reason for rejecting this correction:",
    );
    if (decision === "reject" && !comments?.trim()) return;
    try {
      await api.post(`/attendance/corrections/${id}/${decision}`, {
        comments: comments?.trim() || undefined,
      });
      await loadPageData();
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message ?? "Could not review correction.",
      );
    }
  }

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();

    return records.filter((record) => {
      const matchesPolicy =
        policyStatus === "ALL" || record.policyStatus === policyStatus;

      if (!matchesPolicy) {
        return false;
      }

      if (!query) {
        return true;
      }

      return (
        employeeName(record).toLowerCase().includes(query) ||
        record.employee?.employeeNumber.toLowerCase().includes(query) ||
        record.employee?.department?.name.toLowerCase().includes(query) ||
        record.employee?.jobTitle?.toLowerCase().includes(query) ||
        record.notes?.toLowerCase().includes(query) ||
        record.policyStatus?.toLowerCase().includes(query)
      );
    });
  }, [records, search, policyStatus]);

  const clockedInCount = filteredRecords.filter(
    (record) => record.status === "CLOCKED_IN",
  ).length;

  const clockedOutCount = filteredRecords.filter(
    (record) => record.status === "CLOCKED_OUT",
  ).length;

  const missingClockOutCount = filteredRecords.filter(
    (record) => record.status === "MISSED_CLOCK_OUT",
  ).length;

  const lateCount = filteredRecords.filter((record) => record.isLate).length;

  const shortShiftCount = filteredRecords.filter(
    (record) => record.isShortShift,
  ).length;

  const compliantCount = filteredRecords.filter(
    (record) => record.policyStatus === "COMPLIANT",
  ).length;

  const totalMinutes = filteredRecords.reduce((total, record) => {
    return total + getDurationMinutes(record);
  }, 0);

  return (
    <DashboardShell activePage="attendance">
      <div className="space-y-8">
        <section className="flex flex-col gap-5 border-b border-black/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-sm uppercase tracking-[0.25em] text-gray-400">
              Time and attendance
            </p>

            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#111827]">
              Attendance dashboard
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              Monitor clock-ins, clock-outs, late arrivals, short shifts and
              attendance compliance.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void exportServerReport()}
              className="inline-flex items-center justify-center gap-2 border border-black/10 bg-white px-5 py-3 text-sm font-medium text-gray-600 transition hover:border-black hover:text-black"
            >
              <Download size={16} />
              Export CSV
            </button>

            <button
              type="button"
              onClick={loadPageData}
              className="inline-flex items-center justify-center gap-2 border border-black bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-white hover:text-black"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Records"
            value={String(filteredRecords.length)}
            helper={`${compliantCount} compliant`}
            icon={<CalendarClock size={18} />}
          />

          <StatCard
            title="Clocked in"
            value={String(clockedInCount)}
            helper="Currently active"
            icon={<UserCheck size={18} />}
          />

          <StatCard
            title="Late arrivals"
            value={String(lateCount)}
            helper="Beyond threshold"
            icon={<AlertTriangle size={18} />}
          />

          <StatCard
            title="Total hours"
            value={formatDuration(totalMinutes)}
            helper={`${clockedOutCount} completed shifts`}
            icon={<Timer size={18} />}
          />
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <MiniStat
            label="Clocked out"
            value={String(clockedOutCount)}
            icon={<Clock size={16} />}
          />

          <MiniStat
            label="Short shifts"
            value={String(shortShiftCount)}
            icon={<AlertTriangle size={16} />}
          />

          <MiniStat
            label="Missing clock-ins"
            value={String(summary?.missingClockIns ?? 0)}
            icon={<UserX size={16} />}
          />
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <MiniStat
            label="On approved leave"
            value={String(summary?.onLeave ?? 0)}
            icon={<UserCheck size={16} />}
          />
          <MiniStat
            label="Pending corrections"
            value={String(summary?.pendingCorrections ?? corrections.length)}
            icon={<AlertTriangle size={16} />}
          />
          <MiniStat
            label="Overtime"
            value={formatDuration(summary?.totalOvertimeMinutes ?? 0)}
            icon={<Timer size={16} />}
          />
          <MiniStat
            label="Compliance"
            value={`${summary?.compliancePercentage ?? 100}%`}
            icon={<CheckCircle2 size={16} />}
          />
        </section>

        <section className="border border-black/10 bg-white">
          <div className="grid gap-4 border-b border-black/10 px-6 py-5 xl:grid-cols-[1fr_auto]">
            <div>
              <h2 className="text-lg font-semibold tracking-[-0.03em]">
                Attendance records
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                {filteredRecords.length} record
                {filteredRecords.length === 1 ? "" : "s"} shown.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-5">
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="border border-black/10 bg-[#f8fafc] px-4 py-3 text-sm outline-none transition focus:border-black"
              />

              <select
                value={employeeId}
                onChange={(event) => setEmployeeId(event.target.value)}
                className="border border-black/10 bg-[#f8fafc] px-4 py-3 text-sm outline-none transition focus:border-black"
              >
                <option value="ALL">All employees</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.firstName} {employee.lastName}
                  </option>
                ))}
              </select>

              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="border border-black/10 bg-[#f8fafc] px-4 py-3 text-sm outline-none transition focus:border-black"
              >
                <option value="ALL">All statuses</option>
                <option value="CLOCKED_IN">Clocked in</option>
                <option value="CLOCKED_OUT">Clocked out</option>
                <option value="MISSED_CLOCK_OUT">Missing clock-out</option>
              </select>

              <select
                value={policyStatus}
                onChange={(event) => setPolicyStatus(event.target.value)}
                className="border border-black/10 bg-[#f8fafc] px-4 py-3 text-sm outline-none transition focus:border-black"
              >
                <option value="ALL">All policy</option>
                <option value="COMPLIANT">Compliant</option>
                <option value="CLOCKED_IN">Clocked in</option>
                <option value="LATE">Late</option>
                <option value="SHORT_SHIFT">Short shift</option>
                <option value="LATE_AND_SHORT_SHIFT">Late + short shift</option>
                <option value="MISSED_CLOCK_OUT">Missing clock-out</option>
              </select>

              <button
                type="button"
                onClick={loadPageData}
                className="border border-black bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-white hover:text-black"
              >
                Apply
              </button>
            </div>
          </div>

          <div className="border-b border-black/10 px-6 py-5">
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search employee, employee number, department, policy status, notes..."
                className="w-full border border-black/10 bg-[#f8fafc] py-3 pl-11 pr-4 text-sm outline-none transition focus:border-black"
              />
            </div>
          </div>

          {error ? (
            <div className="mx-6 mt-5 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="p-6">
            {loading ? (
              <div className="flex min-h-[420px] items-center justify-center">
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <Loader2 className="animate-spin" size={18} />
                  Loading attendance records...
                </div>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="border border-dashed border-black/15 bg-[#f8fafc] px-5 py-14 text-center">
                <CalendarClock size={32} className="mx-auto text-gray-300" />

                <p className="mt-4 text-sm font-medium text-[#111827]">
                  No attendance records found
                </p>

                <p className="mt-1 text-sm text-gray-500">
                  Try changing the date or filters.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRecords.map((record) => (
                  <article
                    key={record.id}
                    className="border border-black/10 bg-[#f8fafc] p-5"
                  >
                    <div className="flex flex-col gap-5">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center border border-black/10 bg-white text-gray-500">
                              <CalendarClock size={17} />
                            </div>

                            <div>
                              <h3 className="text-sm font-semibold text-[#111827]">
                                {employeeName(record)}
                              </h3>

                              <p className="mt-1 text-xs text-gray-500">
                                {record.employee?.employeeNumber ??
                                  "No employee number"}{" "}
                                ·{" "}
                                {record.employee?.jobTitle ??
                                  "No job title captured"}
                              </p>
                            </div>

                            <span
                              className={`border px-2 py-1 text-[11px] font-medium ${getStatusClass(
                                record.status,
                              )}`}
                            >
                              {formatStatus(record.status)}
                            </span>

                            <span
                              className={`inline-flex items-center gap-1 border px-2 py-1 text-[11px] font-medium ${getPolicyStatusClass(
                                record.policyStatus,
                              )}`}
                            >
                              {getPolicyIcon(record.policyStatus)}
                              {formatPolicyStatus(record.policyStatus)}
                            </span>
                          </div>

                          <div className="mt-4 grid gap-3 text-sm text-gray-500 md:grid-cols-4">
                            <InfoBlock
                              label="Date"
                              value={formatDate(record.clockInAt)}
                            />

                            <InfoBlock
                              label="Clock in"
                              value={formatTime(record.clockInAt)}
                            />

                            <InfoBlock
                              label="Clock out"
                              value={formatTime(record.clockOutAt)}
                            />

                            <InfoBlock
                              label="Worked"
                              value={formatDuration(getDurationMinutes(record))}
                            />
                          </div>

                          <div className="mt-3 grid gap-3 text-sm text-gray-500 md:grid-cols-4">
                            <InfoBlock
                              label="Expected"
                              value={formatDuration(
                                record.expectedMinutes ?? 0,
                              )}
                            />

                            <InfoBlock
                              label="Scheduled"
                              value={`${record.scheduledClockInTime ?? "08:00"} - ${
                                record.scheduledClockOutTime ?? "17:00"
                              }`}
                            />

                            <InfoBlock
                              label="Late by"
                              value={`${record.lateByMinutes ?? 0} min`}
                            />

                            <InfoBlock
                              label="Early out"
                              value={`${record.earlyClockOutByMinutes ?? 0} min`}
                            />
                          </div>

                          <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-400">
                            {record.employee?.department ? (
                              <span>{record.employee.department.name}</span>
                            ) : null}

                            {record.employee?.email ? (
                              <span>{record.employee.email}</span>
                            ) : null}

                            <span>
                              Created {formatDateTime(record.createdAt)}
                            </span>
                          </div>

                          {record.notes ? (
                            <p className="mt-4 border-t border-black/10 pt-4 text-sm leading-6 text-gray-500">
                              {record.notes}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="border border-black/10 bg-white">
          <div className="border-b border-black/10 px-6 py-5">
            <h2 className="text-lg font-semibold">
              Pending correction requests
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Approvals update attendance transactionally and retain the
              original values.
            </p>
          </div>
          <div className="divide-y divide-black/10">
            {corrections.length === 0 ? (
              <p className="p-6 text-sm text-gray-500">
                No pending corrections.
              </p>
            ) : (
              corrections.map((correction) => (
                <div
                  key={correction.id}
                  className="flex flex-col justify-between gap-4 p-5 lg:flex-row lg:items-center"
                >
                  <div>
                    <p className="font-semibold">
                      {correction.employee.firstName}{" "}
                      {correction.employee.lastName}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      {correction.reasonCategory.replaceAll("_", " ")} ·{" "}
                      {formatDate(correction.requestedDate)}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      {correction.explanation}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void reviewCorrection(correction.id, "approve")
                      }
                      className="border border-emerald-700 bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void reviewCorrection(correction.id, "reject")
                      }
                      className="border border-red-700 bg-white px-4 py-2 text-sm font-semibold text-red-700"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
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

function MiniStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border border-black/10 bg-white p-4">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-gray-400">
          {label}
        </p>

        <p className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[#111827]">
          {value}
        </p>
      </div>

      <div className="text-gray-400">{icon}</div>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-black/10 bg-white p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-gray-400">
        {label}
      </p>

      <p className="mt-2 text-sm font-medium text-[#111827]">{value}</p>
    </div>
  );
}
