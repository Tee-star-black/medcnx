"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Crown,
  FileText,
  FolderKanban,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  Target,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { api } from "@/lib/api";
import type { AuthUser } from "@/types/auth";

type Department = {
  id: string;
  name: string;
  description?: string | null;
  _count: {
    employees: number;
  };
};

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
  employee: {
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
};

type PerformanceDashboard = {
  activeCycles: number;
  pendingReviews: number;
  overdueReviews: number;
  goalsDueSoon: number;
  overdueGoals: number;
  developmentPlans: number;
};

type PayrollRun = {
  id: string;
  title: string;
  periodMonth: number;
  periodYear: number;
  status: string;
  employeeCount: number;
  totalGrossPay: number;
  totalNetPay: number;
  createdAt: string;
};

const payrollStatusLabels: Record<string, string> = {
  DRAFT: "In preparation",
  CALCULATED: "Calculated",
  AI_AUDITED: "Audit complete",
  HR_REVIEWED: "HR reviewed",
  FINANCE_REVIEWED: "Finance reviewed",
  PENDING_CEO_APPROVAL: "Your approval required",
  CEO_APPROVED: "Executive approved",
  PAYMENT_PROCESSING: "Payment processing",
  PAID: "Paid",
  COMPLETED: "Completed",
  FINALISED: "Finalised",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
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

function formatCategory(category: string) {
  return category
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

function daysUntil(value?: string | null) {
  if (!value) {
    return null;
  }

  const today = new Date();
  const target = new Date(value);

  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  return Math.ceil(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
}

function isExpiringSoon(expiryDate?: string | null) {
  const days = daysUntil(expiryDate);

  if (days === null) {
    return false;
  }

  return days >= 0 && days <= 30;
}

function isExpired(expiryDate?: string | null) {
  const days = daysUntil(expiryDate);

  if (days === null) {
    return false;
  }

  return days < 0;
}

function initials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export default function DashboardPage() {
  const router = useRouter();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [performance, setPerformance] = useState<PerformanceDashboard | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  const activeEmployees = useMemo(() => {
    return employees.filter(
      (employee) => employee.employmentStatus === "ACTIVE",
    ).length;
  }, [employees]);

  const recentEmployees = useMemo(() => {
    return employees.slice(0, 5);
  }, [employees]);

  const documentStats = useMemo(() => {
    const expiringSoon = documents.filter((document) =>
      isExpiringSoon(document.expiryDate),
    );

    const expired = documents.filter((document) =>
      isExpired(document.expiryDate),
    );

    const confidential = documents.filter(
      (document) => document.isConfidential,
    );

    const employeeVisible = documents.filter(
      (document) => document.visibleToEmployee,
    );

    return {
      total: documents.length,
      expiringSoon,
      expired,
      confidential,
      employeeVisible,
    };
  }, [documents]);

  const complianceAlerts = useMemo(() => {
    return [...documentStats.expired, ...documentStats.expiringSoon]
      .sort((a, b) => {
        const aDays = daysUntil(a.expiryDate) ?? 9999;
        const bDays = daysUntil(b.expiryDate) ?? 9999;

        return aDays - bDays;
      })
      .slice(0, 5);
  }, [documentStats.expired, documentStats.expiringSoon]);

  useEffect(() => {
    async function loadDashboard() {
      const token = localStorage.getItem("medcnx_access_token");

      if (!token) {
        router.push("/");
        return;
      }

      try {
        const meResponse = await api.get<AuthUser>("/auth/me");

        if (meResponse.data.roles.includes("EMPLOYEE")) {
          localStorage.setItem("medcnx_user", JSON.stringify(meResponse.data));
          router.replace("/employee");
          return;
        }

        const isExecutive =
          meResponse.data.roles.includes("PAYROLL_APPROVER") ||
          meResponse.data.permissions.includes("payroll:approve");

        if (isExecutive) {
          setUser(meResponse.data);
          localStorage.setItem("medcnx_user", JSON.stringify(meResponse.data));
          const payrollResponse = await api.get<PayrollRun[]>("/payroll/runs");
          setPayrollRuns(payrollResponse.data);
          return;
        }

        if (
          !meResponse.data.permissions.includes("employees:read") &&
          meResponse.data.permissions.includes("payroll:read")
        ) {
          localStorage.setItem("medcnx_user", JSON.stringify(meResponse.data));
          router.replace("/dashboard/payroll");
          return;
        }

        const [employeesResponse, departmentsResponse] = await Promise.all([
          api.get<Employee[]>("/employees"),
          api.get<Department[]>("/departments"),
        ]);

        setUser(meResponse.data);
        setEmployees(employeesResponse.data);
        setDepartments(departmentsResponse.data);

        if (meResponse.data.permissions.includes("performance:read")) {
          try {
            const performanceResponse = await api.get<PerformanceDashboard>(
              "/performance/dashboard",
            );
            setPerformance(performanceResponse.data);
          } catch {
            setPerformance(null);
          }
        }

        try {
          const documentsResponse = await api.get<EmployeeDocument[]>(
            "/employees/documents",
          );

          setDocuments(documentsResponse.data);
        } catch {
          setDocuments([]);
        }
      } catch {
        localStorage.removeItem("medcnx_access_token");
        localStorage.removeItem("medcnx_user");
        router.push("/");
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [router]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] text-sm text-[var(--muted)]">
        <div className="flex items-center gap-3 border border-[var(--border)] bg-[var(--surface)] px-5 py-4">
          <Loader2 className="animate-spin" size={18} />
          Loading dashboard...
        </div>
      </main>
    );
  }

  const isExecutive =
    user?.roles.includes("PAYROLL_APPROVER") ||
    user?.permissions.includes("payroll:approve");

  if (isExecutive) {
    return (
      <DashboardShell user={user} activePage="dashboard">
        <ExecutiveDashboard
          user={user}
          payrollRuns={payrollRuns}
          onNavigate={(path) => router.push(path)}
        />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell user={user} activePage="dashboard">
      <div className="space-y-8">
        <section className="hr-office-hero relative overflow-hidden border border-[var(--border)] bg-[var(--surface)]">
          <div className="relative grid gap-8 p-6 lg:grid-cols-[1fr_auto] lg:p-8">
            <div>
              <p className="mb-3 text-xs uppercase tracking-[0.32em] text-[var(--muted-soft)]">
                People operations
              </p>

              <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.07em] text-[var(--text)] md:text-5xl">
                Good day, {user?.firstName ?? "HR team"}
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                Your HR office for people records, workforce activity,
                compliance, documents and the actions that keep the organisation
                moving.
              </p>
            </div>

            <div className="self-end border border-[var(--border)] bg-[var(--surface)] px-5 py-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted-soft)]">
                HR workspace
              </p>

              <p className="mt-1 text-sm font-semibold text-[var(--text)]">
                {user?.roles.includes("HR_MANAGER")
                  ? "Human Resources"
                  : "Organisation administration"}
              </p>

              <p className="mt-1 text-xs text-[var(--muted)]">
                {user?.organisation?.name ?? "MedCNX workspace"}
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Total employees"
            value={String(employees.length)}
            helper="All employee records"
            icon={<Users size={19} />}
          />

          <MetricCard
            title="Active employees"
            value={String(activeEmployees)}
            helper="Currently active staff"
            icon={<Activity size={19} />}
          />

          <MetricCard
            title="Departments"
            value={String(departments.length)}
            helper="Organisation units"
            icon={<FolderKanban size={19} />}
          />

          <MetricCard
            title="Documents"
            value={String(documentStats.total)}
            helper={`${documentStats.employeeVisible.length} visible to employees`}
            icon={<FileText size={19} />}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <WorkforceAnalytics
            departments={departments}
            employeeTotal={employees.length}
          />
          <ComplianceAnalytics
            total={documentStats.total}
            current={
              documentStats.total -
              documentStats.expired.length -
              documentStats.expiringSoon.length
            }
            expiring={documentStats.expiringSoon.length}
            expired={documentStats.expired.length}
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <ActionCard
            title="Document control"
            value={String(documentStats.total)}
            helper="Open the central HR document dashboard"
            icon={<FileText size={20} />}
            onClick={() => router.push("/dashboard/documents")}
          />

          <AlertCard
            tone="warning"
            title="Expiring soon"
            value={String(documentStats.expiringSoon.length)}
            helper="Documents expiring in the next 30 days"
            icon={<CalendarClock size={20} />}
            onClick={() => router.push("/dashboard/documents?filter=expiring")}
          />

          <AlertCard
            tone="danger"
            title="Expired documents"
            value={String(documentStats.expired.length)}
            helper="Documents that require HR attention"
            icon={<AlertTriangle size={20} />}
            onClick={() => router.push("/dashboard/documents?filter=expired")}
          />

          {performance ? (
            <ActionCard
              title="Performance actions"
              value={String(
                performance.pendingReviews + performance.overdueGoals,
              )}
              helper={`${performance.overdueReviews} overdue reviews · ${performance.goalsDueSoon} goals due soon`}
              icon={<Target size={20} />}
              onClick={() => router.push("/dashboard/performance")}
            />
          ) : null}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Panel
            title="Recent employees"
            description="Latest employee records in the organisation."
            actionLabel="View all"
            onAction={() => router.push("/dashboard/employees")}
          >
            {recentEmployees.length === 0 ? (
              <EmptyState
                icon={<Users size={22} />}
                title="No employees yet"
                description="Create your first employee to populate the dashboard."
              />
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {recentEmployees.map((employee) => (
                  <button
                    key={employee.id}
                    type="button"
                    onClick={() =>
                      router.push(`/dashboard/employees/${employee.id}`)
                    }
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-[var(--surface-soft)]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[var(--border)] bg-[var(--surface-soft)] text-xs font-semibold text-[var(--text)]">
                        {initials(employee.firstName, employee.lastName)}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--text)]">
                          {employee.firstName} {employee.lastName}
                        </p>

                        <p className="mt-1 truncate text-xs text-[var(--muted)]">
                          {employee.employeeNumber} ·{" "}
                          {employee.jobTitle ?? "No job title"}
                        </p>
                      </div>
                    </div>

                    <StatusBadge status={employee.employmentStatus} />
                  </button>
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title="Document alerts"
            description="Expired and upcoming document expiries."
            actionLabel="View all"
            onAction={() => router.push("/dashboard/documents")}
          >
            {complianceAlerts.length === 0 ? (
              <EmptyState
                icon={<ShieldCheck size={22} />}
                title="No document alerts"
                description="Expiring documents will appear here."
              />
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {complianceAlerts.map((document) => {
                  const days = daysUntil(document.expiryDate);
                  const expired = isExpired(document.expiryDate);

                  return (
                    <button
                      key={document.id}
                      type="button"
                      onClick={() =>
                        router.push(
                          `/dashboard/employees/${document.employee.id}`,
                        )
                      }
                      className="w-full px-5 py-4 text-left transition hover:bg-[var(--surface-soft)]"
                    >
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span
                          className={`border px-2 py-1 text-[11px] font-medium ${
                            expired
                              ? "border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger-text)]"
                              : "border-[var(--warning-border)] bg-[var(--warning-bg)] text-[var(--warning-text)]"
                          }`}
                        >
                          {expired
                            ? `Expired ${Math.abs(days ?? 0)} day${
                                Math.abs(days ?? 0) === 1 ? "" : "s"
                              } ago`
                            : `Expires in ${days} day${days === 1 ? "" : "s"}`}
                        </span>

                        <span className="border border-[var(--border)] bg-[var(--surface-soft)] px-2 py-1 text-[11px] font-medium text-[var(--muted)]">
                          {formatCategory(document.category)}
                        </span>
                      </div>

                      <p className="text-sm font-semibold text-[var(--text)]">
                        {document.title}
                      </p>

                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {document.employee.firstName}{" "}
                        {document.employee.lastName} ·{" "}
                        {document.employee.employeeNumber}
                      </p>

                      <p className="mt-2 text-xs text-[var(--muted-soft)]">
                        Expiry date: {formatDate(document.expiryDate)}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </Panel>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <Panel
            title="Department load"
            description="Employee distribution by department."
          >
            {departments.length === 0 ? (
              <EmptyState
                icon={<Building2 size={22} />}
                title="No departments yet"
                description="Create departments to organise your workforce."
              />
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {departments.map((department) => (
                  <button
                    key={department.id}
                    type="button"
                    onClick={() =>
                      router.push(`/dashboard/departments/${department.id}`)
                    }
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-[var(--surface-soft)]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--text)]">
                        {department.name}
                      </p>

                      <p className="mt-1 truncate text-xs text-[var(--muted)]">
                        {department.description ?? "No description"}
                      </p>
                    </div>

                    <span className="shrink-0 border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-1 text-xs font-medium text-[var(--text)]">
                      {department._count.employees} employee
                      {department._count.employees === 1 ? "" : "s"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Panel>

          <section className="border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--muted)]">
                <ShieldCheck size={20} />
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold tracking-[-0.03em] text-[var(--text)]">
                  Current permissions
                </h2>

                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                  Your active role permissions are loaded from the backend and
                  enforced by the API.
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  {user?.permissions?.length ? (
                    user.permissions.map((permission) => (
                      <span
                        key={permission}
                        className="border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-1 text-xs font-medium text-[var(--muted)]"
                      >
                        {permission}
                      </span>
                    ))
                  ) : (
                    <span className="border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-1 text-xs font-medium text-[var(--muted)]">
                      No permissions loaded
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <QuickLink
            title="Employees"
            description="Manage workforce records"
            icon={<Users size={18} />}
            onClick={() => router.push("/dashboard/employees")}
          />

          <QuickLink
            title="Documents"
            description="Upload and generate HR documents"
            icon={<FileText size={18} />}
            onClick={() => router.push("/dashboard/documents")}
          />

          <QuickLink
            title="Payroll"
            description="Run payroll and manage payslips"
            icon={<WalletCards size={18} />}
            onClick={() => router.push("/dashboard/payroll")}
          />

          {user?.permissions.includes("performance:read") ? (
            <QuickLink
              title="Performance"
              description="Reviews, goals and development"
              icon={<Target size={18} />}
              onClick={() => router.push("/dashboard/performance")}
            />
          ) : null}
        </section>
      </div>
    </DashboardShell>
  );
}

function ExecutiveDashboard({
  user,
  payrollRuns,
  onNavigate,
}: {
  user: AuthUser | null;
  payrollRuns: PayrollRun[];
  onNavigate: (path: string) => void;
}) {
  const pending = payrollRuns.filter(
    (run) => run.status === "PENDING_CEO_APPROVAL",
  );
  const approved = payrollRuns.filter((run) =>
    [
      "CEO_APPROVED",
      "PAYMENT_PROCESSING",
      "PAID",
      "COMPLETED",
      "FINALISED",
    ].includes(run.status),
  );
  const currentRun = pending[0] ?? payrollRuns[0];
  const latestRuns = payrollRuns.slice(0, 5);

  return (
    <div className="executive-portal space-y-6">
      <section className="executive-office-hero relative overflow-hidden border border-[#b9b4a8] bg-[#f5f2eb]">
        <div className="relative grid min-h-[330px] gap-8 p-7 sm:p-9 lg:grid-cols-[1fr_0.62fr] lg:p-11">
          <div className="flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="h-px w-10 bg-[#9b7b4f]" />
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#725936]">
                  Executive office
                </p>
              </div>
              <h1 className="mt-7 max-w-3xl text-4xl font-semibold tracking-[-0.06em] text-[#182a30] sm:text-5xl">
                Good day, {user?.firstName ?? "Executive"}
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-[#53656a]">
                A private decision space for approvals, organisational assurance
                and the workforce commitments that require executive attention.
              </p>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 border-t border-[#c9c2b4] pt-5 text-sm font-semibold text-[#53656a]">
              <span>{user?.organisation?.name ?? "MedCNX organisation"}</span>
              <span>Executive access</span>
              <span>Protected approval authority</span>
            </div>
          </div>

          <aside className="self-end border border-[#a79d8b] bg-white/90 p-5 shadow-[0_18px_45px_rgba(64,53,38,0.12)]">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#725936]">
              Decision brief
            </p>
            <div className="mt-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-4xl font-semibold tracking-[-0.06em] text-[#182a30]">
                  {pending.length}
                </p>
                <p className="mt-1 text-sm font-bold text-[#53656a]">
                  Payroll approval{pending.length === 1 ? "" : "s"} waiting
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center bg-[#183b45] text-white">
                <Crown size={20} />
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                onNavigate(
                  pending[0]
                    ? `/dashboard/payroll/runs/${pending[0].id}`
                    : "/dashboard/payroll/runs",
                )
              }
              className="mt-5 flex h-11 w-full items-center justify-between bg-[#183b45] px-4 text-sm font-bold text-white"
            >
              {pending.length
                ? "Review next decision"
                : "Open payroll register"}
              <ArrowRight size={16} />
            </button>
          </aside>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ExecutiveMetric
          label="Awaiting approval"
          value={String(pending.length)}
          helper="Requires executive decision"
          icon={<LockKeyhole size={18} />}
          urgent={pending.length > 0}
        />
        <ExecutiveMetric
          label="Current net payroll"
          value={formatCurrency(currentRun?.totalNetPay ?? 0)}
          helper={currentRun?.title ?? "No payroll period available"}
          icon={<CircleDollarSign size={18} />}
        />
        <ExecutiveMetric
          label="Workforce covered"
          value={String(currentRun?.employeeCount ?? 0)}
          helper="Employees in the current run"
          icon={<Users size={18} />}
        />
        <ExecutiveMetric
          label="Approved runs"
          value={String(approved.length)}
          helper="Executive decisions recorded"
          icon={<BadgeCheck size={18} />}
        />
      </section>

      <PayrollTrendAnalytics payrollRuns={payrollRuns} />

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="border border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-end justify-between border-b border-[var(--border)] p-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent)]">
                Executive ledger
              </p>
              <h2 className="mt-2 text-xl font-black tracking-[-0.035em]">
                Recent payroll decisions
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("/dashboard/payroll/runs")}
              className="text-sm font-bold text-[var(--accent)]"
            >
              View register
            </button>
          </div>
          {latestRuns.length ? (
            <div className="divide-y divide-[var(--border)]">
              {latestRuns.map((run) => (
                <button
                  key={run.id}
                  type="button"
                  onClick={() =>
                    onNavigate(`/dashboard/payroll/runs/${run.id}`)
                  }
                  className="grid w-full gap-3 px-5 py-4 text-left transition hover:bg-[var(--surface-soft)] sm:grid-cols-[1fr_auto_auto] sm:items-center"
                >
                  <div>
                    <p className="text-sm font-black">{run.title}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {run.employeeCount} employees ·{" "}
                      {formatCurrency(run.totalNetPay)} net
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-[var(--muted)]">
                    {payrollStatusLabels[run.status] ??
                      formatCategory(run.status)}
                  </span>
                  <ArrowRight size={15} className="text-[var(--muted)]" />
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<WalletCards size={22} />}
              title="No payroll runs available"
              description="Submitted payroll decisions will appear here."
            />
          )}
        </div>

        <div className="space-y-4">
          <section className="border border-[#b9b4a8] bg-[#f5f2eb] p-6 text-[#182a30]">
            <TrendingUp size={20} className="text-[#725936]" />
            <h2 className="mt-4 text-lg font-black">Executive focus</h2>
            <p className="mt-2 text-sm leading-6 text-[#53656a]">
              Review only decisions that have completed HR, finance and payroll
              intelligence checks. Operational preparation remains separated
              from your final approval authority.
            </p>
          </section>
          <button
            type="button"
            onClick={() => onNavigate("/dashboard/documents/generated")}
            className="flex w-full items-center justify-between border border-[var(--border)] bg-[var(--surface)] p-5 text-left"
          >
            <span className="flex items-center gap-3">
              <FileText size={19} className="text-[var(--accent)]" />
              <span>
                <span className="block text-sm font-black">
                  Document approvals
                </span>
                <span className="mt-1 block text-xs text-[var(--muted)]">
                  Review protected documents requiring executive authority
                </span>
              </span>
            </span>
            <ArrowRight size={16} />
          </button>
          <div className="flex items-center gap-3 border border-emerald-300 bg-emerald-50 p-5 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
            <CheckCircle2 size={20} />
            <div>
              <p className="text-sm font-black">Approval controls active</p>
              <p className="mt-1 text-xs">
                OTP verification and audit logging are enforced.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function PayrollTrendAnalytics({ payrollRuns }: { payrollRuns: PayrollRun[] }) {
  const runs = [...payrollRuns].slice(0, 6).reverse();
  const maximum = Math.max(...runs.map((run) => Number(run.totalNetPay)), 1);

  return (
    <section className="border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent)]">
            Executive analytics
          </p>
          <h2 className="mt-2 text-xl font-black tracking-[-0.035em]">
            Net payroll movement
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            A six-run view of the organisation&apos;s net payroll commitment.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-[var(--muted)]">
          <span className="h-2.5 w-2.5 bg-[#9b7b4f]" />
          Net payroll
        </div>
      </div>
      {runs.length ? (
        <div className="mt-8 grid h-56 grid-cols-3 items-end gap-3 border-b border-l border-[var(--border)] px-4 pt-4 sm:grid-cols-6">
          {runs.map((run) => {
            const height = Math.max(
              12,
              (Number(run.totalNetPay) / maximum) * 100,
            );
            return (
              <div
                key={run.id}
                className="flex h-full min-w-0 flex-col justify-end text-center"
              >
                <p className="mb-2 truncate text-[10px] font-black text-[var(--muted)]">
                  {formatCurrency(run.totalNetPay)}
                </p>
                <div
                  className="mx-auto w-full max-w-14 bg-[#9b7b4f] transition-[height]"
                  style={{ height: `${height}%` }}
                  title={`${run.title}: ${formatCurrency(run.totalNetPay)}`}
                />
                <p className="mt-2 truncate text-[10px] font-bold text-[var(--muted)]">
                  {run.periodMonth}/{String(run.periodYear).slice(-2)}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-8 border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted)]">
          Payroll trend data will appear after the first calculation.
        </p>
      )}
    </section>
  );
}

function WorkforceAnalytics({
  departments,
  employeeTotal,
}: {
  departments: Department[];
  employeeTotal: number;
}) {
  const topDepartments = [...departments]
    .sort((a, b) => b._count.employees - a._count.employees)
    .slice(0, 6);

  return (
    <section className="border border-[var(--border)] bg-[var(--surface)] p-6">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent)]">
        Workforce analytics
      </p>
      <h2 className="mt-2 text-xl font-black tracking-[-0.035em]">
        People by department
      </h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Current distribution across the largest organisation units.
      </p>
      <div className="mt-6 space-y-4">
        {topDepartments.map((department) => {
          const share = employeeTotal
            ? (department._count.employees / employeeTotal) * 100
            : 0;
          return (
            <div key={department.id}>
              <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                <span className="truncate font-bold">{department.name}</span>
                <span className="font-black text-[var(--muted)]">
                  {department._count.employees} · {Math.round(share)}%
                </span>
              </div>
              <div className="h-2 bg-[var(--surface-soft)]">
                <div
                  className="h-full bg-[var(--accent)]"
                  style={{ width: `${share}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ComplianceAnalytics({
  total,
  current,
  expiring,
  expired,
}: {
  total: number;
  current: number;
  expiring: number;
  expired: number;
}) {
  const safeTotal = Math.max(total, 1);
  const currentRate = Math.max(0, Math.round((current / safeTotal) * 100));

  return (
    <section className="border border-[var(--border)] bg-[var(--surface)] p-6">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent)]">
        Compliance analytics
      </p>
      <div className="mt-5 flex items-end justify-between border-b border-[var(--border)] pb-5">
        <div>
          <p className="text-5xl font-semibold tracking-[-0.07em]">
            {currentRate}%
          </p>
          <p className="mt-2 text-sm font-bold text-[var(--muted)]">
            Documents currently compliant
          </p>
        </div>
        <ShieldCheck size={28} className="text-[var(--accent)]" />
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2">
        {[
          ["Current", Math.max(current, 0), "bg-emerald-500"],
          ["Expiring", expiring, "bg-amber-500"],
          ["Expired", expired, "bg-red-500"],
        ].map(([label, value, color]) => (
          <div key={String(label)} className="bg-[var(--surface-soft)] p-3">
            <span className={`block h-1 w-8 ${color}`} />
            <p className="mt-3 text-2xl font-black">{String(value)}</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
              {String(label)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ExecutiveMetric({
  label,
  value,
  helper,
  icon,
  urgent = false,
}: {
  label: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
  urgent?: boolean;
}) {
  return (
    <article
      className={`border p-5 ${
        urgent
          ? "border-[#9b7b4f] bg-[#fbf7ed]"
          : "border-[var(--border)] bg-[var(--surface)]"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--muted)]">
          {label}
        </p>
        <span className={urgent ? "text-[#725936]" : "text-[var(--accent)]"}>
          {icon}
        </span>
      </div>
      <p className="mt-5 text-3xl font-semibold tracking-[-0.055em]">{value}</p>
      <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{helper}</p>
    </article>
  );
}

function MetricCard({
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
    <div className="group border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:border-[var(--border-strong)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted-soft)]">
            {title}
          </p>

          <p className="mt-4 text-3xl font-semibold tracking-[-0.06em] text-[var(--text)]">
            {value}
          </p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--muted)] transition group-hover:border-[var(--text)] group-hover:text-[var(--text)]">
          {icon}
        </div>
      </div>

      <p className="mt-4 text-sm text-[var(--muted)]">{helper}</p>
    </div>
  );
}

function ActionCard({
  title,
  value,
  helper,
  icon,
  onClick,
}: {
  title: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group border border-[var(--border)] bg-[var(--surface)] p-5 text-left transition hover:border-[var(--text)] hover:bg-[var(--surface-soft)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-11 w-11 items-center justify-center border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--muted)] transition group-hover:border-[var(--text)] group-hover:text-[var(--text)]">
          {icon}
        </div>

        <ArrowRight
          size={17}
          className="text-[var(--muted-soft)] transition group-hover:translate-x-1 group-hover:text-[var(--text)]"
        />
      </div>

      <p className="mt-5 text-sm font-medium text-[var(--muted)]">{title}</p>

      <p className="mt-2 text-4xl font-semibold tracking-[-0.07em] text-[var(--text)]">
        {value}
      </p>

      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{helper}</p>
    </button>
  );
}

function AlertCard({
  tone,
  title,
  value,
  helper,
  icon,
  onClick,
}: {
  tone: "warning" | "danger";
  title: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  const styles =
    tone === "danger"
      ? {
          border: "border-[var(--danger-border)]",
          bg: "bg-[var(--danger-bg)]",
          text: "text-[var(--danger-text)]",
        }
      : {
          border: "border-[var(--warning-border)]",
          bg: "bg-[var(--warning-bg)]",
          text: "text-[var(--warning-text)]",
        };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group border p-5 text-left transition hover:opacity-90 ${styles.border} ${styles.bg}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div
          className={`flex h-11 w-11 items-center justify-center border bg-[var(--surface)] ${styles.border} ${styles.text}`}
        >
          {icon}
        </div>

        <ArrowRight
          size={17}
          className={`transition group-hover:translate-x-1 ${styles.text}`}
        />
      </div>

      <p className={`mt-5 text-sm font-medium ${styles.text}`}>{title}</p>

      <p
        className={`mt-2 text-4xl font-semibold tracking-[-0.07em] ${styles.text}`}
      >
        {value}
      </p>

      <p className={`mt-2 text-sm leading-6 ${styles.text}`}>{helper}</p>
    </button>
  );
}

function Panel({
  title,
  description,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.03em] text-[var(--text)]">
            {title}
          </h2>

          <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
        </div>

        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="shrink-0 border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>

      {children}
    </section>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="px-5 py-12 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--muted)]">
        {icon}
      </div>

      <p className="text-sm font-semibold text-[var(--text)]">{title}</p>

      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
        {description}
      </p>
    </div>
  );
}

function QuickLink({
  title,
  description,
  icon,
  onClick,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center justify-between gap-4 border border-[var(--border)] bg-[var(--surface)] p-5 text-left transition hover:border-[var(--text)] hover:bg-[var(--surface-soft)]"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--muted)] transition group-hover:border-[var(--text)] group-hover:text-[var(--text)]">
          {icon}
        </div>

        <div>
          <p className="text-sm font-semibold text-[var(--text)]">{title}</p>

          <p className="mt-1 text-xs text-[var(--muted)]">{description}</p>
        </div>
      </div>

      <ArrowRight
        size={17}
        className="text-[var(--muted-soft)] transition group-hover:translate-x-1 group-hover:text-[var(--text)]"
      />
    </button>
  );
}
