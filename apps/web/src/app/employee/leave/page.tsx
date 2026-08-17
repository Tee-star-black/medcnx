'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { EmployeeShell } from '@/components/employee/EmployeeShell';
import { api } from '@/lib/api';

type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

type LeaveRequest = {
  id: string;
  leaveType: string;
  status: LeaveStatus;
  startDate: string;
  endDate: string;
  totalDays: string | number;
  reason?: string | null;
  rejectionNote?: string | null;
  createdAt: string;
  documents?: Array<{
    id: string;
    originalName: string;
  }>;
};

type OrganisationPolicy = {
  defaultAnnualLeaveDays: number;
  sickLeaveCycleDays: number;
  sickLeaveDocumentThresholdDays: number;
  leaveYearStartMonth: number;
};

type LeaveBalance = {
  leaveType: string;
  label: string;
  allocation: number | null;
  used: number;
  pending: number;
  available: number | null;
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

function formatLeaveType(value: string) {
  return value
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
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

  return 'border-gray-200 bg-gray-50 text-gray-600';
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

export default function EmployeeLeaveDashboardPage() {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [policy, setPolicy] = useState<OrganisationPolicy>(fallbackPolicy);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadLeaveDashboard();
  }, []);

  async function loadLeaveDashboard() {
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
        'Could not load your leave dashboard.';

      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally {
      setLoading(false);
    }
  }

  const balances = useMemo<LeaveBalance[]>(() => {
    const configs = [
      {
        leaveType: 'ANNUAL',
        label: 'Annual leave',
        allocation: policy.defaultAnnualLeaveDays,
      },
      {
        leaveType: 'SICK',
        label: 'Sick leave',
        allocation: policy.sickLeaveCycleDays,
      },
      {
        leaveType: 'FAMILY_RESPONSIBILITY',
        label: 'Family responsibility',
        allocation: 3,
      },
      {
        leaveType: 'MATERNITY',
        label: 'Maternity leave',
        allocation: 120,
      },
      {
        leaveType: 'PATERNITY',
        label: 'Paternity leave',
        allocation: 10,
      },
      {
        leaveType: 'UNPAID',
        label: 'Unpaid leave',
        allocation: null,
      },
      {
        leaveType: 'OTHER',
        label: 'Other leave',
        allocation: null,
      },
    ];

    return configs.map((config) => {
      const used = getUsedLeaveDays(leaveRequests, config.leaveType);
      const pending = getPendingLeaveDays(leaveRequests, config.leaveType);

      return {
        ...config,
        used,
        pending,
        available:
          config.allocation === null
            ? null
            : Math.max(config.allocation - used - pending, 0),
      };
    });
  }, [leaveRequests, policy]);

  const pendingRequests = leaveRequests.filter(
    (request) => request.status === 'PENDING',
  );

  const approvedRequests = leaveRequests.filter(
    (request) => request.status === 'APPROVED',
  );

  const rejectedRequests = leaveRequests.filter(
    (request) => request.status === 'REJECTED',
  );

  const recentRequests = leaveRequests.slice(0, 8);

  return (
    <EmployeeShell>
      <div className="space-y-8">
        <section className="flex flex-col gap-5 border-b border-black/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-sm uppercase tracking-[0.25em] text-gray-400">
              Leave management
            </p>

            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#111827]">
              My leave
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              Track your leave balances, pending requests, approved leave and
              document requirements.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={loadLeaveDashboard}
              className="inline-flex items-center justify-center gap-2 border border-black/10 bg-white px-5 py-3 text-sm font-medium text-gray-600 transition hover:border-black hover:text-black"
            >
              <RefreshCw size={16} />
              Refresh
            </button>

            <Link
              href="/employee/leave/new"
              className="inline-flex items-center justify-center gap-2 border border-black bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-white hover:text-black"
            >
              <Plus size={16} />
              Request leave
            </Link>
          </div>
        </section>

        {error ? (
          <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="flex min-h-[460px] items-center justify-center border border-black/10 bg-white">
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <Loader2 className="animate-spin" size={18} />
              Loading leave dashboard...
            </div>
          </div>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-4">
              <StatCard
                title="Total requests"
                value={String(leaveRequests.length)}
                helper="All leave records"
              />

              <StatCard
                title="Pending"
                value={String(pendingRequests.length)}
                helper="Awaiting HR review"
              />

              <StatCard
                title="Approved"
                value={String(approvedRequests.length)}
                helper="Approved requests"
              />

              <StatCard
                title="Rejected"
                value={String(rejectedRequests.length)}
                helper="Declined requests"
              />
            </section>

            <section className="grid gap-6 xl:grid-cols-[1fr_380px]">
              <section className="border border-black/10 bg-white">
                <div className="flex items-start justify-between gap-5 border-b border-black/10 px-6 py-5">
                  <div>
                    <h2 className="text-lg font-semibold tracking-[-0.03em]">
                      Leave balances
                    </h2>

                    <p className="mt-1 text-sm text-gray-500">
                      Balances are calculated from approved and pending leave
                      requests.
                    </p>
                  </div>

                  <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-black/10 bg-[#f8fafc] text-gray-500">
                    <CalendarDays size={18} />
                  </div>
                </div>

                <div className="grid gap-4 p-6 md:grid-cols-2">
                  {balances.map((balance) => (
                    <BalanceCard key={balance.leaveType} balance={balance} />
                  ))}
                </div>
              </section>

              <aside className="space-y-6">
                <section className="border border-black/10 bg-[#111827] p-6 text-white">
                  <div className="flex h-10 w-10 items-center justify-center border border-white/15 bg-white/10">
                    <ShieldCheck size={18} />
                  </div>

                  <h2 className="mt-5 text-lg font-semibold tracking-[-0.03em]">
                    Current HR policy
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
                      label="Sick note required"
                      value={`${policy.sickLeaveDocumentThresholdDays}+ days`}
                    />

                    <SummaryRowDark
                      label="Leave year starts"
                      value={monthName(policy.leaveYearStartMonth)}
                    />
                  </div>
                </section>

                <section className="border border-black/10 bg-white">
                  <div className="border-b border-black/10 px-6 py-5">
                    <h2 className="text-lg font-semibold tracking-[-0.03em]">
                      Document rule
                    </h2>

                    <p className="mt-1 text-sm text-gray-500">
                      Sick leave document requirements.
                    </p>
                  </div>

                  <div className="p-6">
                    <div className="border border-black/10 bg-[#f8fafc] p-5">
                      <div className="flex items-center gap-3">
                        <FileText size={17} className="text-gray-400" />

                        <p className="text-sm font-semibold text-[#111827]">
                          Sick note policy
                        </p>
                      </div>

                      <p className="mt-3 text-sm leading-6 text-gray-500">
                        A supporting document is required for sick leave requests
                        of{' '}
                        <strong>
                          {policy.sickLeaveDocumentThresholdDays} or more day
                          {policy.sickLeaveDocumentThresholdDays === 1
                            ? ''
                            : 's'}
                        </strong>
                        .
                      </p>
                    </div>
                  </div>
                </section>
              </aside>
            </section>

            <section className="border border-black/10 bg-white">
              <div className="border-b border-black/10 px-6 py-5">
                <h2 className="text-lg font-semibold tracking-[-0.03em]">
                  Recent requests
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Your latest leave request activity.
                </p>
              </div>

              <div className="p-6">
                {recentRequests.length === 0 ? (
                  <div className="border border-dashed border-black/15 bg-[#f8fafc] px-5 py-14 text-center">
                    <CalendarDays size={32} className="mx-auto text-gray-300" />

                    <p className="mt-4 text-sm font-medium text-[#111827]">
                      No leave requests yet
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                      Your submitted leave requests will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentRequests.map((request) => (
                      <article
                        key={request.id}
                        className="border border-black/10 bg-[#f8fafc] p-5"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-3">
                              <h3 className="text-sm font-semibold text-[#111827]">
                                {formatLeaveType(request.leaveType)}
                              </h3>

                              <span
                                className={`border px-2 py-1 text-[11px] font-medium ${getStatusClass(
                                  request.status,
                                )}`}
                              >
                                {request.status}
                              </span>

                              {request.documents &&
                              request.documents.length > 0 ? (
                                <span className="inline-flex items-center gap-1 border border-black/10 bg-white px-2 py-1 text-[11px] font-medium text-gray-500">
                                  <FileText size={12} />
                                  Document attached
                                </span>
                              ) : null}
                            </div>

                            <p className="mt-3 text-sm text-gray-500">
                              {formatDate(request.startDate)} -{' '}
                              {formatDate(request.endDate)} ·{' '}
                              {Number(request.totalDays)} day
                              {Number(request.totalDays) === 1 ? '' : 's'}
                            </p>

                            {request.reason ? (
                              <p className="mt-3 text-sm leading-6 text-gray-500">
                                {request.reason}
                              </p>
                            ) : null}

                            {request.rejectionNote ? (
                              <p className="mt-3 border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
                                {request.rejectionNote}
                              </p>
                            ) : null}
                          </div>

                          <p className="text-xs text-gray-400">
                            Submitted {formatDate(request.createdAt)}
                          </p>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </EmployeeShell>
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

      <p className="mt-3 text-2xl font-semibold tracking-[-0.05em] text-[#111827]">
        {value}
      </p>

      <p className="mt-1 text-sm text-gray-500">{helper}</p>
    </div>
  );
}

function BalanceCard({ balance }: { balance: LeaveBalance }) {
  const percentage =
    balance.allocation === null || balance.allocation === 0
      ? 0
      : Math.round(((balance.available ?? 0) / balance.allocation) * 100);

  return (
    <article className="border border-black/10 bg-[#f8fafc] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-[#111827]">
            {balance.label}
          </h3>

          <p className="mt-1 text-xs text-gray-500">
            {balance.allocation === null
              ? 'No fixed allocation'
              : `${balance.allocation} days allocated`}
          </p>
        </div>

        <span className="border border-black/10 bg-white px-2 py-1 text-xs font-medium text-gray-500">
          {balance.available === null ? '∞' : balance.available}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
        <BalanceMetric label="Used" value={String(balance.used)} />
        <BalanceMetric label="Pending" value={String(balance.pending)} />
        <BalanceMetric
          label="Available"
          value={balance.available === null ? '∞' : String(balance.available)}
        />
      </div>

      {balance.allocation !== null ? (
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-xs text-gray-400">
            <span>Availability</span>
            <span>{percentage}%</span>
          </div>

          <div className="h-2 border border-black/10 bg-white">
            <div
              className="h-full bg-[#111827]"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      ) : null}
    </article>
  );
}

function BalanceMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-black/10 bg-white p-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-gray-400">
        {label}
      </p>

      <p className="mt-1 text-sm font-semibold text-[#111827]">{value}</p>
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