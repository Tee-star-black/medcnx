"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  History,
  Loader2,
  LogIn,
  LogOut,
  RefreshCw,
  Timer,
  FilePenLine,
  XCircle,
} from "lucide-react";
import { EmployeeShell } from "@/components/employee/EmployeeShell";
import { api } from "@/lib/api";

type AttendanceStatus = "CLOCKED_IN" | "CLOCKED_OUT" | "MISSED_CLOCK_OUT";

type PolicyStatus =
  | "COMPLIANT"
  | "CLOCKED_IN"
  | "LATE"
  | "SHORT_SHIFT"
  | "LATE_AND_SHORT_SHIFT"
  | "MISSED_CLOCK_OUT";

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

  scheduledClockInTime?: string;
  scheduledClockOutTime?: string;
  expectedMinutes?: number;
  workedMinutes?: number;
  lateByMinutes?: number;
  earlyClockOutByMinutes?: number;
  overtimeMinutes?: number;
  isLate?: boolean;
  isShortShift?: boolean;
  policyStatus?: PolicyStatus;
};

type AttendanceCorrection = {
  id: string;
  attendanceRecordId?: string | null;
  requestedDate: string;
  requestedClockInAt?: string | null;
  requestedClockOutAt?: string | null;
  reasonCategory: string;
  explanation: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  reviewComments?: string | null;
  createdAt: string;
};

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

export default function EmployeeAttendancePage() {
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [corrections, setCorrections] = useState<AttendanceCorrection[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showCorrectionForm, setShowCorrectionForm] = useState(false);
  const [correctionForm, setCorrectionForm] = useState({
    attendanceRecordId: "",
    requestedDate: new Date().toISOString().slice(0, 10),
    requestedClockInAt: "",
    requestedClockOutAt: "",
    reasonCategory: "INCORRECT_TIME",
    explanation: "",
  });

  useEffect(() => {
    loadAttendance();
  }, []);

  const isClockedIn =
    todayRecord?.status === "CLOCKED_IN" && !todayRecord.clockOutAt;

  const completedRecords = useMemo(() => {
    return records.filter((record) => record.status === "CLOCKED_OUT");
  }, [records]);

  const totalMinutes = useMemo(() => {
    return completedRecords.reduce((total, record) => {
      return total + getDurationMinutes(record);
    }, 0);
  }, [completedRecords]);

  const latestRecords = useMemo(() => {
    return records.slice(0, 10);
  }, [records]);

  async function loadAttendance() {
    setLoading(true);
    setError("");

    try {
      const [todayResponse, historyResponse, correctionsResponse] =
        await Promise.all([
          api.get<AttendanceRecord | null>("/attendance/me/today"),
          api.get<AttendanceRecord[]>("/attendance/me"),
          api.get<AttendanceCorrection[]>("/attendance/me/corrections"),
        ]);

      setTodayRecord(todayResponse.data);
      setRecords(historyResponse.data);
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

  function openCorrection(record?: AttendanceRecord) {
    setCorrectionForm({
      attendanceRecordId: record?.id ?? "",
      requestedDate: record
        ? new Date(record.clockInAt).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      requestedClockInAt: record?.clockInAt
        ? new Date(record.clockInAt).toISOString().slice(0, 16)
        : "",
      requestedClockOutAt: record?.clockOutAt
        ? new Date(record.clockOutAt).toISOString().slice(0, 16)
        : "",
      reasonCategory: "INCORRECT_TIME",
      explanation: "",
    });
    setShowCorrectionForm(true);
  }

  async function submitCorrection() {
    if (correctionForm.explanation.trim().length < 10) {
      setError(
        "Please provide a detailed explanation of at least 10 characters.",
      );
      return;
    }
    setActionLoading(true);
    setError("");
    try {
      await api.post("/attendance/me/corrections", {
        attendanceRecordId: correctionForm.attendanceRecordId || undefined,
        requestedDate: correctionForm.requestedDate,
        requestedClockInAt: correctionForm.requestedClockInAt
          ? new Date(correctionForm.requestedClockInAt).toISOString()
          : undefined,
        requestedClockOutAt: correctionForm.requestedClockOutAt
          ? new Date(correctionForm.requestedClockOutAt).toISOString()
          : undefined,
        reasonCategory: correctionForm.reasonCategory,
        explanation: correctionForm.explanation.trim(),
      });
      setShowCorrectionForm(false);
      setSuccess("Attendance correction submitted for review.");
      await loadAttendance();
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message ?? "Could not submit correction.",
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function cancelCorrection(id: string) {
    if (!window.confirm("Cancel this pending attendance correction?")) return;
    await api.patch(`/attendance/me/corrections/${id}/cancel`);
    setSuccess("Attendance correction cancelled.");
    await loadAttendance();
  }

  async function clockIn() {
    setActionLoading(true);
    setError("");
    setSuccess("");

    try {
      await api.post("/attendance/clock-in", {
        notes: notes.trim() || undefined,
      });

      setNotes("");
      setSuccess("You have clocked in successfully.");
      await loadAttendance();
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ?? "Could not clock in.";

      setError(Array.isArray(message) ? message.join(" ") : message);
    } finally {
      setActionLoading(false);
    }
  }

  async function clockOut() {
    setActionLoading(true);
    setError("");
    setSuccess("");

    try {
      await api.post("/attendance/clock-out", {
        notes: notes.trim() || undefined,
      });

      setNotes("");
      setSuccess("You have clocked out successfully.");
      await loadAttendance();
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ?? "Could not clock out.";

      setError(Array.isArray(message) ? message.join(" ") : message);
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <EmployeeShell>
      <div className="space-y-8">
        <section className="flex flex-col gap-5 border-b border-black/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-sm uppercase tracking-[0.25em] text-gray-400">
              Time and attendance
            </p>

            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#111827]">
              My attendance
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              Clock in, clock out and review your attendance against company
              policy.
            </p>
          </div>

          <button
            type="button"
            onClick={loadAttendance}
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

        {loading ? (
          <div className="flex min-h-[460px] items-center justify-center border border-black/10 bg-white">
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <Loader2 className="animate-spin" size={18} />
              Loading attendance...
            </div>
          </div>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-4">
              <StatCard
                title="Today status"
                value={
                  todayRecord ? formatStatus(todayRecord.status) : "No record"
                }
              />

              <StatCard
                title="Policy status"
                value={
                  todayRecord
                    ? formatPolicyStatus(todayRecord.policyStatus)
                    : "No record"
                }
              />

              <StatCard
                title="Worked today"
                value={
                  todayRecord
                    ? formatDuration(getDurationMinutes(todayRecord))
                    : "0h 0m"
                }
              />

              <StatCard
                title="Total recorded"
                value={formatDuration(totalMinutes)}
              />
            </section>

            <section className="grid gap-6 xl:grid-cols-[420px_1fr]">
              <div className="border border-black/10 bg-white">
                <div className="flex items-start justify-between gap-5 border-b border-black/10 px-6 py-5">
                  <div>
                    <h2 className="text-lg font-semibold tracking-[-0.03em]">
                      Today
                    </h2>

                    <p className="mt-1 text-sm text-gray-500">
                      {todayRecord
                        ? `Attendance record for ${formatDate(todayRecord.clockInAt)}`
                        : "No attendance record for today yet."}
                    </p>
                  </div>

                  <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-black/10 bg-[#111827] text-white">
                    <Clock size={18} />
                  </div>
                </div>

                <div className="space-y-5 p-6">
                  <div className="border border-black/10 bg-[#f8fafc] p-5">
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-gray-400">
                            Current status
                          </p>

                          <p className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-[#111827]">
                            {todayRecord
                              ? formatStatus(todayRecord.status)
                              : "Not clocked in"}
                          </p>
                        </div>

                        {todayRecord ? (
                          <span
                            className={`border px-3 py-2 text-xs font-medium ${getStatusClass(
                              todayRecord.status,
                            )}`}
                          >
                            {formatStatus(todayRecord.status)}
                          </span>
                        ) : (
                          <span className="border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-500">
                            NO RECORD
                          </span>
                        )}
                      </div>

                      {todayRecord ? (
                        <span
                          className={`inline-flex w-fit items-center gap-2 border px-3 py-2 text-xs font-medium ${getPolicyStatusClass(
                            todayRecord.policyStatus,
                          )}`}
                        >
                          {getPolicyIcon(todayRecord.policyStatus)}
                          {formatPolicyStatus(todayRecord.policyStatus)}
                        </span>
                      ) : null}
                    </div>

                    {todayRecord ? (
                      <div className="mt-5 grid gap-3 text-sm text-gray-500 sm:grid-cols-2">
                        <InfoBlock
                          label="Clock in"
                          value={formatDateTime(todayRecord.clockInAt)}
                        />

                        <InfoBlock
                          label="Clock out"
                          value={formatDateTime(todayRecord.clockOutAt)}
                        />

                        <InfoBlock
                          label="Scheduled"
                          value={`${todayRecord.scheduledClockInTime ?? "08:00"} - ${
                            todayRecord.scheduledClockOutTime ?? "17:00"
                          }`}
                        />

                        <InfoBlock
                          label="Expected hours"
                          value={formatDuration(
                            todayRecord.expectedMinutes ?? 0,
                          )}
                        />

                        <InfoBlock
                          label="Late by"
                          value={`${todayRecord.lateByMinutes ?? 0} min`}
                        />

                        <InfoBlock
                          label="Early out"
                          value={`${todayRecord.earlyClockOutByMinutes ?? 0} min`}
                        />
                      </div>
                    ) : null}
                  </div>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium">
                      Notes
                    </span>

                    <textarea
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      rows={4}
                      placeholder={
                        isClockedIn
                          ? "Optional clock-out note..."
                          : "Optional clock-in note..."
                      }
                      className="w-full resize-none border border-black/10 bg-[#f8fafc] px-4 py-3 text-sm outline-none transition focus:border-black"
                    />
                  </label>

                  {isClockedIn ? (
                    <button
                      type="button"
                      onClick={clockOut}
                      disabled={actionLoading}
                      className="inline-flex w-full items-center justify-center gap-2 border border-black bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {actionLoading ? (
                        <>
                          <Loader2 className="animate-spin" size={16} />
                          Clocking out...
                        </>
                      ) : (
                        <>
                          <LogOut size={16} />
                          Clock out
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={clockIn}
                      disabled={
                        actionLoading || todayRecord?.status === "CLOCKED_OUT"
                      }
                      className="inline-flex w-full items-center justify-center gap-2 border border-black bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {actionLoading ? (
                        <>
                          <Loader2 className="animate-spin" size={16} />
                          Clocking in...
                        </>
                      ) : (
                        <>
                          <LogIn size={16} />
                          Clock in
                        </>
                      )}
                    </button>
                  )}

                  {todayRecord?.status === "CLOCKED_OUT" ? (
                    <p className="text-sm leading-6 text-gray-500">
                      You have already completed today’s attendance record.
                    </p>
                  ) : null}
                </div>
              </div>

              <section className="border border-black/10 bg-white">
                <div className="flex items-start justify-between gap-4 border-b border-black/10 px-6 py-5">
                  <div>
                    <h2 className="text-lg font-semibold tracking-[-0.03em]">
                      Recent history
                    </h2>

                    <p className="mt-1 text-sm text-gray-500">
                      Your latest attendance records with policy feedback.
                    </p>
                  </div>

                  <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-black/10 bg-[#f8fafc] text-gray-500">
                    <History size={18} />
                  </div>
                </div>

                <div className="p-6">
                  {latestRecords.length === 0 ? (
                    <div className="border border-dashed border-black/15 bg-[#f8fafc] px-5 py-14 text-center">
                      <Timer size={32} className="mx-auto text-gray-300" />

                      <p className="mt-4 text-sm font-medium text-[#111827]">
                        No attendance history yet
                      </p>

                      <p className="mt-1 text-sm text-gray-500">
                        Your attendance records will appear here.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {latestRecords.map((record) => (
                        <article
                          key={record.id}
                          className="border border-black/10 bg-[#f8fafc] p-5"
                        >
                          <div className="flex flex-col gap-4">
                            <div className="flex flex-wrap items-center gap-3">
                              <CalendarClock
                                size={17}
                                className="text-gray-400"
                              />

                              <h3 className="text-sm font-semibold text-[#111827]">
                                {formatDate(record.clockInAt)}
                              </h3>

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

                            <div className="grid gap-3 text-sm text-gray-500 md:grid-cols-4">
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
                                value={formatDuration(
                                  getDurationMinutes(record),
                                )}
                              />

                              <InfoBlock
                                label="Late by"
                                value={`${record.lateByMinutes ?? 0} min`}
                              />
                            </div>

                            {record.notes ? (
                              <p className="border-t border-black/10 pt-4 text-sm leading-6 text-gray-500">
                                {record.notes}
                              </p>
                            ) : null}

                            <button
                              type="button"
                              onClick={() => openCorrection(record)}
                              className="inline-flex w-fit items-center gap-2 border border-black/15 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:border-black"
                            >
                              <FilePenLine size={14} /> Request correction
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </section>

            <section className="border border-black/10 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 px-6 py-5">
                <div>
                  <h2 className="text-lg font-semibold">
                    Attendance corrections
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Request and track corrections without silently changing
                    records.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openCorrection()}
                  className="inline-flex items-center gap-2 border border-black bg-black px-4 py-2 text-sm font-semibold text-white"
                >
                  <FilePenLine size={16} /> New correction
                </button>
              </div>

              {showCorrectionForm ? (
                <div className="grid gap-4 border-b border-black/10 bg-[#f8fafc] p-6 md:grid-cols-2">
                  <label className="text-sm">
                    Date
                    <input
                      type="date"
                      value={correctionForm.requestedDate}
                      onChange={(e) =>
                        setCorrectionForm({
                          ...correctionForm,
                          requestedDate: e.target.value,
                        })
                      }
                      className="mt-2 w-full border border-black/15 bg-white p-3"
                    />
                  </label>
                  <label className="text-sm">
                    Reason
                    <select
                      value={correctionForm.reasonCategory}
                      onChange={(e) =>
                        setCorrectionForm({
                          ...correctionForm,
                          reasonCategory: e.target.value,
                        })
                      }
                      className="mt-2 w-full border border-black/15 bg-white p-3"
                    >
                      <option value="FORGOT_CLOCK_IN">
                        Forgot to clock in
                      </option>
                      <option value="FORGOT_CLOCK_OUT">
                        Forgot to clock out
                      </option>
                      <option value="INCORRECT_TIME">Incorrect time</option>
                      <option value="TECHNICAL_PROBLEM">
                        Technical problem
                      </option>
                      <option value="APPROVED_OFF_SITE_WORK">
                        Approved off-site work
                      </option>
                      <option value="OTHER">Other</option>
                    </select>
                  </label>
                  <label className="text-sm">
                    Requested clock-in
                    <input
                      type="datetime-local"
                      value={correctionForm.requestedClockInAt}
                      onChange={(e) =>
                        setCorrectionForm({
                          ...correctionForm,
                          requestedClockInAt: e.target.value,
                        })
                      }
                      className="mt-2 w-full border border-black/15 bg-white p-3"
                    />
                  </label>
                  <label className="text-sm">
                    Requested clock-out
                    <input
                      type="datetime-local"
                      value={correctionForm.requestedClockOutAt}
                      onChange={(e) =>
                        setCorrectionForm({
                          ...correctionForm,
                          requestedClockOutAt: e.target.value,
                        })
                      }
                      className="mt-2 w-full border border-black/15 bg-white p-3"
                    />
                  </label>
                  <label className="text-sm md:col-span-2">
                    Detailed explanation
                    <textarea
                      rows={4}
                      value={correctionForm.explanation}
                      onChange={(e) =>
                        setCorrectionForm({
                          ...correctionForm,
                          explanation: e.target.value,
                        })
                      }
                      className="mt-2 w-full border border-black/15 bg-white p-3"
                    />
                  </label>
                  <div className="flex gap-3 md:col-span-2">
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => void submitCorrection()}
                      className="border border-black bg-black px-5 py-3 text-sm font-semibold text-white"
                    >
                      Submit request
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCorrectionForm(false)}
                      className="border border-black/15 bg-white px-5 py-3 text-sm font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="divide-y divide-black/10">
                {corrections.length === 0 ? (
                  <p className="p-6 text-sm text-gray-500">
                    No correction requests submitted.
                  </p>
                ) : (
                  corrections.map((correction) => (
                    <div
                      key={correction.id}
                      className="flex flex-col justify-between gap-3 p-5 md:flex-row md:items-center"
                    >
                      <div>
                        <p className="font-semibold">
                          {correction.reasonCategory.replaceAll("_", " ")}
                        </p>
                        <p className="mt-1 text-sm text-gray-500">
                          {formatDate(correction.requestedDate)} ·{" "}
                          {correction.explanation}
                        </p>
                        {correction.reviewComments ? (
                          <p className="mt-1 text-sm text-gray-500">
                            Review: {correction.reviewComments}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="border border-black/15 px-3 py-2 text-xs font-semibold">
                          {correction.status}
                        </span>
                        {correction.status === "PENDING" ? (
                          <button
                            type="button"
                            onClick={() => void cancelCorrection(correction.id)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-red-700"
                          >
                            <XCircle size={14} /> Cancel
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </>
        )}
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

      <p className="mt-3 text-xl font-semibold tracking-[-0.05em] text-[#111827]">
        {value}
      </p>
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
