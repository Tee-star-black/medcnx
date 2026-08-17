"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Download, Loader2, Send, ShieldX } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { api } from "@/lib/api";
type D = {
  id: string;
  title: string;
  referenceNumber: string;
  category: string;
  status: string;
  signatureMode: string;
  signatureStatus: string;
  visibleToEmployee: boolean;
  createdAt: string;
  approvedAt?: string;
  publishedAt?: string;
  employee?: {
    firstName: string;
    lastName: string;
    employeeNumber: string;
    jobTitle?: string;
  } | null;
  recipient?: {
    firstName: string;
    lastName: string;
    jobTitle?: string;
  } | null;
  template: { name: string };
  templateVersion: { versionNumber: number };
  generatedBy: { firstName: string; lastName: string };
  approvedBy?: { firstName: string; lastName: string };
  approvals: {
    id: string;
    status: string;
    decisionNote?: string;
    requestedAt: string;
    decidedAt?: string;
    requestedBy: { firstName: string; lastName: string };
    assignedTo: { firstName: string; lastName: string };
  }[];
};
export default function Detail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [item, setItem] = useState<D | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [note, setNote] = useState("");
  useEffect(() => {
    void load();
  }, [id]);
  async function load() {
    try {
      setItem((await api.get<D>(`/document-v2/generated/${id}`)).data);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Could not load document.");
    }
  }
  async function action(name: string, body?: unknown) {
    setBusy(true);
    setError("");
    try {
      await api.post(`/document-v2/generated/${id}/${name}`, body);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || `Could not ${name} document.`);
    } finally {
      setBusy(false);
    }
  }
  async function download(format: "pdf" | "docx") {
    const r = await api.get(`/document-v2/generated/${id}/download/${format}`, {
      responseType: "blob",
    });
    const u = URL.createObjectURL(r.data);
    const a = document.createElement("a");
    a.href = u;
    a.download = `${item?.referenceNumber}.${format}`;
    a.click();
    URL.revokeObjectURL(u);
  }
  return (
    <DashboardShell activePage="documents">
      <div className="space-y-6 text-slate-900 dark:text-white">
        <header className="flex items-end justify-between border-b border-black/10 pb-5 dark:border-white/15">
          <div>
            <p className="font-mono text-xs text-slate-500">
              {item?.referenceNumber || "Loading"}
            </p>
            <h1 className="mt-2 text-3xl font-semibold">
              {item?.title || "Generated document"}
            </h1>
          </div>
          <Link
            href="/dashboard/documents/generated"
            className="border border-black/20 px-4 py-2 text-sm dark:border-white/20"
          >
            Back
          </Link>
        </header>
        {error && (
          <div className="border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-200">
            {error}
          </div>
        )}
        {!item ? (
          <div className="p-12 text-center">
            <Loader2 className="mx-auto animate-spin" />
          </div>
        ) : (
          <>
            <section className="grid gap-px border border-black/10 bg-black/10 dark:border-white/15 dark:bg-white/15 md:grid-cols-4">
              {[
                ["Status", item.status],
                ["Signature", item.signatureStatus],
                [
                  "Person",
                  `${(item.employee || item.recipient)?.firstName || ""} ${(item.employee || item.recipient)?.lastName || ""}`.trim(),
                ],
                [
                  "Template",
                  `${item.template.name} · v${item.templateVersion.versionNumber}`,
                ],
              ].map(([a, b]) => (
                <div key={a} className="bg-white p-5 dark:bg-slate-950">
                  <p className="text-xs uppercase tracking-wider text-slate-500">
                    {a}
                  </p>
                  <p className="mt-2 text-sm font-medium">
                    {b.replaceAll("_", " ")}
                  </p>
                </div>
              ))}
            </section>
            <section className="flex flex-wrap gap-2 border border-black/10 bg-white p-5 dark:border-white/15 dark:bg-slate-950">
              <button
                onClick={() => void download("pdf")}
                className="border border-black/20 px-4 py-2 text-sm dark:border-white/20"
              >
                <Download size={16} className="mr-2 inline" />
                PDF
              </button>
              <button
                onClick={() => void download("docx")}
                className="border border-black/20 px-4 py-2 text-sm dark:border-white/20"
              >
                <Download size={16} className="mr-2 inline" />
                DOCX
              </button>
              {item.status === "PENDING_CEO_APPROVAL" && (
                <>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Decision note"
                    className="min-w-64 border border-black/20 px-3 py-2 text-sm dark:border-white/20 dark:bg-slate-950"
                  />
                  <button
                    disabled={busy}
                    onClick={() => void action("approve", { note })}
                    className="bg-emerald-700 px-4 py-2 text-sm text-white"
                  >
                    <CheckCircle2 size={16} className="mr-2 inline" />
                    Approve & sign
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => void action("reject", { note })}
                    className="bg-red-700 px-4 py-2 text-sm text-white"
                  >
                    <ShieldX size={16} className="mr-2 inline" />
                    Reject
                  </button>
                </>
              )}
              {["GENERATED_FOR_REVIEW", "SIGNED", "APPROVED"].includes(
                item.status,
              ) && (
                <button
                  disabled={busy}
                  onClick={() => void action("publish")}
                  className="bg-slate-950 px-4 py-2 text-sm text-white dark:bg-white dark:text-slate-950"
                >
                  <Send size={16} className="mr-2 inline" />
                  {item.employee ? "Publish to employee" : "Finalise document"}
                </button>
              )}
            </section>
            <section className="border border-black/10 bg-white p-6 dark:border-white/15 dark:bg-slate-950">
              <h2 className="font-semibold">Approval and audit context</h2>
              <dl className="mt-4 grid gap-4 text-sm md:grid-cols-3">
                <Info
                  k="Generated by"
                  v={`${item.generatedBy.firstName} ${item.generatedBy.lastName}`}
                />
                <Info
                  k="Generated"
                  v={new Date(item.createdAt).toLocaleString("en-ZA")}
                />
                <Info
                  k="Published"
                  v={
                    item.publishedAt
                      ? new Date(item.publishedAt).toLocaleString("en-ZA")
                      : "Not published"
                  }
                />
                {item.approvals.map((a) => (
                  <div key={a.id} className="border-l-2 border-slate-300 pl-3">
                    <dt className="text-slate-500">
                      CEO approval · {a.status}
                    </dt>
                    <dd>
                      {a.assignedTo.firstName} {a.assignedTo.lastName}
                      <br />
                      {a.decisionNote || "No decision note"}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
function Info({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-slate-500">{k}</dt>
      <dd className="mt-1 font-medium">{v}</dd>
    </div>
  );
}
