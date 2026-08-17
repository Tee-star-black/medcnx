'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  RefreshCw,
  Search,
  UserRound,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { api } from '@/lib/api';

type LeaveStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | string;

type LeaveRequest = {
  id: string;
  leaveType: string;
  status: LeaveStatus;
  startDate: string;
  endDate: string;
  reason?: string | null;
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
};

const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const monthNames = [
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

function startOfDay(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function isSameDay(a: Date, b: Date) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

function formatDate(value: string) {
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

function daysBetween(startDate: string, endDate: string) {
  const start = startOfDay(new Date(startDate));
  const end = startOfDay(new Date(endDate));

  const difference = end.getTime() - start.getTime();
  return Math.max(1, Math.floor(difference / (1000 * 60 * 60 * 24)) + 1);
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

function getCalendarDays(viewDate: Date) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  const firstWeekDay = firstDayOfMonth.getDay() === 0 ? 7 : firstDayOfMonth.getDay();
  const leadingDays = firstWeekDay - 1;

  const calendarStart = new Date(year, month, 1 - leadingDays);

  const days: Date[] = [];

  for (let index = 0; index < 42; index += 1) {
    const day = new Date(calendarStart);
    day.setDate(calendarStart.getDate() + index);
    days.push(day);
  }

  const lastVisibleDay = days[days.length - 1];

  if (
    lastVisibleDay.getMonth() !== lastDayOfMonth.getMonth() &&
    lastVisibleDay.getDate() < 7
  ) {
    return days;
  }

  return days;
}

function requestTouchesDate(request: LeaveRequest, date: Date) {
  const day = startOfDay(date);
  const start = startOfDay(new Date(request.startDate));
  const end = startOfDay(new Date(request.endDate));

  return day.getTime() >= start.getTime() && day.getTime() <= end.getTime();
}

function employeeName(request: LeaveRequest) {
  if (!request.employee) {
    return 'Unassigned employee';
  }

  return `${request.employee.firstName} ${request.employee.lastName}`;
}

export default function LeaveCalendarPage() {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadLeaveRequests();
  }, []);

  const calendarDays = useMemo(() => {
    return getCalendarDays(viewDate);
  }, [viewDate]);

  const filteredLeaveRequests = useMemo(() => {
    const query = search.trim().toLowerCase();

    return leaveRequests.filter((request) => {
      const matchesStatus =
        statusFilter === 'ALL' ? true : request.status === statusFilter;

      const matchesSearch = !query
        ? true
        : employeeName(request).toLowerCase().includes(query) ||
          request.leaveType.toLowerCase().includes(query) ||
          request.employee?.employeeNumber.toLowerCase().includes(query) ||
          request.employee?.department?.name.toLowerCase().includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [leaveRequests, search, statusFilter]);

  const selectedDayRequests = useMemo(() => {
    return filteredLeaveRequests
      .filter((request) => requestTouchesDate(request, selectedDate))
      .sort((a, b) => {
        const statusOrder: Record<string, number> = {
          APPROVED: 1,
          PENDING: 2,
          REJECTED: 3,
          CANCELLED: 4,
        };

        return (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99);
      });
  }, [filteredLeaveRequests, selectedDate]);

  const monthRequests = useMemo(() => {
    return filteredLeaveRequests.filter((request) => {
      const start = new Date(request.startDate);
      const end = new Date(request.endDate);

      const monthStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
      const monthEnd = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);

      return start <= monthEnd && end >= monthStart;
    });
  }, [filteredLeaveRequests, viewDate]);

  const approvedCount = monthRequests.filter(
    (request) => request.status === 'APPROVED',
  ).length;

  const pendingCount = monthRequests.filter(
    (request) => request.status === 'PENDING',
  ).length;

  const totalLeaveDays = monthRequests
    .filter((request) => request.status === 'APPROVED')
    .reduce((total, request) => total + daysBetween(request.startDate, request.endDate), 0);

  async function loadLeaveRequests() {
    setLoading(true);
    setError('');

    try {
      const response = await api.get<LeaveRequest[]>('/leave');
      setLeaveRequests(response.data);
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ??
        'Could not load leave calendar.';

      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally {
      setLoading(false);
    }
  }

  function goToPreviousMonth() {
    setViewDate((current) => {
      const nextDate = new Date(current);
      nextDate.setMonth(current.getMonth() - 1);
      return nextDate;
    });
  }

  function goToNextMonth() {
    setViewDate((current) => {
      const nextDate = new Date(current);
      nextDate.setMonth(current.getMonth() + 1);
      return nextDate;
    });
  }

  function goToToday() {
    const today = new Date();
    setViewDate(today);
    setSelectedDate(today);
  }

  return (
    <DashboardShell activePage="leave">
      <div className="space-y-8">
        <section className="flex flex-col gap-5 border-b border-black/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-sm uppercase tracking-[0.25em] text-gray-400">
              Leave planning
            </p>

            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#111827]">
              Leave calendar
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              View pending and approved leave requests across the month.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={goToToday}
              className="border border-black/10 bg-white px-5 py-3 text-sm font-medium text-gray-600 transition hover:border-black hover:text-black"
            >
              Today
            </button>

            <button
              type="button"
              onClick={loadLeaveRequests}
              className="inline-flex items-center gap-2 border border-black bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-white hover:text-black"
            >
              <RefreshCw size={15} />
              Refresh
            </button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <StatCard title="This month" value={String(monthRequests.length)} />
          <StatCard title="Approved" value={String(approvedCount)} />
          <StatCard title="Pending" value={String(pendingCount)} />
          <StatCard title="Approved days" value={String(totalLeaveDays)} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <div className="border border-black/10 bg-white">
            <div className="flex flex-col gap-4 border-b border-black/10 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={goToPreviousMonth}
                  className="flex h-10 w-10 items-center justify-center border border-black/10 bg-white text-gray-500 transition hover:border-black hover:text-black"
                >
                  <ChevronLeft size={17} />
                </button>

                <div className="min-w-[180px] text-center">
                  <p className="text-lg font-semibold tracking-[-0.04em]">
                    {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={goToNextMonth}
                  className="flex h-10 w-10 items-center justify-center border border-black/10 bg-white text-gray-500 transition hover:border-black hover:text-black"
                >
                  <ChevronRight size={17} />
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
                <div className="relative">
                  <Search
                    size={16}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search employee, type, department..."
                    className="w-full border border-black/10 bg-[#f8fafc] py-3 pl-11 pr-4 text-sm outline-none transition focus:border-black"
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
              </div>
            </div>

            {error ? (
              <div className="mx-6 mt-5 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <div className="p-4 sm:p-6">
              {loading ? (
                <div className="flex min-h-[520px] items-center justify-center">
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <Loader2 className="animate-spin" size={18} />
                    Loading leave calendar...
                  </div>
                </div>
              ) : (
                <div className="overflow-hidden border border-black/10">
                  <div className="grid grid-cols-7 border-b border-black/10 bg-[#f8fafc]">
                    {weekDays.map((day) => (
                      <div
                        key={day}
                        className="border-r border-black/10 px-3 py-3 text-center text-xs font-medium uppercase tracking-[0.16em] text-gray-400 last:border-r-0"
                      >
                        {day}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7">
                    {calendarDays.map((day) => {
                      const isCurrentMonth =
                        day.getMonth() === viewDate.getMonth();

                      const isToday = isSameDay(day, new Date());
                      const isSelected = isSameDay(day, selectedDate);

                      const dayRequests = filteredLeaveRequests.filter((request) =>
                        requestTouchesDate(request, day),
                      );

                      return (
                        <button
                          key={day.toISOString()}
                          type="button"
                          onClick={() => setSelectedDate(day)}
                          className={`min-h-[124px] border-r border-t border-black/10 p-2 text-left transition last:border-r-0 hover:bg-[#f8fafc] ${
                            isSelected ? 'bg-[#111827]/5 ring-1 ring-inset ring-[#111827]' : ''
                          } ${!isCurrentMonth ? 'bg-gray-50 text-gray-300' : 'bg-white'}`}
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <span
                              className={`flex h-7 w-7 items-center justify-center text-xs font-medium ${
                                isToday
                                  ? 'bg-[#111827] text-white'
                                  : isCurrentMonth
                                    ? 'text-[#111827]'
                                    : 'text-gray-300'
                              }`}
                            >
                              {day.getDate()}
                            </span>

                            {dayRequests.length > 0 ? (
                              <span className="text-[11px] text-gray-400">
                                {dayRequests.length}
                              </span>
                            ) : null}
                          </div>

                          <div className="space-y-1">
                            {dayRequests.slice(0, 3).map((request) => (
                              <div
                                key={request.id}
                                className={`truncate border px-2 py-1 text-[11px] font-medium ${getStatusClass(
                                  request.status,
                                )}`}
                              >
                                {employeeName(request)}
                              </div>
                            ))}

                            {dayRequests.length > 3 ? (
                              <div className="px-2 py-1 text-[11px] text-gray-400">
                                +{dayRequests.length - 3} more
                              </div>
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <aside className="border border-black/10 bg-white">
            <div className="border-b border-black/10 px-6 py-5">
              <p className="text-xs uppercase tracking-[0.18em] text-gray-400">
                Selected day
              </p>

              <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[#111827]">
                {new Intl.DateTimeFormat('en-ZA', {
                  weekday: 'long',
                  month: 'long',
                  day: '2-digit',
                  year: 'numeric',
                }).format(selectedDate)}
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                {selectedDayRequests.length} leave request
                {selectedDayRequests.length === 1 ? '' : 's'}
              </p>
            </div>

            <div className="p-6">
              {selectedDayRequests.length === 0 ? (
                <div className="border border-dashed border-black/15 bg-[#f8fafc] px-5 py-12 text-center">
                  <CalendarDays size={32} className="mx-auto text-gray-300" />

                  <p className="mt-4 text-sm font-medium text-[#111827]">
                    No leave scheduled
                  </p>

                  <p className="mt-1 text-sm text-gray-500">
                    Select another day or change the filters.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedDayRequests.map((request) => (
                    <article
                      key={request.id}
                      className="border border-black/10 bg-[#f8fafc] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-[#111827]">
                            {employeeName(request)}
                          </h3>

                          <p className="mt-1 text-xs text-gray-500">
                            {request.employee?.employeeNumber ?? 'No employee number'}
                          </p>
                        </div>

                        <span
                          className={`border px-2 py-1 text-[11px] font-medium ${getStatusClass(
                            request.status,
                          )}`}
                        >
                          {request.status}
                        </span>
                      </div>

                      <div className="mt-4 space-y-2 text-sm text-gray-500">
                        <div className="flex items-center gap-2">
                          <Clock size={15} />
                          {formatDate(request.startDate)} -{' '}
                          {formatDate(request.endDate)}
                        </div>

                        <div className="flex items-center gap-2">
                          <CalendarDays size={15} />
                          {formatLeaveType(request.leaveType)} ·{' '}
                          {daysBetween(request.startDate, request.endDate)} day
                          {daysBetween(request.startDate, request.endDate) === 1
                            ? ''
                            : 's'}
                        </div>

                        {request.employee?.department ? (
                          <div className="flex items-center gap-2">
                            <UserRound size={15} />
                            {request.employee.department.name}
                          </div>
                        ) : null}
                      </div>

                      {request.reason ? (
                        <p className="mt-4 border-t border-black/10 pt-4 text-sm leading-6 text-gray-500">
                          {request.reason}
                        </p>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </section>
      </div>
    </DashboardShell>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="border border-black/10 bg-white p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-gray-400">
        {title}
      </p>

      <p className="mt-3 text-2xl font-semibold tracking-[-0.05em] text-[#111827]">
        {value}
      </p>
    </div>
  );
}