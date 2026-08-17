"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { api } from "@/lib/api";

type Review = {
  id: string;
  status: string;
  reviewerType: string;
  confidential: boolean;
  answers?: Record<string, unknown> | null;
  overallScore?: string | number | null;
  strengths?: string | null;
  developmentAreas?: string | null;
  managerSummary?: string | null;
  finalOutcome?: string | null;
  employee: {
    id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    jobTitle?: string | null;
    department?: { name: string } | null;
  };
  reviewerUser: { firstName: string; lastName: string; email: string };
  cycle: {
    name: string;
    dueDate: string;
    template: {
      name: string;
      questions: Array<{ id: string; label: string; type: string }>;
    };
  };
};

const field =
  "w-full border border-[#ccd7dd] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#08788d]";

export default function ReviewDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [review, setReview] = useState<Review | null>(null);
  const [summary, setSummary] = useState("");
  const [outcome, setOutcome] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void load();
  }, [id]);

  async function load() {
    try {
      const response = await api.get<Review>(`/performance/reviews/${id}`);
      setReview(response.data);
      setSummary(response.data.managerSummary || "");
      setOutcome(response.data.finalOutcome || "");
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || "Could not load review.");
    }
  }

  async function finalise() {
    setBusy(true);
    setError("");
    try {
      await api.post(`/performance/reviews/${id}/finalise`, {
        managerSummary: summary,
        finalOutcome: outcome,
      });
      await load();
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message || "Could not finalise review.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardShell activePage="performance">
      <div className="mx-auto max-w-6xl space-y-5 text-[#163042]">
        <header className="border-b border-[#dbe3e7] bg-white p-6">
          <Link
            href="/dashboard/performance"
            className="inline-flex items-center gap-2 text-sm text-[#607787] hover:text-[#08788d]"
          >
            <ArrowLeft size={15} />
            Performance & Development
          </Link>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-.04em]">
            {review
              ? `${review.employee.firstName} ${review.employee.lastName}`
              : "Performance review"}
          </h1>
          {review && (
            <p className="mt-2 text-sm text-[#607787]">
              {review.cycle.name} · {review.cycle.template.name} ·{" "}
              {review.reviewerType.replaceAll("_", " ")}
            </p>
          )}
        </header>
        {error && (
          <div className="border-l-4 border-red-600 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}
        {!review ? (
          <div className="grid min-h-80 place-items-center">
            <Loader2 className="animate-spin text-[#08788d]" />
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
            <section className="border border-[#dbe3e7] bg-white">
              <div className="border-b border-[#e2e8eb] p-5">
                <h2 className="font-semibold">Submitted assessment</h2>
                <p className="mt-1 text-xs text-[#607787]">
                  Individual confidential responses are restricted to authorised
                  reviewers.
                </p>
              </div>
              <div className="space-y-5 p-6">
                {review.cycle.template.questions.map((question) => (
                  <div key={question.id}>
                    <p className="text-sm font-semibold">{question.label}</p>
                    <div className="mt-2 border border-[#e1e7ea] bg-[#f7f9fa] p-4 text-sm text-[#4f6877]">
                      {String(review.answers?.[question.id] ?? "Not answered")}
                    </div>
                  </div>
                ))}
                <div className="grid gap-4 md:grid-cols-2">
                  <Summary label="Strengths" value={review.strengths} />
                  <Summary
                    label="Development areas"
                    value={review.developmentAreas}
                  />
                </div>
              </div>
            </section>
            <aside className="space-y-5">
              <section className="border border-[#dbe3e7] bg-white p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-[#08788d]">
                  Review status
                </p>
                <p className="mt-3 font-semibold">
                  {review.status.replaceAll("_", " ")}
                </p>
                <p className="mt-2 text-sm text-[#607787]">
                  Reviewer: {review.reviewerUser.firstName}{" "}
                  {review.reviewerUser.lastName}
                </p>
                {review.confidential && (
                  <p className="mt-4 flex items-center gap-2 text-xs text-[#607787]">
                    <ShieldCheck size={15} />
                    Confidential reviewer response
                  </p>
                )}
              </section>
              <section className="border border-[#dbe3e7] bg-white p-5">
                <h2 className="font-semibold">Final review outcome</h2>
                <label className="mt-4 block text-xs font-semibold">
                  Manager summary
                  <textarea
                    className={`${field} mt-1 min-h-32`}
                    value={summary}
                    onChange={(event) => setSummary(event.target.value)}
                    disabled={review.status !== "SUBMITTED"}
                  />
                </label>
                <label className="mt-4 block text-xs font-semibold">
                  Agreed outcome
                  <textarea
                    className={`${field} mt-1 min-h-24`}
                    value={outcome}
                    onChange={(event) => setOutcome(event.target.value)}
                    disabled={review.status !== "SUBMITTED"}
                  />
                </label>
                {review.status === "SUBMITTED" ? (
                  <button
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 bg-[#08788d] px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
                    disabled={busy || !summary || !outcome}
                    onClick={() => void finalise()}
                  >
                    {busy ? (
                      <Loader2 className="animate-spin" size={15} />
                    ) : (
                      <CheckCircle2 size={16} />
                    )}
                    Finalise for acknowledgement
                  </button>
                ) : (
                  <p className="mt-4 text-xs text-[#607787]">
                    The response must be submitted before it can be finalised.
                  </p>
                )}
              </section>
            </aside>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function Summary({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="border border-[#e1e7ea] p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-[#78909e]">
        {label}
      </p>
      <p className="mt-2 text-sm leading-6">{value || "Not provided"}</p>
    </div>
  );
}
