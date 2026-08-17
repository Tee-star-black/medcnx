"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  CalendarDays,
  Clock,
  FileWarning,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Save,
  ShieldCheck,
  Settings,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { api } from "@/lib/api";

type Organisation = {
  id: string;
  name: string;
  slug: string;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  postalCode?: string | null;

  standardClockInTime: string;
  standardClockOutTime: string;
  lateClockInThresholdMinutes: number;
  defaultWorkingHoursPerDay: number;
  leaveYearStartMonth: number;
  defaultAnnualLeaveDays: number;
  sickLeaveCycleDays: number;
  sickLeaveDocumentThresholdDays: number;
  autoMarkMissedClockOut: boolean;
  attendanceWorkingDays: number[];
  attendanceGracePeriodMinutes: number;
  allowEarlyClockIn: boolean;
  allowEarlyClockOut: boolean;
  requireLateAttendanceNote: boolean;
  requireEarlyClockOutNote: boolean;
  managersMayEditAttendance: boolean;
  attendanceCorrectionsRequireApproval: boolean;

  createdAt: string;
  updatedAt: string;
};

type OrganisationForm = {
  name: string;
  email: string;
  phone: string;
  website: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  province: string;
  country: string;
  postalCode: string;

  standardClockInTime: string;
  standardClockOutTime: string;
  lateClockInThresholdMinutes: number;
  defaultWorkingHoursPerDay: number;
  leaveYearStartMonth: number;
  defaultAnnualLeaveDays: number;
  sickLeaveCycleDays: number;
  sickLeaveDocumentThresholdDays: number;
  autoMarkMissedClockOut: boolean;
  attendanceWorkingDays: number[];
  attendanceGracePeriodMinutes: number;
  allowEarlyClockIn: boolean;
  allowEarlyClockOut: boolean;
  requireLateAttendanceNote: boolean;
  requireEarlyClockOutNote: boolean;
  managersMayEditAttendance: boolean;
  attendanceCorrectionsRequireApproval: boolean;
};

function emptyForm(): OrganisationForm {
  return {
    name: "",
    email: "",
    phone: "",
    website: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    province: "",
    country: "",
    postalCode: "",

    standardClockInTime: "08:00",
    standardClockOutTime: "17:00",
    lateClockInThresholdMinutes: 15,
    defaultWorkingHoursPerDay: 8,
    leaveYearStartMonth: 1,
    defaultAnnualLeaveDays: 15,
    sickLeaveCycleDays: 30,
    sickLeaveDocumentThresholdDays: 2,
    autoMarkMissedClockOut: true,
    attendanceWorkingDays: [1, 2, 3, 4, 5],
    attendanceGracePeriodMinutes: 0,
    allowEarlyClockIn: true,
    allowEarlyClockOut: true,
    requireLateAttendanceNote: false,
    requireEarlyClockOutNote: false,
    managersMayEditAttendance: false,
    attendanceCorrectionsRequireApproval: true,
  };
}

function toForm(organisation: Organisation): OrganisationForm {
  return {
    name: organisation.name ?? "",
    email: organisation.email ?? "",
    phone: organisation.phone ?? "",
    website: organisation.website ?? "",
    addressLine1: organisation.addressLine1 ?? "",
    addressLine2: organisation.addressLine2 ?? "",
    city: organisation.city ?? "",
    province: organisation.province ?? "",
    country: organisation.country ?? "",
    postalCode: organisation.postalCode ?? "",

    standardClockInTime: organisation.standardClockInTime ?? "08:00",
    standardClockOutTime: organisation.standardClockOutTime ?? "17:00",
    lateClockInThresholdMinutes: organisation.lateClockInThresholdMinutes ?? 15,
    defaultWorkingHoursPerDay: organisation.defaultWorkingHoursPerDay ?? 8,
    leaveYearStartMonth: organisation.leaveYearStartMonth ?? 1,
    defaultAnnualLeaveDays: organisation.defaultAnnualLeaveDays ?? 15,
    sickLeaveCycleDays: organisation.sickLeaveCycleDays ?? 30,
    sickLeaveDocumentThresholdDays:
      organisation.sickLeaveDocumentThresholdDays ?? 2,
    autoMarkMissedClockOut: organisation.autoMarkMissedClockOut ?? true,
    attendanceWorkingDays: organisation.attendanceWorkingDays ?? [
      1, 2, 3, 4, 5,
    ],
    attendanceGracePeriodMinutes:
      organisation.attendanceGracePeriodMinutes ?? 0,
    allowEarlyClockIn: organisation.allowEarlyClockIn ?? true,
    allowEarlyClockOut: organisation.allowEarlyClockOut ?? true,
    requireLateAttendanceNote: organisation.requireLateAttendanceNote ?? false,
    requireEarlyClockOutNote: organisation.requireEarlyClockOutNote ?? false,
    managersMayEditAttendance: organisation.managersMayEditAttendance ?? false,
    attendanceCorrectionsRequireApproval:
      organisation.attendanceCorrectionsRequireApproval ?? true,
  };
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-ZA", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function monthName(month: number) {
  const names = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  return names[month - 1] ?? "January";
}

export default function DashboardSettingsPage() {
  const [organisation, setOrganisation] = useState<Organisation | null>(null);
  const [form, setForm] = useState<OrganisationForm>(() => emptyForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadOrganisation();
  }, []);

  async function loadOrganisation() {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await api.get<Organisation>("/organisations/me");

      setOrganisation(response.data);
      setForm(toForm(response.data));
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ??
        "Could not load organisation settings.";

      setError(Array.isArray(message) ? message.join(" ") : message);
    } finally {
      setLoading(false);
    }
  }

  function updateField(
    field: keyof OrganisationForm,
    value: string | number | boolean | number[],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function numberValue(value: string, fallback: number) {
    const parsed = Number(value);

    if (Number.isNaN(parsed)) {
      return fallback;
    }

    return parsed;
  }

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await api.patch<Organisation>("/organisations/me", form);

      setOrganisation(response.data);
      setForm(toForm(response.data));
      setSuccess("Organisation and policy settings saved successfully.");
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ??
        "Could not save organisation settings.";

      setError(Array.isArray(message) ? message.join(" ") : message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardShell activePage="settings">
      <div className="space-y-8">
        <section className="flex flex-col gap-5 border-b border-black/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-sm uppercase tracking-[0.25em] text-gray-400">
              Administration
            </p>

            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#111827]">
              Organisation settings
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              Manage company details, attendance rules, leave defaults and HR
              policy settings.
            </p>
          </div>

          <button
            type="button"
            onClick={loadOrganisation}
            className="inline-flex items-center justify-center gap-2 border border-black/10 bg-white px-5 py-3 text-sm font-medium text-gray-600 transition hover:border-black hover:text-black"
          >
            <RefreshCw size={16} />
            Refresh
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

        <Link
          href="/dashboard/settings/access-control"
          className="flex items-center justify-between border border-[var(--accent)] bg-[var(--surface)] p-5 text-[var(--text)] transition hover:bg-[var(--surface-soft)]"
        >
          <span className="flex items-center gap-4">
            <span className="flex h-11 w-11 items-center justify-center bg-[var(--accent)] text-[var(--accent-text)]">
              <ShieldCheck size={19} />
            </span>
            <span>
              <span className="block text-sm font-black">Access control</span>
              <span className="mt-1 block text-xs text-[var(--muted)]">
                Manage users, role assignments, account status and permission matrices.
              </span>
            </span>
          </span>
          <span className="text-xs font-black uppercase tracking-wider text-[var(--accent)]">
            Open
          </span>
        </Link>

        {loading ? (
          <div className="flex min-h-[520px] items-center justify-center border border-black/10 bg-white">
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <Loader2 className="animate-spin" size={18} />
              Loading organisation settings...
            </div>
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
            <form
              onSubmit={saveSettings}
              className="border border-black/10 bg-white"
            >
              <div className="border-b border-black/10 px-6 py-5">
                <h2 className="text-lg font-semibold tracking-[-0.03em] text-[#111827]">
                  Company and HR policy profile
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  These rules will later drive attendance warnings, leave
                  validation and document requirements.
                </p>
              </div>

              <div className="space-y-9 p-6">
                <section>
                  <SectionHeading
                    icon={<Building2 size={16} />}
                    title="Basic information"
                    description="Organisation name and public contact details."
                  />

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Organisation name" required>
                      <input
                        value={form.name}
                        onChange={(event) =>
                          updateField("name", event.target.value)
                        }
                        required
                        className="field-input"
                        placeholder="Example Medical Practice"
                      />
                    </Field>

                    <Field label="Website">
                      <input
                        value={form.website}
                        onChange={(event) =>
                          updateField("website", event.target.value)
                        }
                        className="field-input"
                        placeholder="https://example.co.za"
                      />
                    </Field>

                    <Field label="HR email">
                      <input
                        type="email"
                        value={form.email}
                        onChange={(event) =>
                          updateField("email", event.target.value)
                        }
                        className="field-input"
                        placeholder="hr@example.co.za"
                      />
                    </Field>

                    <Field label="HR phone">
                      <input
                        value={form.phone}
                        onChange={(event) =>
                          updateField("phone", event.target.value)
                        }
                        className="field-input"
                        placeholder="+27..."
                      />
                    </Field>
                  </div>
                </section>

                <section>
                  <SectionHeading
                    icon={<MapPin size={16} />}
                    title="Address"
                    description="Physical or administrative office address."
                  />

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Address line 1">
                      <input
                        value={form.addressLine1}
                        onChange={(event) =>
                          updateField("addressLine1", event.target.value)
                        }
                        className="field-input"
                        placeholder="Street address"
                      />
                    </Field>

                    <Field label="Address line 2">
                      <input
                        value={form.addressLine2}
                        onChange={(event) =>
                          updateField("addressLine2", event.target.value)
                        }
                        className="field-input"
                        placeholder="Building, floor or unit"
                      />
                    </Field>

                    <Field label="City">
                      <input
                        value={form.city}
                        onChange={(event) =>
                          updateField("city", event.target.value)
                        }
                        className="field-input"
                        placeholder="Johannesburg"
                      />
                    </Field>

                    <Field label="Province">
                      <input
                        value={form.province}
                        onChange={(event) =>
                          updateField("province", event.target.value)
                        }
                        className="field-input"
                        placeholder="Gauteng"
                      />
                    </Field>

                    <Field label="Country">
                      <input
                        value={form.country}
                        onChange={(event) =>
                          updateField("country", event.target.value)
                        }
                        className="field-input"
                        placeholder="South Africa"
                      />
                    </Field>

                    <Field label="Postal code">
                      <input
                        value={form.postalCode}
                        onChange={(event) =>
                          updateField("postalCode", event.target.value)
                        }
                        className="field-input"
                        placeholder="0000"
                      />
                    </Field>
                  </div>
                </section>

                <section>
                  <SectionHeading
                    icon={<Clock size={16} />}
                    title="Attendance policy"
                    description="Default working hours and clock-in rules."
                  />

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Standard clock-in time">
                      <input
                        type="time"
                        value={form.standardClockInTime}
                        onChange={(event) =>
                          updateField("standardClockInTime", event.target.value)
                        }
                        className="field-input"
                      />
                    </Field>

                    <Field label="Standard clock-out time">
                      <input
                        type="time"
                        value={form.standardClockOutTime}
                        onChange={(event) =>
                          updateField(
                            "standardClockOutTime",
                            event.target.value,
                          )
                        }
                        className="field-input"
                      />
                    </Field>

                    <Field label="Late threshold in minutes">
                      <input
                        type="number"
                        min={0}
                        max={240}
                        value={form.lateClockInThresholdMinutes}
                        onChange={(event) =>
                          updateField(
                            "lateClockInThresholdMinutes",
                            numberValue(event.target.value, 15),
                          )
                        }
                        className="field-input"
                      />
                    </Field>

                    <Field label="Working hours per day">
                      <input
                        type="number"
                        min={1}
                        max={24}
                        value={form.defaultWorkingHoursPerDay}
                        onChange={(event) =>
                          updateField(
                            "defaultWorkingHoursPerDay",
                            numberValue(event.target.value, 8),
                          )
                        }
                        className="field-input"
                      />
                    </Field>

                    <Field label="Grace period in minutes">
                      <input
                        type="number"
                        min={0}
                        max={120}
                        value={form.attendanceGracePeriodMinutes}
                        onChange={(event) =>
                          updateField(
                            "attendanceGracePeriodMinutes",
                            numberValue(event.target.value, 0),
                          )
                        }
                        className="field-input"
                      />
                    </Field>

                    <div className="md:col-span-2">
                      <p className="mb-2 text-sm font-medium">Working days</p>
                      <div className="grid grid-cols-7 gap-2">
                        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                          (label, day) => {
                            const selected =
                              form.attendanceWorkingDays.includes(day);
                            return (
                              <button
                                key={label}
                                type="button"
                                onClick={() =>
                                  updateField(
                                    "attendanceWorkingDays",
                                    selected
                                      ? form.attendanceWorkingDays.filter(
                                          (value) => value !== day,
                                        )
                                      : [
                                          ...form.attendanceWorkingDays,
                                          day,
                                        ].sort(),
                                  )
                                }
                                className={`border px-2 py-2 text-xs font-semibold ${selected ? "border-black bg-black text-white" : "border-black/15 bg-white text-gray-600"}`}
                              >
                                {label}
                              </button>
                            );
                          },
                        )}
                      </div>
                    </div>

                    {(
                      [
                        [
                          "allowEarlyClockIn",
                          "Allow employees to clock in early",
                        ],
                        [
                          "allowEarlyClockOut",
                          "Allow employees to clock out early",
                        ],
                        [
                          "requireLateAttendanceNote",
                          "Require a note for late clock-in",
                        ],
                        [
                          "requireEarlyClockOutNote",
                          "Require a note for early clock-out",
                        ],
                        [
                          "managersMayEditAttendance",
                          "Allow authorised managers to edit attendance",
                        ],
                        [
                          "attendanceCorrectionsRequireApproval",
                          "Require approval for attendance corrections",
                        ],
                      ] as Array<[keyof OrganisationForm, string]>
                    ).map(([field, label]) => (
                      <label
                        key={field}
                        className="flex items-center gap-3 border border-black/10 bg-[#f8fafc] p-4"
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(form[field])}
                          onChange={(event) =>
                            updateField(field, event.target.checked)
                          }
                          className="h-4 w-4"
                        />
                        <span className="text-sm font-medium">{label}</span>
                      </label>
                    ))}

                    <label className="flex items-start gap-3 border border-black/10 bg-[#f8fafc] p-4 md:col-span-2">
                      <input
                        type="checkbox"
                        checked={form.autoMarkMissedClockOut}
                        onChange={(event) =>
                          updateField(
                            "autoMarkMissedClockOut",
                            event.target.checked,
                          )
                        }
                        className="mt-1 h-4 w-4"
                      />

                      <span>
                        <span className="block text-sm font-medium text-[#111827]">
                          Automatically mark missed clock-outs
                        </span>

                        <span className="mt-1 block text-sm leading-6 text-gray-500">
                          Later, this will allow the system to flag employees
                          who clocked in but did not clock out.
                        </span>
                      </span>
                    </label>
                  </div>
                </section>

                <section>
                  <SectionHeading
                    icon={<CalendarDays size={16} />}
                    title="Leave policy"
                    description="Annual leave and sick leave default rules."
                  />

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Leave year start month">
                      <select
                        value={form.leaveYearStartMonth}
                        onChange={(event) =>
                          updateField(
                            "leaveYearStartMonth",
                            numberValue(event.target.value, 1),
                          )
                        }
                        className="field-input"
                      >
                        {Array.from({ length: 12 }).map((_, index) => {
                          const month = index + 1;

                          return (
                            <option key={month} value={month}>
                              {monthName(month)}
                            </option>
                          );
                        })}
                      </select>
                    </Field>

                    <Field label="Default annual leave days">
                      <input
                        type="number"
                        min={0}
                        max={60}
                        value={form.defaultAnnualLeaveDays}
                        onChange={(event) =>
                          updateField(
                            "defaultAnnualLeaveDays",
                            numberValue(event.target.value, 15),
                          )
                        }
                        className="field-input"
                      />
                    </Field>

                    <Field label="Sick leave cycle days">
                      <input
                        type="number"
                        min={0}
                        max={365}
                        value={form.sickLeaveCycleDays}
                        onChange={(event) =>
                          updateField(
                            "sickLeaveCycleDays",
                            numberValue(event.target.value, 30),
                          )
                        }
                        className="field-input"
                      />
                    </Field>

                    <Field label="Require sick note after X days">
                      <input
                        type="number"
                        min={0}
                        max={30}
                        value={form.sickLeaveDocumentThresholdDays}
                        onChange={(event) =>
                          updateField(
                            "sickLeaveDocumentThresholdDays",
                            numberValue(event.target.value, 2),
                          )
                        }
                        className="field-input"
                      />
                    </Field>
                  </div>
                </section>

                <div className="flex flex-col gap-3 border-t border-black/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-gray-500">
                    These settings are now saved at organisation level.
                  </p>

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
                        Save settings
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>

            <aside className="space-y-6">
              <section className="border border-black/10 bg-white">
                <div className="border-b border-black/10 px-6 py-5">
                  <h2 className="text-lg font-semibold tracking-[-0.03em] text-[#111827]">
                    Organisation summary
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    Current saved details.
                  </p>
                </div>

                <div className="space-y-4 p-6">
                  <SummaryItem
                    icon={<Building2 size={16} />}
                    label="Name"
                    value={organisation?.name ?? "Not set"}
                  />

                  <SummaryItem
                    icon={<Mail size={16} />}
                    label="Email"
                    value={organisation?.email ?? "Not set"}
                  />

                  <SummaryItem
                    icon={<Phone size={16} />}
                    label="Phone"
                    value={organisation?.phone ?? "Not set"}
                  />

                  <SummaryItem
                    icon={<MapPin size={16} />}
                    label="Location"
                    value={
                      [
                        organisation?.city,
                        organisation?.province,
                        organisation?.country,
                      ]
                        .filter(Boolean)
                        .join(", ") || "Not set"
                    }
                  />
                </div>
              </section>

              <section className="border border-black/10 bg-white">
                <div className="border-b border-black/10 px-6 py-5">
                  <h2 className="text-lg font-semibold tracking-[-0.03em] text-[#111827]">
                    HR policy summary
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    Rules currently saved for this organisation.
                  </p>
                </div>

                <div className="space-y-4 p-6">
                  <SummaryItem
                    icon={<Clock size={16} />}
                    label="Working day"
                    value={`${form.standardClockInTime} - ${form.standardClockOutTime}`}
                  />

                  <SummaryItem
                    icon={<Clock size={16} />}
                    label="Late threshold"
                    value={`${form.lateClockInThresholdMinutes} minutes`}
                  />

                  <SummaryItem
                    icon={<CalendarDays size={16} />}
                    label="Leave year"
                    value={`Starts in ${monthName(form.leaveYearStartMonth)}`}
                  />

                  <SummaryItem
                    icon={<FileWarning size={16} />}
                    label="Sick note rule"
                    value={`Required after ${form.sickLeaveDocumentThresholdDays} day(s)`}
                  />
                </div>
              </section>

              <section className="border border-black/10 bg-[#111827] p-6 text-white">
                <div className="flex h-10 w-10 items-center justify-center border border-white/15 bg-white/10">
                  <Settings size={18} />
                </div>

                <h2 className="mt-5 text-lg font-semibold tracking-[-0.03em]">
                  Policy engine foundation ready
                </h2>

                <p className="mt-2 text-sm leading-6 text-white/65">
                  These settings can now be connected to attendance warnings,
                  leave validation, reports and future payroll calculations.
                </p>

                <div className="mt-5 border-t border-white/10 pt-5 text-xs text-white/45">
                  Last updated: {formatDateTime(organisation?.updatedAt)}
                </div>
              </section>
            </aside>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function SectionHeading({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center border border-black/10 bg-[#f8fafc] text-gray-500">
        {icon}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-[#111827]">{title}</h3>

        <p className="text-xs text-gray-500">{description}</p>
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
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>

      {children}
    </label>
  );
}

function SummaryItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-3 border border-black/10 bg-[#f8fafc] p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-black/10 bg-white text-gray-500">
        {icon}
      </div>

      <div className="min-w-0">
        <p className="text-xs uppercase tracking-[0.16em] text-gray-400">
          {label}
        </p>

        <p className="mt-1 break-words text-sm font-medium text-[#111827]">
          {value}
        </p>
      </div>
    </div>
  );
}
