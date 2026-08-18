'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AxiosError } from 'axios';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  History,
  Loader2,
  RefreshCw,
  TriangleAlert,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { api } from '@/lib/api';

type Employee = {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  jobTitle?: string | null;
  employmentStatus: string;
};

type PositionDetail = {
  id: string;
  departmentId?: string | null;
  code: string;
  title: string;
  description?: string | null;
  level?: string | null;
  employmentCategory?: string | null;
  approvedHeadcount: number;
  active: boolean;
  currentHeadcount: number;
  vacancies: number;
  employees: Employee[];
};

type Department = {
  id: string;
  name: string;
};

type Assignment = {
  id: string;
  employeeId: string;
  positionId: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  reason?: string | null;
  assignedByUserId?: string | null;
  current: boolean;
  employee?: Employee | null;
};

type PositionHistory = {
  position: {
    id: string;
    code: string;
    title: string;
    active: boolean;
  };
  assignments: Assignment[];
};

type ApiErrorPayload = {
  message?: string | string[];
};

function apiErrorMessage(error: unknown, fallback: string) {
  const message = (error as AxiosError<ApiErrorPayload>).response?.data?.message;
  return Array.isArray(message) ? message.join(' ') : message || fallback;
}

function formatDate(value?: string | null) {
  if (!value) return 'Present';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function categoryLabel(value?: string | null) {
  if (!value) return 'Not specified';
  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function PositionDetailPage() {
  const params = useParams<{ id: string }>();
  const positionId = params.id;
  const [position, setPosition] = useState<PositionDetail | null>(null);
  const [history, setHistory] = useState<PositionHistory | null>(null);
  const [department, setDepartment] = useState<Department | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (positionId) void loadPosition();
  }, [positionId]);

  async function loadPosition() {
    setLoading(true);
    setError('');

    try {
      const [positionResponse, historyResponse, departmentsResponse] = await Promise.all([
        api.get<PositionDetail>(`/positions/${positionId}`),
        api.get<PositionHistory>(`/positions/${positionId}/history`),
        api.get<Department[]>('/departments'),
      ]);

      setPosition(positionResponse.data);
      setHistory(historyResponse.data);
      setDepartment(
        departmentsResponse.data.find(
          (item) => item.id === positionResponse.data.departmentId,
        ) ?? null,
      );
    } catch (requestError: unknown) {
      setError(apiErrorMessage(requestError, 'Could not load this position.'));
    } finally {
      setLoading(false);
    }
  }

  const currentAssignments = useMemo(
    () => history?.assignments.filter((assignment) => assignment.current) ?? [],
    [history],
  );

  const formerAssignments = useMemo(
    () => history?.assignments.filter((assignment) => !assignment.current) ?? [],
    [history],
  );

  return (
    <DashboardShell activePage="recruitment">
      <div className="space-y-7">
        <section className="flex flex-col gap-5 border-b border-black/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              href="/dashboard/positions"
              className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-black"
            >
              <ArrowLeft size={15} />
              Position catalogue
            </Link>
            <p className="mb-2 text-sm uppercase tracking-[0.25em] text-gray-400">
              Workforce establishment
            </p>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#111827]">
              {position?.title ?? 'Position detail'}
            </h1>
            {position ? (
              <p className="mt-2 text-sm text-gray-500">
                {position.code} · {department?.name ?? 'No department'}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-3">
            {position?.active && position.vacancies > 0 ? (
              <Link
                href="/dashboard/recruitment/jobs"
                className="inline-flex items-center gap-2 border border-black bg-black px-4 py-3 text-sm font-medium text-white hover:bg-white hover:text-black"
              >
                <BriefcaseBusiness size={16} />
                Vacancy planning
              </Link>
            ) : null}
            <button
              type="button"
              onClick={loadPosition}
              className="inline-flex items-center gap-2 border border-black/10 bg-white px-4 py-3 text-sm font-medium text-gray-600 hover:border-black hover:text-black"
            >
              <RefreshCw size={15} />
              Refresh
            </button>
          </div>
        </section>

        {error ? (
          <div className="flex items-start gap-3 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <TriangleAlert size={17} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {loading ? (
          <div className="flex min-h-[520px] items-center justify-center border border-black/10 bg-white">
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <Loader2 size={18} className="animate-spin" />
              Loading position detail...
            </div>
          </div>
        ) : position ? (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Metric label="Approved seats" value={position.approvedHeadcount} helper="Authorised establishment" />
              <Metric label="Current occupants" value={position.currentHeadcount} helper="Active assignments" />
              <Metric label="Vacancies" value={position.vacancies} helper="Approved seats not filled" emphasis={position.vacancies > 0} />
              <Metric label="Status" value={position.active ? 'Active' : 'Archived'} helper="Position lifecycle" />
            </section>

            <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
              <div className="border border-black/10 bg-white">
                <div className="border-b border-black/10 px-6 py-5">
                  <div className="flex items-center gap-3">
                    <UsersRound size={18} className="text-gray-500" />
                    <div>
                      <h2 className="text-lg font-semibold tracking-[-0.03em] text-[#111827]">Current occupants</h2>
                      <p className="text-sm text-gray-500">Employees currently assigned to this position.</p>
                    </div>
                  </div>
                </div>

                {!currentAssignments.length ? (
                  <div className="px-6 py-14 text-center">
                    <UserRound size={34} className="mx-auto text-gray-300" />
                    <p className="mt-4 text-sm font-medium text-[#111827]">No current occupants</p>
                    <p className="mt-1 text-sm text-gray-500">This position currently contributes to approved vacancies.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-black/10">
                    {currentAssignments.map((assignment) => (
                      <OccupantRow key={assignment.id} assignment={assignment} />
                    ))}
                  </div>
                )}
              </div>

              <aside className="border border-black/10 bg-[#f8fafc] p-6">
                <div className="flex items-center gap-3">
                  <Building2 size={18} className="text-gray-500" />
                  <h2 className="font-semibold text-[#111827]">Position definition</h2>
                </div>
                <Definition label="Code" value={position.code} />
                <Definition label="Department" value={department?.name ?? 'No department'} />
                <Definition label="Level" value={position.level ?? 'Not specified'} />
                <Definition label="Employment category" value={categoryLabel(position.employmentCategory)} />
                <Definition label="Description" value={position.description ?? 'No description supplied.'} multiline />
              </aside>
            </section>

            <section className="border border-black/10 bg-white">
              <div className="border-b border-black/10 px-6 py-5">
                <div className="flex items-center gap-3">
                  <History size={18} className="text-gray-500" />
                  <div>
                    <h2 className="text-lg font-semibold tracking-[-0.03em] text-[#111827]">Assignment history</h2>
                    <p className="text-sm text-gray-500">Effective-dated record of previous occupancy for this position.</p>
                  </div>
                </div>
              </div>

              {!formerAssignments.length ? (
                <div className="px-6 py-12 text-center text-sm text-gray-500">No previous assignments recorded.</div>
              ) : (
                <div className="divide-y divide-black/10">
                  {formerAssignments.map((assignment) => (
                    <article key={assignment.id} className="grid gap-4 px-6 py-5 lg:grid-cols-[1.1fr_220px_1fr] lg:items-center">
                      <EmployeeIdentity employee={assignment.employee} />
                      <div className="flex items-start gap-2 text-sm text-gray-500">
                        <CalendarDays size={15} className="mt-0.5 shrink-0" />
                        <span>{formatDate(assignment.effectiveFrom)} → {formatDate(assignment.effectiveTo)}</span>
                      </div>
                      <div className="text-sm text-gray-500">
                        <span className="font-medium text-gray-700">Reason:</span>{' '}
                        {assignment.reason || 'Not recorded'}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </DashboardShell>
  );
}

function OccupantRow({ assignment }: { assignment: Assignment }) {
  return (
    <article className="grid gap-4 px-6 py-5 lg:grid-cols-[1fr_220px_auto] lg:items-center">
      <EmployeeIdentity employee={assignment.employee} />
      <div className="text-sm text-gray-500">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">Assigned since</p>
        <p className="mt-1">{formatDate(assignment.effectiveFrom)}</p>
      </div>
      {assignment.employee ? (
        <Link
          href={`/dashboard/employees/${assignment.employee.id}`}
          className="inline-flex justify-center border border-black/10 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:border-black hover:text-black"
        >
          View employee
        </Link>
      ) : null}
    </article>
  );
}

function EmployeeIdentity({ employee }: { employee?: Employee | null }) {
  if (!employee) {
    return <p className="text-sm text-gray-500">Employee record unavailable</p>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-[#111827]">{employee.firstName} {employee.lastName}</h3>
        <span className="border border-black/10 bg-[#f8fafc] px-2 py-1 text-[11px] font-medium text-gray-500">
          {employee.employeeNumber}
        </span>
      </div>
      <p className="mt-1 text-sm text-gray-500">{employee.jobTitle || 'No job title'} · {employee.employmentStatus}</p>
    </div>
  );
}

function Metric({ label, value, helper, emphasis }: { label: string; value: number | string; helper: string; emphasis?: boolean }) {
  return (
    <div className={`border p-5 ${emphasis ? 'border-amber-200 bg-amber-50' : 'border-black/10 bg-white'}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#111827]">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{helper}</p>
    </div>
  );
}

function Definition({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className="mt-5 border-t border-black/10 pt-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">{label}</p>
      <p className={`mt-1 text-sm text-gray-700 ${multiline ? 'leading-6' : ''}`}>{value}</p>
    </div>
  );
}
