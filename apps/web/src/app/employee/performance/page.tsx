"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Loader2,
  ShieldCheck,
  Target,
  TrendingUp,
} from "lucide-react";
import { EmployeeShell } from "@/components/employee/EmployeeShell";
import { api } from "@/lib/api";

type Question = {
  id: string;
  label: string;
  type: "RATING" | "TEXT" | "YES_NO" | "MULTIPLE_CHOICE";
  required?: boolean;
  maxScore?: number;
  options?: string[];
  helpText?: string;
};
type Review = {
  id: string;
  status: string;
  reviewerType: string;
  confidential: boolean;
  answers?: Record<string, unknown> | null;
  strengths?: string | null;
  developmentAreas?: string | null;
  managerSummary?: string | null;
  finalOutcome?: string | null;
  employeeComments?: string | null;
  employee: {
    firstName: string;
    lastName: string;
    employeeNumber: string;
    jobTitle?: string | null;
  };
  cycle: {
    name: string;
    dueDate: string;
    template: { name: string; questions: Question[] };
  };
};
type Goal = {
  id: string;
  title: string;
  description?: string | null;
  progress: number;
  status: string;
  targetDate: string;
};
type Plan = {
  id: string;
  title: string;
  developmentNeed: string;
  actionPlan: string;
  status: string;
  targetDate: string;
};
type MyPerformance = {
  assignments: Review[];
  reviews: Review[];
  goals: Goal[];
  developmentPlans: Plan[];
};

const input =
  "mt-2 w-full border border-[var(--border-strong)] bg-[var(--surface)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)]";

export default function EmployeePerformancePage() {
  const [data, setData] = useState<MyPerformance | null>(null);
  const [selected, setSelected] = useState<Review | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [strengths, setStrengths] = useState("");
  const [developmentAreas, setDevelopmentAreas] = useState("");
  const [comments, setComments] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setError("");
    try {
      setData((await api.get<MyPerformance>("/performance/my")).data);
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message ||
          "Could not load your performance record.",
      );
    }
  }

  function openReview(review: Review) {
    setSelected(review);
    setAnswers(review.answers || {});
    setStrengths(review.strengths || "");
    setDevelopmentAreas(review.developmentAreas || "");
    setComments(review.employeeComments || "");
    setSuccess("");
  }

  const score = useMemo(() => {
    if (!selected) return undefined;
    const ratingQuestions = selected.cycle.template.questions.filter(
      (question) => question.type === "RATING",
    );
    const values = ratingQuestions
      .map((question) => Number(answers[question.id]))
      .filter((value) => Number.isFinite(value) && value > 0);
    return values.length
      ? Number(
          (
            values.reduce((total, value) => total + value, 0) / values.length
          ).toFixed(2),
        )
      : undefined;
  }, [answers, selected]);

  async function save(submit = false) {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const payload = {
        answers,
        overallScore: score,
        strengths: strengths || undefined,
        developmentAreas: developmentAreas || undefined,
      };
      if (submit) {
        await api.post(`/performance/my/reviews/${selected.id}/submit`, payload);
        setSuccess("Your review has been submitted.");
        setSelected(null);
      } else {
        await api.patch(`/performance/my/reviews/${selected.id}`, payload);
        setSuccess("Draft saved.");
      }
      await load();
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message || "Could not save your review.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function acknowledge(review: Review) {
    setBusy(true);
    setError("");
    try {
      await api.post(`/performance/my/reviews/${review.id}/acknowledge`, {
        employeeComments: comments || undefined,
      });
      setSuccess("Review acknowledged and added to your performance history.");
      setSelected(null);
      await load();
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message ||
          "Could not acknowledge the review.",
      );
    } finally {
      setBusy(false);
    }
  }

  const openAssignments =
    data?.assignments.filter(
      (review) => !["SUBMITTED", "COMPLETED", "CANCELLED"].includes(review.status),
    ) ?? [];
  const awaitingAcknowledgement =
    data?.reviews.filter(
      (review) => review.status === "AWAITING_ACKNOWLEDGEMENT",
    ) ?? [];

  return (
    <EmployeeShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="border-b border-[var(--border)] pb-6">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--accent)]">
            My development
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-.04em]">
            Performance & Development
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
            Complete assigned assessments, review agreed outcomes and track
            your goals and development plan.
          </p>
        </header>

        {error && (
          <div className="border-l-4 border-red-600 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}
        {success && (
          <div className="border-l-4 border-emerald-600 bg-emerald-50 p-4 text-sm text-emerald-800">
            {success}
          </div>
        )}

        {!data ? (
          <div className="grid min-h-80 place-items-center">
            <Loader2 className="animate-spin text-[var(--accent)]" />
          </div>
        ) : selected ? (
          <section className="border border-[var(--border)] bg-[var(--surface)]">
            <div className="flex flex-col gap-3 border-b border-[var(--border)] p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--accent)]">
                  {selected.reviewerType.replaceAll("_", " ")}
                </p>
                <h2 className="mt-2 text-xl font-semibold">
                  {selected.cycle.name}
                </h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {selected.cycle.template.name}
                </p>
              </div>
              <button
                className="text-sm font-semibold text-[var(--muted)]"
                onClick={() => setSelected(null)}
              >
                Back to overview
              </button>
            </div>

            {selected.status === "AWAITING_ACKNOWLEDGEMENT" ? (
              <div className="space-y-5 p-6">
                <Info title="Manager summary" value={selected.managerSummary} />
                <Info title="Agreed outcome" value={selected.finalOutcome} />
                <label className="block text-sm font-semibold">
                  Employee comments (optional)
                  <textarea
                    className={`${input} min-h-28`}
                    value={comments}
                    onChange={(event) => setComments(event.target.value)}
                  />
                </label>
                <p className="flex items-start gap-2 text-xs leading-5 text-[var(--muted)]">
                  <ShieldCheck size={15} className="mt-0.5 shrink-0" />
                  Acknowledgement confirms that the review was discussed and
                  received. It does not prevent you from recording comments.
                </p>
                <button
                  className="inline-flex items-center gap-2 bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--accent-text)]"
                  disabled={busy}
                  onClick={() => void acknowledge(selected)}
                >
                  <CheckCircle2 size={16} />
                  Acknowledge review
                </button>
              </div>
            ) : (
              <div className="space-y-6 p-6">
                {selected.confidential && (
                  <div className="flex items-start gap-3 border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                    <ShieldCheck size={17} className="mt-0.5 shrink-0" />
                    Your individual answers are confidential. The employee will
                    receive the approved final summary, not your named response.
                  </div>
                )}
                {selected.cycle.template.questions.map((question, index) => (
                  <label key={question.id} className="block">
                    <span className="text-sm font-semibold">
                      {index + 1}. {question.label}
                      {question.required ? " *" : ""}
                    </span>
                    {question.helpText && (
                      <span className="mt-1 block text-xs text-[var(--muted)]">
                        {question.helpText}
                      </span>
                    )}
                    {question.type === "RATING" ? (
                      <span className="mt-3 flex flex-wrap gap-2">
                        {Array.from(
                          { length: question.maxScore || 5 },
                          (_, item) => item + 1,
                        ).map((value) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() =>
                              setAnswers({ ...answers, [question.id]: value })
                            }
                            className={`grid h-10 w-10 place-items-center border text-sm font-semibold ${
                              Number(answers[question.id]) === value
                                ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-text)]"
                                : "border-[var(--border-strong)]"
                            }`}
                          >
                            {value}
                          </button>
                        ))}
                      </span>
                    ) : question.type === "YES_NO" ? (
                      <select
                        className={input}
                        value={String(answers[question.id] || "")}
                        onChange={(event) =>
                          setAnswers({
                            ...answers,
                            [question.id]: event.target.value,
                          })
                        }
                      >
                        <option value="">Select</option>
                        <option>Yes</option>
                        <option>No</option>
                      </select>
                    ) : (
                      <textarea
                        className={`${input} min-h-28`}
                        value={String(answers[question.id] || "")}
                        onChange={(event) =>
                          setAnswers({
                            ...answers,
                            [question.id]: event.target.value,
                          })
                        }
                      />
                    )}
                  </label>
                ))}
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-sm font-semibold">
                    Key strengths
                    <textarea
                      className={`${input} min-h-28`}
                      value={strengths}
                      onChange={(event) => setStrengths(event.target.value)}
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    Development areas
                    <textarea
                      className={`${input} min-h-28`}
                      value={developmentAreas}
                      onChange={(event) =>
                        setDevelopmentAreas(event.target.value)
                      }
                    />
                  </label>
                </div>
                <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-5">
                  <button
                    className="border border-[var(--border-strong)] px-5 py-3 text-sm font-semibold"
                    disabled={busy}
                    onClick={() => void save(false)}
                  >
                    Save draft
                  </button>
                  <button
                    className="inline-flex items-center gap-2 bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--accent-text)]"
                    disabled={busy}
                    onClick={() => void save(true)}
                  >
                    Submit assessment
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </section>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-4">
              <Metric
                label="Assigned reviews"
                value={openAssignments.length}
                icon={<ClipboardCheck size={18} />}
              />
              <Metric
                label="Awaiting acknowledgement"
                value={awaitingAcknowledgement.length}
                icon={<CheckCircle2 size={18} />}
              />
              <Metric
                label="Active goals"
                value={
                  data.goals.filter((goal) => goal.status !== "COMPLETED").length
                }
                icon={<Target size={18} />}
              />
              <Metric
                label="Development actions"
                value={
                  data.developmentPlans.filter(
                    (plan) => plan.status !== "COMPLETED",
                  ).length
                }
                icon={<TrendingUp size={18} />}
              />
            </section>

            {(openAssignments.length > 0 ||
              awaitingAcknowledgement.length > 0) && (
              <section className="border border-[var(--border)] bg-[var(--surface)]">
                <div className="border-b border-[var(--border)] p-5">
                  <h2 className="font-semibold">Action required</h2>
                </div>
                <div className="divide-y divide-[var(--border)]">
                  {[...awaitingAcknowledgement, ...openAssignments].map(
                    (review) => (
                      <button
                        key={review.id}
                        onClick={() => openReview(review)}
                        className="flex w-full items-center justify-between gap-4 p-5 text-left transition hover:bg-[var(--surface-soft)]"
                      >
                        <span>
                          <b className="block text-sm">{review.cycle.name}</b>
                          <span className="mt-1 block text-xs text-[var(--muted)]">
                            {review.status === "AWAITING_ACKNOWLEDGEMENT"
                              ? "Read and acknowledge your final review"
                              : `${review.reviewerType.replaceAll("_", " ")} for ${review.employee.firstName} ${review.employee.lastName}`}
                          </span>
                        </span>
                        <ChevronRight size={18} />
                      </button>
                    ),
                  )}
                </div>
              </section>
            )}

            <section className="grid gap-5 lg:grid-cols-2">
              <Panel title="My goals">
                {data.goals.map((goal) => (
                  <div key={goal.id} className="border border-[var(--border)] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <b className="text-sm">{goal.title}</b>
                      <span className="text-xs font-semibold">{goal.progress}%</span>
                    </div>
                    <div className="mt-3 h-1.5 bg-[var(--surface-soft)]">
                      <div
                        className="h-full bg-[var(--accent)]"
                        style={{ width: `${goal.progress}%` }}
                      />
                    </div>
                    <p className="mt-3 text-xs text-[var(--muted)]">
                      Due {new Date(goal.targetDate).toLocaleDateString("en-ZA")}
                    </p>
                  </div>
                ))}
                {!data.goals.length && (
                  <p className="text-sm text-[var(--muted)]">
                    No goals have been agreed yet.
                  </p>
                )}
              </Panel>
              <Panel title="Development plan">
                {data.developmentPlans.map((plan) => (
                  <div key={plan.id} className="border border-[var(--border)] p-4">
                    <b className="text-sm">{plan.title}</b>
                    <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                      {plan.actionPlan}
                    </p>
                  </div>
                ))}
                {!data.developmentPlans.length && (
                  <p className="text-sm text-[var(--muted)]">
                    No development actions have been recorded.
                  </p>
                )}
              </Panel>
            </section>
          </>
        )}
      </div>
    </EmployeeShell>
  );
}

function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="text-[var(--accent)]">{icon}</div>
      <p className="mt-4 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{label}</p>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function Info({ title, value }: { title: string; value?: string | null }) {
  return (
    <div className="border border-[var(--border)] bg-[var(--surface-soft)] p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
        {title}
      </p>
      <p className="mt-3 text-sm leading-6">{value || "Not provided"}</p>
    </div>
  );
}
