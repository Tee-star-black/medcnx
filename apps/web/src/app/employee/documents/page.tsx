"use client";
import { useEffect, useMemo, useState } from "react";
import { Download, FileText, Loader2, Search, ShieldCheck } from "lucide-react";
import { EmployeeShell } from "@/components/employee/EmployeeShell";
import { api } from "@/lib/api";
type D = {
  id: string;
  title: string;
  referenceNumber: string;
  category: string;
  status: string;
  createdAt: string;
  publishedAt?: string;
  effectiveDate?: string;
  template: { name: string };
};
export default function MyDocuments() {
  const [items, setItems] = useState<D[]>([]),
    [loading, setLoading] = useState(true),
    [downloading, setDownloading] = useState(""),
    [error, setError] = useState(""),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState("ALL");
  useEffect(() => {
    void load();
  }, []);
  async function load() {
    setLoading(true);
    try {
      setItems((await api.get<D[]>("/document-v2/my-documents")).data);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Could not load your documents.");
    } finally {
      setLoading(false);
    }
  }
  async function download(d: D) {
    setDownloading(d.id);
    try {
      const r = await api.get(`/document-v2/my-documents/${d.id}/download`, {
        responseType: "blob",
      });
      const u = URL.createObjectURL(r.data),
        a = document.createElement("a");
      a.href = u;
      a.download = `${d.referenceNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(u);
    } catch (e: any) {
      setError(
        e?.response?.data?.message || "Could not download this document.",
      );
    } finally {
      setDownloading("");
    }
  }
  const categories = useMemo(
    () => [...new Set(items.map((x) => x.category))],
    [items],
  );
  const filtered = items.filter(
    (x) =>
      (category === "ALL" || x.category === category) &&
      `${x.title} ${x.referenceNumber}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <EmployeeShell>
      <div className="space-y-6 text-slate-900 dark:text-white">
        <header className="border-b border-black/10 pb-5 dark:border-white/15">
          <p className="text-xs uppercase tracking-[.2em] text-slate-500">
            Employee self-service
          </p>
          <h1 className="mt-2 text-3xl font-semibold">
            My generated documents
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Only final documents published securely to your employee profile
            appear here.
          </p>
        </header>
        {error && (
          <div className="border border-red-300 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}
        <section className="grid gap-3 border border-black/10 bg-white p-4 dark:border-white/15 dark:bg-slate-950 md:grid-cols-[1fr_240px]">
          <label className="relative">
            <Search
              size={16}
              className="absolute left-3 top-3 text-slate-400"
            />
            <input
              className="w-full border border-black/15 bg-white py-2.5 pl-9 pr-3 text-sm dark:border-white/20 dark:bg-slate-950"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title or reference"
            />
          </label>
          <select
            className="border border-black/15 bg-white px-3 py-2.5 text-sm dark:border-white/20 dark:bg-slate-950"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="ALL">All categories</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </section>
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="mx-auto animate-spin" />
          </div>
        ) : (
          <section className="grid gap-4 md:grid-cols-2">
            {filtered.map((d) => (
              <article
                key={d.id}
                className="border border-black/10 bg-white p-5 dark:border-white/15 dark:bg-slate-950"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3">
                    <div className="bg-slate-100 p-2 dark:bg-slate-900">
                      <FileText size={19} />
                    </div>
                    <div>
                      <h2 className="font-semibold">{d.title}</h2>
                      <p className="mt-1 font-mono text-xs text-slate-500">
                        {d.referenceNumber}
                      </p>
                    </div>
                  </div>
                  <ShieldCheck size={18} className="text-emerald-600" />
                </div>
                <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-black/10 pt-4 text-sm dark:border-white/10">
                  <div>
                    <dt className="text-xs text-slate-500">Category</dt>
                    <dd>{d.category.replaceAll("_", " ")}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Published</dt>
                    <dd>
                      {new Date(
                        d.publishedAt || d.createdAt,
                      ).toLocaleDateString("en-ZA")}
                    </dd>
                  </div>
                </dl>
                <button
                  disabled={downloading === d.id}
                  onClick={() => void download(d)}
                  className="mt-5 w-full border border-slate-950 bg-slate-950 px-4 py-2.5 text-sm text-white disabled:opacity-50 dark:border-white dark:bg-white dark:text-slate-950"
                >
                  {downloading === d.id ? (
                    <Loader2 size={16} className="mr-2 inline animate-spin" />
                  ) : (
                    <Download size={16} className="mr-2 inline" />
                  )}
                  Download final PDF
                </button>
              </article>
            ))}
            {!filtered.length && (
              <div className="col-span-full p-12 text-center text-sm text-slate-500">
                No published documents match your filters.
              </div>
            )}
          </section>
        )}
      </div>
    </EmployeeShell>
  );
}
