'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FolderKanban,
  FolderPlus,
  Loader2,
  Network,
  Search,
  Users,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { StatCard } from '@/components/dashboard/StatCard';
import { api } from '@/lib/api';
import type { AuthUser } from '@/types/auth';

type Department = {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  _count: {
    employees: number;
  };
};

export default function DepartmentsPage() {
  const router = useRouter();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const filteredDepartments = useMemo(() => {
    const query = search.toLowerCase().trim();

    if (!query) {
      return departments;
    }

    return departments.filter((department) => {
      return (
        department.name.toLowerCase().includes(query) ||
        department.description?.toLowerCase().includes(query)
      );
    });
  }, [departments, search]);

  const totalEmployeesInDepartments = useMemo(() => {
    return departments.reduce(
      (total, department) => total + department._count.employees,
      0,
    );
  }, [departments]);

  useEffect(() => {
    async function loadDepartmentsPage() {
      const token = localStorage.getItem('medcnx_access_token');

      if (!token) {
        router.push('/');
        return;
      }

      try {
        const [meResponse, departmentsResponse] = await Promise.all([
          api.get<AuthUser>('/auth/me'),
          api.get<Department[]>('/departments'),
        ]);

        setUser(meResponse.data);
        setDepartments(departmentsResponse.data);
      } catch {
        localStorage.removeItem('medcnx_access_token');
        localStorage.removeItem('medcnx_user');
        router.push('/');
      } finally {
        setLoading(false);
      }
    }

    loadDepartmentsPage();
  }, [router]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f7f9] text-sm text-gray-500">
        <div className="flex items-center gap-3">
          <Loader2 className="animate-spin" size={18} />
          Loading departments...
        </div>
      </main>
    );
  }

  return (
    <DashboardShell user={user} activePage="departments">
      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-sm uppercase tracking-[0.25em] text-gray-400">
              Organisation Structure
            </p>

            <h1 className="text-4xl font-semibold tracking-[-0.06em]">
              Departments
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-500">
              Manage departments, operational units and employee distribution
              across the organisation.
            </p>
          </div>

          <button
            onClick={() => router.push('/dashboard/departments/new')}
            className="flex h-11 items-center justify-center gap-2 bg-[#111827] px-5 text-sm font-medium text-white transition hover:bg-black"
          >
            <FolderPlus size={17} />
            Create department
          </button>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <StatCard
            title="Total departments"
            value={String(departments.length)}
            description="Organisation departments"
            icon={<FolderKanban size={20} />}
          />

          <StatCard
            title="Assigned employees"
            value={String(totalEmployeesInDepartments)}
            description="Employees linked to departments"
            icon={<Users size={20} />}
          />

          <StatCard
            title="Active structure"
            value={departments.length > 0 ? 'Online' : 'Empty'}
            description="Department system status"
            icon={<Network size={20} />}
          />
        </div>

        <section className="border border-black/10 bg-white">
          <div className="flex flex-col justify-between gap-4 border-b border-black/10 p-5 md:flex-row md:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center border border-black/10 bg-[#f8fafc] text-gray-600">
                <Network size={20} />
              </div>

              <div>
                <h2 className="text-lg font-semibold tracking-[-0.03em]">
                  Department directory
                </h2>

                <p className="text-sm text-gray-500">
                  {filteredDepartments.length} department
                  {filteredDepartments.length === 1 ? '' : 's'} shown
                </p>
              </div>
            </div>

            <div className="flex h-11 w-full items-center border border-black/10 bg-[#f8fafc] px-4 md:w-80">
              <Search size={17} className="text-gray-400" />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search departments..."
                className="h-full w-full bg-transparent px-3 text-sm outline-none"
              />
            </div>
          </div>

          {filteredDepartments.length === 0 ? (
            <div className="p-10 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center border border-black/10 bg-[#f8fafc] text-gray-500">
                <Network size={22} />
              </div>

              <p className="text-sm font-medium">No departments found</p>

              <p className="mt-2 text-sm text-gray-500">
                Try changing your search or create your first department.
              </p>
            </div>
          ) : (
            <div className="grid gap-0 md:grid-cols-2">
              {filteredDepartments.map((department) => (
                <article
                  key={department.id}
                  onClick={() =>
                    router.push(`/dashboard/departments/${department.id}`)
                  }
                  className="cursor-pointer border-b border-black/10 p-6 transition hover:bg-[#f8fafc] md:border-r"
                >
                  <div className="mb-8 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xl font-semibold tracking-[-0.04em]">
                        {department.name}
                      </p>

                      <p className="mt-3 max-w-lg text-sm leading-6 text-gray-500">
                        {department.description ?? 'No description added.'}
                      </p>
                    </div>

                    <div className="flex h-11 w-11 items-center justify-center border border-black/10 bg-[#f8fafc] text-gray-600">
                      <Users size={20} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between border border-black/10 bg-[#f8fafc] p-4">
                    <div>
                      <p className="text-sm text-gray-400">
                        Assigned employees
                      </p>

                      <p className="mt-1 text-2xl font-semibold tracking-[-0.04em]">
                        {department._count.employees}
                      </p>
                    </div>

                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        router.push(
                          `/dashboard/employees?department=${department.id}`,
                        );
                      }}
                      className="border border-black/10 bg-white px-4 py-2 text-sm text-gray-600 transition hover:bg-gray-50"
                    >
                      View employees
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </DashboardShell>
  );
}