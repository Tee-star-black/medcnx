"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { FileUp, Loader2 } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { api } from "@/lib/api";
type Version = {
  id: string;
  versionNumber: number;
  originalName: string;
  sizeBytes: number;
  detectedPlaceholders: string[];
  unsupportedPlaceholders: string[];
  isValid: boolean;
  validationErrors?: string[];
  createdAt: string;
  uploadedBy: { firstName: string; lastName: string };
};
type T = {
  id: string;
  name: string;
  description?: string;
  category: string;
  status: string;
  signatureMode: string;
  currentVersion?: Version;
  versions: Version[];
};
export default function TemplateHistory({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [item, setItem] = useState<T | null>(null),
    [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    void load();
  }, [id]);
  async function load() {
    try {
      setItem((await api.get<T>(`/document-v2/templates/${id}`)).data);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Could not load template.");
    }
  }
  async function replace() {
    if (!file) return;
    setBusy(true);
    try {
      const f = new FormData();
      f.append("file", file);
      await api.post(`/document-v2/templates/${id}/versions`, f);
      setFile(null);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Replacement upload failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <DashboardShell activePage="documents">
      <div className="space-y-6 text-slate-900 dark:text-white">
        <header className="flex items-end justify-between border-b border-black/10 pb-5 dark:border-white/15">
          <div>
            <p className="text-xs uppercase tracking-[.2em] text-slate-500">
              Template version history
            </p>
            <h1 className="mt-2 text-3xl font-semibold">
              {item?.name || "Template"}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {item?.category?.replaceAll("_", " ")} ·{" "}
              {item?.signatureMode?.replaceAll("_", " ")} · {item?.status}
            </p>
          </div>
          <Link
            href="/dashboard/documents/templates"
            className="border border-black/20 px-4 py-2 text-sm dark:border-white/20"
          >
            Back
          </Link>
        </header>
        {error && (
          <div className="border border-red-300 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}
        <section className="flex flex-col gap-3 border border-black/10 bg-white p-5 dark:border-white/15 dark:bg-slate-950 sm:flex-row sm:items-end">
          <label className="flex-1 text-sm">
            Upload replacement DOCX
            <input
              type="file"
              accept=".docx"
              className="mt-2 w-full border border-black/15 p-2.5 dark:border-white/20"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>
          <button
            disabled={!file || busy || item?.status === "ARCHIVED"}
            onClick={() => void replace()}
            className="bg-slate-950 px-4 py-2.5 text-sm text-white disabled:opacity-40 dark:bg-white dark:text-slate-950"
          >
            {busy ? (
              <Loader2 size={16} className="mr-2 inline animate-spin" />
            ) : (
              <FileUp size={16} className="mr-2 inline" />
            )}
            Create new version
          </button>
        </section>
        <section className="space-y-3">
          {item?.versions.map((v) => (
            <article
              key={v.id}
              className="border border-black/10 bg-white p-5 dark:border-white/15 dark:bg-slate-950"
            >
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <h2 className="font-semibold">
                    Version {v.versionNumber}{" "}
                    {item.currentVersion?.id === v.id ? "· Current" : ""}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {v.originalName} · {(v.sizeBytes / 1024).toFixed(1)} KB ·{" "}
                    {new Date(v.createdAt).toLocaleString("en-ZA")}
                  </p>
                </div>
                <span
                  className={
                    v.isValid
                      ? "text-sm text-emerald-600"
                      : "text-sm text-amber-600"
                  }
                >
                  {v.isValid ? "Valid" : "Needs correction"}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {v.detectedPlaceholders.map((p) => (
                  <code
                    key={p}
                    className="border border-black/10 bg-slate-50 px-2 py-1 text-xs dark:border-white/15 dark:bg-slate-900"
                  >{`{{${p}}}`}</code>
                ))}
              </div>
              {Boolean(v.unsupportedPlaceholders.length) && (
                <p className="mt-3 text-sm text-red-600">
                  Unsupported: {v.unsupportedPlaceholders.join(", ")}
                </p>
              )}
            </article>
          ))}
          {!item && (
            <div className="p-12 text-center">
              <Loader2 className="mx-auto animate-spin" />
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
