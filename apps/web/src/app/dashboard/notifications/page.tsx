"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, FileCheck2, Loader2, UserRoundCog } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { api } from "@/lib/api";
import type { AuthUser } from "@/types/auth";

type ProfileRequest = {
  id: string;
  field: string;
  requestedValue: string;
  status: string;
  createdAt: string;
  employee: {
    employeeNumber: string;
    firstName: string;
    lastName: string;
  };
};

type GeneratedDocument = {
  id: string;
  title: string;
  referenceNumber: string;
  status: string;
  createdAt: string;
  employee?: { firstName: string; lastName: string } | null;
  recipient?: { firstName: string; lastName: string } | null;
};

export default function WorkspaceNotificationsPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profileRequests, setProfileRequests] = useState<ProfileRequest[]>([]);
  const [documents, setDocuments] = useState<GeneratedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const me = (await api.get<AuthUser>("/auth/me")).data;
      setUser(me);

      const canReviewProfiles = me.permissions.includes(
        "profile:review-changes",
      );
      const canReadDocuments =
        me.permissions.includes("generated_documents:read") &&
        me.permissions.includes("generated_documents:view-all");

      const [requestResult, documentResult] = await Promise.all([
        canReviewProfiles
          ? api.get<ProfileRequest[]>(
              "/employee-self-service/profile-change-requests",
            )
          : Promise.resolve({ data: [] as ProfileRequest[] }),
        canReadDocuments
          ? api.get<GeneratedDocument[]>("/document-v2/generated")
          : Promise.resolve({ data: [] as GeneratedDocument[] }),
      ]);

      setProfileRequests(
        requestResult.data.filter((item) => item.status === "PENDING"),
      );
      setDocuments(
        documentResult.data.filter(
          (item) => item.status === "PENDING_CEO_APPROVAL",
        ),
      );
    } catch (requestError: any) {
      const message = requestError?.response?.data?.message;
      setError(
        Array.isArray(message)
          ? message.join(" ")
          : message || "Could not load workspace notifications.",
      );
    } finally {
      setLoading(false);
    }
  }

  const total = profileRequests.length + documents.length;

  return (
    <DashboardShell user={user} activePage="notifications">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="border border-[var(--border)] bg-[var(--surface)] p-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
            Workspace action centre
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Notifications
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Administrative actions are kept separate from your Employee
            Self-Service inbox.
          </p>
        </header>

        {error && (
          <div className="border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-64 items-center justify-center gap-3 text-[var(--muted)]">
            <Loader2 className="animate-spin" size={18} /> Loading workspace
            actions...
          </div>
        ) : total === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center border border-dashed border-[var(--border-strong)] bg-[var(--surface-soft)] p-8 text-center">
            <Bell size={30} className="text-[var(--muted)]" />
            <h2 className="mt-4 font-bold">No workspace actions waiting</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Profile reviews and document approvals assigned to this workspace
              will appear here.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="border border-[var(--border)] bg-[var(--surface)]">
              <div className="flex items-center gap-3 border-b border-[var(--border)] p-5">
                <UserRoundCog size={18} />
                <div>
                  <h2 className="font-bold">Profile changes</h2>
                  <p className="text-xs text-[var(--muted)]">
                    {profileRequests.length} awaiting HR review
                  </p>
                </div>
              </div>
              {profileRequests.length ? (
                <div className="divide-y divide-[var(--border)]">
                  {profileRequests.map((request) => (
                    <article key={request.id} className="p-5">
                      <p className="font-bold">
                        {request.employee.firstName} {request.employee.lastName}
                      </p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {request.field.replaceAll("_", " ")} ·{" "}
                        {request.employee.employeeNumber}
                      </p>
                      <Link
                        href="/dashboard/employees/profile-requests"
                        className="mt-4 inline-flex h-9 items-center bg-[var(--accent)] px-3 text-xs font-bold text-[var(--accent-text)]"
                      >
                        Review request
                      </Link>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="p-5 text-sm text-[var(--muted)]">
                  No profile changes are waiting.
                </p>
              )}
            </section>

            <section className="border border-[var(--border)] bg-[var(--surface)]">
              <div className="flex items-center gap-3 border-b border-[var(--border)] p-5">
                <FileCheck2 size={18} />
                <div>
                  <h2 className="font-bold">Document approvals</h2>
                  <p className="text-xs text-[var(--muted)]">
                    {documents.length} awaiting approval
                  </p>
                </div>
              </div>
              {documents.length ? (
                <div className="divide-y divide-[var(--border)]">
                  {documents.map((document) => {
                    const subject = document.employee || document.recipient;
                    return (
                      <article key={document.id} className="p-5">
                        <p className="font-bold">{document.title}</p>
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          {document.referenceNumber} · {subject?.firstName}{" "}
                          {subject?.lastName}
                        </p>
                        <Link
                          href={`/dashboard/documents/generated/${document.id}`}
                          className="mt-4 inline-flex h-9 items-center bg-[var(--accent)] px-3 text-xs font-bold text-[var(--accent-text)]"
                        >
                          Open document
                        </Link>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="p-5 text-sm text-[var(--muted)]">
                  No document approvals are waiting.
                </p>
              )}
            </section>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
