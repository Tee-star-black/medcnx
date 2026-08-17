'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { api } from '@/lib/api';

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
  endDate?: string | null;
  dateOfBirth?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  postalCode?: string | null;
  department?: {
    id: string;
    name: string;
  } | null;
};

type Department = {
  id: string;
  name: string;
};

const employmentTypes = [
  { value: 'FULL_TIME', label: 'Full-time' },
  { value: 'PART_TIME', label: 'Part-time' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'TEMPORARY', label: 'Temporary' },
  { value: 'INTERN', label: 'Intern' },
];

const employmentStatuses = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ON_LEAVE', label: 'On leave' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'TERMINATED', label: 'Terminated' },
  { value: 'INACTIVE', label: 'Inactive' },
];

function toDateInputValue(value?: string | null) {
  if (!value) {
    return '';
  }

  return value.slice(0, 10);
}

function clean(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export default function EditEmployeePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const employeeId = params.id;

  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [employeeNumber, setEmployeeNumber] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [employmentType, setEmploymentType] = useState('FULL_TIME');
  const [employmentStatus, setEmploymentStatus] = useState('ACTIVE');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [country, setCountry] = useState('South Africa');
  const [postalCode, setPostalCode] = useState('');

  useEffect(() => {
    loadPageData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  async function loadPageData() {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const [employeeResponse, departmentsResponse] = await Promise.all([
        api.get<Employee>(`/employees/${employeeId}`),
        api.get<Department[]>('/departments'),
      ]);

      const employee = employeeResponse.data;

      setDepartments(departmentsResponse.data);

      setEmployeeNumber(employee.employeeNumber ?? '');
      setFirstName(employee.firstName ?? '');
      setLastName(employee.lastName ?? '');
      setEmail(employee.email ?? '');
      setPhone(employee.phone ?? '');
      setJobTitle(employee.jobTitle ?? '');
      setDepartmentId(employee.department?.id ?? '');
      setEmploymentType(employee.employmentType ?? 'FULL_TIME');
      setEmploymentStatus(employee.employmentStatus ?? 'ACTIVE');
      setStartDate(toDateInputValue(employee.startDate));
      setEndDate(toDateInputValue(employee.endDate));
      setDateOfBirth(toDateInputValue(employee.dateOfBirth));
      setAddressLine1(employee.addressLine1 ?? '');
      setAddressLine2(employee.addressLine2 ?? '');
      setCity(employee.city ?? '');
      setProvince(employee.province ?? '');
      setCountry(employee.country ?? 'South Africa');
      setPostalCode(employee.postalCode ?? '');
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ??
        'Could not load employee profile.';

      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally {
      setLoading(false);
    }
  }

  async function updateEmployee(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError('');
    setSuccess('');

    if (!employeeNumber.trim()) {
      setError('Employee number is required.');
      return;
    }

    if (!firstName.trim()) {
      setError('First name is required.');
      return;
    }

    if (!lastName.trim()) {
      setError('Last name is required.');
      return;
    }

    setSaving(true);

    try {
      await api.patch(`/employees/${employeeId}`, {
        employeeNumber: employeeNumber.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: clean(email),
        phone: clean(phone),
        jobTitle: clean(jobTitle),
        departmentId: departmentId || null,
        employmentType,
        employmentStatus,
        startDate: startDate || null,
        endDate: endDate || null,
        dateOfBirth: dateOfBirth || null,
      });

      setSuccess('Employee profile updated successfully.');

      setTimeout(() => {
        router.push(`/dashboard/employees/${employeeId}`);
      }, 700);
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ??
        'Could not update employee profile.';

      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <DashboardShell activePage="employees">
        <div className="flex min-h-[520px] items-center justify-center border border-black/10 bg-white">
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <Loader2 className="animate-spin" size={18} />
            Loading employee editor...
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell activePage="employees">
      <form onSubmit={updateEmployee} className="space-y-8">
        <section className="flex flex-col gap-5 border-b border-black/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <button
              type="button"
              onClick={() => router.push(`/dashboard/employees/${employeeId}`)}
              className="mb-5 inline-flex items-center gap-2 text-sm text-gray-500 transition hover:text-black"
            >
              <ArrowLeft size={15} />
              Back to profile
            </button>

            <p className="mb-2 text-sm uppercase tracking-[0.25em] text-gray-400">
              Employee editor
            </p>

            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#111827]">
              Edit employee profile
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              Update employee details, department assignment, employment status
              and contact information.
            </p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 border border-black bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                Saving...
              </>
            ) : (
              <>
                <Save size={16} />
                Save changes
              </>
            )}
          </button>
        </section>

        {error ? (
          <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            <section className="border border-black/10 bg-white">
              <SectionHeader
                icon={<UserRound size={18} />}
                title="Personal details"
                description="Core identity and contact details."
              />

              <div className="grid gap-5 p-6 md:grid-cols-2">
                <Field label="Employee number" required>
                  <input
                    value={employeeNumber}
                    onChange={(event) => setEmployeeNumber(event.target.value)}
                    className="field-input"
                  />
                </Field>

                <div />

                <Field label="First name" required>
                  <input
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    className="field-input"
                  />
                </Field>

                <Field label="Last name" required>
                  <input
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    className="field-input"
                  />
                </Field>

                <Field label="Email">
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="field-input"
                  />
                </Field>

                <Field label="Phone">
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className="field-input"
                  />
                </Field>

                <Field label="Date of birth">
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(event) => setDateOfBirth(event.target.value)}
                    className="field-input"
                  />
                </Field>
              </div>
            </section>

            <section className="border border-black/10 bg-white">
              <SectionHeader
                icon={<BriefcaseBusiness size={18} />}
                title="Employment details"
                description="Role, department and employment status."
              />

              <div className="grid gap-5 p-6 md:grid-cols-2">
                <Field label="Job title">
                  <input
                    value={jobTitle}
                    onChange={(event) => setJobTitle(event.target.value)}
                    className="field-input"
                  />
                </Field>

                <Field label="Department">
                  <select
                    value={departmentId}
                    onChange={(event) => setDepartmentId(event.target.value)}
                    className="field-input"
                  >
                    <option value="">Unassigned</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Employment type">
                  <select
                    value={employmentType}
                    onChange={(event) => setEmploymentType(event.target.value)}
                    className="field-input"
                  >
                    {employmentTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Employment status">
                  <select
                    value={employmentStatus}
                    onChange={(event) =>
                      setEmploymentStatus(event.target.value)
                    }
                    className="field-input"
                  >
                    {employmentStatuses.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Start date">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    className="field-input"
                  />
                </Field>

                <Field label="End date">
                  <input
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    className="field-input"
                  />
                </Field>
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="border border-black/10 bg-[#111827] p-6 text-white">
              <div className="flex h-11 w-11 items-center justify-center border border-white/15 bg-white/10">
                <ShieldCheck size={19} />
              </div>

              <h2 className="mt-5 text-lg font-semibold tracking-[-0.03em]">
                Profile control
              </h2>

              <p className="mt-2 text-sm leading-6 text-white/70">
                Changes made here affect employee records across documents,
                leave, attendance and reports.
              </p>

              <div className="mt-6 border-t border-white/10 pt-5">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex w-full items-center justify-center gap-2 border border-white bg-white px-5 py-3 text-sm font-medium text-[#111827] transition hover:bg-transparent hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      Saving changes...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Save employee
                    </>
                  )}
                </button>
              </div>
            </section>

            <section className="border border-black/10 bg-white p-6">
              <div className="flex h-11 w-11 items-center justify-center border border-black/10 bg-[#f8fafc] text-gray-500">
                <Building2 size={19} />
              </div>

              <h2 className="mt-5 text-lg font-semibold tracking-[-0.03em]">
                Department assignment
              </h2>

              <p className="mt-2 text-sm leading-6 text-gray-500">
                Assigning a department updates workforce reporting and
                department-based filters across MedCNX.
              </p>
            </section>

            <section className="border border-black/10 bg-white p-6">
              <div className="flex h-11 w-11 items-center justify-center border border-black/10 bg-[#f8fafc] text-gray-500">
                <Mail size={19} />
              </div>

              <h2 className="mt-5 text-lg font-semibold tracking-[-0.03em]">
                Contact accuracy
              </h2>

              <p className="mt-2 text-sm leading-6 text-gray-500">
                Keep email and phone details accurate for future notifications,
                payslip delivery and employee communication.
              </p>
            </section>

            <section className="border border-black/10 bg-white p-6">
              <div className="flex h-11 w-11 items-center justify-center border border-black/10 bg-[#f8fafc] text-gray-500">
                <Phone size={19} />
              </div>

              <h2 className="mt-5 text-lg font-semibold tracking-[-0.03em]">
                Employee lifecycle
              </h2>

              <p className="mt-2 text-sm leading-6 text-gray-500">
                Use employment status and end date to reflect whether an
                employee is active, suspended, inactive or terminated.
              </p>
            </section>
          </aside>
        </section>
      </form>
    </DashboardShell>
  );
}

function SectionHeader({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4 border-b border-black/10 px-6 py-5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-black/10 bg-[#f8fafc] text-gray-500">
        {icon}
      </div>

      <div>
        <h2 className="text-lg font-semibold tracking-[-0.03em] text-[#111827]">
          {title}
        </h2>

        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[#111827]">
        {label} {required ? <span className="text-red-500">*</span> : null}
      </span>

      {children}
    </label>
  );
}