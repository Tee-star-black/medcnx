'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, FolderPen, Loader2, Save } from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { api } from '@/lib/api';
import type { AuthUser } from '@/types/auth';

type DepartmentDetails = {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
};

type DepartmentForm = {
  name: string;
  description: string;
};

const initialForm: DepartmentForm = {
  name: '',
  description: '',
};

export default function EditDepartmentPage() {
  const router = useRouter();
  const params = useParams();

  const departmentId = params.id as string;

  const [user, setUser] = useState<AuthUser | null>(null);
  const [form, setForm] = useState<DepartmentForm>(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadPage() {
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

        const department = departmentResponse.data;

        setUser(meResponse.data);

        setForm({
          name: department.name ?? '',
          description: department.description ?? '',
        });
      } catch {
        router.push('/dashboard/departments');
      } finally {
        setLoading(false);
      }
    }

    if (departmentId) {
      loadPage();
    }
  }, [departmentId, router]);

  function updateField(field: keyof DepartmentForm, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function cleanPayload() {
    return Object.fromEntries(
      Object.entries(form).filter(([, value]) => value.trim() !== ''),
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError('');
    setSaving(true);

    try {
      await api.patch(`/departments/${departmentId}`, cleanPayload());
      router.push(`/dashboard/departments/${departmentId}`);
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ??
        'Could not update department. Please check the form and try again.';

      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f7f9] text-sm text-gray-500">
        <div className="flex items-center gap-3">
          <Loader2 className="animate-spin" size={18} />
          Loading department editor...
        </div>
      </main>
    );
  }

  return (
    <DashboardShell user={user} activePage="departments">
      <section className="mx-auto max-w-4xl px-6 py-10">
        <button
          onClick={() => router.push(`/dashboard/departments/${departmentId}`)}
          className="mb-6 flex items-center gap-2 text-sm text-gray-500 transition hover:text-[#111827]"
        >
          <ArrowLeft size={16} />
          Back to department profile
        </button>

        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-sm uppercase tracking-[0.25em] text-gray-400">
              Organisation Structure
            </p>

            <h1 className="text-4xl font-semibold tracking-[-0.06em]">
              Edit department
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-500">
              Update the department name and description. Changes are saved
              through the protected MedCNX API.
            </p>
          </div>

          <div className="flex h-12 w-12 items-center justify-center border border-black/10 bg-white text-gray-600">
            <FolderPen size={22} />
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="border border-black/10 bg-white p-6"
        >
          {error ? (
            <div className="mb-6 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <section>
            <div className="mb-5">
              <h2 className="text-lg font-semibold tracking-[-0.03em]">
                Department details
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Keep department names clear and easy for HR users to understand.
              </p>
            </div>

            <div className="grid gap-5">
              <FormInput
                label="Department name"
                value={form.name}
                onChange={(value) => updateField('name', value)}
                placeholder="Finance, HR, Clinical Operations..."
                required
              />

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-gray-700">
                  Description
                </span>

                <textarea
                  value={form.description}
                  onChange={(event) =>
                    updateField('description', event.target.value)
                  }
                  placeholder="Describe what this department handles..."
                  rows={5}
                  className="w-full resize-none border border-black/10 bg-[#f8fafc] px-4 py-3 text-sm outline-none transition focus:border-[#111827]"
                />
              </label>
            </div>
          </section>

          <div className="mt-8 flex flex-col-reverse justify-end gap-3 border-t border-black/10 pt-6 sm:flex-row">
            <button
              type="button"
              onClick={() =>
                router.push(`/dashboard/departments/${departmentId}`)
              }
              className="h-11 border border-black/10 bg-white px-5 text-sm text-gray-600 transition hover:bg-gray-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="flex h-11 items-center justify-center gap-2 bg-[#111827] px-5 text-sm font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 className="animate-spin" size={17} />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={17} />
                  Save changes
                </>
              )}
            </button>
          </div>
        </form>
      </section>
    </DashboardShell>
  );
}

function FormInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-gray-700">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>

      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        required={required}
        placeholder={placeholder}
        className="h-12 w-full border border-black/10 bg-[#f8fafc] px-4 text-sm outline-none transition focus:border-[#111827]"
      />
    </label>
  );
}