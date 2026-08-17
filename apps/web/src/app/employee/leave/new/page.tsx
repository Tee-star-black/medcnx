'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CalendarDays,
  FileText,
  Loader2,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { EmployeeShell } from '@/components/employee/EmployeeShell';
import { api } from '@/lib/api';

type LeaveRequest = {
  id: string;
  leaveType: string;
  status: string;
  startDate: string;
  endDate: string;
  totalDays: string | number;
  reason?: string | null;
  createdAt: string;
};

type OrganisationPolicy = {
  defaultAnnualLeaveDays: number;
  sickLeaveCycleDays: number;
  sickLeaveDocumentThresholdDays: number;
  leaveYearStartMonth: number;
};

type LeaveTypeConfig = {
  value: string;
  label: string;
  limit: number;
  requiresDocument: boolean;
};

const fallbackPolicy: OrganisationPolicy = {
  defaultAnnualLeaveDays: 15,
  sickLeaveCycleDays: 30,
  sickLeaveDocumentThresholdDays: 2,
  leaveYearStartMonth: 1,
};

function getLeaveTypes(policy: OrganisationPolicy): LeaveTypeConfig[] {
  return [
    {
      value: 'ANNUAL',
      label: 'Annual leave',
      limit: policy.defaultAnnualLeaveDays,
      requiresDocument: false,
    },
    {
      value: 'SICK',
      label: 'Sick leave',
      limit: policy.sickLeaveCycleDays,
      requiresDocument: false,
    },
    {
      value: 'FAMILY_RESPONSIBILITY',
      label: 'Family responsibility',
      limit: 3,
      requiresDocument: true,
    },
    {
      value: 'MATERNITY',
      label: 'Maternity leave',
      limit: 120,
      requiresDocument: true,
    },
    {
      value: 'PATERNITY',
      label: 'Paternity leave',
      limit: 10,
      requiresDocument: true,
    },
    {
      value: 'STUDY',
      label: 'Study leave',
      limit: 0,
      requiresDocument: true,
    },
    {
      value: 'UNPAID',
      label: 'Unpaid leave',
      limit: 0,
      requiresDocument: false,
    },
    {
      value: 'OTHER',
      label: 'Other leave',
      limit: 0,
      requiresDocument: false,
    },
  ];
}

function calculateDays(startDate: string, endDate: string) {
  if (!startDate || !endDate) {
    return 0;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  if (end < start) {
    return 0;
  }

  const difference = end.getTime() - start.getTime();

  return Math.floor(difference / (1000 * 60 * 60 * 24)) + 1;
}

function getUsedLeaveDays(leaveRequests: LeaveRequest[], leaveType: string) {
  return leaveRequests
    .filter(
      (request) =>
        request.leaveType === leaveType && request.status === 'APPROVED',
    )
    .reduce((total, request) => total + Number(request.totalDays), 0);
}

function getPendingLeaveDays(leaveRequests: LeaveRequest[], leaveType: string) {
  return leaveRequests
    .filter(
      (request) =>
        request.leaveType === leaveType && request.status === 'PENDING',
    )
    .reduce((total, request) => total + Number(request.totalDays), 0);
}

function leaveTypeRequiresDocument({
  leaveType,
  requestedDays,
  selectedLeaveType,
  policy,
}: {
  leaveType: string;
  requestedDays: number;
  selectedLeaveType: LeaveTypeConfig;
  policy: OrganisationPolicy;
}) {
  if (requestedDays <= 0) {
    return false;
  }

  if (leaveType === 'SICK') {
    return requestedDays >= policy.sickLeaveDocumentThresholdDays;
  }

  return selectedLeaveType.requiresDocument;
}

export default function NewEmployeeLeavePage() {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [policy, setPolicy] = useState<OrganisationPolicy>(fallbackPolicy);

  const [leaveType, setLeaveType] = useState('ANNUAL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [documentFile, setDocumentFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadLeaveInformation();
  }, []);

  const leaveTypes = useMemo(() => {
    return getLeaveTypes(policy);
  }, [policy]);

  const selectedLeaveType = useMemo(() => {
    return leaveTypes.find((type) => type.value === leaveType) ?? leaveTypes[0];
  }, [leaveType, leaveTypes]);

  const requestedDays = useMemo(() => {
    return calculateDays(startDate, endDate);
  }, [startDate, endDate]);

  const usedDays = useMemo(() => {
    return getUsedLeaveDays(leaveRequests, leaveType);
  }, [leaveRequests, leaveType]);

  const pendingDays = useMemo(() => {
    return getPendingLeaveDays(leaveRequests, leaveType);
  }, [leaveRequests, leaveType]);

  const hasHardLimit = selectedLeaveType.limit > 0;

  const availableDays = useMemo(() => {
    if (!hasHardLimit) {
      return null;
    }

    return Math.max(selectedLeaveType.limit - usedDays - pendingDays, 0);
  }, [hasHardLimit, selectedLeaveType.limit, usedDays, pendingDays]);

  const exceedsBalance =
    availableDays !== null && requestedDays > availableDays;

  const needsDocument = leaveTypeRequiresDocument({
    leaveType,
    requestedDays,
    selectedLeaveType,
    policy,
  });

  async function loadLeaveInformation() {
    setLoading(true);
    setError('');

    try {
      const leaveResponse = await api.get<LeaveRequest[]>('/leave/my-requests');
      setLeaveRequests(leaveResponse.data);

      try {
        const organisationResponse =
          await api.get<OrganisationPolicy>('/organisations/me');

        setPolicy({
          defaultAnnualLeaveDays:
            organisationResponse.data.defaultAnnualLeaveDays ??
            fallbackPolicy.defaultAnnualLeaveDays,
          sickLeaveCycleDays:
            organisationResponse.data.sickLeaveCycleDays ??
            fallbackPolicy.sickLeaveCycleDays,
          sickLeaveDocumentThresholdDays:
            organisationResponse.data.sickLeaveDocumentThresholdDays ??
            fallbackPolicy.sickLeaveDocumentThresholdDays,
          leaveYearStartMonth:
            organisationResponse.data.leaveYearStartMonth ??
            fallbackPolicy.leaveYearStartMonth,
        });
      } catch {
        setPolicy(fallbackPolicy);
      }
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ??
        'Could not load your leave history.';

      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally {
      setLoading(false);
    }
  }

  async function submitLeaveRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError('');
    setSuccess('');

    if (!startDate || !endDate) {
      setError('Please select a start date and end date.');
      return;
    }

    if (requestedDays <= 0) {
      setError('End date cannot be before start date.');
      return;
    }

    if (exceedsBalance) {
      setError(
        `This request exceeds your available ${selectedLeaveType.label.toLowerCase()} balance.`,
      );
      return;
    }

    if (needsDocument && !documentFile) {
      if (leaveType === 'SICK') {
        setError(
          `Sick leave of ${requestedDays} day${
            requestedDays === 1 ? '' : 's'
          } requires a supporting document. Current policy requires a sick note for ${policy.sickLeaveDocumentThresholdDays} or more day${
            policy.sickLeaveDocumentThresholdDays === 1 ? '' : 's'
          }.`,
        );
        return;
      }

      setError(`${selectedLeaveType.label} requires a supporting document.`);
      return;
    }

    setSubmitting(true);

    try {
      if (documentFile) {
        const formData = new FormData();

        formData.append('leaveType', leaveType);
        formData.append('startDate', startDate);
        formData.append('endDate', endDate);

        if (reason.trim()) {
          formData.append('reason', reason.trim());
        }

        formData.append('document', documentFile);

        await api.post('/leave/my-requests/with-document', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
      } else {
        await api.post('/leave/my-requests', {
          leaveType,
          startDate,
          endDate,
          reason: reason.trim() || undefined,
        });
      }

      setSuccess('Leave request submitted successfully.');
      setLeaveType('ANNUAL');
      setStartDate('');
      setEndDate('');
      setReason('');
      setDocumentFile(null);

      await loadLeaveInformation();
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ??
        'Could not submit leave request.';

      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <EmployeeShell>
      <div className="space-y-8">
        <section className="flex flex-col gap-5 border-b border-black/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              href="/employee"
              className="mb-5 inline-flex items-center gap-2 text-sm text-gray-500 transition hover:text-black"
            >
              <ArrowLeft size={15} />
              Back to employee portal
            </Link>

            <p className="mb-2 text-sm uppercase tracking-[0.25em] text-gray-400">
              Leave management
            </p>

            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#111827]">
              Request leave
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              Submit a leave request for HR review. Document requirements now
              follow your organisation’s HR policy settings.
            </p>
          </div>
        </section>

        {loading ? (
          <div className="flex min-h-[320px] items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <Loader2 className="animate-spin" size={18} />
              Loading leave information...
            </div>
          </div>
        ) : (
          <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <form
              onSubmit={submitLeaveRequest}
              className="border border-black/10 bg-white"
            >
              <div className="flex items-start justify-between gap-5 border-b border-black/10 px-6 py-5">
                <div>
                  <h2 className="text-lg font-semibold tracking-[-0.03em]">
                    Request details
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    Choose your leave category, dates and supporting document if
                    required.
                  </p>
                </div>

                <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-black/10 bg-[#f8fafc] text-gray-500">
                  <CalendarDays size={18} />
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
                    Leave type
                  </span>

                  <select
                    value={leaveType}
                    onChange={(event) => {
                      setLeaveType(event.target.value);
                      setDocumentFile(null);
                    }}
                    className="w-full border border-black/10 bg-[#f8fafc] px-4 py-3 text-sm outline-none transition focus:border-black"
                  >
                    {leaveTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium">
                      Start date <span className="text-red-500">*</span>
                    </span>

                    <input
                      type="date"
                      value={startDate}
                      onChange={(event) => setStartDate(event.target.value)}
                      className="w-full border border-black/10 bg-[#f8fafc] px-4 py-3 text-sm outline-none transition focus:border-black"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium">
                      End date <span className="text-red-500">*</span>
                    </span>

                    <input
                      type="date"
                      value={endDate}
                      onChange={(event) => setEndDate(event.target.value)}
                      className="w-full border border-black/10 bg-[#f8fafc] px-4 py-3 text-sm outline-none transition focus:border-black"
                    />
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <PolicyBox
                    label="Requested days"
                    value={
                      requestedDays > 0
                        ? `${requestedDays} day${
                            requestedDays === 1 ? '' : 's'
                          }`
                        : 'Select dates'
                    }
                  />

                  <PolicyBox
                    label="Available"
                    value={
                      availableDays === null
                        ? 'No fixed limit'
                        : `${availableDays} days`
                    }
                  />

                  <PolicyBox
                    label="Document"
                    value={needsDocument ? 'Required' : 'Optional'}
                    danger={needsDocument}
                  />
                </div>

                {leaveType === 'SICK' && requestedDays > 0 ? (
                  <div
                    className={`border px-4 py-3 text-sm leading-6 ${
                      needsDocument
                        ? 'border-red-200 bg-red-50 text-red-700'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {needsDocument
                      ? `A sick note is required because this request is ${requestedDays} day${
                          requestedDays === 1 ? '' : 's'
                        }. Current policy requires a sick note for ${
                          policy.sickLeaveDocumentThresholdDays
                        } or more day${
                          policy.sickLeaveDocumentThresholdDays === 1
                            ? ''
                            : 's'
                        }.`
                      : `No sick note required for this request. Current policy only requires one for ${policy.sickLeaveDocumentThresholdDays} or more day${
                          policy.sickLeaveDocumentThresholdDays === 1
                            ? ''
                            : 's'
                        }.`}
                  </div>
                ) : null}

                <label className="block">
                  <span className="mb-2 block text-sm font-medium">
                    Reason
                  </span>

                  <textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    rows={5}
                    placeholder="Add a short reason for your leave request..."
                    className="w-full resize-none border border-black/10 bg-[#f8fafc] px-4 py-3 text-sm outline-none transition focus:border-black"
                  />
                </label>

                <div className="border border-black/10 bg-[#f8fafc] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="flex items-center gap-2 text-sm font-semibold text-[#111827]">
                        <FileText size={15} />
                        Supporting document
                      </span>

                      <p className="mt-2 text-sm leading-6 text-gray-500">
                        {needsDocument
                          ? 'This request requires a supporting document before submission.'
                          : 'A document is optional for this request, but you may attach one if needed.'}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 border px-2 py-1 text-[11px] font-medium ${
                        needsDocument
                          ? 'border-red-200 bg-red-50 text-red-700'
                          : 'border-black/10 bg-white text-gray-500'
                      }`}
                    >
                      {needsDocument ? 'Required' : 'Optional'}
                    </span>
                  </div>

                  <input
                    type="file"
                    onChange={(event) =>
                      setDocumentFile(event.target.files?.[0] ?? null)
                    }
                    className="mt-5 w-full border border-dashed border-black/15 bg-white px-4 py-4 text-sm outline-none transition file:mr-4 file:border-0 file:bg-black file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
                  />

                  {documentFile ? (
                    <p className="mt-3 text-xs text-gray-500">
                      Selected file: {documentFile.name}
                    </p>
                  ) : null}
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex w-full items-center justify-center gap-2 border border-black bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      Submit request
                    </>
                  )}
                </button>
              </div>
            </form>

            <aside className="space-y-4">
              <div className="border border-black/10 bg-white p-5">
                <div className="mb-4 flex h-11 w-11 items-center justify-center border border-black/10 bg-[#111827] text-white">
                  <CalendarDays size={20} />
                </div>

                <p className="text-sm font-semibold text-[#111827]">
                  Leave summary
                </p>

                <p className="mt-1 text-sm leading-6 text-gray-500">
                  Updated from your selected leave type and dates.
                </p>

                <div className="mt-5 space-y-3 text-sm">
                  <SummaryRow
                    label="Leave type"
                    value={selectedLeaveType.label}
                  />

                  <SummaryRow
                    label="Allocated"
                    value={
                      hasHardLimit
                        ? `${selectedLeaveType.limit} days`
                        : 'No fixed limit'
                    }
                  />

                  <SummaryRow label="Used" value={`${usedDays} days`} />
                  <SummaryRow label="Pending" value={`${pendingDays} days`} />

                  <SummaryRow
                    label="Available"
                    value={
                      availableDays === null
                        ? 'No fixed limit'
                        : `${availableDays} days`
                    }
                  />

                  <SummaryRow
                    label="Requested"
                    value={
                      requestedDays > 0
                        ? `${requestedDays} day${
                            requestedDays === 1 ? '' : 's'
                          }`
                        : 'Select dates'
                    }
                  />

                  <SummaryRow
                    label="Document"
                    value={needsDocument ? 'Required' : 'Optional'}
                  />
                </div>

                {exceedsBalance ? (
                  <div className="mt-5 border border-red-200 bg-red-50 px-4 py-3 text-xs leading-5 text-red-700">
                    This request exceeds your available leave balance.
                  </div>
                ) : null}
              </div>

              <div className="border border-black/10 bg-[#111827] p-5 text-white">
                <p className="text-xs uppercase tracking-[0.22em] text-gray-400">
                  Current selection
                </p>

                <p className="mt-5 text-4xl font-semibold tracking-[-0.06em]">
                  {availableDays === null ? '∞' : availableDays}
                </p>

                <p className="mt-1 text-sm text-gray-300">
                  {availableDays === null
                    ? `no fixed limit for ${selectedLeaveType.label.toLowerCase()}`
                    : `days available for ${selectedLeaveType.label.toLowerCase()}`}
                </p>

                <div className="mt-6 border-t border-white/10 pt-5">
                  <p className="text-sm leading-6 text-gray-300">
                    Your request will be sent to HR for approval. You can track
                    the status from your employee portal.
                  </p>
                </div>
              </div>

              <div className="border border-black/10 bg-white p-5">
                <div className="mb-4 flex h-11 w-11 items-center justify-center border border-black/10 bg-[#f8fafc] text-gray-500">
                  <ShieldCheck size={20} />
                </div>

                <p className="text-sm font-semibold text-[#111827]">
                  HR policy
                </p>

                <p className="mt-2 text-sm leading-6 text-gray-500">
                  Annual leave allocation is currently{' '}
                  <strong>{policy.defaultAnnualLeaveDays} days</strong>. Sick
                  leave allocation is currently{' '}
                  <strong>{policy.sickLeaveCycleDays} days</strong>. Sick notes
                  are required for{' '}
                  <strong>
                    {policy.sickLeaveDocumentThresholdDays} or more day
                    {policy.sickLeaveDocumentThresholdDays === 1 ? '' : 's'}
                  </strong>
                  .
                </p>
              </div>
            </aside>
          </section>
        )}
      </div>
    </EmployeeShell>
  );
}

function PolicyBox({
  label,
  value,
  danger,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div
      className={`border p-4 ${
        danger
          ? 'border-red-200 bg-red-50 text-red-700'
          : 'border-black/10 bg-[#f8fafc] text-[#111827]'
      }`}
    >
      <p className="text-xs uppercase tracking-[0.16em] opacity-70">{label}</p>
      <p className="mt-2 text-sm font-semibold">{value}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-black/5 pb-3 last:border-b-0 last:pb-0">
      <span className="text-gray-500">{label}</span>
      <span className="text-right font-medium text-[#111827]">{value}</span>
    </div>
  );
}