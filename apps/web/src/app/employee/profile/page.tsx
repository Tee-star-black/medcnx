"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Loader2,
  PencilLine,
  Save,
  UserRound,
  X,
} from "lucide-react";
import { EmployeeShell } from "@/components/employee/EmployeeShell";
import { api } from "@/lib/api";

type Profile = {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  preferredName?: string | null;
  email?: string | null;
  personalEmail?: string | null;
  phone?: string | null;
  residentialAddress?: string | null;
  jobTitle?: string | null;
  employmentType?: string | null;
  employmentStatus: string;
  startDate?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
  department?: { name: string } | null;
  organisation: { name: string };
  compensationProfile?: {
    bankName?: string | null;
    bankAccountNumber?: string | null;
  } | null;
};

type ChangeRequest = {
  id: string;
  field: EditableField;
  currentValue?: string | null;
  requestedValue: string;
  reason: string;
  status: string;
  reviewComments?: string | null;
  createdAt: string;
};

type EditableField =
  | "PERSONAL_EMAIL"
  | "PHONE"
  | "PREFERRED_NAME"
  | "RESIDENTIAL_ADDRESS"
  | "EMERGENCY_CONTACT_NAME"
  | "EMERGENCY_CONTACT_PHONE"
  | "EMERGENCY_CONTACT_RELATION"
  | "BANK_NAME"
  | "BANK_ACCOUNT_NUMBER";

type EditValues = Record<EditableField, string>;

const editableFields: Array<{
  field: EditableField;
  label: string;
  type?: string;
  sensitive?: boolean;
}> = [
  { field: "PREFERRED_NAME", label: "Preferred name" },
  { field: "PERSONAL_EMAIL", label: "Personal email", type: "email" },
  { field: "PHONE", label: "Phone number", type: "tel" },
  { field: "RESIDENTIAL_ADDRESS", label: "Residential address" },
  { field: "EMERGENCY_CONTACT_NAME", label: "Emergency contact name" },
  {
    field: "EMERGENCY_CONTACT_PHONE",
    label: "Emergency contact phone",
    type: "tel",
  },
  {
    field: "EMERGENCY_CONTACT_RELATION",
    label: "Emergency contact relationship",
  },
  { field: "BANK_NAME", label: "Bank name" },
  {
    field: "BANK_ACCOUNT_NUMBER",
    label: "New bank account number",
    sensitive: true,
  },
];

const emptyEditValues: EditValues = {
  PERSONAL_EMAIL: "",
  PHONE: "",
  PREFERRED_NAME: "",
  RESIDENTIAL_ADDRESS: "",
  EMERGENCY_CONTACT_NAME: "",
  EMERGENCY_CONTACT_PHONE: "",
  EMERGENCY_CONTACT_RELATION: "",
  BANK_NAME: "",
  BANK_ACCOUNT_NUMBER: "",
};

const inputClass =
  "mt-2 h-11 w-full border border-[var(--border-strong)] bg-[var(--surface)] px-3 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-ring)]";

function formatDate(value?: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium" }).format(
        new Date(value),
      )
    : "Not provided";
}

function labelForField(value: string) {
  return (
    editableFields.find((item) => item.field === value)?.label ??
    value.replaceAll("_", " ")
  );
}

function valuesFromProfile(profile: Profile): EditValues {
  return {
    PERSONAL_EMAIL: profile.personalEmail || "",
    PHONE: profile.phone || "",
    PREFERRED_NAME: profile.preferredName || "",
    RESIDENTIAL_ADDRESS: profile.residentialAddress || "",
    EMERGENCY_CONTACT_NAME: profile.emergencyContactName || "",
    EMERGENCY_CONTACT_PHONE: profile.emergencyContactPhone || "",
    EMERGENCY_CONTACT_RELATION: profile.emergencyContactRelation || "",
    BANK_NAME: profile.compensationProfile?.bankName || "",
    // The API deliberately returns a masked account. Keep this blank so the
    // employee must deliberately enter a replacement account number.
    BANK_ACCOUNT_NUMBER: "",
  };
}

function errorMessage(error: any, fallback: string) {
  const message = error?.response?.data?.message;
  return Array.isArray(message) ? message.join(" ") : message || fallback;
}

export default function EmployeeProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [editing, setEditing] = useState(false);
  const [editValues, setEditValues] = useState<EditValues>(emptyEditValues);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [profileResponse, requestsResponse] = await Promise.all([
        api.get<Profile>("/employee-self-service/profile"),
        api.get<ChangeRequest[]>(
          "/employee-self-service/profile-change-requests/me",
        ),
      ]);
      setProfile(profileResponse.data);
      setRequests(requestsResponse.data);
      if (!editing) setEditValues(valuesFromProfile(profileResponse.data));
    } catch (requestError: any) {
      setError(errorMessage(requestError, "Could not load your profile."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // Loading is intentionally tied to the route, not the edit toggle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pendingFields = useMemo(
    () =>
      new Set(
        requests
          .filter((request) => request.status === "PENDING")
          .map((request) => request.field),
      ),
    [requests],
  );

  function beginEditing() {
    if (!profile) return;
    setEditValues(valuesFromProfile(profile));
    setReason("");
    setError("");
    setSuccess("");
    setEditing(true);
  }

  function stopEditing() {
    setEditing(false);
    setReason("");
    if (profile) setEditValues(valuesFromProfile(profile));
  }

  async function saveChanges() {
    if (!profile) return;
    setError("");
    setSuccess("");

    const current = valuesFromProfile(profile);
    const changes = editableFields.filter(({ field }) => {
      const requested = editValues[field].trim();
      if (field === "BANK_ACCOUNT_NUMBER") return Boolean(requested);
      return requested !== current[field].trim();
    });

    if (!changes.length) {
      setError("No profile changes were entered.");
      return;
    }
    if (!reason.trim()) {
      setError("Explain why these profile changes are needed.");
      return;
    }

    const duplicate = changes.find(({ field }) => pendingFields.has(field));
    if (duplicate) {
      setError(
        `A pending request already exists for ${duplicate.label.toLowerCase()}.`,
      );
      return;
    }

    setSaving(true);
    try {
      // Each changed field becomes its own governed record so HR can approve
      // or reject it independently and the audit history remains precise.
      for (const change of changes) {
        await api.post("/employee-self-service/profile-change-requests", {
          field: change.field,
          requestedValue: editValues[change.field].trim(),
          reason: reason.trim(),
        });
      }
      setEditing(false);
      setReason("");
      setSuccess(
        `${changes.length} profile change request${changes.length === 1 ? "" : "s"} sent to HR. Your current profile remains unchanged until approval.`,
      );
      await load();
    } catch (requestError: any) {
      setError(
        errorMessage(requestError, "Could not submit the profile changes."),
      );
    } finally {
      setSaving(false);
    }
  }

  async function cancel(id: string) {
    try {
      setError("");
      await api.patch(
        `/employee-self-service/profile-change-requests/${id}/cancel`,
      );
      await load();
    } catch (requestError: any) {
      setError(errorMessage(requestError, "Could not cancel the request."));
    }
  }

  if (loading) {
    return (
      <EmployeeShell>
        <div className="flex min-h-[60vh] items-center justify-center gap-3 text-[var(--muted)]">
          <Loader2 className="animate-spin" size={18} /> Loading your profile...
        </div>
      </EmployeeShell>
    );
  }

  const employment = [
    ["Employee number", profile?.employeeNumber],
    ["Job title", profile?.jobTitle],
    ["Department", profile?.department?.name],
    ["Employment type", profile?.employmentType],
    ["Employment status", profile?.employmentStatus],
    ["Start date", formatDate(profile?.startDate)],
    ["Work email", profile?.email],
    ["Organisation", profile?.organisation.name],
  ];
  const personal = [
    ["Preferred name", profile?.preferredName],
    ["Personal email", profile?.personalEmail],
    ["Phone", profile?.phone],
    ["Residential address", profile?.residentialAddress],
    ["Emergency contact", profile?.emergencyContactName],
    ["Emergency contact phone", profile?.emergencyContactPhone],
    ["Relationship", profile?.emergencyContactRelation],
    ["Bank", profile?.compensationProfile?.bankName],
    ["Account", profile?.compensationProfile?.bankAccountNumber],
  ];

  return (
    <EmployeeShell>
      <div className="space-y-6">
        <header className="flex flex-col gap-4 border border-[var(--border)] bg-[var(--surface)] p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
              My profile
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              {profile?.firstName} {profile?.lastName}
            </h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Review your details and submit controlled, traceable changes to
              HR.
            </p>
          </div>
          {!editing && (
            <button
              type="button"
              onClick={beginEditing}
              className="inline-flex h-11 items-center justify-center gap-2 bg-[var(--accent)] px-5 text-sm font-bold text-[var(--accent-text)]"
            >
              <PencilLine size={16} /> Edit profile
            </button>
          )}
        </header>

        {error && (
          <div className="border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
            {error}
          </div>
        )}
        {success && (
          <div className="border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
            {success}
          </div>
        )}

        {editing ? (
          <section className="border border-[var(--border)] bg-[var(--surface)]">
            <div className="border-b border-[var(--border)] p-5">
              <h2 className="font-bold">Edit personal information</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Changed fields are retained as pending requests. HR approval is
                required before the employee record changes.
              </p>
            </div>
            <div className="grid gap-5 p-6 md:grid-cols-2">
              {editableFields.map((item) => (
                <label key={item.field} className="text-sm font-semibold">
                  {item.label}
                  {pendingFields.has(item.field) && (
                    <span className="ml-2 text-xs font-normal text-amber-700">
                      Pending HR review
                    </span>
                  )}
                  <input
                    type={item.type || "text"}
                    autoComplete={item.sensitive ? "off" : undefined}
                    disabled={pendingFields.has(item.field)}
                    value={editValues[item.field]}
                    placeholder={
                      item.sensitive
                        ? "Leave blank to keep the current account"
                        : undefined
                    }
                    onChange={(event) =>
                      setEditValues({
                        ...editValues,
                        [item.field]: event.target.value,
                      })
                    }
                    className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-50`}
                  />
                </label>
              ))}
              <label className="text-sm font-semibold md:col-span-2">
                Reason for changes <span className="text-red-600">*</span>
                <textarea
                  required
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="mt-2 min-h-24 w-full resize-y border border-[var(--border-strong)] bg-[var(--surface)] p-3 outline-none focus:border-[var(--accent)]"
                  placeholder="Explain why these details should be updated"
                />
              </label>
              <div className="flex flex-wrap gap-2 md:col-span-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveChanges()}
                  className="inline-flex h-11 items-center gap-2 bg-[var(--accent)] px-5 font-bold text-[var(--accent-text)] disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <Save size={16} />
                  )}
                  {saving ? "Submitting..." : "Submit changes"}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={stopEditing}
                  className="inline-flex h-11 items-center gap-2 border border-[var(--border-strong)] px-5 font-bold disabled:opacity-50"
                >
                  <X size={16} /> Cancel editing
                </button>
              </div>
            </div>
          </section>
        ) : (
          <div className="grid gap-6 xl:grid-cols-2">
            <section className="border border-[var(--border)] bg-[var(--surface)]">
              <div className="flex items-center gap-3 border-b border-[var(--border)] p-5">
                <Building2 size={18} />
                <h2 className="font-bold">Employment information</h2>
              </div>
              <dl className="grid sm:grid-cols-2">
                {employment.map(([label, value]) => (
                  <div
                    key={label}
                    className="border-b border-[var(--border)] p-5 sm:border-r"
                  >
                    <dt className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                      {label}
                    </dt>
                    <dd className="mt-2 text-sm font-semibold">
                      {value || "Not provided"}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
            <section className="border border-[var(--border)] bg-[var(--surface)]">
              <div className="flex items-center gap-3 border-b border-[var(--border)] p-5">
                <UserRound size={18} />
                <h2 className="font-bold">Personal information</h2>
              </div>
              <dl className="grid sm:grid-cols-2">
                {personal.map(([label, value]) => (
                  <div
                    key={label}
                    className="border-b border-[var(--border)] p-5 sm:border-r"
                  >
                    <dt className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                      {label}
                    </dt>
                    <dd className="mt-2 break-words text-sm font-semibold">
                      {value || "Not provided"}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>
        )}

        <section className="border border-[var(--border)] bg-[var(--surface)]">
          <div className="border-b border-[var(--border)] p-5">
            <h2 className="font-bold">Change request history</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              The system keeps pending, approved, rejected and cancelled
              requests for accountability.
            </p>
          </div>
          {requests.length === 0 ? (
            <p className="p-6 text-sm text-[var(--muted)]">
              You have not submitted any profile changes.
            </p>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {requests.map((request) => (
                <article
                  key={request.id}
                  className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div>
                    <p className="font-bold">{labelForField(request.field)}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      Requested {formatDate(request.createdAt)} ·{" "}
                      {request.requestedValue}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      Reason: {request.reason}
                    </p>
                    {request.reviewComments && (
                      <p className="mt-2 text-sm">
                        HR: {request.reviewComments}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="border border-[var(--border-strong)] px-3 py-2 text-xs font-bold">
                      {request.status}
                    </span>
                    {request.status === "PENDING" && (
                      <button
                        type="button"
                        onClick={() => void cancel(request.id)}
                        className="inline-flex h-9 items-center gap-2 border border-red-300 px-3 text-xs font-bold text-red-700 dark:text-red-300"
                      >
                        <X size={14} />
                        Cancel request
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </EmployeeShell>
  );
}
