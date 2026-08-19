'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  BriefcaseBusiness,
  FilePenLine,
  FolderKanban,
  Loader2,
  Search,
  UserPlus,
  Users,
  X,
} from 'lucide-react';

import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { StatCard } from '@/components/dashboard/StatCard';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import {
  Button,
  DataTable,
  EmptyState,
  PageHeader,
} from '@/components/ui';
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
  department?: { id: string; name: string } | null;
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
  const departmentFilter = searchParams.get('department');

  const [user, setUser] = useState<AuthUser | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const departmentFilteredEmployees = useMemo(() => {
    if (!departmentFilter) return employees;
    return employees.filter((employee) => employee.department?.id === departmentFilter);
  }, [employees, departmentFilter]);

  const filteredEmployees = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) return departmentFilteredEmployees;

    return departmentFilteredEmployees.filter((employee) => {
      const fullName = `${employee.firstName} ${employee.lastName}`.toLowerCase();
      return (
        fullName.includes(query) ||
        employee.employeeNumber.toLowerCase().includes(query) ||
        employee.email?.toLowerCase().includes(query) ||
        employee.phone?.toLowerCase().includes(query) ||
        employee.jobTitle?.toLowerCase().includes(query) ||
        employee.department?.name.toLowerCase().includes(query) ||
        employee.employmentStatus.toLowerCase().includes(query)
      );
    });
  }, [departmentFilteredEmployees, search]);

  const activeEmployees = useMemo(
    () => employees.filter((employee) => employee.employmentStatus === 'ACTIVE').length,
    [employees],
  );

  const assignedDepartments = useMemo(() => {
    const departmentIds = employees
      .map((employee) => employee.department?.id)
      .filter((departmentId): departmentId is string => Boolean(departmentId));
    return new Set(departmentIds).size;
  }, [employees]);

  const selectedDepartmentName = useMemo(() => {
    if (!departmentFilter) return null;
    return (
      employees.find((employee) => employee.department?.id === departmentFilter)?.department?.name ??
      'Selected department'
    );
  }, [employees, departmentFilter]);

  useEffect(() => {
    async function loadEmployeesPage() {
      const token = localStorage.getItem('medcnx_access_token');
      if (!token) {
        router.push('/');
        return;
      }

      try {
        const [meResponse, employeesResponse] = await Promise.all([
          api.get<AuthUser>('/auth/me'),
          api.get<Employee[]>('/employees'),
        ]);
        setUser(meResponse.data);
        setEmployees(employeesResponse.data);
      } catch {
        localStorage.removeItem('medcnx_access_token');
        localStorage.removeItem('medcnx_user');
        router.push('/');
      } finally {
        setLoading(false);
      }
    }

    void loadEmployeesPage();
  }, [router]);

  if (loading) return <EmployeesPageLoading />;

  return (
    <DashboardShell user={user} activePage="employees">
      <main className="workspace-content px-5 py-7 sm:px-7 lg:px-9 lg:py-9">
        <div className="space-y-6">
          <PageHeader
            category="People operations"
            title="Employees"
            description="A single operational directory for employee identity, employment structure, status and contact information."
            secondaryAction={{
              label: 'Profile requests',
              icon: <FilePenLine size={17} />,
              onClick: () => router.push('/dashboard/employees/profile-requests'),
            }}
            primaryAction={{
              label: 'Create employee',
              icon: <UserPlus size={17} />,
              onClick: () => router.push('/dashboard/employees/new'),
            }}
          />

          {departmentFilter ? (
            <section className="flex flex-col gap-4 border border-[var(--border-strong)] bg-[var(--accent-soft)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[var(--accent)] bg-[var(--surface)] text-[var(--accent)]">
                  <FolderKanban size={18} />
                </div>
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--accent)]">
                    Department scope
                  </p>
                  <p className="mt-1 text-sm font-bold text-[var(--text)]">
                    {selectedDepartmentName}
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Directory results are restricted to this department.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="secondary"
                icon={<X size={16} />}
                onClick={() => router.push('/dashboard/employees')}
              >
                Clear filter
              </Button>
            </section>
          ) : null}

          <section className="grid gap-4 md:grid-cols-3">
            <StatCard
              title="Total employees"
              value={String(employees.length)}
              description="All employee records"
              icon={<Users size={20} />}
            />
            <StatCard
              title="Active employees"
              value={String(activeEmployees)}
              description="Currently active staff"
              icon={<BriefcaseBusiness size={20} />}
            />
            <StatCard
              title="Departments used"
              value={String(assignedDepartments)}
              description="Departments with employees"
              icon={<FolderKanban size={20} />}
            />
          </section>

          <section className="border border-[var(--border-strong)] bg-[var(--surface)]">
            <header className="flex flex-col gap-4 border-b border-[var(--border)] px-5 py-5 lg:flex-row lg:items-center lg:justify-between lg:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center border border-[var(--border-strong)] bg-[var(--surface-soft)] text-[var(--accent)]">
                  <Users size={20} />
                </div>
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--muted)]">
                    Workforce register
                  </p>
                  <h2 className="mt-1 text-lg font-black tracking-[-0.035em] text-[var(--text)]">
                    Employee directory
                  </h2>
                  <p className="mt-1 text-sm font-medium text-[var(--muted)]">
                    {filteredEmployees.length} employee{filteredEmployees.length === 1 ? '' : 's'} shown
                  </p>
                </div>
              </div>

              <label className="flex min-h-11 w-full items-center border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 transition focus-within:border-[var(--accent)] focus-within:shadow-[0_0_0_3px_var(--accent-ring)] lg:w-[360px]">
                <Search size={17} className="shrink-0 text-[var(--muted)]" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search name, number, role or department"
                  aria-label="Search employees"
                  className="min-h-0 w-full border-0 bg-transparent px-3 py-2 text-sm font-semibold text-[var(--text)] outline-none shadow-none"
                />
              </label>
            </header>

            <DataTable
              caption="Employee directory"
              rowCount={filteredEmployees.length}
              empty={
                <EmptyState
                  icon={<Users size={22} />}
                  title="No employees found"
                  description="Adjust the current search or department scope, or create a new employee record."
                  action={
                    <Button
                      type="button"
                      variant="primary"
                      icon={<UserPlus size={16} />}
                      onClick={() => router.push('/dashboard/employees/new')}
                    >
                      Create employee
                    </Button>
                  }
                />
              }
            >
              <thead>
                <tr>
                  <th className="px-5 py-4 text-left">Employee</th>
                  <th className="px-5 py-4 text-left">Employee No.</th>
                  <th className="px-5 py-4 text-left">Department</th>
                  <th className="px-5 py-4 text-left">Job title</th>
                  <th className="px-5 py-4 text-left">Status</th>
                  <th className="px-5 py-4 text-left">Contact</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((employee) => (
                  <tr
                    key={employee.id}
                    onClick={() => router.push(`/dashboard/employees/${employee.id}`)}
                    className="cursor-pointer"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[var(--border-strong)] bg-[var(--surface-soft)] text-sm font-black text-[var(--text)]">
                          {employee.firstName.charAt(0)}{employee.lastName.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-extrabold text-[var(--text)]">
                            {employee.firstName} {employee.lastName}
                          </p>
                          <p className="mt-0.5 truncate text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                            {employee.employmentType?.replaceAll('_', ' ') ?? 'Employment type not set'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono text-sm font-semibold text-[var(--text-soft)]">
                      {employee.employeeNumber}
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-[var(--text-soft)]">
                      {employee.department?.name ?? 'Unassigned'}
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-[var(--text-soft)]">
                      {employee.jobTitle ?? 'Not set'}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={employee.employmentStatus} />
                    </td>
                    <td className="px-5 py-4">
                      <div className="space-y-1 text-sm font-medium text-[var(--muted)]">
                        <p className="max-w-[260px] truncate">{employee.email ?? 'No email'}</p>
                        <p>{employee.phone ?? 'No phone'}</p>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </section>
        </div>
      </main>
    </DashboardShell>
  );
}

function EmployeesPageLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] text-sm font-semibold text-[var(--muted)]">
      <div className="flex items-center gap-3 border border-[var(--border)] bg-[var(--surface)] px-5 py-4">
        <Loader2 className="animate-spin" size={18} />
        Loading employees...
      </div>
    </main>
  );
}
