'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  Save,
  UserPlus,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { api } from '@/lib/api';
import type { AuthUser } from '@/types/auth';

type Department = {
  id: string;
  name: string;
  description?: string | null;
  _count: {
    employees: number;
  };
};

type EmployeeForm = {
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  departmentId: string;
  jobTitle: string;
  employmentType: string;
  startDate: string;
  idNumber: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
};

const initialForm: EmployeeForm = {
  employeeNumber: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  departmentId: '',
  jobTitle: '',
  employmentType: 'Full-time',
  startDate: '',
  idNumber: '',
  dateOfBirth: '',
  gender: '',
  nationality: 'South African',
  emergencyContactName: '',
  emergencyContactPhone: '',
  emergencyContactRelation: '',
};

export default function CreateEmployeePage() {
  const router = useRouter();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [form, setForm] = useState<EmployeeForm>(initialForm);
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

    loadPage();
  }, [router]);

  function updateField(field: keyof EmployeeForm, value: string) {
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
      await api.post('/employees', cleanPayload());
      router.push('/dashboard/employees');
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ??
        'Could not create employee. Please check the form and try again.';

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
          Loading employee form...
        </div>
      </main>
    );
  }

  return (
    <DashboardShell user={user} activePage="employees">
      <section className="mx-auto max-w-5xl px-6 py-10">
        <button
          onClick={() => router.push('/dashboard/employees')}
          className="mb-6 flex items-center gap-2 text-sm text-gray-500 transition hover:text-[#111827]"
        >
          <ArrowLeft size={16} />
          Back to employees
        </button>

        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-sm uppercase tracking-[0.25em] text-gray-400">
              Employee Records
            </p>

            <h1 className="text-4xl font-semibold tracking-[-0.06em]">
              Create employee
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-500">
              Add a new employee profile to the organisation. This record will
              be scoped to your organisation and protected by MedCNX
              permissions.
            </p>
          </div>

          <div className="flex h-12 w-12 items-center justify-center border border-black/10 bg-white text-gray-600">
            <UserPlus size={22} />
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

          <FormSection
            title="Core employee details"
            description="Basic identity and employment information."
          >
            <FormInput
              label="Employee number"
              value={form.employeeNumber}
              onChange={(value) => updateField('employeeNumber', value)}
              placeholder="MED-002"
              required
            />

            <FormInput
              label="First name"
              value={form.firstName}
              onChange={(value) => updateField('firstName', value)}
              placeholder="Enter first name"
              required
            />

            <FormInput
              label="Last name"
              value={form.lastName}
              onChange={(value) => updateField('lastName', value)}
              placeholder="Enter last name"
              required
            />

            <FormInput
              label="Email"
              value={form.email}
              onChange={(value) => updateField('email', value)}
              placeholder="employee@medcnx.local"
              type="email"
            />

            <FormInput
              label="Phone"
              value={form.phone}
              onChange={(value) => updateField('phone', value)}
              placeholder="+27 82 000 0000"
            />

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">
                Department
              </span>

              <select
                value={form.departmentId}
                onChange={(event) =>
                  updateField('departmentId', event.target.value)
                }
                className="h-12 w-full border border-black/10 bg-[#f8fafc] px-4 text-sm outline-none"
              >
                <option value="">Select department</option>

                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </label>

            <FormInput
              label="Job title"
              value={form.jobTitle}
              onChange={(value) => updateField('jobTitle', value)}
              placeholder="Registered Nurse"
            />

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">
                Employment type
              </span>

              <select
                value={form.employmentType}
                onChange={(event) =>
                  updateField('employmentType', event.target.value)
                }
                className="h-12 w-full border border-black/10 bg-[#f8fafc] px-4 text-sm outline-none"
              >
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="Contract">Contract</option>
                <option value="Locum">Locum</option>
                <option value="Intern">Intern</option>
              </select>
            </label>

            <FormInput
              label="Start date"
              value={form.startDate}
              onChange={(value) => updateField('startDate', value)}
              type="date"
            />
          </FormSection>

          <FormSection
            title="Personal information"
            description="Optional details used for HR profile completeness."
          >
            <FormInput
              label="ID number"
              value={form.idNumber}
              onChange={(value) => updateField('idNumber', value)}
              placeholder="South African ID number"
            />

            <FormInput
              label="Date of birth"
              value={form.dateOfBirth}
              onChange={(value) => updateField('dateOfBirth', value)}
              type="date"
            />

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">
                Gender
              </span>

              <select
                value={form.gender}
                onChange={(event) => updateField('gender', event.target.value)}
                className="h-12 w-full border border-black/10 bg-[#f8fafc] px-4 text-sm outline-none"
              >
                <option value="">Select gender</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Other">Other</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </label>

            <FormInput
              label="Nationality"
              value={form.nationality}
              onChange={(value) => updateField('nationality', value)}
              placeholder="South African"
            />
          </FormSection>

          <FormSection
            title="Emergency contact"
            description="Person to contact in case of emergency."
          >
            <FormInput
              label="Contact name"
              value={form.emergencyContactName}
              onChange={(value) => updateField('emergencyContactName', value)}
              placeholder="Full name"
            />

            <FormInput
              label="Contact phone"
              value={form.emergencyContactPhone}
              onChange={(value) => updateField('emergencyContactPhone', value)}
              placeholder="+27 82 000 0000"
            />

            <FormInput
              label="Relationship"
              value={form.emergencyContactRelation}
              onChange={(value) =>
                updateField('emergencyContactRelation', value)
              }
              placeholder="Spouse, parent, sibling..."
            />
          </FormSection>

          <div className="mt-8 flex flex-col-reverse justify-end gap-3 border-t border-black/10 pt-6 sm:flex-row">
            <button
              type="button"
              onClick={() => router.push('/dashboard/employees')}
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
                  Creating...
                </>
              ) : (
                <>
                  <Save size={17} />
                  Create employee
                </>
              )}
            </button>
          </div>
        </form>
      </section>
    </DashboardShell>
  );
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-black/10 py-6 first:pt-0 last:border-b-0">
      <div className="mb-5">
        <h2 className="text-lg font-semibold tracking-[-0.03em]">{title}</h2>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">{children}</div>
    </section>
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