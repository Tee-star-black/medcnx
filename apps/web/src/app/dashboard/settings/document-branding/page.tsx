"use client";
import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { api } from "@/lib/api";
type Settings = {
  organisation: { name: string; email?: string; phone?: string };
  branding?: {
    legalName?: string;
    tradingName?: string;
    registrationNumber?: string;
    address?: string;
    email?: string;
    phone?: string;
    defaultDocumentFooter?: string;
  };
  signature?: {
    ceoUserId?: string;
    ceoFullName?: string;
    ceoJobTitle?: string;
    status: string;
    signatureConfigured: boolean;
    updatedAt: string;
  };
};
const field =
  "w-full border border-black/15 bg-white px-3 py-2.5 text-sm dark:border-white/20 dark:bg-slate-950";
export default function Branding() {
  const [data, setData] = useState<Settings | null>(null),
    [branding, setBranding] = useState<Record<string, string>>({}),
    [signature, setSignature] = useState<Record<string, string>>({
      status: "ACTIVE",
    }),
    [logo, setLogo] = useState<File | null>(null),
    [sigFile, setSigFile] = useState<File | null>(null),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    void load();
  }, []);
  async function load() {
    const r = await api.get<Settings>("/document-v2/settings/branding");
    setData(r.data);
    setBranding({
      legalName: r.data.branding?.legalName || "",
      tradingName: r.data.branding?.tradingName || "",
      registrationNumber: r.data.branding?.registrationNumber || "",
      address: r.data.branding?.address || "",
      email: r.data.branding?.email || "",
      phone: r.data.branding?.phone || "",
      defaultDocumentFooter: r.data.branding?.defaultDocumentFooter || "",
    });
    setSignature({
      ceoUserId: r.data.signature?.ceoUserId || "",
      ceoFullName: r.data.signature?.ceoFullName || "",
      ceoJobTitle: r.data.signature?.ceoJobTitle || "",
      status: r.data.signature?.status || "ACTIVE",
    });
  }
  async function save(kind: "branding" | "signature") {
    setBusy(true);
    setError("");
    setMessage("");
    const f = new FormData();
    Object.entries(kind === "branding" ? branding : signature).forEach(
      ([k, v]) => v != null && f.append(k, String(v)),
    );
    const file = kind === "branding" ? logo : sigFile;
    if (file) f.append(kind === "branding" ? "logo" : "signature", file);
    try {
      await api.patch(`/document-v2/settings/${kind}`, f);
      setMessage(
        `${kind === "branding" ? "Branding" : "CEO signature"} updated.`,
      );
      await load();
    } catch (requestError: any) {
      const detail = requestError?.response?.data?.message;
      setError(
        Array.isArray(detail)
          ? detail.join(" ")
          : detail || "The settings could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <DashboardShell activePage="settings">
      <div className="space-y-6 text-slate-900 dark:text-white">
        <header className="border-b border-black/10 pb-5 dark:border-white/15">
          <p className="text-xs uppercase tracking-[.2em] text-slate-500">
            Private document assets
          </p>
          <h1 className="mt-2 text-3xl font-semibold">
            Branding and CEO signature
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Assets are stored privately and are inserted only during authorised
            backend generation.
          </p>
        </header>
        {message && (
          <div className="border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
            {message}
          </div>
        )}
        {error && (
          <div className="border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-200">
            {error}
          </div>
        )}
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4 border border-black/10 bg-white p-6 dark:border-white/15 dark:bg-slate-950">
            <h2 className="font-semibold">Organisation branding</h2>
            {[
              "legalName",
              "tradingName",
              "registrationNumber",
              "address",
              "email",
              "phone",
              "defaultDocumentFooter",
            ].map((k) => (
              <label key={k} className="block text-sm capitalize">
                {k.replace(/([A-Z])/g, " $1")}
                <input
                  className={`${field} mt-2`}
                  value={branding[k] || ""}
                  onChange={(e) =>
                    setBranding({ ...branding, [k]: e.target.value })
                  }
                />
              </label>
            ))}
            <label className="block text-sm">
              Private logo (PNG/JPEG)
              <input
                type="file"
                accept="image/png,image/jpeg"
                className={`${field} mt-2`}
                onChange={(e) => setLogo(e.target.files?.[0] || null)}
              />
            </label>
            <button
              disabled={busy}
              onClick={() => void save("branding")}
              className="bg-slate-950 px-4 py-2.5 text-sm text-white dark:bg-white dark:text-slate-950"
            >
              {busy ? "Saving..." : "Save branding"}
            </button>
          </div>
          <div className="space-y-4 border border-black/10 bg-white p-6 dark:border-white/15 dark:bg-slate-950">
            <h2 className="font-semibold">Protected CEO signature</h2>
            <p className="text-sm text-slate-500">
              Configured: {data?.signature?.signatureConfigured ? "Yes" : "No"}{" "}
              · Status: {data?.signature?.status || "Not configured"}
            </p>
            {["ceoUserId", "ceoFullName", "ceoJobTitle"].map((k) => (
              <label key={k} className="block text-sm capitalize">
                {k.replace(/([A-Z])/g, " $1")}
                <input
                  className={`${field} mt-2`}
                  value={signature[k] || ""}
                  onChange={(e) =>
                    setSignature({ ...signature, [k]: e.target.value })
                  }
                />
              </label>
            ))}
            <select
              className={field}
              value={signature.status || "ACTIVE"}
              onChange={(e) =>
                setSignature({ ...signature, status: e.target.value })
              }
            >
              <option>ACTIVE</option>
              <option>DISABLED</option>
            </select>
            <label className="block text-sm">
              Private signature image (PNG/JPEG)
              <input
                type="file"
                accept="image/png,image/jpeg"
                className={`${field} mt-2`}
                onChange={(e) => setSigFile(e.target.files?.[0] || null)}
              />
            </label>
            <button
              disabled={busy}
              onClick={() => void save("signature")}
              className="bg-slate-950 px-4 py-2.5 text-sm text-white dark:bg-white dark:text-slate-950"
            >
              {busy ? "Saving..." : "Save protected signature"}
            </button>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
