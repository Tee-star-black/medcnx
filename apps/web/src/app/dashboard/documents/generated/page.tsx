"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Check,
  ChevronRight,
  FileText,
  Info,
  Loader2,
  PencilLine,
  Search,
  UserRound,
  UserRoundPlus,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { api } from "@/lib/api";

type Template = {
  id: string;
  name: string;
  category: string;
  signatureMode: string;
  currentVersion: {
    versionNumber: number;
    detectedPlaceholders: string[];
  } | null;
};
type Employee = {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  jobTitle?: string | null;
  department?: { name: string } | null;
};
type External = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  idNumber: string;
  address: string;
  jobTitle: string;
  department: string;
  proposedSalary: string;
  proposedStartDate: string;
};
type Overrides = {
  firstName?: string;
  lastName?: string;
  email?: string;
  jobTitle?: string;
  department?: string;
  startDate?: string;
  employmentStatus?: string;
  basicSalary?: string;
  address?: string;
  idNumber?: string;
  organisationName?: string;
  organisationAddress?: string;
  organisationEmail?: string;
  organisationPhone?: string;
  phone?: string;
  organisationRegistrationNumber?: string;
  positionTitle?: string;
  commencementDate?: string;
  reportingLine?: string;
  natureOfEmployment?: string;
  hoursOfWork?: string;
  remunerationPackage?: string;
  regulatoryCompliance?: string;
  expiryDate?: string;
  addresseeName?: string;
  addresseeAddress?: string;
  professionalRegistrationNumber?: string;
  remunerationInWords?: string;
  payeReferenceNumber?: string;
  payPeriod?: string;
  bankAccountMasked?: string;
  bankName?: string;
  allowancesDetails?: string;
  contractType?: string;
  employmentSchedule?: string;
  endDate?: string;
  probationPeriod?: string;
  workLocation?: string;
  noticePeriod?: string;
  professionalCouncil?: string;
  specialConditions?: string;
  confirmationPurpose?: string;
  leaveType?: string;
  leaveStartDate?: string;
  leaveEndDate?: string;
  leaveDays?: string;
  incidentDate?: string;
  incidentDescription?: string;
  hearingDate?: string;
  hearingLocation?: string;
  chairperson?: string;
  warningLevel?: string;
  warningExpiryDate?: string;
  requiredImprovement?: string;
  disciplinaryOutcome?: string;
  terminationDate?: string;
};
type Preview = {
  mappedData: Record<string, Record<string, string>>;
  missingFields: string[];
  canGenerate: boolean;
  template: { version: number; signatureMode: string; placeholders: string[] };
  subject: {
    type: "EMPLOYEE" | "EXTERNAL";
    id: string | null;
    employeeNumber: string | null;
    fullName: string;
    department: string;
    email: string;
  };
};
type DocumentRow = {
  id: string;
  title: string;
  referenceNumber: string;
  status: string;
  signatureStatus: string;
  createdAt: string;
  employee?: {
    employeeNumber: string;
    firstName: string;
    lastName: string;
  } | null;
  recipient?: {
    firstName: string;
    lastName: string;
    email?: string | null;
  } | null;
  template: { name: string };
  templateVersion: { versionNumber: number };
};
const emptyExternal: External = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  idNumber: "",
  address: "",
  jobTitle: "",
  department: "",
  proposedSalary: "",
  proposedStartDate: "",
};
const field =
  "mt-1.5 w-full border border-[#cdd6dc] bg-white px-3.5 py-2.5 text-sm text-[#163042] outline-none transition focus:border-[#08788d] focus:ring-2 focus:ring-[#08788d]/10";
const primary =
  "inline-flex items-center justify-center gap-2 border border-[#08788d] bg-[#08788d] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#066477] disabled:cursor-not-allowed disabled:opacity-40";
const secondary =
  "inline-flex items-center justify-center gap-2 border border-[#c8d2d9] bg-white px-4 py-2.5 text-sm font-semibold text-[#163042] transition hover:border-[#08788d] hover:text-[#08788d] disabled:opacity-40";
const errorMessage = (e: any, fallback: string) => {
  const m = e?.response?.data?.message;
  return typeof m === "string" ? m : Array.isArray(m) ? m.join(" ") : fallback;
};

export default function GeneratedDocumentsPage() {
  const [templates, setTemplates] = useState<Template[]>([]),
    [employees, setEmployees] = useState<Employee[]>([]),
    [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [templateId, setTemplateId] = useState(""),
    [mode, setMode] = useState<"EMPLOYEE" | "EXTERNAL">("EMPLOYEE"),
    [employeeId, setEmployeeId] = useState(""),
    [external, setExternal] = useState<External>(emptyExternal),
    [title, setTitle] = useState(""),
    [effectiveDate, setEffectiveDate] = useState(""),
    [overrides, setOverrides] = useState<Overrides>({}),
    [updateProfile, setUpdateProfile] = useState(false),
    [preview, setPreview] = useState<Preview | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [search, setSearch] = useState("");
  useEffect(() => {
    void load();
  }, []);
  async function load() {
    setError("");
    try {
      const [t, e, d] = await Promise.all([
        api.get<Template[]>("/document-v2/templates?status=ACTIVE"),
        api.get<Employee[]>("/employees"),
        api.get<DocumentRow[]>("/document-v2/generated"),
      ]);
      setTemplates(t.data);
      setEmployees(e.data);
      setDocuments(d.data);
      setTemplateId((v) => v || t.data[0]?.id || "");
      setEmployeeId((v) => v || e.data[0]?.id || "");
    } catch (e) {
      setError(errorMessage(e, "Could not load document generation."));
    }
  }
  const payload = () => ({
    templateId,
    employeeId: mode === "EMPLOYEE" ? employeeId : undefined,
    recipient:
      mode === "EXTERNAL"
        ? Object.fromEntries(
            Object.entries(external).filter(([, v]) => v !== ""),
          )
        : undefined,
    overrides: Object.keys(overrides).length ? overrides : undefined,
    title: title || undefined,
    effectiveDate: effectiveDate || undefined,
  });
  async function review() {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      setPreview(
        (await api.post<Preview>("/document-v2/generated/preview", payload()))
          .data,
      );
    } catch (e) {
      setError(errorMessage(e, "Could not validate the mapped information."));
    } finally {
      setBusy(false);
    }
  }
  async function generate() {
    setBusy(true);
    setError("");
    try {
      const r = await api.post<DocumentRow>("/document-v2/generated", {
        ...payload(),
        updateEmployeeProfile: mode === "EMPLOYEE" && updateProfile,
        idempotencyKey: crypto.randomUUID(),
      });
      setSuccess(`Created ${r.data.referenceNumber}.`);
      setPreview(null);
      setOverrides({});
      await load();
    } catch (e) {
      setError(errorMessage(e, "Document generation failed."));
    } finally {
      setBusy(false);
    }
  }
  async function openPdf() {
    setBusy(true);
    setError("");
    try {
      const r = await api.post(
        "/document-v2/generated/preview-pdf",
        payload(),
        { responseType: "blob" },
      );
      const url = URL.createObjectURL(r.data);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      setError(errorMessage(e, "Could not render the PDF preview."));
    } finally {
      setBusy(false);
    }
  }
  function edit(path: string, value: string) {
    const map: Record<string, keyof Overrides> = {
      "employee.firstName": "firstName",
      "employee.lastName": "lastName",
      "employee.email": "email",
      "employee.phone": "phone",
      "employee.jobTitle": "jobTitle",
      "employee.department": "department",
      "employee.startDate": "startDate",
      "employee.employmentStatus": "employmentStatus",
      "employee.basicSalary": "basicSalary",
      "employee.address": "address",
      "employee.idNumber": "idNumber",
      "organisation.name": "organisationName",
      "organisation.address": "organisationAddress",
      "organisation.email": "organisationEmail",
      "organisation.phone": "organisationPhone",
      "organisation.registrationNumber": "organisationRegistrationNumber",
      "document.positionTitle": "positionTitle",
      "document.commencementDate": "commencementDate",
      "document.reportingLine": "reportingLine",
      "document.natureOfEmployment": "natureOfEmployment",
      "document.hoursOfWork": "hoursOfWork",
      "document.remunerationPackage": "remunerationPackage",
      "document.regulatoryCompliance": "regulatoryCompliance",
      "document.expiryDate": "expiryDate",
      "document.addresseeName": "addresseeName",
      "document.addresseeAddress": "addresseeAddress",
      "document.professionalRegistrationNumber":
        "professionalRegistrationNumber",
      "document.remunerationInWords": "remunerationInWords",
      "document.payeReferenceNumber": "payeReferenceNumber",
      "document.payPeriod": "payPeriod",
      "document.bankAccountMasked": "bankAccountMasked",
      "document.bankName": "bankName",
      "document.allowancesDetails": "allowancesDetails",
      "document.contractType": "contractType",
      "document.employmentSchedule": "employmentSchedule",
      "document.endDate": "endDate",
      "document.probationPeriod": "probationPeriod",
      "document.workLocation": "workLocation",
      "document.noticePeriod": "noticePeriod",
      "document.professionalCouncil": "professionalCouncil",
      "document.specialConditions": "specialConditions",
      "document.confirmationPurpose": "confirmationPurpose",
      "document.leaveType": "leaveType",
      "document.leaveStartDate": "leaveStartDate",
      "document.leaveEndDate": "leaveEndDate",
      "document.leaveDays": "leaveDays",
      "document.incidentDate": "incidentDate",
      "document.incidentDescription": "incidentDescription",
      "document.hearingDate": "hearingDate",
      "document.hearingLocation": "hearingLocation",
      "document.chairperson": "chairperson",
      "document.warningLevel": "warningLevel",
      "document.warningExpiryDate": "warningExpiryDate",
      "document.requiredImprovement": "requiredImprovement",
      "document.disciplinaryOutcome": "disciplinaryOutcome",
      "document.terminationDate": "terminationDate",
    };
    const key = map[path];
    if (key) setOverrides((v) => ({ ...v, [key]: value }));
    const [scope, fieldName] = path.split(".");
    setPreview((current) =>
      current
        ? {
            ...current,
            mappedData: {
              ...current.mappedData,
              [scope]: { ...current.mappedData[scope], [fieldName]: value },
            },
          }
        : current,
    );
  }
  const selectedTemplate = templates.find((t) => t.id === templateId),
    selectedEmployee = employees.find((e) => e.id === employeeId);
  const filtered = useMemo(
    () =>
      documents.filter((d) =>
        `${d.referenceNumber} ${d.title} ${d.employee?.firstName || d.recipient?.firstName || ""} ${d.employee?.lastName || d.recipient?.lastName || ""}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [documents, search],
  );
  const canReview = Boolean(
    templateId &&
    (mode === "EMPLOYEE"
      ? employeeId
      : external.firstName && external.lastName),
  );
  return (
    <DashboardShell activePage="documents">
      <div className="min-h-full bg-[#f6f8f9] p-1 text-[#163042]">
        <div className="mx-auto max-w-[1500px] space-y-6">
          <header className="flex flex-col gap-4 border-b border-[#dbe2e7] bg-white px-7 py-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.18em] text-[#08788d]">
                Document workspace
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-.03em]">
                Create a document
              </h1>
              <p className="mt-2 text-sm text-[#607787]">
                Choose a person, adjust the information in place, preview the
                PDF and generate a controlled record.
              </p>
            </div>
            <div className="flex gap-2">
              <Link className={secondary} href="/dashboard/documents/templates">
                Templates
              </Link>
              <Link
                className={secondary}
                href="/dashboard/settings/document-branding"
              >
                Branding & signature
              </Link>
            </div>
          </header>
          <nav className="grid border border-[#dbe2e7] bg-white sm:grid-cols-4">
            {[
              ["1", "Template", Boolean(templateId)],
              ["2", "Person", canReview],
              ["3", "Information", Boolean(preview)],
              ["4", "Preview & generate", Boolean(preview?.canGenerate)],
            ].map(([n, label, done], i) => (
              <div
                key={String(label)}
                className={`flex items-center gap-3 px-5 py-4 ${i ? "border-t border-[#e4e9ec] sm:border-l sm:border-t-0" : ""}`}
              >
                <span
                  className={`grid h-7 w-7 place-items-center border text-xs font-bold ${done ? "border-[#08788d] bg-[#08788d] text-white" : "border-[#cbd5dc] text-[#78909e]"}`}
                >
                  {done ? <Check size={14} /> : n}
                </span>
                <span className="text-sm font-semibold">{label}</span>
              </div>
            ))}
          </nav>
          {error && (
            <div className="border-l-4 border-red-600 bg-red-50 px-5 py-4 text-sm text-red-800">
              {error}
            </div>
          )}
          {success && (
            <div className="border-l-4 border-emerald-600 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
              {success}
            </div>
          )}
          <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-6">
              <article className="border border-[#dbe2e7] bg-white">
                <SectionTitle
                  number="1"
                  title="Select a template"
                  help="Only validated and active templates appear here."
                />
                <div className="p-6">
                  <label className="text-sm font-semibold">
                    Document template
                    <select
                      className={field}
                      value={templateId}
                      onChange={(e) => {
                        setTemplateId(e.target.value);
                        setPreview(null);
                      }}
                    >
                      <option value="">Choose an active template</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} · Version {t.currentVersion?.versionNumber}
                        </option>
                      ))}
                    </select>
                  </label>
                  {!templates.length && (
                    <p className="mt-3 text-sm text-amber-700">
                      No active templates are available. Upload, validate and
                      activate one first.
                    </p>
                  )}
                </div>
              </article>
              <article className="border border-[#dbe2e7] bg-white">
                <SectionTitle
                  number="2"
                  title="Who is this document for?"
                  help="An external person is saved as a pre-hire document recipient and does not receive an employee account."
                />
                <div className="p-6">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ModeButton
                      active={mode === "EMPLOYEE"}
                      icon={<UserRound size={19} />}
                      title="Registered employee"
                      text="Use an existing employee profile"
                      onClick={() => {
                        setMode("EMPLOYEE");
                        setPreview(null);
                      }}
                    />
                    <ModeButton
                      active={mode === "EXTERNAL"}
                      icon={<UserRoundPlus size={19} />}
                      title="New or external person"
                      text="Offer, contract or pre-employment document"
                      onClick={() => {
                        setMode("EXTERNAL");
                        setPreview(null);
                      }}
                    />
                  </div>
                  {mode === "EMPLOYEE" ? (
                    <div className="mt-5">
                      <label className="text-sm font-semibold">
                        Employee
                        <select
                          className={field}
                          value={employeeId}
                          onChange={(e) => {
                            setEmployeeId(e.target.value);
                            setPreview(null);
                            setOverrides({});
                          }}
                        >
                          {employees.map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.firstName} {x.lastName} · {x.employeeNumber}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  ) : (
                    <ExternalForm value={external} onChange={setExternal} />
                  )}
                </div>
              </article>
              <article className="border border-[#dbe2e7] bg-white">
                <SectionTitle
                  number="3"
                  title="Document details"
                  help="The effective date is separate from the date the document is generated."
                />
                <div className="grid gap-4 p-6 sm:grid-cols-2">
                  <label className="text-sm font-semibold">
                    Document title
                    <input
                      className={field}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={selectedTemplate?.name || "Document title"}
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    Effective date
                    <input
                      type="date"
                      className={field}
                      value={effectiveDate}
                      onChange={(e) => setEffectiveDate(e.target.value)}
                    />
                  </label>
                  <div className="sm:col-span-2">
                    <button
                      disabled={!canReview || busy}
                      className={primary}
                      onClick={() => void review()}
                    >
                      {busy ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : (
                        <ChevronRight size={16} />
                      )}
                      Review and edit mapped information
                    </button>
                  </div>
                </div>
              </article>
              {preview && (
                <article className="border border-[#dbe2e7] bg-white">
                  <SectionTitle
                    number="4"
                    title="Review and edit information"
                    help="Edits are applied to this document. For an employee, choose whether to save them back to the profile."
                  />
                  <div className="p-6">
                    {preview.missingFields.length ? (
                      <div className="mb-5 border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        <b>Information needed:</b>{" "}
                        {preview.missingFields.join(", ")}
                      </div>
                    ) : (
                      <div className="mb-5 flex items-center gap-2 border-l-4 border-emerald-600 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                        <Check size={16} />
                        All required information is available.
                      </div>
                    )}
                    <div className="grid gap-4 md:grid-cols-2">
                      {Object.entries(preview.mappedData).flatMap(
                        ([scope, values]) =>
                          Object.entries(values)
                            .filter(
                              ([k]) =>
                                preview.template.placeholders.includes(
                                  `${scope}.${k}`,
                                ) &&
                                ![
                                  "logo",
                                  "signature",
                                  "fullName",
                                  "employeeNumber",
                                  "referenceNumber",
                                  "generatedDate",
                                ].includes(k),
                            )
                            .map(([key, value]) => {
                              const path = `${scope}.${key}`;
                              const editable =
                                path.startsWith("employee.") ||
                                path.startsWith("document.") ||
                                [
                                  "organisation.name",
                                  "organisation.address",
                                  "organisation.email",
                                  "organisation.phone",
                                  "organisation.registrationNumber",
                                ].includes(path);
                              const options = selectOptions(path);
                              return (
                                <label
                                  key={path}
                                  className="text-sm font-semibold"
                                >
                                  <span className="flex items-center gap-1.5">
                                    {labelFor(path)}
                                    {editable && (
                                      <PencilLine
                                        size={13}
                                        className="text-[#78909e]"
                                      />
                                    )}
                                  </span>
                                  {options ? (
                                    <select
                                      className={field}
                                      value={String(value || "")}
                                      onChange={(e) =>
                                        edit(path, e.target.value)
                                      }
                                    >
                                      <option value="">Select an option</option>
                                      {options.map((option) => (
                                        <option key={option} value={option}>
                                          {option}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <input
                                      className={`${field} ${editable ? "" : "bg-[#f4f6f7] text-[#6d818e]"}`}
                                      value={String(value || "")}
                                      readOnly={!editable}
                                      maxLength={
                                        path === "employee.idNumber"
                                          ? 13
                                          : undefined
                                      }
                                      inputMode={
                                        path === "employee.idNumber"
                                          ? "numeric"
                                          : undefined
                                      }
                                      onChange={(e) =>
                                        edit(
                                          path,
                                          path === "employee.idNumber"
                                            ? e.target.value
                                                .replace(/\D/g, "")
                                                .slice(0, 13)
                                            : e.target.value,
                                        )
                                      }
                                    />
                                  )}
                                </label>
                              );
                            }),
                      )}
                    </div>
                    {mode === "EMPLOYEE" && (
                      <label className="mt-6 flex items-start gap-3 border border-[#d7e0e5] bg-[#f8fafb] p-4">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 accent-[#08788d]"
                          checked={updateProfile}
                          onChange={(e) => setUpdateProfile(e.target.checked)}
                        />
                        <span>
                          <b className="block text-sm">
                            Update the employee profile with these edits
                          </b>
                          <span className="mt-1 block text-xs leading-5 text-[#607787]">
                            Leave this off to use the edited values for this
                            document only. Organisation overrides always remain
                            document-only.
                          </span>
                        </span>
                      </label>
                    )}
                    <div className="mt-6 flex flex-wrap gap-2">
                      <button
                        className={secondary}
                        disabled={busy}
                        onClick={() => void review()}
                      >
                        Revalidate changes
                      </button>
                      <button
                        className={secondary}
                        disabled={!preview.canGenerate || busy}
                        onClick={() => void openPdf()}
                      >
                        Open PDF preview
                      </button>
                      <button
                        className={primary}
                        disabled={!preview.canGenerate || busy}
                        onClick={() => void generate()}
                      >
                        {selectedTemplate?.signatureMode === "CEO_APPROVAL"
                          ? "Generate and request approval"
                          : "Generate document"}
                      </button>
                    </div>
                  </div>
                </article>
              )}
            </div>
            <aside className="h-fit border border-[#dbe2e7] bg-white lg:sticky lg:top-5">
              <div className="border-b border-[#e1e7ea] px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-[.14em] text-[#78909e]">
                  Current selection
                </p>
              </div>
              <dl className="divide-y divide-[#e8edef] px-5">
                <Summary label="Template" value={selectedTemplate?.name} />
                <Summary
                  label="Version"
                  value={
                    selectedTemplate?.currentVersion
                      ? `Version ${selectedTemplate.currentVersion.versionNumber}`
                      : undefined
                  }
                />
                <Summary
                  label="Person"
                  value={
                    mode === "EMPLOYEE"
                      ? selectedEmployee
                        ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}`
                        : undefined
                      : `${external.firstName} ${external.lastName}`.trim() ||
                        undefined
                  }
                />
                <Summary
                  label="Type"
                  value={
                    mode === "EMPLOYEE"
                      ? "Registered employee"
                      : "External / pre-hire"
                  }
                />
                <Summary
                  label="Department"
                  value={
                    mode === "EMPLOYEE"
                      ? selectedEmployee?.department?.name
                      : external.department
                  }
                />
                <Summary
                  label="Signature"
                  value={selectedTemplate?.signatureMode?.replaceAll("_", " ")}
                />
              </dl>
            </aside>
          </section>
          <section className="border border-[#dbe2e7] bg-white">
            <div className="flex flex-col gap-3 border-b border-[#e1e7ea] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold">Generated documents</h2>
                <p className="mt-1 text-xs text-[#78909e]">
                  Employee and external-recipient documents
                </p>
              </div>
              <label className="relative">
                <Search
                  className="absolute left-3 top-2.5 text-[#78909e]"
                  size={16}
                />
                <input
                  className="border border-[#ccd6dc] py-2 pl-9 pr-3 text-sm outline-none focus:border-[#08788d]"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search documents"
                />
              </label>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-[#f5f7f8] text-xs uppercase tracking-wider text-[#6f8593]">
                  <tr>
                    {[
                      "Reference",
                      "Document",
                      "Person",
                      "Type",
                      "Template",
                      "Status",
                      "Generated",
                      "",
                    ].map((h) => (
                      <th key={h} className="px-4 py-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d) => {
                    const person = d.employee || d.recipient;
                    return (
                      <tr key={d.id} className="border-t border-[#e5eaed]">
                        <td className="px-4 py-3 font-mono text-xs">
                          {d.referenceNumber}
                        </td>
                        <td className="px-4 py-3 font-semibold">{d.title}</td>
                        <td className="px-4 py-3">
                          {person?.firstName} {person?.lastName}
                        </td>
                        <td className="px-4 py-3 text-[#607787]">
                          {d.employee ? "Employee" : "External"}
                        </td>
                        <td className="px-4 py-3">
                          {d.template.name} · v{d.templateVersion.versionNumber}
                        </td>
                        <td className="px-4 py-3">
                          {d.status.replaceAll("_", " ")}
                        </td>
                        <td className="px-4 py-3">
                          {new Date(d.createdAt).toLocaleDateString("en-ZA")}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            className="font-semibold text-[#08788d] hover:underline"
                            href={`/dashboard/documents/generated/${d.id}`}
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!filtered.length && (
                <div className="grid place-items-center px-6 py-14 text-center text-sm text-[#78909e]">
                  <FileText className="mb-2" />
                  No generated documents found.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </DashboardShell>
  );
}
function SectionTitle({
  number,
  title,
  help,
}: {
  number: string;
  title: string;
  help: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#e1e7ea] px-6 py-4">
      <div className="flex items-center gap-3">
        <span className="grid h-7 w-7 place-items-center bg-[#e7f3f5] text-xs font-bold text-[#08788d]">
          {number}
        </span>
        <h2 className="font-semibold">{title}</h2>
      </div>
      <span className="group relative">
        <Info size={17} className="cursor-help text-[#78909e]" />
        <span className="pointer-events-none absolute right-0 top-6 z-20 hidden w-64 border border-[#cbd6dc] bg-[#163042] p-3 text-xs font-normal leading-5 text-white shadow-lg group-hover:block">
          {help}
        </span>
      </span>
    </div>
  );
}
function ModeButton({
  active,
  icon,
  title,
  text,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  title: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-start gap-3 border p-4 text-left transition ${active ? "border-[#08788d] bg-[#f0f8f9]" : "border-[#d6dfe4] hover:border-[#8ba0ac]"}`}
    >
      <span className={active ? "text-[#08788d]" : "text-[#6f8593]"}>
        {icon}
      </span>
      <span>
        <b className="block text-sm">{title}</b>
        <span className="mt-1 block text-xs text-[#607787]">{text}</span>
      </span>
    </button>
  );
}
function ExternalForm({
  value,
  onChange,
}: {
  value: External;
  onChange: (v: External) => void;
}) {
  const set = (key: keyof External, v: string) =>
    onChange({ ...value, [key]: v });
  return (
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <Input
        label="First name"
        required
        value={value.firstName}
        onChange={(v) => set("firstName", v)}
      />
      <Input
        label="Last name"
        required
        value={value.lastName}
        onChange={(v) => set("lastName", v)}
      />
      <Input
        label="Email"
        type="email"
        value={value.email}
        onChange={(v) => set("email", v)}
      />
      <Input
        label="Phone"
        value={value.phone}
        onChange={(v) => set("phone", v)}
      />
      <Input
        label="ID or passport number"
        value={value.idNumber}
        onChange={(v) => set("idNumber", v)}
      />
      <Input
        label="Proposed job title"
        value={value.jobTitle}
        onChange={(v) => set("jobTitle", v)}
      />
      <Input
        label="Department"
        value={value.department}
        onChange={(v) => set("department", v)}
      />
      <Input
        label="Proposed salary (ZAR)"
        type="number"
        value={value.proposedSalary}
        onChange={(v) => set("proposedSalary", v)}
      />
      <Input
        label="Proposed start date"
        type="date"
        value={value.proposedStartDate}
        onChange={(v) => set("proposedStartDate", v)}
      />
      <label className="text-sm font-semibold sm:col-span-2">
        Residential address
        <textarea
          className={`${field} min-h-20 resize-y`}
          value={value.address}
          onChange={(e) => set("address", e.target.value)}
        />
      </label>
    </div>
  );
}
function Input({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="text-sm font-semibold">
      {label}
      {required && <span className="text-red-600"> *</span>}
      <input
        type={type}
        className={field}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
function Summary({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4 py-4 text-sm">
      <dt className="text-[#78909e]">{label}</dt>
      <dd className="max-w-[180px] text-right font-semibold">
        {value || "Not selected"}
      </dd>
    </div>
  );
}
function labelFor(path: string) {
  return path
    .split(".")
    .pop()!
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase());
}

function selectOptions(path: string): string[] | null {
  const options: Record<string, string[]> = {
    "document.contractType": [
      "Permanent employment",
      "Fixed-term employment",
      "Temporary employment",
    ],
    "document.employmentSchedule": ["Full-time", "Part-time"],
    "document.probationPeriod": ["None", "1 month", "3 months", "6 months"],
    "document.noticePeriod": [
      "As prescribed by the BCEA",
      "One week",
      "Two weeks",
      "One calendar month",
      "Three calendar months",
    ],
    "document.professionalCouncil": [
      "Not applicable",
      "HPCSA",
      "SANC",
      "SACSSP",
      "HPCSA and SANC",
      "Other",
    ],
    "document.natureOfEmployment": [
      "Full-time permanent employment",
      "Part-time permanent employment",
      "Fixed-term employment",
      "Temporary employment",
    ],
    "employee.employmentStatus": [
      "PROSPECTIVE",
      "ACTIVE",
      "ON LEAVE",
      "SUSPENDED",
      "TERMINATED",
    ],
    "document.bankName": [
      "Absa",
      "Access Bank South Africa",
      "African Bank",
      "Bank Zero",
      "Bidvest Bank",
      "Capitec Bank",
      "Discovery Bank",
      "First National Bank (FNB)",
      "Investec",
      "Nedbank",
      "Sasfin Bank",
      "Standard Bank",
      "TymeBank",
    ],
  };
  return options[path] || null;
}
