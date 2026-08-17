'use client';

import {
  Suspense,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  useRouter,
  useSearchParams,
} from 'next/navigation';
import {
  BriefcaseBusiness,
  FolderKanban,
  Loader2,
  Search,
  UserPlus,
  Users,
  FilePenLine,
} from 'lucide-react';

import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { StatCard } from '@/components/dashboard/StatCard';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { api } from '@/lib/api';
import type { AuthUser } from '@/types/auth';

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

export default function EmployeesPage() {
  return (
    <Suspense fallback={<EmployeesPageLoading />}>
      <EmployeesPageContent />
    </Suspense>
  );
}

function EmployeesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const departmentFilter =
    searchParams.get('department');

  const [user, setUser] =
    useState<AuthUser | null>(null);

  const [employees, setEmployees] =
    useState<Employee[]>([]);

  const [search, setSearch] =
    useState('');

  const [loading, setLoading] =
    useState(true);

  const departmentFilteredEmployees =
    useMemo(() => {
      if (!departmentFilter) {
        return employees;
      }

      return employees.filter(
        (employee) =>
          employee.department?.id ===
          departmentFilter,
      );
    }, [employees, departmentFilter]);

  const filteredEmployees = useMemo(() => {
    const query =
      search.toLowerCase().trim();

    if (!query) {
      return departmentFilteredEmployees;
    }

    return departmentFilteredEmployees.filter(
      (employee) => {
        const fullName =
          `${employee.firstName} ${employee.lastName}`.toLowerCase();

        return (
          fullName.includes(query) ||
          employee.employeeNumber
            .toLowerCase()
            .includes(query) ||
          employee.email
            ?.toLowerCase()
            .includes(query) ||
          employee.phone
            ?.toLowerCase()
            .includes(query) ||
          employee.jobTitle
            ?.toLowerCase()
            .includes(query) ||
          employee.department?.name
            .toLowerCase()
            .includes(query) ||
          employee.employmentStatus
            .toLowerCase()
            .includes(query)
        );
      },
    );
  }, [
    departmentFilteredEmployees,
    search,
  ]);

  const activeEmployees = useMemo(() => {
    return employees.filter(
      (employee) =>
        employee.employmentStatus === 'ACTIVE',
    ).length;
  }, [employees]);

  const assignedDepartments =
    useMemo(() => {
      const departmentIds = employees
        .map(
          (employee) =>
            employee.department?.id,
        )
        .filter(
          (
            departmentId,
          ): departmentId is string =>
            Boolean(departmentId),
        );

      return new Set(departmentIds).size;
    }, [employees]);

  const selectedDepartmentName =
    useMemo(() => {
      if (!departmentFilter) {
        return null;
      }

      const matchedEmployee =
        employees.find(
          (employee) =>
            employee.department?.id ===
            departmentFilter,
        );

      return (
        matchedEmployee?.department?.name ??
        'Selected department'
      );
    }, [employees, departmentFilter]);

  useEffect(() => {
    async function loadEmployeesPage() {
      const token =
        localStorage.getItem(
          'medcnx_access_token',
        );

      if (!token) {
        router.push('/');
        return;
      }

      try {
        const [
          meResponse,
          employeesResponse,
        ] = await Promise.all([
          api.get<AuthUser>('/auth/me'),
          api.get<Employee[]>('/employees'),
        ]);

        setUser(meResponse.data);
        setEmployees(
          employeesResponse.data,
        );
      } catch {
        localStorage.removeItem(
          'medcnx_access_token',
        );

        localStorage.removeItem(
          'medcnx_user',
        );

        router.push('/');
      } finally {
        setLoading(false);
      }
    }

    void loadEmployeesPage();
  }, [router]);

  if (loading) {
    return <EmployeesPageLoading />;
  }

  return (
    <DashboardShell
      user={user}
      activePage="employees"
    >
      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-sm uppercase tracking-[0.25em] text-gray-400">
              Workforce Directory
            </p>

            <h1 className="text-4xl font-semibold tracking-[-0.06em]">
              Employees
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-500">
              Manage employee profiles,
              contact details, employment
              status and department
              allocations.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => router.push('/dashboard/employees/profile-requests')}
            className="flex h-11 items-center justify-center gap-2 border border-[var(--border-strong)] bg-[var(--surface)] px-5 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--surface-soft)]"
          >
            <FilePenLine size={17} />
            Profile requests
          </button>
          <button
            type="button"
            onClick={() =>
              router.push(
                '/dashboard/employees/new',
              )
            }
            className="flex h-11 items-center justify-center gap-2 bg-[#111827] px-5 text-sm font-medium text-white transition hover:bg-black"
          >
            <UserPlus size={17} />
            Create employee
          </button>
          </div>
        </div>

        {departmentFilter ? (
          <div className="mb-6 flex flex-col justify-between gap-3 border border-black/10 bg-white p-4 md:flex-row md:items-center">
            <div>
              <p className="text-sm font-medium text-[#111827]">
                Department filter active
              </p>

              <p className="mt-1 text-sm text-gray-500">
                Showing employees assigned
                to{' '}
                {selectedDepartmentName}.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                router.push(
                  '/dashboard/employees',
                )
              }
              className="h-10 border border-black/10 bg-white px-4 text-sm text-gray-600 transition hover:bg-gray-50"
            >
              Clear filter
            </button>
          </div>
        ) : null}

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <StatCard
            title="Total employees"
            value={String(
              employees.length,
            )}
            description="All employee records"
            icon={<Users size={20} />}
          />

          <StatCard
            title="Active employees"
            value={String(
              activeEmployees,
            )}
            description="Currently active staff"
            icon={
              <BriefcaseBusiness
                size={20}
              />
            }
          />

          <StatCard
            title="Departments used"
            value={String(
              assignedDepartments,
            )}
            description="Departments with employees"
            icon={
              <FolderKanban size={20} />
            }
          />
        </div>

        <section className="border border-black/10 bg-white">
          <div className="flex flex-col justify-between gap-4 border-b border-black/10 p-5 md:flex-row md:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center border border-black/10 bg-[#f8fafc] text-gray-600">
                <Users size={20} />
              </div>

              <div>
                <h2 className="text-lg font-semibold tracking-[-0.03em]">
                  Employee directory
                </h2>

                <p className="text-sm text-gray-500">
                  {
                    filteredEmployees.length
                  }{' '}
                  employee
                  {filteredEmployees.length ===
                  1
                    ? ''
                    : 's'}{' '}
                  shown
                </p>
              </div>
            </div>

            <div className="flex h-11 w-full items-center border border-black/10 bg-[#f8fafc] px-4 md:w-80">
              <Search
                size={17}
                className="text-gray-400"
              />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Search employees..."
                className="h-full w-full bg-transparent px-3 text-sm outline-none"
              />
            </div>
          </div>

          {filteredEmployees.length ===
          0 ? (
            <div className="p-10 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center border border-black/10 bg-[#f8fafc] text-gray-500">
                <Users size={22} />
              </div>

              <p className="text-sm font-medium">
                No employees found
              </p>

              <p className="mt-2 text-sm text-gray-500">
                Try changing your search,
                clearing the department filter,
                or creating a new employee.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-black/10 bg-[#f8fafc] text-xs uppercase tracking-[0.16em] text-gray-400">
                    <th className="px-5 py-4 font-medium">
                      Employee
                    </th>

                    <th className="px-5 py-4 font-medium">
                      Employee No.
                    </th>

                    <th className="px-5 py-4 font-medium">
                      Department
                    </th>

                    <th className="px-5 py-4 font-medium">
                      Job title
                    </th>

                    <th className="px-5 py-4 font-medium">
                      Status
                    </th>

                    <th className="px-5 py-4 font-medium">
                      Contact
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredEmployees.map(
                    (employee) => (
                      <tr
                        key={employee.id}
                        onClick={() =>
                          router.push(
                            `/dashboard/employees/${employee.id}`,
                          )
                        }
                        className="cursor-pointer border-b border-black/5 transition hover:bg-[#f8fafc]"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center border border-black/10 bg-white text-sm font-semibold">
                              {employee.firstName.charAt(
                                0,
                              )}
                              {employee.lastName.charAt(
                                0,
                              )}
                            </div>

                            <div>
                              <p className="text-sm font-medium">
                                {
                                  employee.firstName
                                }{' '}
                                {
                                  employee.lastName
                                }
                              </p>

                              <p className="text-xs text-gray-400">
                                {employee.employmentType ??
                                  'No employment type'}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-sm text-gray-600">
                          {
                            employee.employeeNumber
                          }
                        </td>

                        <td className="px-5 py-4 text-sm text-gray-600">
                          {employee.department
                            ?.name ??
                            'Unassigned'}
                        </td>

                        <td className="px-5 py-4 text-sm text-gray-600">
                          {employee.jobTitle ??
                            'Not set'}
                        </td>

                        <td className="px-5 py-4">
                          <StatusBadge
                            status={
                              employee.employmentStatus
                            }
                          />
                        </td>

                        <td className="px-5 py-4">
                          <div className="space-y-1 text-sm text-gray-500">
                            <p>
                              {employee.email ??
                                'No email'}
                            </p>

                            <p>
                              {employee.phone ??
                                'No phone'}
                            </p>
                          </div>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </DashboardShell>
  );
}

function EmployeesPageLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f7f9] text-sm text-gray-500">
      <div className="flex items-center gap-3">
        <Loader2
          className="animate-spin"
          size={18}
        />

        Loading employees...
      </div>
    </main>
  );
}
