"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  ShieldCheck,
  XCircle,
  UserRound,
  CalendarClock,
  ReceiptText,
  Bell,
} from "lucide-react";
import { EmployeeShell } from "@/components/employee/EmployeeShell";
import { api } from "@/lib/api";
import type { AuthUser } from "@/types/auth";

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
  department?: {
    id: string;
    name: string;
  } | null;
};

type LeaveRequest = {
  id: string;
  leaveType: string;
  status: string;
  startDate: string;
  endDate: string;
  totalDays: string;
  reason?: string | null;
  rejectionNote?: string | null;
  createdAt: string;
  approvedAt?: string | null;
};

const leaveTypeLabels: Record<string, string> = {
  ANNUAL: "Annual leave",
  SICK: "Sick leave",
  FAMILY_RESPONSIBILITY: "Family responsibility",
  MATERNITY: "Maternity leave",
  PATERNITY: "Paternity leave",
  STUDY: "Study leave",
  UNPAID: "Unpaid leave",
  OTHER: "Other leave",
};

const leaveLimits: Record<string, number> = {
  ANNUAL: 15,
  SICK: 30,
  FAMILY_RESPONSIBILITY: 3,
  MATERNITY: 120,
  PATERNITY: 10,
  STUDY: 5,
  UNPAID: 30,
  OTHER: 5,
};

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

function formatLeaveType(type: string) {
  return leaveTypeLabels[type] ?? type.replaceAll("_", " ");
}

function statusClass(status: string) {
  if (status === "APPROVED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "REJECTED") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (status === "CANCELLED") {
    return "border-gray-200 bg-gray-50 text-gray-500";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}

function statusIcon(status: string) {
  if (status === "APPROVED") {
    return <CheckCircle2 size={14} />;
  }

  if (status === "REJECTED") {
    return <XCircle size={14} />;
  }

  return <Clock size={14} />;
}

function getUsedLeaveDays(leaveRequests: LeaveRequest[], leaveType: string) {
  return leaveRequests
    .filter(
      (request) =>
        request.leaveType === leaveType && request.status === "APPROVED",
    )
    .reduce((total, request) => total + Number(request.totalDays), 0);
}

function getPendingLeaveDays(leaveRequests: LeaveRequest[], leaveType: string) {
  return leaveRequests
    .filter(
      (request) =>
        request.leaveType === leaveType && request.status === "PENDING",
    )
    .reduce((total, request) => total + Number(request.totalDays), 0);
}

export default function EmployeePortalPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadEmployeePortal();
  }, []);

  const latestLeaveRequests = useMemo(() => {
    return leaveRequests.slice(0, 5);
  }, [leaveRequests]);

  const pendingLeaveCount = useMemo(() => {
    return leaveRequests.filter((request) => request.status === "PENDING")
      .length;
  }, [leaveRequests]);

  const approvedLeaveCount = useMemo(() => {
    return leaveRequests.filter((request) => request.status === "APPROVED")
      .length;
  }, [leaveRequests]);

  const rejectedLeaveCount = useMemo(() => {
    return leaveRequests.filter((request) => request.status === "REJECTED")
      .length;
  }, [leaveRequests]);

  const annualUsed = useMemo(() => {
    return getUsedLeaveDays(leaveRequests, "ANNUAL");
  }, [leaveRequests]);

  const sickUsed = useMemo(() => {
    return getUsedLeaveDays(leaveRequests, "SICK");
  }, [leaveRequests]);

  const annualPending = useMemo(() => {
    return getPendingLeaveDays(leaveRequests, "ANNUAL");
  }, [leaveRequests]);

  async function loadEmployeePortal() {
    setLoading(true);
    setError("");

    try {
      const [meResponse, employeeResponse, leaveResponse] = await Promise.all([
        api.get<AuthUser>("/auth/me"),
        api.get<Employee>("/employees/me"),
        api.get<LeaveRequest[]>("/leave/my-requests"),
      ]);

      setUser(meResponse.data);
      setEmployee(employeeResponse.data);
      setLeaveRequests(leaveResponse.data);
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ??
        "Could not load employee portal.";

      setError(Array.isArray(message) ? message.join(" ") : message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <EmployeeShell>
        <div className="flex min-h-[70vh] items-center justify-center">
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <Loader2 className="animate-spin" size={18} />
            Loading employee portal...
          </div>
        </div>
      </EmployeeShell>
    );
  }

  if (error) {
    return (
      <EmployeeShell>
        <div className="border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      </EmployeeShell>
    );
  }

  return (
    <EmployeeShell>
      <div className="space-y-7">
        <section className="employee-lounge overflow-hidden border border-[#203d48]">
          <div className="grid min-h-[310px] lg:grid-cols-[1.15fr_0.85fr]">
            <div className="employee-lounge-welcome relative flex flex-col justify-between px-7 py-8 sm:px-9 sm:py-10">
              <div>
                <div className="mb-8 flex items-center gap-3">
                  <span className="h-px w-9 bg-[#c5a779]" />
                  <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-[#d9c6a6]">
                    Professional staff lounge
                  </p>
                </div>

                <h1 className="max-w-2xl text-4xl font-semibold tracking-[-0.055em] text-white sm:text-5xl">
                  Welcome back, {employee?.firstName ?? user?.firstName}
                </h1>

                <p className="mt-4 max-w-xl text-base leading-7 text-[#cfdbdf]">
                  A private, calm workspace for your day, your records and the
                  services you use most—without the noise of the HR office.
                </p>
              </div>

              <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 border-t border-white/15 pt-5 text-sm text-[#d8e2e5]">
                <span>
                  <strong className="text-white">
                    {employee?.jobTitle || "Team member"}
                  </strong>
                </span>
                <span>
                  {employee?.department?.name || "Department not assigned"}
                </span>
                <span>Employee {employee?.employeeNumber || "profile"}</span>
              </div>
            </div>

            <div className="employee-lounge-service employee-lounge-ambience relative border-t border-white/10 p-6 lg:border-l lg:border-t-0 lg:p-7">
              <div className="mb-5">
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#a9bcc2]">
                  Lounge services
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-[-0.035em] text-white">
                  What would you like to do?
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/employee/leave/new"
                  className="employee-lounge-action employee-lounge-action-primary"
                >
                  <CalendarDays size={16} />
                  Request leave
                </Link>

                <Link
                  href="/employee/documents"
                  className="employee-lounge-action"
                >
                  <FileText size={16} />
                  View documents
                </Link>
                <Link
                  href="/employee/profile"
                  className="employee-lounge-action"
                >
                  <UserRound size={16} />
                  My profile
                </Link>
                <Link
                  href="/employee/attendance"
                  className="employee-lounge-action"
                >
                  <CalendarClock size={16} />
                  Attendance
                </Link>
                <Link
                  href="/employee/payslips"
                  className="employee-lounge-action"
                >
                  <ReceiptText size={16} />
                  Payslips
                </Link>
                <Link
                  href="/employee/notifications"
                  className="employee-lounge-action"
                >
                  <Bell size={16} />
                  Notifications
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Pending leave"
            value={String(pendingLeaveCount)}
            helper="Awaiting HR action"
          />

          <StatCard
            title="Approved leave"
            value={String(approvedLeaveCount)}
            helper="Approved requests"
          />

          <StatCard
            title="Rejected leave"
            value={String(rejectedLeaveCount)}
            helper="Rejected requests"
          />

          <StatCard
            title="Annual used"
            value={`${annualUsed}/${leaveLimits.ANNUAL}`}
            helper={
              annualPending > 0
                ? `${annualPending} day${annualPending === 1 ? "" : "s"} pending`
                : "Approved annual days"
            }
          />
        </section>

        <section className="border border-[var(--border)] bg-[var(--surface)] p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent)]">
                My analytics
              </p>
              <h2 className="mt-2 text-xl font-black tracking-[-0.035em]">
                Leave availability
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                A simple view of approved usage against your standard balances.
              </p>
            </div>
            <Link
              href="/employee/leave"
              className="text-sm font-bold text-[var(--accent)]"
            >
              View leave history
            </Link>
          </div>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <LeaveAnalyticsRow
              label="Annual leave"
              used={annualUsed}
              allowance={leaveLimits.ANNUAL}
              pending={annualPending}
            />
            <LeaveAnalyticsRow
              label="Sick leave"
              used={sickUsed}
              allowance={leaveLimits.SICK}
              pending={getPendingLeaveDays(leaveRequests, "SICK")}
            />
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="border border-black/10 bg-white">
            <div className="border-b border-black/10 px-6 py-5">
              <h2 className="text-lg font-semibold tracking-[-0.03em]">
                My profile
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Your employee information on record.
              </p>
            </div>

            <div className="space-y-4 p-6">
              <ProfileRow
                label="Employee number"
                value={employee?.employeeNumber}
              />

              <ProfileRow
                label="Full name"
                value={
                  employee
                    ? `${employee.firstName} ${employee.lastName}`
                    : undefined
                }
              />

              <ProfileRow label="Email" value={employee?.email} />
              <ProfileRow label="Phone" value={employee?.phone} />
              <ProfileRow label="Job title" value={employee?.jobTitle} />
              <ProfileRow
                label="Department"
                value={employee?.department?.name}
              />
              <ProfileRow
                label="Employment status"
                value={employee?.employmentStatus}
              />
              <ProfileRow
                label="Start date"
                value={formatDate(employee?.startDate)}
              />
            </div>
          </div>

          <div className="border border-black/10 bg-white">
            <div className="flex items-center justify-between border-b border-black/10 px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold tracking-[-0.03em]">
                  Recent leave activity
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Your latest leave requests and statuses.
                </p>
              </div>

              <Link
                href="/employee/leave/new"
                className="hidden border border-black/10 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-black hover:text-black sm:inline-flex"
              >
                New request
              </Link>
            </div>

            <div className="p-6">
              {latestLeaveRequests.length === 0 ? (
                <div className="border border-dashed border-black/15 bg-[#f8fafc] px-5 py-12 text-center">
                  <ShieldCheck size={32} className="mx-auto text-gray-300" />

                  <p className="mt-4 text-sm font-medium text-[#111827]">
                    No leave requests yet
                  </p>

                  <p className="mt-1 text-sm text-gray-500">
                    Submit your first leave request when you need time off.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {latestLeaveRequests.map((request) => (
                    <article
                      key={request.id}
                      className="border border-black/10 bg-[#f8fafc] p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-[#111827]">
                            {formatLeaveType(request.leaveType)}
                          </p>

                          <p className="mt-1 text-xs text-gray-500">
                            {formatDate(request.startDate)} —{" "}
                            {formatDate(request.endDate)} ·{" "}
                            {Number(request.totalDays)} day
                            {Number(request.totalDays) === 1 ? "" : "s"}
                          </p>

                          {request.reason ? (
                            <p className="mt-2 text-sm leading-6 text-gray-500">
                              {request.reason}
                            </p>
                          ) : null}

                          {request.rejectionNote ? (
                            <p className="mt-2 border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                              {request.rejectionNote}
                            </p>
                          ) : null}
                        </div>

                        <span
                          className={`inline-flex items-center gap-2 border px-3 py-1 text-xs font-medium ${statusClass(
                            request.status,
                          )}`}
                        >
                          {statusIcon(request.status)}
                          {request.status}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="border border-black/10 bg-white">
          <div className="border-b border-black/10 px-6 py-5">
            <h2 className="text-lg font-semibold tracking-[-0.03em]">
              Leave balances
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Estimated balances based on approved leave in this workspace.
            </p>
          </div>

          <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-4">
            <BalanceCard
              title="Annual leave"
              used={annualUsed}
              pending={getPendingLeaveDays(leaveRequests, "ANNUAL")}
              limit={leaveLimits.ANNUAL}
            />

            <BalanceCard
              title="Sick leave"
              used={sickUsed}
              pending={getPendingLeaveDays(leaveRequests, "SICK")}
              limit={leaveLimits.SICK}
            />

            <BalanceCard
              title="Family responsibility"
              used={getUsedLeaveDays(leaveRequests, "FAMILY_RESPONSIBILITY")}
              pending={getPendingLeaveDays(
                leaveRequests,
                "FAMILY_RESPONSIBILITY",
              )}
              limit={leaveLimits.FAMILY_RESPONSIBILITY}
            />

            <BalanceCard
              title="Study leave"
              used={getUsedLeaveDays(leaveRequests, "STUDY")}
              pending={getPendingLeaveDays(leaveRequests, "STUDY")}
              limit={leaveLimits.STUDY}
            />
          </div>
        </section>
      </div>
    </EmployeeShell>
  );
}

function LeaveAnalyticsRow({
  label,
  used,
  allowance,
  pending,
}: {
  label: string;
  used: number;
  allowance: number;
  pending: number;
}) {
  const usedPercentage = Math.min(100, (used / allowance) * 100);
  return (
    <article className="border border-[var(--border)] bg-[var(--surface-soft)] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black">{label}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {Math.max(0, allowance - used)} days estimated remaining
          </p>
        </div>
        <p className="text-2xl font-black tracking-[-0.04em]">
          {used}/{allowance}
        </p>
      </div>
      <div className="mt-5 h-2 bg-[var(--surface)]">
        <div
          className="h-full bg-[var(--accent)]"
          style={{ width: `${usedPercentage}%` }}
        />
      </div>
      <div className="mt-3 flex justify-between text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
        <span>{Math.round(usedPercentage)}% used</span>
        <span>{pending ? `${pending} pending` : "No pending days"}</span>
      </div>
    </article>
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

      <p className="mt-3 text-3xl font-semibold tracking-[-0.06em] text-[#111827]">
        {value}
      </p>

      <p className="mt-2 text-xs text-gray-500">{helper}</p>
    </div>
  );
}

function ProfileRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-black/5 pb-3 last:border-b-0 last:pb-0">
      <span className="text-sm text-gray-500">{label}</span>

      <span className="text-right text-sm font-medium text-[#111827]">
        {value || "Not set"}
      </span>
    </div>
  );
}

function BalanceCard({
  title,
  used,
  pending,
  limit,
}: {
  title: string;
  used: number;
  pending: number;
  limit: number;
}) {
  const remaining = Math.max(limit - used - pending, 0);
  const usedPercentage = Math.min((used / limit) * 100, 100);
  const pendingPercentage = Math.min(((used + pending) / limit) * 100, 100);

  return (
    <div className="border border-black/10 bg-[#f8fafc] p-5">
      <p className="text-sm font-semibold text-[#111827]">{title}</p>

      <div className="mt-4 h-2 bg-white">
        <div
          className="h-2 bg-gray-300"
          style={{
            width: `${pendingPercentage}%`,
          }}
        />

        <div
          className="-mt-2 h-2 bg-[#111827]"
          style={{
            width: `${usedPercentage}%`,
          }}
        />
      </div>

      <div className="mt-4 space-y-2 text-xs text-gray-500">
        <div className="flex items-center justify-between">
          <span>{used} approved used</span>
          <span>{remaining} available</span>
        </div>

        {pending > 0 ? (
          <div className="flex items-center justify-between text-amber-700">
            <span>{pending} pending</span>
            <span>Awaiting HR</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
