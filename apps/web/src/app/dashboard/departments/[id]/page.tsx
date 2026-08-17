'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CalendarDays,
  FolderKanban,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Search,
  UserRound,
  Users,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { api } from '@/lib/api';
import type { AuthUser } from '@/types/auth';

type DepartmentDetails = {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  employees: Employee[];
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
};

export default function DepartmentDetailsPage() {
  const router = useRouter();
  const params = useParams();

  const departmentId = params.id as string;

  const [user, setUser] = useState<AuthUser | null>(null);
  const [department, setDepartment] = useState<DepartmentDetails | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const filteredEmployees = useMemo(() => {
    if (!department) {
      return [];
    }

    const query = search.toLowerCase().trim();

    if (!query) {
      return department.employees;
    }

    return department.employees.filter((employee) => {
      const fullName =
        `${employee.firstName} ${employee.lastName}`.toLowerCase();

      return (
        fullName.includes(query) ||
        employee.employeeNumber.toLowerCase().includes(query) ||
        employee.email?.toLowerCase().includes(query) ||
        employee.phone?.toLowerCase().includes(query) ||
        employee.jobTitle?.toLowerCase().includes(query) ||
        employee.employmentStatus.toLowerCase().includes(query)
      );
    });
  }, [department, search]);

  const activeEmployees = useMemo(() => {
    if (!department) {
      return 0;
    }

    return department.employees.filter(
      (employee) => employee.employmentStatus === 'ACTIVE',
    ).length;
  }, [department]);

  useEffect(() => {
    async function loadDepartmentDetails() {
      const token = localStorage.getItem('medcnx_access_token');

      if (!token) {
        router.push('/');
        return;
      }

      try {
        const [meResponse, departmentResponse] = await Promise.all([
          api.get<AuthUser>('/auth/me'),
          api.get<DepartmentDetails>(`/departments/${departmentId}`),
        ]);

        setUser(meResponse.data);
        setDepartment(departmentResponse.data);
      } catch {
        router.push('/dashboard/departments');
      } finally {
        setLoading(false);
      }
    }

    if (departmentId) {
      loadDepartmentDetails();
    }
  }, [departmentId, router]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f7f9] text-sm text-gray-500">
        <div className="flex items-center gap-3">
          <Loader2 className="animate-spin" size={18} />
          Loading department profile...
        </div>
      </main>
    );
  }

  if (!department) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f7f9] text-sm text-gray-500">
        Department not found.
      </main>
    );
  }

  return (
    <DashboardShell user={user} activePage="departments">
      <section className="mx-auto max-w-7xl px-6 py-10">
        <button
          onClick={() => router.push('/dashboard/departments')}
          className="mb-6 flex items-center gap-2 text-sm text-gray-500 transition hover:text-[#111827]"
        >
          <ArrowLeft size={16} />
          Back to departments
        </button>

        <div className="mb-8 grid gap-6 lg:grid-cols-[1fr_320px]">
          <section className="border border-black/10 bg-white p-6">
            <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-start">
              <div>
                <p className="mb-2 text-sm uppercase tracking-[0.25em] text-gray-400">
                  Department Profile
                </p>

                <h1 className="text-4xl font-semibold tracking-[-0.06em]">
                  {department.name}
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-500">
                  {department.description ?? 'No department description added.'}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() =>
                    router.push(`/dashboard/departments/${department.id}/edit`)
                  }
                  className="flex h-9 items-center gap-2 border border-black/10 bg-white px-3 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  <Pencil size={14} />
                  Edit
                </button>

                <div className="flex h-12 w-12 items-center justify-center border border-black/10 bg-[#f8fafc] text-gray-600">
                  <FolderKanban size={22} />
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <ProfileStat
                icon={<Users size={18} />}
                label="Total employees"
                value={String(department.employees.length)}
              />

              <ProfileStat
                icon={<UserRound size={18} />}
                label="Active employees"
                value={String(activeEmployees)}
              />

              <ProfileStat
                icon={<CalendarDays size={18} />}
                label="Created"
                value={formatDate(department.createdAt)}
              />
            </div>
          </section>

          <section className="border border-black/10 bg-[#111827] p-6 text-white">
            <p className="text-sm uppercase tracking-[0.25em] text-white/40">
              Department metadata
            </p>

            <div className="mt-6 space-y-4">
              <InfoLine label="Department ID" value={department.id} dark />

              <InfoLine
                label="Created"
                value={formatDate(department.createdAt)}
                dark
              />

              <InfoLine
                label="Updated"
                value={formatDate(department.updatedAt)}
                dark
              />
            </div>
          </section>
        </div>

        <section className="border border-black/10 bg-white">
          <div className="flex flex-col justify-between gap-4 border-b border-black/10 p-5 md:flex-row md:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center border border-black/10 bg-[#f8fafc] text-gray-600">
                <Users size={20} />
              </div>

              <div>
                <h2 className="text-lg font-semibold tracking-[-0.03em]">
                  Employees in this department
                </h2>

                <p className="text-sm text-gray-500">
                  {filteredEmployees.length} employee
                  {filteredEmployees.length === 1 ? '' : 's'} shown
                </p>
              </div>
            </div>

            <div className="flex h-11 w-full items-center border border-black/10 bg-[#f8fafc] px-4 md:w-80">
              <Search size={17} className="text-gray-400" />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search employees..."
                className="h-full w-full bg-transparent px-3 text-sm outline-none"
              />
            </div>
          </div>

          {filteredEmployees.length === 0 ? (
            <div className="p-10 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center border border-black/10 bg-[#f8fafc] text-gray-500">
                <Users size={22} />
              </div>

              <p className="text-sm font-medium">No employees found</p>

              <p className="mt-2 text-sm text-gray-500">
                This department has no employees yet, or your search returned no
                results.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-black/10 bg-[#f8fafc] text-xs uppercase tracking-[0.16em] text-gray-400">
                    <th className="px-5 py-4 font-medium">Employee</th>
                    <th className="px-5 py-4 font-medium">Employee No.</th>
                    <th className="px-5 py-4 font-medium">Job title</th>
                    <th className="px-5 py-4 font-medium">Status</th>
                    <th className="px-5 py-4 font-medium">Contact</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredEmployees.map((employee) => (
                    <tr
                      key={employee.id}
                      onClick={() =>
                        router.push(`/dashboard/employees/${employee.id}`)
                      }
                      className="cursor-pointer border-b border-black/5 transition hover:bg-[#f8fafc]"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center border border-black/10 bg-white text-sm font-semibold">
                            {employee.firstName.charAt(0)}
                            {employee.lastName.charAt(0)}
                          </div>

                          <div>
                            <p className="text-sm font-medium">
                              {employee.firstName} {employee.lastName}
                            </p>

                            <p className="text-xs text-gray-400">
                              {employee.employmentType ?? 'No employment type'}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-600">
                        {employee.employeeNumber}
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-600">
                        {employee.jobTitle ?? 'Not set'}
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge status={employee.employmentStatus} />
                      </td>

                      <td className="px-5 py-4">
                        <div className="space-y-1 text-sm text-gray-500">
                          <p className="flex items-center gap-2">
                            <Mail size={14} />
                            {employee.email ?? 'No email'}
                          </p>

                          <p className="flex items-center gap-2">
                            <Phone size={14} />
                            {employee.phone ?? 'No phone'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </DashboardShell>
  );
}

function ProfileStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="border border-black/10 bg-[#f8fafc] p-4">
      <div className="mb-4 flex h-9 w-9 items-center justify-center border border-black/10 bg-white text-gray-600">
        {icon}
      </div>

      <p className="text-xs uppercase tracking-[0.18em] text-gray-400">
        {label}
      </p>

      <p className="mt-2 text-sm font-medium text-[#111827]">{value}</p>
    </div>
  );
}

function InfoLine({
  label,
  value,
  dark = false,
}: {
  label: string;
  value: string;
  dark?: boolean;
}) {
  return (
    <div
      className={
        dark
          ? 'flex justify-between gap-4 border-b border-white/10 pb-3 text-sm'
          : 'flex justify-between gap-4 border-b border-black/5 pb-3 text-sm'
      }
    >
      <span className={dark ? 'text-white/45' : 'text-gray-500'}>{label}</span>

      <span
        className={
          dark
            ? 'max-w-[60%] text-right font-medium text-white'
            : 'max-w-[60%] text-right font-medium text-[#111827]'
        }
      >
        {value}
      </span>
    </div>
  );
}

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