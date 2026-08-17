"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  CheckCircle2,
  ChevronRight,
  Download,
  Eye,
  FilePlus2,
  FileText,
  FolderOpen,
  Loader2,
  RefreshCw,
  Search,
  Upload,
  X,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { api } from "@/lib/api";

type Template = {
  id: string;
  name: string;
  description?: string;
  category: string;
  status: string;
  signatureMode: string;
  defaultEmployeeVisibility: boolean;
  currentVersion: {
    versionNumber: number;
    originalName: string;
    detectedPlaceholders: string[];
    unsupportedPlaceholders: string[];
    isValid: boolean;
  } | null;
  _count: { versions: number; documents: number };
};
type Preset = {
  key: string;
  fileName: string;
  name: string;
  description: string;
  category: string;
  signatureMode: string;
  detectedPlaceholders: string[];
  unsupportedPlaceholders: string[];
  isValid: boolean;
  imported: boolean;
  templateId?: string | null;
  templateStatus?: string | null;
};
type Group = {
  key: string;
  name: string;
  description: string;
  categories: string[];
};

const groups: Group[] = [
  {
    key: "EMPLOYMENT",
    name: "Employment",
    description: "Contracts, offers and amendments",
    categories: [
      "EMPLOYMENT_CONTRACT",
      "OFFER_LETTER",
      "CONTRACT_AMENDMENT",
      "PROMOTION",
    ],
  },
  {
    key: "CONFIRMATION",
    name: "Confirmations",
    description: "Employment, salary and service records",
    categories: [
      "CONFIRMATION_OF_EMPLOYMENT",
      "SALARY_CONFIRMATION",
      "SERVICE_CERTIFICATE",
      "SALARY_ADJUSTMENT",
    ],
  },
  {
    key: "LEAVE",
    name: "Leave",
    description: "Leave confirmations and agreements",
    categories: ["LEAVE_CONFIRMATION", "UNPAID_LEAVE_AGREEMENT"],
  },
  {
    key: "POLICY",
    name: "Policy & compliance",
    description: "Acknowledgements and confidentiality",
    categories: ["POLICY_ACKNOWLEDGEMENT", "CONFIDENTIALITY_AGREEMENT"],
  },
  {
    key: "DISCIPLINARY",
    name: "Disciplinary",
    description: "Notices, warnings and outcomes",
    categories: [
      "DISCIPLINARY_NOTICE",
      "WARNING_LETTER",
      "DISCIPLINARY_OUTCOME",
    ],
  },
  {
    key: "PAYROLL",
    name: "Payroll",
    description: "Payslips and remuneration records",
    categories: ["PAYSLIP"],
  },
  {
    key: "TERMINATION",
    name: "Termination",
    description: "Resignation, termination and retrenchment",
    categories: [
      "TERMINATION",
      "RESIGNATION_ACKNOWLEDGEMENT",
      "RETRENCHMENT_NOTICE",
    ],
  },
  {
    key: "GENERAL",
    name: "General HR",
    description: "References and custom letters",
    categories: ["REFERENCE_LETTER", "GENERAL_HR_LETTER", "CUSTOM"],
  },
];
const categories = [...new Set(groups.flatMap((group) => group.categories))];
const modes = ["AUTOMATIC", "CEO_APPROVAL", "MANUAL", "NONE"];
const field =
  "w-full border border-[#ccd7dd] bg-white px-3.5 py-2.5 text-sm text-[#163042] outline-none focus:border-[#08788d] focus:ring-2 focus:ring-[#08788d]/10";
const primary =
  "inline-flex items-center justify-center gap-2 bg-[#08788d] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#066477] disabled:opacity-40";
const secondary =
  "inline-flex items-center justify-center gap-2 border border-[#cbd6dc] bg-white px-4 py-2.5 text-sm font-semibold text-[#163042] hover:border-[#08788d] hover:text-[#08788d] disabled:opacity-40";
const message = (e: any, fallback: string) =>
  e?.response?.data?.message || fallback;

export default function TemplatesPage() {
  const [items, setItems] = useState<Template[]>([]),
    [presets, setPresets] = useState<Preset[]>([]);
  const [selectedGroup, setSelectedGroup] = useState("ALL"),
    [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false),
    [addMode, setAddMode] = useState<"PRESET" | "UPLOAD">("PRESET");
  const [file, setFile] = useState<File | null>(null),
    [name, setName] = useState(""),
    [description, setDescription] = useState("");
  const [category, setCategory] = useState("EMPLOYMENT_CONTRACT"),
    [signatureMode, setSignatureMode] = useState("CEO_APPROVAL");
  const [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const [previewUrl, setPreviewUrl] = useState(""),
    [previewName, setPreviewName] = useState("");
  useEffect(() => {
    void load();
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // The generated object URL is also revoked whenever a new preview opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function load() {
    setError("");
    try {
      const [templates, presetList] = await Promise.all([
        api.get<Template[]>("/document-v2/templates"),
        api.get<Preset[]>("/document-v2/templates/presets"),
      ]);
      setItems(templates.data);
      setPresets(presetList.data);
    } catch (e) {
      setError(String(message(e, "Could not load template management.")));
    }
  }
  const activeGroup = groups.find((group) => group.key === selectedGroup);
  const filtered = useMemo(
    () =>
      items.filter((item) => {
        const inGroup =
          !activeGroup || activeGroup.categories.includes(item.category);
        return (
          inGroup &&
          `${item.name} ${item.category} ${item.description || ""}`
            .toLowerCase()
            .includes(search.toLowerCase())
        );
      }),
    [items, activeGroup, search],
  );
  async function previewPreset(preset: Preset) {
    setBusy(`preview:${preset.key}`);
    setError("");
    try {
      const response = await api.get(
        `/document-v2/templates/presets/${encodeURIComponent(preset.key)}/preview`,
        { responseType: "blob" },
      );
      const url = URL.createObjectURL(response.data);
      openPreview(url, preset.name);
    } catch (e) {
      setError(String(message(e, "Could not preview this preset.")));
    } finally {
      setBusy("");
    }
  }
  function openPreview(url: string, title: string) {
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return url;
    });
    setPreviewName(title);
  }
  function closePreview() {
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return "";
    });
    setPreviewName("");
  }
  async function previewTemplate(template: Template) {
    setBusy(`preview-template:${template.id}`);
    setError("");
    try {
      const response = await api.get(
        `/document-v2/templates/${template.id}/preview`,
        { responseType: "blob" },
      );
      openPreview(URL.createObjectURL(response.data), template.name);
    } catch (e) {
      setError(String(message(e, "Could not preview this template.")));
    } finally {
      setBusy("");
    }
  }
  async function usePreset(preset: Preset) {
    setBusy(`import:${preset.key}`);
    setError("");
    setSuccess("");
    try {
      await api.post(
        `/document-v2/templates/presets/${encodeURIComponent(preset.key)}/import`,
      );
      setSuccess(`${preset.name} was added and activated.`);
      setShowAdd(false);
      await load();
    } catch (e) {
      setError(String(message(e, "Could not add this preset.")));
    } finally {
      setBusy("");
    }
  }
  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy("upload");
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("name", name);
      form.append("description", description);
      form.append("category", category);
      form.append("signatureMode", signatureMode);
      form.append("defaultEmployeeVisibility", "false");
      await api.post("/document-v2/templates", form);
      setSuccess("Template uploaded for validation.");
      setFile(null);
      setName("");
      setShowAdd(false);
      await load();
    } catch (e) {
      setError(String(message(e, "Upload failed.")));
    } finally {
      setBusy("");
    }
  }
  async function act(id: string, action: "validate" | "activate" | "archive") {
    setBusy(`${action}:${id}`);
    setError("");
    try {
      await api.post(`/document-v2/templates/${id}/${action}`);
      await load();
    } catch (e) {
      setError(String(message(e, `Could not ${action} template.`)));
    } finally {
      setBusy("");
    }
  }
  return (
    <DashboardShell activePage="documents">
      <div className="min-h-full bg-[#f6f8f9] p-1 text-[#163042]">
        <div className="mx-auto max-w-[1500px] space-y-6">
          <header className="flex flex-col gap-4 border-b border-[#dbe2e7] bg-white px-7 py-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.18em] text-[#08788d]">
                Document library
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-.03em]">
                Template management
              </h1>
              <p className="mt-2 text-sm text-[#607787]">
                Choose a business category, maintain one controlled template,
                and keep its version history.
              </p>
            </div>
            <div className="flex gap-2">
              <Link className={secondary} href="/dashboard/documents/generated">
                Generate document
              </Link>
              <button
                className={primary}
                onClick={() => setShowAdd((value) => !value)}
              >
                <FilePlus2 size={17} />
                Add template
              </button>
            </div>
          </header>
          {error && (
            <div className="border-l-4 border-red-600 bg-red-50 px-5 py-4 text-sm text-red-800">
              {String(error)}
            </div>
          )}
          {success && (
            <div className="border-l-4 border-emerald-600 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
              {success}
            </div>
          )}
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {groups.map((group) => {
              const count = items.filter(
                (item) =>
                  group.categories.includes(item.category) &&
                  item.status !== "ARCHIVED",
              ).length;
              return (
                <button
                  key={group.key}
                  onClick={() =>
                    setSelectedGroup(
                      selectedGroup === group.key ? "ALL" : group.key,
                    )
                  }
                  className={`border bg-white p-5 text-left transition ${selectedGroup === group.key ? "border-[#08788d] ring-2 ring-[#08788d]/10" : "border-[#dbe2e7] hover:border-[#8ba0ac]"}`}
                >
                  <span className="flex items-center justify-between">
                    <FolderOpen size={20} className="text-[#08788d]" />
                    <span className="rounded-full bg-[#edf3f5] px-2.5 py-1 text-xs font-bold">
                      {count}
                    </span>
                  </span>
                  <b className="mt-4 block">{group.name}</b>
                  <span className="mt-1 block text-xs leading-5 text-[#607787]">
                    {group.description}
                  </span>
                </button>
              );
            })}
          </section>
          {showAdd && (
            <section className="border border-[#cbd8de] bg-white">
              <div className="flex border-b border-[#e1e7ea]">
                <button
                  className={`px-6 py-4 text-sm font-semibold ${addMode === "PRESET" ? "border-b-2 border-[#08788d] text-[#08788d]" : "text-[#607787]"}`}
                  onClick={() => setAddMode("PRESET")}
                >
                  Choose a preset
                </button>
                <button
                  className={`px-6 py-4 text-sm font-semibold ${addMode === "UPLOAD" ? "border-b-2 border-[#08788d] text-[#08788d]" : "text-[#607787]"}`}
                  onClick={() => setAddMode("UPLOAD")}
                >
                  Upload Word file
                </button>
              </div>
              {addMode === "PRESET" ? (
                <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-3">
                  {presets.map((preset) => (
                    <article
                      key={preset.key}
                      className="flex flex-col border border-[#dce4e8] p-5"
                    >
                      <span className="text-xs font-bold uppercase tracking-wider text-[#08788d]">
                        {preset.category.replaceAll("_", " ")}
                      </span>
                      <h3 className="mt-2 font-semibold">{preset.name}</h3>
                      <p className="mt-2 flex-1 text-xs leading-5 text-[#607787]">
                        {preset.description}
                      </p>
                      <p className="mt-3 text-xs text-[#607787]">
                        {preset.detectedPlaceholders.length} mapped fields ·{" "}
                        {preset.signatureMode.replaceAll("_", " ")}
                      </p>
                      <div className="mt-4 flex gap-2">
                        <button
                          className={secondary}
                          disabled={Boolean(busy)}
                          onClick={() => void previewPreset(preset)}
                        >
                          {busy === `preview:${preset.key}` ? (
                            <Loader2 className="animate-spin" size={15} />
                          ) : (
                            <Eye size={15} />
                          )}
                          Preview
                        </button>
                        <button
                          className={primary}
                          disabled={
                            preset.imported ||
                            !preset.isValid ||
                            Boolean(busy)
                          }
                          onClick={() => void usePreset(preset)}
                        >
                          {busy === `import:${preset.key}` ? (
                            <Loader2 className="animate-spin" size={15} />
                          ) : (
                            <ChevronRight size={15} />
                          )}
                          {preset.imported ? "Already added" : "Use preset"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <form
                  onSubmit={upload}
                  className="grid gap-4 p-6 md:grid-cols-2"
                >
                  <input
                    required
                    className={field}
                    placeholder="Template name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <input
                    className={field}
                    placeholder="Description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                  <select
                    className={field}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {categories.map((item) => (
                      <option key={item} value={item}>
                        {item.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                  <select
                    className={field}
                    value={signatureMode}
                    onChange={(e) => setSignatureMode(e.target.value)}
                  >
                    {modes.map((item) => (
                      <option key={item}>{item.replaceAll("_", " ")}</option>
                    ))}
                  </select>
                  <input
                    required
                    accept=".docx"
                    type="file"
                    className={field}
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                  <button className={primary} disabled={!file || Boolean(busy)}>
                    <Upload size={16} />
                    Upload and inspect
                  </button>
                </form>
              )}
            </section>
          )}
          <div
            className={`grid gap-5 ${previewUrl ? "xl:grid-cols-[minmax(0,1fr)_minmax(430px,46%)]" : ""}`}
          >
          <section className="min-w-0 border border-[#dbe2e7] bg-white">
            <div className="flex flex-col gap-3 border-b border-[#e1e7ea] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold">
                  {activeGroup?.name || "All organisation templates"}
                </h2>
                <p className="mt-1 text-xs text-[#607787]">
                  {filtered.length} template{filtered.length === 1 ? "" : "s"}
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
                  placeholder="Search templates"
                />
              </label>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left text-sm">
                <thead className="bg-[#f5f7f8] text-xs uppercase tracking-wider text-[#6f8593]">
                  <tr>
                    {[
                      "Template",
                      "Document type",
                      "Version",
                      "Fields",
                      "Signature",
                      "Status",
                      "Used",
                      "Actions",
                    ].map((heading) => (
                      <th className="px-4 py-3" key={heading}>
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr key={item.id} className="border-t border-[#e5eaed]">
                      <td className="px-4 py-4">
                        <Link
                          className="font-semibold text-[#08788d] hover:underline"
                          href={`/dashboard/documents/templates/${item.id}`}
                        >
                          {item.name}
                        </Link>
                        <span className="mt-1 block text-xs text-[#607787]">
                          {item.description ||
                            item.currentVersion?.originalName}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        {item.category.replaceAll("_", " ")}
                      </td>
                      <td className="px-4 py-4">
                        v{item.currentVersion?.versionNumber} ·{" "}
                        {item._count.versions} version
                        {item._count.versions === 1 ? "" : "s"}
                      </td>
                      <td className="px-4 py-4">
                        {item.currentVersion?.detectedPlaceholders.length || 0}{" "}
                        mapped
                      </td>
                      <td className="px-4 py-4">
                        {item.signatureMode.replaceAll("_", " ")}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`px-2 py-1 text-xs font-bold ${item.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : item.status === "ARCHIVED" ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-700"}`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-4">{item._count.documents}</td>
                      <td className="px-4 py-4">
                        <div className="flex gap-3">
                          <button
                            type="button"
                            title="Preview template"
                            aria-label={`Preview ${item.name}`}
                            disabled={Boolean(busy)}
                            onClick={() => void previewTemplate(item)}
                            className="text-[#607787] transition hover:text-[#08788d]"
                          >
                            {busy === `preview-template:${item.id}` ? (
                              <Loader2 className="animate-spin" size={16} />
                            ) : (
                              <Eye size={17} />
                            )}
                          </button>
                          <button
                            title="Re-scan variables"
                            disabled={Boolean(busy)}
                            onClick={() => void act(item.id, "validate")}
                          >
                            <RefreshCw size={16} />
                          </button>
                          {item.status === "DRAFT" && (
                            <button
                              title="Activate template"
                              disabled={
                                Boolean(busy) || !item.currentVersion?.isValid
                              }
                              onClick={() => void act(item.id, "activate")}
                            >
                              <CheckCircle2 size={17} />
                            </button>
                          )}
                          {item.status !== "ARCHIVED" && (
                            <button
                              title="Archive template"
                              disabled={Boolean(busy)}
                              onClick={() => void act(item.id, "archive")}
                            >
                              <Archive size={17} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filtered.length && (
                <div className="grid place-items-center px-6 py-14 text-center text-sm text-[#78909e]">
                  <FileText className="mb-2" />
                  No templates in this category yet.
                </div>
              )}
            </div>
          </section>
          {previewUrl && (
            <aside className="sticky top-4 h-[calc(100vh-7rem)] min-h-[620px] overflow-hidden border border-[#cbd8de] bg-[#eef3f5]">
              <div className="flex h-16 items-center justify-between border-b border-[#cbd8de] bg-white px-5">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#08788d]">
                    Document preview
                  </p>
                  <h2 className="mt-1 truncate text-sm font-semibold">
                    {previewName}
                  </h2>
                </div>
                <div className="flex items-center gap-1">
                  <a
                    href={previewUrl}
                    download={`${previewName || "template"}.pdf`}
                    className="grid h-9 w-9 place-items-center text-[#607787] transition hover:bg-[#edf3f5] hover:text-[#08788d]"
                    title="Download PDF preview"
                    aria-label="Download PDF preview"
                  >
                    <Download size={17} />
                  </a>
                  <button
                    type="button"
                    onClick={closePreview}
                    className="grid h-9 w-9 place-items-center text-[#607787] transition hover:bg-[#edf3f5] hover:text-[#163042]"
                    title="Close preview"
                    aria-label="Close preview"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
              <iframe
                src={previewUrl}
                title={`${previewName} preview`}
                className="h-[calc(100%-4rem)] w-full bg-white"
              />
            </aside>
          )}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
