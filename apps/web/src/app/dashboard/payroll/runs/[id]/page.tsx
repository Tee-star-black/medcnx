"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Download,
  Edit3,
  FileSearch,
  Loader2,
  LockKeyhole,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { api } from "@/lib/api";
import { can } from "@/lib/permissions";
import type { AuthUser } from "@/types/auth";

type PayrollRunStatus =
  | "DRAFT"
  | "CALCULATED"
  | "AI_AUDITED"
  | "HR_REVIEWED"
  | "FINANCE_REVIEWED"
  | "PENDING_CEO_APPROVAL"
  | "CEO_APPROVED"
  | "PAYMENT_PROCESSING"
  | "PAID"
  | "COMPLETED"
  | "FINALISED"
  | "REJECTED"
  | "CANCELLED";

type FindingSeverity = "CRITICAL" | "HIGH" | "WARNING" | "INFO";

type FindingStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED";

type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

type PayrollEmployee = {
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

type PayrollRunItem = {
  id: string;
  employeeId: string;
  basicSalary: number;
  overtime: number;
  bonus: number;
  commission: number;
  allowances: number;
  grossPay: number;
  paye: number;
  uifEmployee: number;
  pensionEmployee: number;
  medicalAidEmployee: number;
  otherDeductions: number;
  totalDeductions: number;
  netPay: number;
  employerTotal: number;
  notes?: string | null;
  payslipDocumentId?: string | null;
  employee: PayrollEmployee | null;
};

type PayrollRun = {
  id: string;
  title: string;
  periodMonth: number;
  periodYear: number;
  status: PayrollRunStatus;
  employeeCount: number;
  itemCount: number;

  totalBasicSalary: number;
  totalOvertime: number;
  totalBonus: number;
  totalCommission: number;
  totalAllowances: number;
  totalGrossPay: number;

  totalPaye: number;
  totalUifEmployee: number;
  totalPensionEmployee: number;
  totalMedicalAidEmployee: number;
  totalOtherDeductions: number;
  totalDeductions: number;
  totalNetPay: number;

  totalEmployerContributions: number;

  notes?: string | null;
  calculatedAt?: string | null;
  lockedAt?: string | null;
  lockedByUserId?: string | null;
  lockReason?: string | null;
  calculationVersion?: string | null;
  createdAt: string;
  updatedAt: string;
  finalisedAt?: string | null;

  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;

  items: PayrollRunItem[];
};

type PayrollFinding = {
  id: string;
  employeeId?: string | null;
  ruleCode: string;
  severity: FindingSeverity;
  status: FindingStatus;
  title: string;
  description: string;
  resolutionNote?: string | null;
  acknowledgedAt?: string | null;
  resolvedAt?: string | null;
  employee?: PayrollEmployee | null;
};

type PayrollAudit = {
  id: string;
  payrollRunId: string;
  healthScore: number;
  riskLevel: RiskLevel;
  criticalCount: number;
  highCount: number;
  warningCount: number;
  infoCount: number;
  blocked: boolean;
  summary: string;
  analysedAt: string;
  findings: PayrollFinding[];
};

type PayrollTimelineEvent = {
  id: string;
  eventType: string;
  title: string;
  message?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  actor?: {
    id: string;
    email: string;
  } | null;
};

type PayrollApproval = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "EXPIRED";
  approvalType: string;
  requestedAt: string;
  approvedAt?: string | null;
  requestNote?: string | null;
  decisionNote?: string | null;
  summarySnapshot?: Record<string, unknown> | null;
  approver?: {
    id: string;
    email: string;
  } | null;
};

type PayrollApprover = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
};

type OtpRequestResponse = {
  challengeId: string;
  expiresAt: string;
  expiresInSeconds: number;
  maximumAttempts: number;
  deliveryChannel: string;
  recipient: string;
  developmentOtp?: string;
};

const workflowSteps: Array<{
  status: PayrollRunStatus;
  label: string;
}> = [
  { status: "DRAFT", label: "Draft" },
  { status: "CALCULATED", label: "Calculated" },
  { status: "AI_AUDITED", label: "Intelligence" },
  { status: "HR_REVIEWED", label: "HR Review" },
  { status: "FINANCE_REVIEWED", label: "Finance Review" },
  {
    status: "PENDING_CEO_APPROVAL",
    label: "CEO Approval",
  },
  { status: "CEO_APPROVED", label: "Approved" },
  { status: "PAYMENT_PROCESSING", label: "Processing" },
  { status: "PAID", label: "Paid" },
  { status: "COMPLETED", label: "Completed" },
  { status: "FINALISED", label: "Finalised" },
];

const statusOrder: PayrollRunStatus[] = [
  "DRAFT",
  "CALCULATED",
  "AI_AUDITED",
  "HR_REVIEWED",
  "FINANCE_REVIEWED",
  "PENDING_CEO_APPROVAL",
  "CEO_APPROVED",
  "PAYMENT_PROCESSING",
  "PAID",
  "COMPLETED",
  "FINALISED",
];

function formatCurrency(value?: number | null) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format(value ?? 0);
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function monthName(month: number) {
  return new Intl.DateTimeFormat("en-ZA", {
    month: "long",
  }).format(new Date(2026, month - 1, 1));
}

function readableStatus(status: PayrollRunStatus) {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getApiError(error: any, fallback: string) {
  const message = error?.response?.data?.message ?? fallback;

  if (message && typeof message === "object") {
    const details = Array.isArray(message.errors) ? message.errors : [];
    return [message.message, ...details].filter(Boolean).join(" ");
  }

  return Array.isArray(message) ? message.join(" ") : String(message);
}

function readSavedUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem("medcnx_user");
  if (!value) return null;

  try {
    return JSON.parse(value) as AuthUser;
  } catch {
    window.localStorage.removeItem("medcnx_user");
    return null;
  }
}

function severityClass(severity: FindingSeverity) {
  switch (severity) {
    case "CRITICAL":
      return "border-red-200 bg-red-50 text-red-700";
    case "HIGH":
      return "border-orange-200 bg-orange-50 text-orange-700";
    case "WARNING":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-blue-200 bg-blue-50 text-blue-700";
  }
}

function riskClass(risk?: RiskLevel) {
  switch (risk) {
    case "CRITICAL":
      return "border-red-200 bg-red-50 text-red-700";
    case "HIGH":
      return "border-orange-200 bg-orange-50 text-orange-700";
    case "MEDIUM":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
}

function getStepState(
  currentStatus: PayrollRunStatus,
  stepStatus: PayrollRunStatus,
) {
  if (currentStatus === "REJECTED" || currentStatus === "CANCELLED") {
    return "pending";
  }

  const currentIndex = statusOrder.indexOf(currentStatus);
  const stepIndex = statusOrder.indexOf(stepStatus);

  if (stepIndex < currentIndex) {
    return "complete";
  }

  if (stepIndex === currentIndex) {
    return "current";
  }

  return "pending";
}

export default function PayrollRunWorkspacePage() {
  const params = useParams<{ id: string }>();
  const payrollRunId = params.id;

  const [user, setUser] = useState<AuthUser | null>(null);

  const [payrollRun, setPayrollRun] = useState<PayrollRun | null>(null);
  const [audit, setAudit] = useState<PayrollAudit | null>(null);
  const [timeline, setTimeline] = useState<PayrollTimelineEvent[]>([]);
  const [approval, setApproval] = useState<PayrollApproval | null>(null);

  const [loading, setLoading] = useState(true);
  const [workingAction, setWorkingAction] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingItem, setEditingItem] = useState<PayrollRunItem | null>(null);
  const [variableInputs, setVariableInputs] = useState({
    overtime: "",
    bonus: "",
    commission: "",
    allowances: "",
    otherDeductions: "",
    notes: "",
  });

  const [resolutionFinding, setResolutionFinding] =
    useState<PayrollFinding | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");

  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approverUserId, setApproverUserId] = useState("");
  const [approvers, setApprovers] = useState<PayrollApprover[]>([]);
  const [approversLoading, setApproversLoading] = useState(false);
  const [approvalNote, setApprovalNote] = useState("");

  const [otpChallenge, setOtpChallenge] = useState<OtpRequestResponse | null>(
    null,
  );
  const [otpCode, setOtpCode] = useState("");
  const [showOtpModal, setShowOtpModal] = useState(false);

  const loadWorkspace = useCallback(async () => {
    if (!payrollRunId) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [runResponse, timelineResponse] = await Promise.all([
        api.get<PayrollRun>(`/payroll/runs/${payrollRunId}`),
        api
          .get<PayrollTimelineEvent[]>(
            `/payroll/runs/${payrollRunId}/workflow/timeline`,
          )
          .catch(() => ({ data: [] as PayrollTimelineEvent[] })),
      ]);

      setPayrollRun(runResponse.data);
      setTimeline(timelineResponse.data);

      try {
        const auditResponse = await api.get<PayrollAudit>(
          `/payroll/runs/${payrollRunId}/intelligence`,
        );

        setAudit(auditResponse.data);
      } catch (auditError: any) {
        if (auditError?.response?.status === 400) {
          setAudit(null);
        } else {
          throw auditError;
        }
      }

      try {
        const approvalResponse = await api.get<PayrollApproval>(
          `/payroll/runs/${payrollRunId}/approvals/ceo`,
        );

        setApproval(approvalResponse.data);
      } catch (approvalError: any) {
        if (approvalError?.response?.status === 404) {
          setApproval(null);
        } else {
          throw approvalError;
        }
      }
    } catch (requestError: any) {
      setError(
        getApiError(requestError, "The payroll workspace could not be loaded."),
      );
    } finally {
      setLoading(false);
    }
  }, [payrollRunId]);

  useEffect(() => {
    setUser(readSavedUser());
    void loadWorkspace();
  }, [loadWorkspace]);

  const unresolvedCriticalCount = useMemo(() => {
    return (
      audit?.findings.filter(
        (finding) =>
          finding.severity === "CRITICAL" && finding.status !== "RESOLVED",
      ).length ?? 0
    );
  }, [audit]);

  const canCompleteHrReview =
    payrollRun?.status === "AI_AUDITED" &&
    Boolean(audit) &&
    !audit?.blocked &&
    unresolvedCriticalCount === 0;

  const canFinalisePayroll = can(user, "payroll:finalise");
  const canReopenPayroll = can(user, "payroll:reopen");
  const canCalculatePayroll = can(user, "payroll:calculate");
  const canUpdateInputs = can(user, "payroll:update-inputs");
  const canGeneratePayslips = can(user, "payslips:generate");
  const canExportBankFile = can(user, "payroll:export-bank-file");
  const bankExportReady = timeline.some(
    (event) => event.eventType === "PAYROLL_BANK_FILE_EXPORTED",
  );
  const generatedPayslipCount =
    payrollRun?.items.filter((item) => Boolean(item.payslipDocumentId))
      .length ?? 0;

  async function runAction(
    actionName: string,
    action: () => Promise<unknown>,
    successMessage: string,
  ) {
    setWorkingAction(actionName);
    setError("");
    setSuccess("");

    try {
      await action();
      setSuccess(successMessage);
      await loadWorkspace();
    } catch (requestError: any) {
      setError(getApiError(requestError, "The requested action failed."));
    } finally {
      setWorkingAction("");
    }
  }

  async function runIntelligenceAudit() {
    await runAction(
      "audit",
      () => api.post(`/payroll/runs/${payrollRunId}/intelligence/run`),
      "Payroll intelligence audit completed.",
    );
  }

  async function completeHrReview() {
    await runAction(
      "hr-review",
      () =>
        api.post(`/payroll/runs/${payrollRunId}/workflow/hr-review`, {
          note: "HR reviewed the payroll intelligence findings and totals.",
        }),
      "HR review completed.",
    );
  }

  async function completeFinanceReview() {
    await runAction(
      "finance-review",
      () =>
        api.post(`/payroll/runs/${payrollRunId}/workflow/finance-review`, {
          note: "Finance reviewed payroll totals, deductions and employer contributions.",
        }),
      "Finance review completed.",
    );
  }

  async function acknowledgeFinding(findingId: string) {
    await runAction(
      `acknowledge-${findingId}`,
      () =>
        api.patch(
          `/payroll/runs/${payrollRunId}/intelligence/findings/${findingId}/acknowledge`,
          {
            note: "Finding reviewed and acknowledged.",
          },
        ),
      "Finding acknowledged.",
    );
  }

  async function resolveFinding() {
    if (!resolutionFinding || resolutionNote.trim().length < 3) {
      setError("Please provide a resolution note.");
      return;
    }

    await runAction(
      `resolve-${resolutionFinding.id}`,
      () =>
        api.patch(
          `/payroll/runs/${payrollRunId}/intelligence/findings/${resolutionFinding.id}/resolve`,
          {
            resolutionNote: resolutionNote.trim(),
          },
        ),
      "Finding resolved.",
    );

    setResolutionFinding(null);
    setResolutionNote("");
  }

  async function prepareCeoApproval() {
    if (!approverUserId.trim()) {
      setError("Select an authorised executive approver.");
      return;
    }

    await runAction(
      "prepare-ceo",
      () =>
        api.post(`/payroll/runs/${payrollRunId}/approvals/ceo/prepare`, {
          approverUserId: approverUserId.trim(),
          requestNote:
            approvalNote.trim() ||
            "Finance review completed. Payroll is ready for CEO approval.",
        }),
      "Payroll submitted for CEO approval.",
    );

    setShowApprovalModal(false);
    setApprovalNote("");
  }

  async function openApprovalModal() {
    setShowApprovalModal(true);
    setApproversLoading(true);
    setError("");

    try {
      const response = await api.get<PayrollApprover[]>(
        `/payroll/runs/${payrollRunId}/approvals/ceo/approvers`,
      );
      setApprovers(response.data);
      setApproverUserId((current) =>
        response.data.some((approver) => approver.id === current)
          ? current
          : response.data[0]?.id ?? "",
      );
    } catch (requestError: any) {
      setApprovers([]);
      setApproverUserId("");
      setError(
        getApiError(
          requestError,
          "Authorised payroll approvers could not be loaded.",
        ),
      );
    } finally {
      setApproversLoading(false);
    }
  }

  async function requestOtp() {
    setWorkingAction("request-otp");
    setError("");
    setSuccess("");

    try {
      const response = await api.post<OtpRequestResponse>(
        `/payroll/runs/${payrollRunId}/approvals/ceo/otp/request`,
        {
          note: "OTP requested from the Payroll Intelligence Center.",
        },
      );

      setOtpChallenge(response.data);
      setOtpCode(response.data.developmentOtp ?? "");
      setShowOtpModal(true);
      setSuccess("A secure payroll approval OTP was generated.");
      await loadWorkspace();
    } catch (requestError: any) {
      setError(getApiError(requestError, "The OTP could not be requested."));
    } finally {
      setWorkingAction("");
    }
  }

  async function verifyOtp() {
    if (!otpChallenge) {
      setError("Request a new OTP before verification.");
      return;
    }

    if (!/^\d{6}$/.test(otpCode)) {
      setError("Enter the six-digit OTP.");
      return;
    }

    await runAction(
      "verify-otp",
      () =>
        api.post(`/payroll/runs/${payrollRunId}/approvals/ceo/otp/verify`, {
          challengeId: otpChallenge.challengeId,
          code: otpCode,
          decisionNote:
            "Payroll reviewed and approved through secure OTP confirmation.",
        }),
      "Payroll approved successfully.",
    );

    setShowOtpModal(false);
    setOtpChallenge(null);
    setOtpCode("");
  }

  function openVariableInputs(item: PayrollRunItem) {
    setEditingItem(item);
    setVariableInputs({
      overtime: String(item.overtime ?? 0),
      bonus: String(item.bonus ?? 0),
      commission: String(item.commission ?? 0),
      allowances: String(item.allowances ?? 0),
      otherDeductions: String(item.otherDeductions ?? 0),
      notes: item.notes ?? "",
    });
  }

  async function saveVariableInputs() {
    if (!editingItem) return;

    const values = Object.entries(variableInputs)
      .filter(([key]) => key !== "notes")
      .map(([, value]) => Number(value || 0));
    if (values.some((value) => !Number.isFinite(value) || value < 0)) {
      setError("Variable payroll amounts must be valid positive numbers.");
      return;
    }

    setWorkingAction(`inputs-${editingItem.id}`);
    setError("");
    setSuccess("");
    try {
      const response = await api.patch<{
        message: string;
        payrollRun: PayrollRun;
      }>(`/payroll/runs/${payrollRunId}/items/${editingItem.id}/inputs`, {
        overtime: Number(variableInputs.overtime || 0),
        bonus: Number(variableInputs.bonus || 0),
        commission: Number(variableInputs.commission || 0),
        allowances: Number(variableInputs.allowances || 0),
        otherDeductions: Number(variableInputs.otherDeductions || 0),
        notes: variableInputs.notes.trim() || undefined,
      });
      setPayrollRun(response.data.payrollRun);
      setSuccess(response.data.message);
      setEditingItem(null);
      await loadWorkspace();
    } catch (requestError: any) {
      setError(
        getApiError(
          requestError,
          "Variable payroll inputs could not be saved.",
        ),
      );
    } finally {
      setWorkingAction("");
    }
  }

  async function calculatePayrollRun() {
    if (
      !window.confirm(
        "Calculate this run from every active employee compensation profile?",
      )
    ) {
      return;
    }

    await runAction(
      "calculate-run",
      () => api.post(`/payroll/runs/${payrollRunId}/calculate`),
      "Payroll run calculated successfully.",
    );
  }

  async function generateRunPayslips() {
    if (
      !window.confirm(
        "Generate confidential payslips for every employee in this payroll run?",
      )
    ) {
      return;
    }

    await runAction(
      "generate-payslips",
      () => api.post(`/payroll/runs/${payrollRunId}/generate-payslips`),
      "Payroll payslip generation completed.",
    );
  }

  async function exportBankPaymentFile() {
    if (!payrollRun) return;

    if (
      !window.confirm(
        "Validate banking details and download the payment CSV for this approved run?",
      )
    ) {
      return;
    }

    setWorkingAction("bank-export");
    setError("");
    setSuccess("");

    try {
      const response = await api.post(
        `/payroll/runs/${payrollRunId}/bank-export`,
        undefined,
        { responseType: "blob" },
      );
      const disposition = String(response.headers["content-disposition"] ?? "");
      const fileName =
        disposition.match(/filename="?([^";]+)"?/i)?.[1] ??
        `payroll-payments-${payrollRun.periodYear}-${String(
          payrollRun.periodMonth,
        ).padStart(2, "0")}.csv`;
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setSuccess("Bank payment file validated and downloaded.");
      await loadWorkspace();
    } catch (requestError: any) {
      if (requestError?.response?.data instanceof Blob) {
        try {
          const payload = JSON.parse(await requestError.response.data.text());
          requestError.response.data = payload;
        } catch {
          // Use the standard fallback when the error body is not JSON.
        }
      }
      setError(
        getApiError(
          requestError,
          "The bank payment file could not be generated.",
        ),
      );
    } finally {
      setWorkingAction("");
    }
  }

  async function movePayrollForward(
    actionName: string,
    endpoint: string,
    confirmation: string,
    note: string,
    successMessage: string,
  ) {
    if (!window.confirm(confirmation)) return;

    await runAction(
      actionName,
      () =>
        api.post(`/payroll/runs/${payrollRunId}/workflow/${endpoint}`, {
          note,
        }),
      successMessage,
    );
  }

  async function returnPayrollToDraft() {
    const reason = window
      .prompt("Enter the reason for returning this payroll run to draft:")
      ?.trim();

    if (!reason) {
      setError("A reason is required to return payroll to draft.");
      return;
    }

    await runAction(
      "return-to-draft",
      () =>
        api.post(`/payroll/runs/${payrollRunId}/workflow/return-to-draft`, {
          reason,
        }),
      "Payroll returned to draft and unlocked for recalculation.",
    );
  }

  if (loading) {
    return (
      <DashboardShell activePage="payroll" user={user}>
        <div className="flex min-h-[70vh] items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-slate-700" />
            <p className="mt-3 text-sm text-slate-500">
              Loading payroll workspace…
            </p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (!payrollRun) {
    return (
      <DashboardShell activePage="payroll" user={user}>
        <div className="border border-red-200 bg-red-50 p-6 text-red-700">
          {error || "Payroll run was not found."}
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell activePage="payroll" user={user}>
      <div className="mx-auto max-w-[1600px] space-y-6 pb-14">
        <header className="border-b border-slate-200 pb-6">
          <Link
            href="/dashboard/payroll/runs"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-950"
          >
            <ArrowLeft size={16} />
            Payroll register
          </Link>

          <div className="mt-5 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {monthName(payrollRun.periodMonth)} {payrollRun.periodYear}
                </span>

                <span className="border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  {readableStatus(payrollRun.status)}
                </span>

                {payrollRun.lockedAt ? (
                  <span
                    className="inline-flex items-center gap-1.5 border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800"
                    title={payrollRun.lockReason ?? undefined}
                  >
                    <LockKeyhole size={13} />
                    Inputs locked · {formatDateTime(payrollRun.lockedAt)}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    <Edit3 size={13} />
                    Inputs open
                  </span>
                )}
              </div>

              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
                {payrollRun.title}
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                Enterprise payroll review, intelligence findings, executive
                approval and audit timeline.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void loadWorkspace()}
                className="inline-flex h-11 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
              >
                <RefreshCw size={16} />
                Refresh
              </button>

              {(payrollRun.status === "COMPLETED" ||
                payrollRun.status === "FINALISED") &&
                generatedPayslipCount < payrollRun.itemCount && (
                  <button
                    type="button"
                    disabled={
                      !canGeneratePayslips ||
                      workingAction === "generate-payslips"
                    }
                    onClick={() => void generateRunPayslips()}
                    className="inline-flex h-11 items-center gap-2 border border-slate-950 bg-white px-5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {workingAction === "generate-payslips" ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <FileSearch size={16} />
                    )}
                    Generate payslips ({generatedPayslipCount}/
                    {payrollRun.itemCount})
                  </button>
                )}

              {(payrollRun.status === "CALCULATED" ||
                payrollRun.status === "AI_AUDITED") && (
                <button
                  type="button"
                  disabled={workingAction === "audit"}
                  onClick={runIntelligenceAudit}
                  className="inline-flex h-11 items-center gap-2 bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {workingAction === "audit" ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Sparkles size={16} />
                  )}
                  {audit ? "Rerun intelligence" : "Run intelligence"}
                </button>
              )}
            </div>
          </div>
        </header>

        {error && (
          <div className="flex items-start gap-3 border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-start gap-3 border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <section className="border border-slate-200 bg-white p-5 md:p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Workflow
              </p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">
                Payroll release controls
              </h2>
            </div>

            <ShieldCheck className="text-slate-400" size={22} />
          </div>

          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            {workflowSteps.map((step, index) => {
              const state = getStepState(payrollRun.status, step.status);

              return (
                <div key={step.status} className="relative">
                  <div
                    className={[
                      "min-h-24 border p-4",
                      state === "complete"
                        ? "border-emerald-200 bg-emerald-50"
                        : state === "current"
                          ? "border-slate-950 bg-slate-950 text-white"
                          : "border-slate-200 bg-slate-50 text-slate-400",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">
                        {String(index + 1).padStart(2, "0")}
                      </span>

                      {state === "complete" ? (
                        <CheckCircle2 size={17} />
                      ) : state === "current" ? (
                        <Clock3 size={17} />
                      ) : (
                        <div className="h-2 w-2 bg-slate-300" />
                      )}
                    </div>

                    <p className="mt-5 text-sm font-semibold">{step.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            icon={<Users size={19} />}
            label="Employees"
            value={String(payrollRun.itemCount)}
            detail="Included in this run"
          />

          <MetricCard
            icon={<CircleDollarSign size={19} />}
            label="Gross payroll"
            value={formatCurrency(payrollRun.totalGrossPay)}
            detail="Before deductions"
          />

          <MetricCard
            icon={<WalletCards size={19} />}
            label="Net payroll"
            value={formatCurrency(payrollRun.totalNetPay)}
            detail="Employee payments"
          />

          <MetricCard
            icon={<Building2 size={19} />}
            label="Employer cost"
            value={formatCurrency(
              payrollRun.totalGrossPay + payrollRun.totalEmployerContributions,
            )}
            detail="Gross plus contributions"
          />

          <MetricCard
            icon={<FileSearch size={19} />}
            label="Deductions"
            value={formatCurrency(payrollRun.totalDeductions)}
            detail={`PAYE ${formatCurrency(payrollRun.totalPaye)}`}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Payroll intelligence
                </p>
                <h2 className="mt-1 text-lg font-semibold text-slate-950">
                  Health assessment
                </h2>
              </div>

              <Sparkles size={22} className="text-slate-400" />
            </div>

            {audit ? (
              <>
                <div className="mt-8 flex items-end gap-3">
                  <span className="text-6xl font-semibold tracking-tight text-slate-950">
                    {audit.healthScore}
                  </span>
                  <span className="pb-2 text-sm font-medium text-slate-400">
                    / 100
                  </span>
                </div>

                <div className="mt-4 h-2 bg-slate-100">
                  <div
                    className="h-full bg-slate-950 transition-all"
                    style={{
                      width: `${Math.max(
                        0,
                        Math.min(100, audit.healthScore),
                      )}%`,
                    }}
                  />
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <span
                    className={`border px-3 py-1 text-xs font-semibold ${riskClass(
                      audit.riskLevel,
                    )}`}
                  >
                    {audit.riskLevel} RISK
                  </span>

                  {audit.blocked ? (
                    <span className="border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                      BLOCKED
                    </span>
                  ) : (
                    <span className="border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      CLEAR TO REVIEW
                    </span>
                  )}
                </div>

                <p className="mt-5 text-sm leading-6 text-slate-600">
                  {audit.summary}
                </p>

                <div className="mt-6 grid grid-cols-2 gap-px bg-slate-200">
                  <AuditCount label="Critical" value={audit.criticalCount} />
                  <AuditCount label="High" value={audit.highCount} />
                  <AuditCount label="Warnings" value={audit.warningCount} />
                  <AuditCount label="Info" value={audit.infoCount} />
                </div>

                <p className="mt-5 text-xs text-slate-400">
                  Analysed {formatDateTime(audit.analysedAt)}
                </p>
              </>
            ) : (
              <div className="mt-8 border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                <ShieldAlert size={28} className="mx-auto text-slate-400" />
                <p className="mt-3 text-sm font-semibold text-slate-700">
                  No intelligence audit
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Calculate the payroll and run the audit to generate a health
                  score.
                </p>
              </div>
            )}
          </div>

          <div className="border border-slate-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-slate-200 p-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Findings
                </p>
                <h2 className="mt-1 text-lg font-semibold text-slate-950">
                  Payroll exceptions
                </h2>
              </div>

              <span className="text-sm text-slate-500">
                {audit?.findings.length ?? 0} finding
                {(audit?.findings.length ?? 0) === 1 ? "" : "s"}
              </span>
            </div>

            {!audit || audit.findings.length === 0 ? (
              <div className="flex min-h-72 items-center justify-center p-8 text-center">
                <div>
                  <ShieldCheck size={32} className="mx-auto text-emerald-600" />
                  <p className="mt-3 font-semibold text-slate-800">
                    No payroll exceptions
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    There are no active intelligence findings.
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {audit.findings.map((finding) => (
                  <article key={finding.id} className="p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`border px-2.5 py-1 text-[11px] font-bold ${severityClass(
                              finding.severity,
                            )}`}
                          >
                            {finding.severity}
                          </span>

                          <span className="text-xs font-medium text-slate-400">
                            {finding.ruleCode}
                          </span>

                          {finding.status === "RESOLVED" && (
                            <span className="border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                              RESOLVED
                            </span>
                          )}

                          {finding.status === "ACKNOWLEDGED" && (
                            <span className="border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                              ACKNOWLEDGED
                            </span>
                          )}
                        </div>

                        <h3 className="mt-3 font-semibold text-slate-950">
                          {finding.title}
                        </h3>

                        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                          {finding.description}
                        </p>

                        {finding.employee && (
                          <p className="mt-3 text-xs font-medium text-slate-500">
                            {finding.employee.firstName}{" "}
                            {finding.employee.lastName} ·{" "}
                            {finding.employee.employeeNumber}
                          </p>
                        )}

                        {finding.resolutionNote && (
                          <div className="mt-3 border-l-2 border-emerald-500 bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">
                            {finding.resolutionNote}
                          </div>
                        )}
                      </div>

                      {finding.status !== "RESOLVED" && (
                        <div className="flex shrink-0 flex-wrap gap-2">
                          {finding.status === "OPEN" && (
                            <button
                              type="button"
                              disabled={
                                workingAction === `acknowledge-${finding.id}`
                              }
                              onClick={() => acknowledgeFinding(finding.id)}
                              className="inline-flex h-9 items-center gap-2 border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:border-slate-950"
                            >
                              {workingAction === `acknowledge-${finding.id}` ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <Check size={14} />
                              )}
                              Acknowledge
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setResolutionFinding(finding);
                              setResolutionNote("");
                            }}
                            className="inline-flex h-9 items-center gap-2 bg-slate-950 px-3 text-xs font-semibold text-white hover:bg-slate-800"
                          >
                            <ShieldCheck size={14} />
                            Resolve
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.6fr)]">
          <div className="border border-slate-200 bg-white">
            <div className="border-b border-slate-200 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Payroll register
              </p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">
                Employee payment summary
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-4">Employee</th>
                    <th className="px-5 py-4">Basic</th>
                    <th className="px-5 py-4">Gross</th>
                    <th className="px-5 py-4">Deductions</th>
                    <th className="px-5 py-4">Net pay</th>
                    {payrollRun.status === "CALCULATED" && canUpdateInputs ? (
                      <th className="px-5 py-4 text-right">Inputs</th>
                    ) : null}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {payrollRun.items.map((item) => (
                    <tr key={item.id} className="text-sm">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-900">
                          {item.employee
                            ? `${item.employee.firstName} ${item.employee.lastName}`
                            : "Unknown employee"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.employee?.employeeNumber ?? item.employeeId}
                          {item.employee?.department?.name
                            ? ` · ${item.employee.department.name}`
                            : ""}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {formatCurrency(item.basicSalary)}
                      </td>

                      <td className="px-5 py-4 font-medium text-slate-800">
                        {formatCurrency(item.grossPay)}
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {formatCurrency(item.totalDeductions)}
                      </td>

                      <td className="px-5 py-4 font-semibold text-slate-950">
                        {formatCurrency(item.netPay)}
                      </td>
                      {payrollRun.status === "CALCULATED" && canUpdateInputs ? (
                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => openVariableInputs(item)}
                            className="inline-flex h-9 items-center justify-center gap-2 border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 transition hover:border-slate-950 hover:bg-slate-950 hover:text-white"
                          >
                            <Edit3 size={14} /> Edit inputs
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6">
            <div className="border border-slate-200 bg-slate-950 p-6 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Required action
              </p>

              <h2 className="mt-2 text-xl font-semibold">
                {getActionTitle(payrollRun.status)}
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-300">
                {getActionDescription(payrollRun.status)}
              </p>

              <div className="mt-6">
                {payrollRun.status === "DRAFT" && (
                  <button
                    type="button"
                    disabled={
                      !canCalculatePayroll || workingAction === "calculate-run"
                    }
                    onClick={() => void calculatePayrollRun()}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 bg-white px-4 text-sm font-semibold text-slate-950 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {workingAction === "calculate-run" ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <CircleDollarSign size={16} />
                    )}
                    Calculate payroll run
                  </button>
                )}

                {payrollRun.status === "AI_AUDITED" && (
                  <button
                    type="button"
                    disabled={
                      !canCompleteHrReview || workingAction === "hr-review"
                    }
                    onClick={completeHrReview}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 bg-white px-4 text-sm font-semibold text-slate-950 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {workingAction === "hr-review" ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <UserCheck size={16} />
                    )}
                    Complete HR review
                  </button>
                )}

                {payrollRun.status === "HR_REVIEWED" && (
                  <button
                    type="button"
                    disabled={workingAction === "finance-review"}
                    onClick={completeFinanceReview}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 bg-white px-4 text-sm font-semibold text-slate-950 hover:bg-slate-100 disabled:opacity-50"
                  >
                    {workingAction === "finance-review" ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <WalletCards size={16} />
                    )}
                    Complete finance review
                  </button>
                )}

                {payrollRun.status === "FINANCE_REVIEWED" && (
                  <button
                    type="button"
                    onClick={() => void openApprovalModal()}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 bg-white px-4 text-sm font-semibold text-slate-950 hover:bg-slate-100"
                  >
                    <ShieldCheck size={16} />
                    Submit for CEO approval
                  </button>
                )}

                {payrollRun.status === "PENDING_CEO_APPROVAL" && (
                  <button
                    type="button"
                    disabled={workingAction === "request-otp"}
                    onClick={requestOtp}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 bg-white px-4 text-sm font-semibold text-slate-950 hover:bg-slate-100 disabled:opacity-50"
                  >
                    {workingAction === "request-otp" ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <LockKeyhole size={16} />
                    )}
                    Request approval OTP
                  </button>
                )}

                {payrollRun.status === "CEO_APPROVED" && (
                  <div className="space-y-3">
                    <button
                      type="button"
                      disabled={
                        !canExportBankFile || workingAction === "bank-export"
                      }
                      onClick={() => void exportBankPaymentFile()}
                      className="inline-flex h-11 w-full items-center justify-center gap-2 border border-white bg-transparent px-4 text-sm font-semibold text-white hover:bg-white hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {workingAction === "bank-export" ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Download size={16} />
                      )}
                      {bankExportReady
                        ? "Regenerate bank payment file"
                        : "Generate bank payment file"}
                    </button>

                    <button
                      type="button"
                      disabled={
                        !canFinalisePayroll ||
                        !bankExportReady ||
                        workingAction === "payment-processing"
                      }
                      onClick={() =>
                        void movePayrollForward(
                          "payment-processing",
                          "start-payment-processing",
                          "Start payment processing for this approved payroll run?",
                          "Approved payroll released for payment processing.",
                          "Payment processing started.",
                        )
                      }
                      className="inline-flex h-11 w-full items-center justify-center gap-2 bg-white px-4 text-sm font-semibold text-slate-950 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {workingAction === "payment-processing" ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Banknote size={16} />
                      )}
                      {bankExportReady
                        ? "Start payment processing"
                        : "Generate payment file first"}
                    </button>
                  </div>
                )}

                {payrollRun.status === "PAYMENT_PROCESSING" && (
                  <button
                    type="button"
                    disabled={
                      !canFinalisePayroll || workingAction === "mark-paid"
                    }
                    onClick={() =>
                      void movePayrollForward(
                        "mark-paid",
                        "mark-paid",
                        "Confirm that all employee payments were successfully processed?",
                        "All employee payments confirmed as paid.",
                        "Payroll marked as paid.",
                      )
                    }
                    className="inline-flex h-11 w-full items-center justify-center gap-2 bg-white px-4 text-sm font-semibold text-slate-950 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {workingAction === "mark-paid" ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Check size={16} />
                    )}
                    Confirm payments
                  </button>
                )}

                {payrollRun.status === "PAID" && (
                  <button
                    type="button"
                    disabled={
                      !canFinalisePayroll || workingAction === "complete"
                    }
                    onClick={() =>
                      void movePayrollForward(
                        "complete",
                        "complete",
                        "Complete the payroll run after verifying payment results?",
                        "Payment results verified and payroll completed.",
                        "Payroll run completed.",
                      )
                    }
                    className="inline-flex h-11 w-full items-center justify-center gap-2 bg-white px-4 text-sm font-semibold text-slate-950 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {workingAction === "complete" ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={16} />
                    )}
                    Complete payroll
                  </button>
                )}

                {payrollRun.status === "COMPLETED" && (
                  <button
                    type="button"
                    disabled={
                      !canFinalisePayroll || workingAction === "finalise"
                    }
                    onClick={() =>
                      void movePayrollForward(
                        "finalise",
                        "finalise",
                        "Finalise and lock this payroll run? This action cannot be reversed.",
                        "Completed payroll finalised and locked.",
                        "Payroll run finalised.",
                      )
                    }
                    className="inline-flex h-11 w-full items-center justify-center gap-2 bg-white px-4 text-sm font-semibold text-slate-950 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {workingAction === "finalise" ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <LockKeyhole size={16} />
                    )}
                    Finalise and lock
                  </button>
                )}

                {payrollRun.status === "FINALISED" && (
                  <div className="flex items-center gap-3 border border-emerald-700 bg-emerald-950 p-4 text-sm text-emerald-200">
                    <CheckCircle2 size={20} /> Payroll is finalised and locked.
                  </div>
                )}

                {payrollRun.status === "REJECTED" && (
                  <button
                    type="button"
                    disabled={
                      !canReopenPayroll || workingAction === "return-to-draft"
                    }
                    onClick={() => void returnPayrollToDraft()}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 border border-white bg-white px-4 text-sm font-semibold text-slate-950 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {workingAction === "return-to-draft" ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <RefreshCw size={16} />
                    )}
                    Return to draft
                  </button>
                )}

                {payrollRun.status === "CALCULATED" && (
                  <button
                    type="button"
                    disabled={workingAction === "audit"}
                    onClick={runIntelligenceAudit}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 bg-white px-4 text-sm font-semibold text-slate-950 hover:bg-slate-100 disabled:opacity-50"
                  >
                    <Sparkles size={16} />
                    Run payroll intelligence
                  </button>
                )}
              </div>
            </div>

            <div className="border border-slate-200 bg-white">
              <div className="border-b border-slate-200 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Audit trail
                </p>
                <h2 className="mt-1 text-lg font-semibold text-slate-950">
                  Payroll timeline
                </h2>
              </div>

              <div className="max-h-[540px] overflow-y-auto p-5">
                {timeline.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No timeline events have been recorded.
                  </p>
                ) : (
                  <div className="space-y-0">
                    {timeline.map((event, index) => (
                      <div
                        key={event.id}
                        className="relative grid grid-cols-[20px_1fr] gap-3 pb-6"
                      >
                        {index < timeline.length - 1 && (
                          <div className="absolute left-[9px] top-5 h-full w-px bg-slate-200" />
                        )}

                        <div className="relative z-10 mt-1 h-5 w-5 border-4 border-white bg-slate-950" />

                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {event.title}
                          </p>

                          {event.message && (
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              {event.message}
                            </p>
                          )}

                          <p className="mt-2 text-[11px] font-medium text-slate-400">
                            {formatDateTime(event.createdAt)}
                            {event.actor?.email
                              ? ` · ${event.actor.email}`
                              : ""}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      {resolutionFinding && (
        <Modal
          title="Resolve payroll finding"
          onClose={() => setResolutionFinding(null)}
        >
          <p className="text-sm font-semibold text-slate-900">
            {resolutionFinding.title}
          </p>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Explain what was corrected or why the finding is safe to resolve.
          </p>

          <textarea
            value={resolutionNote}
            onChange={(event) => setResolutionNote(event.target.value)}
            rows={5}
            className="mt-5 w-full border border-slate-300 bg-white p-3 text-sm outline-none transition focus:border-slate-950"
            placeholder="Resolution details"
          />

          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setResolutionFinding(null)}
              className="h-10 border border-slate-300 px-4 text-sm font-semibold text-slate-700"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={workingAction.startsWith("resolve-")}
              onClick={resolveFinding}
              className="inline-flex h-10 items-center gap-2 bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {workingAction.startsWith("resolve-") && (
                <Loader2 size={15} className="animate-spin" />
              )}
              Resolve finding
            </button>
          </div>
        </Modal>
      )}

      {editingItem && (
        <Modal
          title={`Variable inputs · ${editingItem.employee?.firstName ?? ""} ${editingItem.employee?.lastName ?? ""}`.trim()}
          onClose={() => setEditingItem(null)}
        >
          <div className="border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
            PAYE, UIF, gross pay and net pay will be recalculated automatically
            when you save.
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {(
              [
                ["overtime", "Overtime"],
                ["bonus", "Bonus"],
                ["commission", "Commission"],
                ["allowances", "Total allowances"],
                ["otherDeductions", "Other deductions"],
              ] as const
            ).map(([field, label]) => (
              <label key={field} className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-800">
                  {label}
                </span>
                <div className="flex h-11 border border-slate-300 bg-white focus-within:border-slate-950">
                  <span className="flex items-center border-r border-slate-200 px-3 text-sm font-semibold text-slate-500">
                    R
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={variableInputs[field]}
                    onChange={(event) =>
                      setVariableInputs((current) => ({
                        ...current,
                        [field]: event.target.value,
                      }))
                    }
                    className="min-w-0 flex-1 px-3 text-sm font-semibold text-slate-950 outline-none"
                  />
                </div>
              </label>
            ))}
          </div>

          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-semibold text-slate-800">
              Payroll note
            </span>
            <textarea
              rows={3}
              value={variableInputs.notes}
              onChange={(event) =>
                setVariableInputs((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              placeholder="Optional reason or supporting reference"
              className="w-full resize-none border border-slate-300 px-3 py-3 text-sm text-slate-950 outline-none focus:border-slate-950"
            />
          </label>

          <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-5">
            <button
              type="button"
              onClick={() => setEditingItem(null)}
              className="inline-flex h-10 items-center border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:border-slate-950"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={workingAction === `inputs-${editingItem.id}`}
              onClick={() => void saveVariableInputs()}
              className="inline-flex h-10 items-center gap-2 bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {workingAction === `inputs-${editingItem.id}` ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Check size={15} />
              )}
              Save and recalculate
            </button>
          </div>
        </Modal>
      )}

      {showApprovalModal && (
        <Modal
          title="Submit for CEO approval"
          onClose={() => setShowApprovalModal(false)}
        >
          <label className="block text-sm font-semibold text-slate-800">
            Executive approver
          </label>

          <select
            value={approverUserId}
            onChange={(event) => setApproverUserId(event.target.value)}
            className="mt-2 h-11 w-full border border-slate-300 px-3 text-sm outline-none focus:border-slate-950"
            disabled={approversLoading}
          >
            <option value="">
              {approversLoading
                ? "Loading authorised approvers..."
                : "Select an authorised approver"}
            </option>
            {approvers.map((approver) => (
              <option key={approver.id} value={approver.id}>
                {approver.firstName} {approver.lastName} · {approver.email}
              </option>
            ))}
          </select>

          {!approversLoading && approvers.length === 0 ? (
            <p className="mt-2 border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
              No other active user has payroll approval permission. Assign
              payroll:approve to the authorised executive before submitting.
            </p>
          ) : (
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Only active users in this organisation with payroll approval
              permission are shown. The requester cannot approve their own
              submission.
            </p>
          )}

          <label className="mt-5 block text-sm font-semibold text-slate-800">
            Approval note
          </label>

          <textarea
            value={approvalNote}
            onChange={(event) => setApprovalNote(event.target.value)}
            rows={4}
            className="mt-2 w-full border border-slate-300 p-3 text-sm outline-none focus:border-slate-950"
            placeholder="Finance review completed. Payroll is ready for approval."
          />

          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowApprovalModal(false)}
              className="h-10 border border-slate-300 px-4 text-sm font-semibold text-slate-700"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={
                workingAction === "prepare-ceo" ||
                approversLoading ||
                !approverUserId
              }
              onClick={prepareCeoApproval}
              className="inline-flex h-10 items-center gap-2 bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {workingAction === "prepare-ceo" && (
                <Loader2 size={15} className="animate-spin" />
              )}
              Submit securely
            </button>
          </div>
        </Modal>
      )}

      {showOtpModal && otpChallenge && (
        <Modal
          title="Confirm CEO payroll approval"
          onClose={() => setShowOtpModal(false)}
        >
          <div className="border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-blue-900">
              OTP sent to {otpChallenge.recipient}
            </p>
            <p className="mt-1 text-xs text-blue-700">
              The code expires at {formatDateTime(otpChallenge.expiresAt)}.
            </p>
          </div>

          {otpChallenge.developmentOtp && (
            <div className="mt-4 border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                Development OTP
              </p>
              <p className="mt-1 font-mono text-2xl font-semibold tracking-[0.35em] text-amber-950">
                {otpChallenge.developmentOtp}
              </p>
            </div>
          )}

          <label className="mt-5 block text-sm font-semibold text-slate-800">
            Six-digit OTP
          </label>

          <input
            value={otpCode}
            onChange={(event) =>
              setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))
            }
            inputMode="numeric"
            maxLength={6}
            className="mt-2 h-14 w-full border border-slate-300 text-center font-mono text-2xl font-semibold tracking-[0.4em] outline-none focus:border-slate-950"
            placeholder="000000"
          />

          <button
            type="button"
            disabled={otpCode.length !== 6 || workingAction === "verify-otp"}
            onClick={verifyOtp}
            className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 bg-slate-950 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {workingAction === "verify-otp" ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <LockKeyhole size={16} />
            )}
            Verify and approve payroll
          </button>
        </Modal>
      )}
    </DashboardShell>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div className="text-slate-400">{icon}</div>
        <ChevronRight size={15} className="text-slate-300" />
      </div>

      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
        {value}
      </p>

      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function AuditCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white p-4">
      <p className="text-2xl font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-950">{title}</h2>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center border border-slate-200 text-slate-500 hover:border-slate-950 hover:text-slate-950"
            aria-label="Close modal"
          >
            <X size={17} />
          </button>
        </div>

        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function getActionTitle(status: PayrollRunStatus) {
  switch (status) {
    case "CALCULATED":
      return "Run payroll intelligence";
    case "AI_AUDITED":
      return "Complete HR review";
    case "HR_REVIEWED":
      return "Complete finance review";
    case "FINANCE_REVIEWED":
      return "Request CEO approval";
    case "PENDING_CEO_APPROVAL":
      return "Confirm executive approval";
    case "CEO_APPROVED":
      return "Start payment processing";
    case "PAYMENT_PROCESSING":
      return "Confirm employee payments";
    case "PAID":
      return "Complete payroll checks";
    case "COMPLETED":
      return "Finalise payroll";
    case "FINALISED":
      return "Payroll finalised";
    case "DRAFT":
      return "Calculate payroll run";
    case "REJECTED":
      return "Payroll requires correction";
    case "CANCELLED":
      return "Payroll was cancelled";
    default:
      return readableStatus(status);
  }
}

function getActionDescription(status: PayrollRunStatus) {
  switch (status) {
    case "CALCULATED":
      return "Run the automated audit before any human review begins.";
    case "AI_AUDITED":
      return "HR must review the payroll and resolve every critical exception.";
    case "HR_REVIEWED":
      return "Finance must validate payroll totals, deductions and employer costs.";
    case "FINANCE_REVIEWED":
      return "Create a secure approval request containing a frozen payroll summary.";
    case "PENDING_CEO_APPROVAL":
      return "The assigned CEO must confirm the approval using a secure OTP.";
    case "CEO_APPROVED":
      return "Executive approval is recorded. Release the approved run for payment processing.";
    case "PAYMENT_PROCESSING":
      return "Confirm only after every employee payment has been processed successfully.";
    case "PAID":
      return "Verify the payment results and complete the payroll run.";
    case "COMPLETED":
      return "Finalise and lock the completed payroll run.";
    case "FINALISED":
      return "This payroll run is complete, finalised and locked against further changes.";
    case "DRAFT":
      return "Calculate all active employees from their saved compensation profiles.";
    case "REJECTED":
      return "Correct the payroll information before restarting the workflow.";
    case "CANCELLED":
      return "No further workflow actions are available for this payroll run.";
    default:
      return "Review the payroll status and timeline before continuing.";
  }
}
