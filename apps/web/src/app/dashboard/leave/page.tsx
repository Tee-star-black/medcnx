'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  Check,
  Clock,
  Download,
  Eye,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { api } from '@/lib/api';

type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | string;

type LeaveDocument = {
  id: string;
  originalName: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

type LeaveRequest = {
  id: string;
  leaveType: string;
  status: LeaveStatus;
  startDate: string;
  endDate: string;
  totalDays?: string | number;
  reason?: string | null;
  rejectionNote?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: {
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
  } | null;
  documents?: LeaveDocument[];
};

type OrganisationPolicy = {
  defaultAnnualLeaveDays: number;
  sickLeaveCycleDays: number;
  sickLeaveDocumentThresholdDays: number;
  leaveYearStartMonth: number;
};

const fallbackPolicy: OrganisationPolicy = {
  defaultAnnualLeaveDays: 15,
  sickLeaveCycleDays: 30,
  sickLeaveDocumentThresholdDays: 2,
  leaveYearStartMonth: 1,
};

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

function formatLeaveType(type: string) {
  return type
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function daysBetween(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const difference = end.getTime() - start.getTime();

  return Math.max(1, Math.floor(difference / (1000 * 60 * 60 * 24)) + 1);
}

function getRequestDays(request: LeaveRequest) {
  if (request.totalDays !== undefined && request.totalDays !== null) {
    return Number(request.totalDays);
  }

  return daysBetween(request.startDate, request.endDate);
}

function getEmployeeName(request: LeaveRequest) {
  if (!request.employee) {
    return 'Unassigned employee';
  }

  return `${request.employee.firstName} ${request.employee.lastName}`;
}

function getStatusClass(status: LeaveStatus) {
  if (status === 'APPROVED') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (status === 'PENDING') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  if (status === 'REJECTED') {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  if (status === 'CANCELLED') {
    return 'border-gray-200 bg-gray-50 text-gray-500';
  }

  return 'border-black/10 bg-white text-gray-600';
}

function monthName(month: number) {
  const names = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  return names[month - 1] ?? 'January';
}

function requiresDocumentByPolicy(
  request: LeaveRequest,
  policy: OrganisationPolicy,
) {
  const totalDays = getRequestDays(request);

  if (request.leaveType === 'SICK') {
    return totalDays >= policy.sickLeaveDocumentThresholdDays;
  }

  return [
    'FAMILY_RESPONSIBILITY',
    'MATERNITY',
    'PATERNITY',
    'STUDY',
  ].includes(request.leaveType);
}

export default function LeaveDashboardPage() {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [policy, setPolicy] = useState<OrganisationPolicy>(fallbackPolicy);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [downloadingDocumentId, setDownloadingDocumentId] = useState<
    string | null
  >(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadLeaveRequests();
  }, []);

  const filteredLeaveRequests = useMemo(() => {
    const query = search.trim().toLowerCase();

    return leaveRequests.filter((request) => {
      const matchesStatus =
        statusFilter === 'ALL' ? true : request.status === statusFilter;

      const matchesType =
        typeFilter === 'ALL' ? true : request.leaveType === typeFilter;

      const employeeName = getEmployeeName(request).toLowerCase();

      const matchesSearch = !query
        ? true
        : employeeName.includes(query) ||
          request.leaveType.toLowerCase().includes(query) ||
          request.employee?.employeeNumber.toLowerCase().includes(query) ||
          request.employee?.email?.toLowerCase().includes(query) ||
          request.employee?.department?.name.toLowerCase().includes(query) ||
          request.reason?.toLowerCase().includes(query);

      return matchesStatus && matchesType && matchesSearch;
    });
  }, [leaveRequests, search, statusFilter, typeFilter]);

  const pendingRequests = leaveRequests.filter(
    (request) => request.status === 'PENDING',
  );

  const approvedRequests = leaveRequests.filter(
    (request) => request.status === 'APPROVED',
  );

  const rejectedRequests = leaveRequests.filter(
    (request) => request.status === 'REJECTED',
  );

  const totalApprovedDays = approvedRequests.reduce((total, request) => {
    return total + getRequestDays(request);
  }, 0);

  const requestsNeedingDocuments = leaveRequests.filter((request) =>
    requiresDocumentByPolicy(request, policy),
  );

  const requestsMissingDocuments = requestsNeedingDocuments.filter(
    (request) => !request.documents || request.documents.length === 0,
  );

  const leaveByType = useMemo(() => {
    const grouped = leaveRequests.reduce<Record<string, number>>(
      (result, request) => {
        result[request.leaveType] =
          (result[request.leaveType] ?? 0) + getRequestDays(request);
        return result;
      },
      {},
    );

    return Object.entries(grouped)
      .map(([leaveType, days]) => ({
        leaveType,
        days,
      }))
      .sort((a, b) => b.days - a.days);
  }, [leaveRequests]);

  async function loadLeaveRequests() {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const [leaveResponse, organisationResponse] = await Promise.all([
        api.get<LeaveRequest[]>('/leave'),
        api.get<OrganisationPolicy>('/organisations/me'),
      ]);

      setLeaveRequests(leaveResponse.data);

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
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ??
        'Could not load leave requests.';

      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally {
      setLoading(false);
    }
  }

  async function approveLeave(request: LeaveRequest) {
    setError('');
    setSuccess('');
    setActionId(request.id);

    try {
      await api.patch(`/leave/${request.id}/approve`);

      setSuccess('Leave request approved successfully.');
      await loadLeaveRequests();
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ??
        'Could not approve leave request.';

      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally {
      setActionId(null);
    }
  }

  async function rejectLeave(request: LeaveRequest) {
    const rejectionNote = window.prompt(
      `Reject leave request for ${getEmployeeName(request)}?\n\nAdd a reason:`,
    );

    if (rejectionNote === null) {
      return;
    }

    if (!rejectionNote.trim()) {
      setError('Please provide a rejection reason.');
      return;
    }

    setError('');
    setSuccess('');
    setActionId(request.id);

    try {
      await api.patch(`/leave/${request.id}/reject`, {
        rejectionNote: rejectionNote.trim(),
      });

      setSuccess('Leave request rejected successfully.');
      await loadLeaveRequests();
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ??
        'Could not reject leave request.';

      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally {
      setActionId(null);
    }
  }

  async function downloadLeaveDocument(document: LeaveDocument) {
    setError('');
    setSuccess('');
    setDownloadingDocumentId(document.id);

    try {
      const response = await api.get(`/leave/documents/${document.id}/download`, {
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
        requestError?.response?.data?.message ??
        'Could not download leave document.';

      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally {
      setDownloadingDocumentId(null);
    }
  }

  return (
    <DashboardShell activePage="leave">
      <div className="space-y-8">
        <section className="flex flex-col gap-5 border-b border-black/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-sm uppercase tracking-[0.25em] text-gray-400">
              Leave management
            </p>

            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#111827]">
              Leave requests
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              Review employee leave requests, approve pending applications,
              monitor policy impact and view supporting documents.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard/leave/calendar"
              className="inline-flex items-center justify-center gap-2 border border-black bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-white hover:text-black"
            >
              <CalendarDays size={16} />
              View calendar
            </Link>

            <button
              type="button"
              onClick={loadLeaveRequests}
              className="inline-flex items-center justify-center gap-2 border border-black/10 bg-white px-5 py-3 text-sm font-medium text-gray-600 transition hover:border-black hover:text-black"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total requests"
            value={String(leaveRequests.length)}
            helper="All statuses"
            icon={<CalendarDays size={18} />}
          />

          <StatCard
            title="Pending"
            value={String(pendingRequests.length)}
            helper="Awaiting review"
            icon={<Clock size={18} />}
          />

          <StatCard
            title="Approved days"
            value={String(totalApprovedDays)}
            helper={`${approvedRequests.length} approved requests`}
            icon={<Check size={18} />}
          />

          <StatCard
            title="Document issues"
            value={String(requestsMissingDocuments.length)}
            helper="Required but missing"
            icon={<AlertTriangle size={18} />}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <section className="border border-black/10 bg-white">
            <div className="grid gap-4 border-b border-black/10 px-6 py-5 lg:grid-cols-[1fr_auto]">
              <div>
                <h2 className="text-lg font-semibold tracking-[-0.03em]">
                  All leave requests
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  {filteredLeaveRequests.length} request
                  {filteredLeaveRequests.length === 1 ? '' : 's'} shown.
                </p>
              </div>

              <div className="grid gap-3 xl:grid-cols-[1fr_170px_170px]">
                <div className="relative">
                  <Search
                    size={16}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search employee, department, type..."
                    className="w-full min-w-[260px] border border-black/10 bg-[#f8fafc] py-3 pl-11 pr-4 text-sm outline-none transition focus:border-black"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="w-full border border-black/10 bg-[#f8fafc] px-4 py-3 text-sm outline-none transition focus:border-black"
                >
                  <option value="ALL">All statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>

                <select
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value)}
                  className="w-full border border-black/10 bg-[#f8fafc] px-4 py-3 text-sm outline-none transition focus:border-black"
                >
                  <option value="ALL">All types</option>
                  <option value="ANNUAL">Annual</option>
                  <option value="SICK">Sick</option>
                  <option value="FAMILY_RESPONSIBILITY">
                    Family responsibility
                  </option>
                  <option value="MATERNITY">Maternity</option>
                  <option value="PATERNITY">Paternity</option>
                  <option value="STUDY">Study</option>
                  <option value="UNPAID">Unpaid</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>

            {error ? (
              <div className="mx-6 mt-5 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            {success ? (
              <div className="mx-6 mt-5 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {success}
              </div>
            ) : null}

            <div className="p-6">
              {loading ? (
                <div className="flex min-h-[420px] items-center justify-center">
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <Loader2 className="animate-spin" size={18} />
                    Loading leave requests...
                  </div>
                </div>
              ) : filteredLeaveRequests.length === 0 ? (
                <div className="border border-dashed border-black/15 bg-[#f8fafc] px-5 py-14 text-center">
                  <CalendarDays size={32} className="mx-auto text-gray-300" />

                  <p className="mt-4 text-sm font-medium text-[#111827]">
                    No leave requests found
                  </p>

                  <p className="mt-1 text-sm text-gray-500">
                    Try changing the search term or filters.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredLeaveRequests.map((request) => {
                    const totalDays = getRequestDays(request);
                    const requiredDocument = requiresDocumentByPolicy(
                      request,
                      policy,
                    );
                    const hasDocument =
                      Boolean(request.documents) &&
                      request.documents!.length > 0;
                    const isMissingDocument = requiredDocument && !hasDocument;

                    return (
                      <article
                        key={request.id}
                        className="border border-black/10 bg-[#f8fafc] p-5"
                      >
                        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center border border-black/10 bg-white text-gray-500">
                                <Clock size={17} />
                              </div>

                              <div>
                                <h3 className="text-sm font-semibold text-[#111827]">
                                  {getEmployeeName(request)}
                                </h3>

                                <p className="mt-1 text-xs text-gray-500">
                                  {request.employee?.employeeNumber ??
                                    'No employee number'}{' '}
                                  ·{' '}
                                  {request.employee?.jobTitle ??
                                    'No job title captured'}
                                </p>
                              </div>

                              <span
                                className={`border px-2 py-1 text-[11px] font-medium ${getStatusClass(
                                  request.status,
                                )}`}
                              >
                                {request.status}
                              </span>

                              <span className="border border-black/10 bg-white px-2 py-1 text-[11px] font-medium text-gray-500">
                                {formatLeaveType(request.leaveType)}
                              </span>

                              {isMissingDocument ? (
                                <span className="inline-flex items-center gap-1 border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700">
                                  <AlertTriangle size={12} />
                                  Missing document
                                </span>
                              ) : hasDocument ? (
                                <span className="inline-flex items-center gap-1 border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">
                                  <FileText size={12} />
                                  Document attached
                                </span>
                              ) : null}
                            </div>

                            <div className="mt-4 grid gap-3 text-sm text-gray-500 md:grid-cols-3">
                              <InfoBlock
                                label="Start date"
                                value={formatDate(request.startDate)}
                              />

                              <InfoBlock
                                label="End date"
                                value={formatDate(request.endDate)}
                              />

                              <InfoBlock
                                label="Duration"
                                value={`${totalDays} day${
                                  totalDays === 1 ? '' : 's'
                                }`}
                              />
                            </div>

                            <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-400">
                              {request.employee?.department ? (
                                <span>{request.employee.department.name}</span>
                              ) : null}

                              {request.employee?.email ? (
                                <span>{request.employee.email}</span>
                              ) : null}

                              <span>
                                Submitted {formatDate(request.createdAt)}
                              </span>
                            </div>

                            {request.reason ? (
                              <p className="mt-4 border-t border-black/10 pt-4 text-sm leading-6 text-gray-500">
                                {request.reason}
                              </p>
                            ) : null}

                            {request.rejectionNote ||
                            request.rejectionReason ? (
                              <p className="mt-4 border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
                                Rejection reason:{' '}
                                {request.rejectionNote ??
                                  request.rejectionReason}
                              </p>
                            ) : null}

                            {request.documents &&
                            request.documents.length > 0 ? (
                              <div className="mt-4 border-t border-black/10 pt-4">
                                <p className="mb-3 text-xs uppercase tracking-[0.18em] text-gray-400">
                                  Supporting documents
                                </p>

                                <div className="flex flex-wrap gap-2">
                                  {request.documents.map((document) => (
                                    <button
                                      key={document.id}
                                      type="button"
                                      onClick={() =>
                                        downloadLeaveDocument(document)
                                      }
                                      disabled={
                                        downloadingDocumentId === document.id
                                      }
                                      className="inline-flex items-center gap-2 border border-black/10 bg-white px-3 py-2 text-xs text-gray-600 transition hover:border-black hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {downloadingDocumentId === document.id ? (
                                        <Loader2
                                          className="animate-spin"
                                          size={14}
                                        />
                                      ) : (
                                        <Download size={14} />
                                      )}

                                      <span>{document.originalName}</span>

                                      <span className="text-gray-400">
                                        {formatFileSize(document.sizeBytes)}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </div>

                          <div className="flex shrink-0 flex-wrap gap-2 xl:justify-end">
                            <Link
                              href="/dashboard/leave/calendar"
                              className="inline-flex items-center justify-center gap-2 border border-black/10 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition hover:border-black hover:text-black"
                            >
                              <Eye size={15} />
                              Calendar
                            </Link>

                            {request.status === 'PENDING' ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => approveLeave(request)}
                                  disabled={actionId === request.id}
                                  className="inline-flex items-center justify-center gap-2 border border-emerald-200 bg-white px-4 py-2 text-sm font-medium text-emerald-700 transition hover:border-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {actionId === request.id ? (
                                    <Loader2
                                      className="animate-spin"
                                      size={15}
                                    />
                                  ) : (
                                    <Check size={15} />
                                  )}
                                  Approve
                                </button>

                                <button
                                  type="button"
                                  onClick={() => rejectLeave(request)}
                                  disabled={actionId === request.id}
                                  className="inline-flex items-center justify-center gap-2 border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition hover:border-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {actionId === request.id ? (
                                    <Loader2
                                      className="animate-spin"
                                      size={15}
                                    />
                                  ) : (
                                    <X size={15} />
                                  )}
                                  Reject
                                </button>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-6">
            <section className="border border-black/10 bg-[#111827] p-6 text-white">
              <div className="flex h-10 w-10 items-center justify-center border border-white/15 bg-white/10">
                <ShieldCheck size={18} />
              </div>

              <h2 className="mt-5 text-lg font-semibold tracking-[-0.03em]">
                HR policy summary
              </h2>

              <div className="mt-5 space-y-3 text-sm text-white/70">
                <SummaryRowDark
                  label="Annual leave"
                  value={`${policy.defaultAnnualLeaveDays} days`}
                />

                <SummaryRowDark
                  label="Sick leave"
                  value={`${policy.sickLeaveCycleDays} days`}
                />

                <SummaryRowDark
                  label="Sick note"
                  value={`${policy.sickLeaveDocumentThresholdDays}+ days`}
                />

                <SummaryRowDark
                  label="Leave year"
                  value={monthName(policy.leaveYearStartMonth)}
                />
              </div>
            </section>

            <section className="border border-black/10 bg-white">
              <div className="border-b border-black/10 px-6 py-5">
                <h2 className="text-lg font-semibold tracking-[-0.03em]">
                  Leave by type
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Total requested days grouped by leave category.
                </p>
              </div>

              <div className="space-y-3 p-6">
                {leaveByType.length === 0 ? (
                  <p className="text-sm text-gray-500">No leave data yet.</p>
                ) : (
                  leaveByType.map((item) => {
                    const percentage =
                      totalApprovedDays === 0
                        ? 0
                        : Math.min(
                            100,
                            Math.round((item.days / totalApprovedDays) * 100),
                          );

                    return (
                      <div
                        key={item.leaveType}
                        className="border border-black/10 bg-[#f8fafc] p-4"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-sm font-medium text-[#111827]">
                              {formatLeaveType(item.leaveType)}
                            </p>

                            <p className="mt-1 text-xs text-gray-500">
                              {item.days} day{item.days === 1 ? '' : 's'}
                            </p>
                          </div>

                          <BarChart3 size={16} className="text-gray-400" />
                        </div>

                        <div className="mt-3 h-2 border border-black/10 bg-white">
                          <div
                            className="h-full bg-[#111827]"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            <section className="border border-black/10 bg-white">
              <div className="border-b border-black/10 px-6 py-5">
                <h2 className="text-lg font-semibold tracking-[-0.03em]">
                  Document compliance
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Policy-driven supporting document checks.
                </p>
              </div>

              <div className="space-y-3 p-6">
                <InfoBlock
                  label="Requires documents"
                  value={String(requestsNeedingDocuments.length)}
                />

                <InfoBlock
                  label="Missing documents"
                  value={String(requestsMissingDocuments.length)}
                />

                <p className="text-sm leading-6 text-gray-500">
                  Sick leave requests require a document from{' '}
                  <strong>
                    {policy.sickLeaveDocumentThresholdDays} day
                    {policy.sickLeaveDocumentThresholdDays === 1 ? '' : 's'}
                  </strong>{' '}
                  upward, based on organisation settings.
                </p>
              </div>
            </section>
          </aside>
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

function SummaryRowDark({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-3 last:border-b-0 last:pb-0">
      <span>{label}</span>
      <span className="text-right font-medium text-white">{value}</span>
    </div>
  );
}