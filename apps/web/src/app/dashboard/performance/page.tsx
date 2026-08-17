"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FilePlus2,
  Loader2,
  Search,
  Target,
  TrendingUp,
  UserCheck,
  UsersRound,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { api } from "@/lib/api";

type Dashboard = {
  activeCycles: number;
  pendingReviews: number;
  overdueReviews: number;
  goalsDueSoon: number;
  overdueGoals: number;
  developmentPlans: number;
  recentReviews: Review[];
};
type Question = {
  id: string;
  label: string;
  type: "RATING" | "TEXT" | "YES_NO";
  required: boolean;
  maxScore?: number;
};
type Template = {
  id: string;
  name: string;
  description?: string;
  type: string;
  status: string;
  anonymous: boolean;
  questions: Question[];
  _count: { cycles: number };
};
type Cycle = {
  id: string;
  name: string;
  status: string;
  startDate: string;
  dueDate: string;
  template: Template;
  _count: { reviews: number };
};
type Employee = {
  id: string;
  userId?: string | null;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  jobTitle?: string | null;
  department?: { name: string } | null;
};
type Review = {
  id: string;
  reviewerType: string;
  status: string;
  overallScore?: string | number | null;
  employee: Employee;
  reviewerUser: { firstName: string; lastName: string };
  cycle: { name: string; dueDate: string; template?: Template };
};
type Goal = {
  id: string;
  title: string;
  status: string;
  progress: number;
  targetDate: string;
  employee: Employee;
};

const field =
  "w-full border border-[#ccd7dd] bg-white px-3.5 py-2.5 text-sm text-[#163042] outline-none transition focus:border-[#08788d] focus:ring-2 focus:ring-[#08788d]/10";
const primary =
  "inline-flex items-center justify-center gap-2 bg-[#08788d] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#066477] disabled:cursor-not-allowed disabled:opacity-40";
const secondary =
  "inline-flex items-center justify-center gap-2 border border-[#cbd6dc] bg-white px-4 py-2.5 text-sm font-semibold text-[#163042] transition hover:border-[#08788d] hover:text-[#08788d]";
const clean = (value: string) => value.replaceAll("_", " ");

const starterQuestions: Question[] = [
  {
    id: "role_delivery",
    label: "Consistently delivers the responsibilities of the role",
    type: "RATING",
    required: true,
    maxScore: 5,
  },
  {
    id: "quality",
    label: "Demonstrates quality, accuracy and professional judgement",
    type: "RATING",
    required: true,
    maxScore: 5,
  },
  {
    id: "teamwork",
    label: "Communicates effectively and contributes to the team",
    type: "RATING",
    required: true,
    maxScore: 5,
  },
  {
    id: "strengths",
    label: "What are this employee’s most important strengths?",
    type: "TEXT",
    required: true,
  },
  {
    id: "development",
    label: "What development would have the greatest positive impact?",
    type: "TEXT",
    required: true,
  },
];

export default function PerformancePage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tab, setTab] = useState("OVERVIEW");
  const [showCreate, setShowCreate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [templateForm, setTemplateForm] = useState({
    name: "Annual Performance Review",
    description: "Balanced employee and manager performance assessment.",
    type: "ANNUAL",
    anonymous: false,
  });
  const [cycleForm, setCycleForm] = useState({
    templateId: "",
    name: "",
    startDate: new Date().toISOString().slice(0, 10),
    dueDate: "",
  });
  const [assignment, setAssignment] = useState({
    cycleId: "",
    employeeId: "",
    reviewerUserId: "",
    reviewerType: "MANAGER",
    confidential: false,
  });

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setError("");
    try {
      const [d, t, c, r, g, e] = await Promise.all([
        api.get<Dashboard>("/performance/dashboard"),
        api.get<Template[]>("/performance/templates"),
        api.get<Cycle[]>("/performance/cycles"),
        api.get<Review[]>("/performance/reviews"),
        api.get<Goal[]>("/performance/goals"),
        api.get<Employee[]>("/employees"),
      ]);
      setDashboard(d.data);
      setTemplates(t.data);
      setCycles(c.data);
      setReviews(r.data);
      setGoals(g.data);
      setEmployees(e.data);
      setCycleForm((value) => ({
        ...value,
        templateId: value.templateId || t.data[0]?.id || "",
      }));
      setAssignment((value) => ({
        ...value,
        cycleId: value.cycleId || c.data[0]?.id || "",
        employeeId: value.employeeId || e.data[0]?.id || "",
        reviewerUserId:
          value.reviewerUserId ||
          e.data.find((item) => item.userId)?.userId ||
          "",
      }));
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message ||
          "Could not load Performance & Development.",
      );
    }
  }

  async function createTemplate() {
    setBusy(true);
    setError("");
    try {
      await api.post("/performance/templates", {
        ...templateForm,
        questions: starterQuestions,
      });
      setSuccess("Assessment template created.");
      setShowCreate("");
      await load();
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message || "Could not create template.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function createCycle() {
    setBusy(true);
    setError("");
    try {
      await api.post("/performance/cycles", cycleForm);
      setSuccess("Review cycle created.");
      setShowCreate("");
      await load();
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message || "Could not create cycle.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function assignReview() {
    setBusy(true);
    setError("");
    try {
      await api.post(
        `/performance/cycles/${assignment.cycleId}/reviews`,
        {
          employeeId: assignment.employeeId,
          reviewerUserId: assignment.reviewerUserId,
          reviewerType: assignment.reviewerType,
          confidential: assignment.confidential,
        },
      );
      setSuccess("Reviewer assigned and notified.");
      setShowCreate("");
      await load();
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message || "Could not assign reviewer.",
      );
    } finally {
      setBusy(false);
    }
  }

  const filteredReviews = useMemo(
    () =>
      reviews.filter((review) =>
        `${review.employee.firstName} ${review.employee.lastName} ${review.cycle.name} ${review.status}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [reviews, search],
  );

  const tabs = [
    "OVERVIEW",
    "REVIEWS",
    "CYCLES",
    "TEMPLATES",
    "GOALS",
    "DEVELOPMENT",
  ];

  return (
    <DashboardShell activePage="performance">
      <div className="min-h-full bg-[#f5f8f9] text-[#163042]">
        <div className="mx-auto max-w-[1550px] space-y-5 p-1">
          <header className="border-b border-[#d9e2e6] bg-white px-7 py-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.2em] text-[#08788d]">
                  People development
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-[-.04em]">
                  Performance & Development
                </h1>
                <p className="mt-2 max-w-3xl text-sm text-[#607787]">
                  Run fair review cycles, collect structured 360° feedback,
                  agree goals and retain a complete development history.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className={secondary}
                  onClick={() => setShowCreate("ASSIGN")}
                >
                  <UserCheck size={16} />
                  Assign review
                </button>
                <button
                  className={primary}
                  onClick={() => setShowCreate("CYCLE")}
                >
                  <FilePlus2 size={16} />
                  New review cycle
                </button>
              </div>
            </div>
            <nav className="mt-6 flex gap-1 overflow-x-auto border-t border-[#e3e9ec] pt-3">
              {tabs.map((item) => (
                <button
                  key={item}
                  onClick={() => setTab(item)}
                  className={`whitespace-nowrap border-b-2 px-4 py-2 text-xs font-bold tracking-wide ${
                    tab === item
                      ? "border-[#08788d] text-[#08788d]"
                      : "border-transparent text-[#6a808e]"
                  }`}
                >
                  {clean(item)}
                </button>
              ))}
            </nav>
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

          {showCreate && (
            <section className="border border-[#cbd8de] bg-white p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#08788d]">
                    New workflow
                  </p>
                  <h2 className="mt-1 text-lg font-semibold">
                    {showCreate === "CYCLE"
                      ? "Create review cycle"
                      : showCreate === "ASSIGN"
                        ? "Assign reviewer"
                        : "Create assessment template"}
                  </h2>
                </div>
                <button
                  className="text-sm text-[#607787]"
                  onClick={() => setShowCreate("")}
                >
                  Close
                </button>
              </div>
              {showCreate === "CYCLE" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <select
                    className={field}
                    value={cycleForm.templateId}
                    onChange={(event) =>
                      setCycleForm({
                        ...cycleForm,
                        templateId: event.target.value,
                      })
                    }
                  >
                    {templates.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <input
                    className={field}
                    placeholder="Cycle name"
                    value={cycleForm.name}
                    onChange={(event) =>
                      setCycleForm({ ...cycleForm, name: event.target.value })
                    }
                  />
                  <label className="text-xs font-semibold">
                    Start date
                    <input
                      className={`${field} mt-1`}
                      type="date"
                      value={cycleForm.startDate}
                      onChange={(event) =>
                        setCycleForm({
                          ...cycleForm,
                          startDate: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="text-xs font-semibold">
                    Due date
                    <input
                      className={`${field} mt-1`}
                      type="date"
                      value={cycleForm.dueDate}
                      onChange={(event) =>
                        setCycleForm({
                          ...cycleForm,
                          dueDate: event.target.value,
                        })
                      }
                    />
                  </label>
                  <button
                    className={primary}
                    disabled={
                      busy ||
                      !cycleForm.name ||
                      !cycleForm.templateId ||
                      !cycleForm.dueDate
                    }
                    onClick={() => void createCycle()}
                  >
                    {busy && <Loader2 className="animate-spin" size={15} />}
                    Create cycle
                  </button>
                </div>
              ) : showCreate === "ASSIGN" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <select
                    className={field}
                    value={assignment.cycleId}
                    onChange={(event) =>
                      setAssignment({
                        ...assignment,
                        cycleId: event.target.value,
                      })
                    }
                  >
                    {cycles.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className={field}
                    value={assignment.employeeId}
                    onChange={(event) =>
                      setAssignment({
                        ...assignment,
                        employeeId: event.target.value,
                      })
                    }
                  >
                    {employees.map((item) => (
                      <option key={item.id} value={item.id}>
                        Review: {item.firstName} {item.lastName}
                      </option>
                    ))}
                  </select>
                  <select
                    className={field}
                    value={assignment.reviewerUserId}
                    onChange={(event) =>
                      setAssignment({
                        ...assignment,
                        reviewerUserId: event.target.value,
                      })
                    }
                  >
                    {employees
                      .filter((item) => item.userId)
                      .map((item) => (
                        <option key={item.id} value={item.userId!}>
                          Reviewer: {item.firstName} {item.lastName}
                        </option>
                      ))}
                  </select>
                  <select
                    className={field}
                    value={assignment.reviewerType}
                    onChange={(event) =>
                      setAssignment({
                        ...assignment,
                        reviewerType: event.target.value,
                      })
                    }
                  >
                    {[
                      "SELF",
                      "MANAGER",
                      "PEER",
                      "DIRECT_REPORT",
                      "DEPARTMENT_HEAD",
                      "EXTERNAL",
                    ].map((item) => (
                      <option key={item}>{clean(item)}</option>
                    ))}
                  </select>
                  <label className="flex items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={assignment.confidential}
                      onChange={(event) =>
                        setAssignment({
                          ...assignment,
                          confidential: event.target.checked,
                        })
                      }
                    />
                    Keep the reviewer response confidential
                  </label>
                  <button
                    className={primary}
                    disabled={
                      busy ||
                      !assignment.cycleId ||
                      !assignment.employeeId ||
                      !assignment.reviewerUserId
                    }
                    onClick={() => void assignReview()}
                  >
                    Assign and notify
                  </button>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <input
                    className={field}
                    value={templateForm.name}
                    onChange={(event) =>
                      setTemplateForm({
                        ...templateForm,
                        name: event.target.value,
                      })
                    }
                  />
                  <select
                    className={field}
                    value={templateForm.type}
                    onChange={(event) =>
                      setTemplateForm({
                        ...templateForm,
                        type: event.target.value,
                      })
                    }
                  >
                    {[
                      "PROBATION",
                      "ANNUAL",
                      "QUARTERLY",
                      "REVIEW_360",
                      "CLINICAL_COMPETENCY",
                      "TRAINING_EVALUATION",
                      "PERFORMANCE_IMPROVEMENT",
                      "CUSTOM",
                    ].map((item) => (
                      <option key={item}>{clean(item)}</option>
                    ))}
                  </select>
                  <textarea
                    className={`${field} min-h-24 md:col-span-2`}
                    value={templateForm.description}
                    onChange={(event) =>
                      setTemplateForm({
                        ...templateForm,
                        description: event.target.value,
                      })
                    }
                  />
                  <p className="text-sm text-[#607787] md:col-span-2">
                    The starter template includes role delivery, quality,
                    teamwork, strengths and development questions. It can be
                    expanded in the template builder.
                  </p>
                  <button
                    className={primary}
                    disabled={busy || !templateForm.name}
                    onClick={() => void createTemplate()}
                  >
                    Create template
                  </button>
                </div>
              )}
            </section>
          )}

          {tab === "OVERVIEW" && (
            <>
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                <Metric
                  label="Active cycles"
                  value={dashboard?.activeCycles ?? 0}
                  icon={<CalendarClock size={18} />}
                />
                <Metric
                  label="Reviews in progress"
                  value={dashboard?.pendingReviews ?? 0}
                  icon={<ClipboardCheck size={18} />}
                />
                <Metric
                  label="Overdue reviews"
                  value={dashboard?.overdueReviews ?? 0}
                  icon={<AlertTriangle size={18} />}
                  danger
                />
                <Metric
                  label="Goals due soon"
                  value={dashboard?.goalsDueSoon ?? 0}
                  icon={<Target size={18} />}
                />
                <Metric
                  label="Overdue goals"
                  value={dashboard?.overdueGoals ?? 0}
                  icon={<TrendingUp size={18} />}
                  danger
                />
                <Metric
                  label="Development plans"
                  value={dashboard?.developmentPlans ?? 0}
                  icon={<UsersRound size={18} />}
                />
              </section>
              <section className="grid gap-5 xl:grid-cols-[1.4fr_.6fr]">
                <ReviewTable reviews={dashboard?.recentReviews ?? []} />
                <div className="border border-[#dbe3e7] bg-[#102a3a] p-6 text-white">
                  <p className="text-xs font-bold uppercase tracking-[.18em] text-[#72c8d3]">
                    Review quality
                  </p>
                  <h2 className="mt-3 text-xl font-semibold">
                    Development, not judgement
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-white/65">
                    Use multiple perspectives, document evidence and agree
                    measurable development actions. Confidential individual
                    responses remain protected.
                  </p>
                  <button
                    className="mt-6 inline-flex items-center gap-2 bg-white px-4 py-2.5 text-sm font-semibold text-[#102a3a]"
                    onClick={() => setShowCreate("TEMPLATE")}
                  >
                    Create assessment template
                    <ArrowRight size={15} />
                  </button>
                </div>
              </section>
            </>
          )}

          {tab === "REVIEWS" && (
            <section className="border border-[#dbe3e7] bg-white">
              <div className="flex flex-col gap-3 border-b border-[#e2e8eb] p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-semibold">Organisation reviews</h2>
                  <p className="mt-1 text-xs text-[#607787]">
                    {filteredReviews.length} assigned response
                    {filteredReviews.length === 1 ? "" : "s"}
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
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search reviews"
                  />
                </label>
              </div>
              <ReviewTable reviews={filteredReviews} />
            </section>
          )}

          {tab === "CYCLES" && (
            <CardGrid>
              {cycles.map((item) => (
                <article key={item.id} className="border border-[#dbe3e7] bg-white p-5">
                  <Status value={item.status} />
                  <h3 className="mt-4 font-semibold">{item.name}</h3>
                  <p className="mt-1 text-xs text-[#607787]">
                    {item.template.name}
                  </p>
                  <div className="mt-5 border-t border-[#e4e9ec] pt-4 text-xs text-[#607787]">
                    {item._count.reviews} assigned · Due{" "}
                    {new Date(item.dueDate).toLocaleDateString("en-ZA")}
                  </div>
                </article>
              ))}
            </CardGrid>
          )}

          {tab === "TEMPLATES" && (
            <>
              <div>
                <button
                  className={primary}
                  onClick={() => setShowCreate("TEMPLATE")}
                >
                  <FilePlus2 size={16} />
                  New template
                </button>
              </div>
              <CardGrid>
                {templates.map((item) => (
                  <article key={item.id} className="border border-[#dbe3e7] bg-white p-5">
                    <div className="flex items-center justify-between">
                      <Status value={item.status} />
                      <span className="text-xs text-[#607787]">
                        {item.questions.length} questions
                      </span>
                    </div>
                    <h3 className="mt-4 font-semibold">{item.name}</h3>
                    <p className="mt-2 text-xs leading-5 text-[#607787]">
                      {item.description}
                    </p>
                    <p className="mt-4 text-xs font-semibold text-[#08788d]">
                      {clean(item.type)} · {item._count.cycles} cycles
                    </p>
                  </article>
                ))}
              </CardGrid>
            </>
          )}

          {tab === "GOALS" && (
            <CardGrid>
              {goals.map((goal) => (
                <article key={goal.id} className="border border-[#dbe3e7] bg-white p-5">
                  <div className="flex items-center justify-between">
                    <Status value={goal.status} />
                    <span className="text-xs font-semibold">{goal.progress}%</span>
                  </div>
                  <h3 className="mt-4 font-semibold">{goal.title}</h3>
                  <p className="mt-1 text-xs text-[#607787]">
                    {goal.employee.firstName} {goal.employee.lastName}
                  </p>
                  <div className="mt-4 h-1.5 bg-[#e7edef]">
                    <div
                      className="h-full bg-[#08788d]"
                      style={{ width: `${goal.progress}%` }}
                    />
                  </div>
                </article>
              ))}
              {!goals.length && <Empty text="No performance goals yet." />}
            </CardGrid>
          )}

          {tab === "DEVELOPMENT" && (
            <Empty text="Development plans will appear here when they are created from finalised reviews." />
          )}
        </div>
      </div>
    </DashboardShell>
  );
}

function Metric({
  label,
  value,
  icon,
  danger,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div className="border border-[#dbe3e7] bg-white p-5">
      <div className={danger ? "text-red-600" : "text-[#08788d]"}>{icon}</div>
      <p className="mt-5 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-[#607787]">{label}</p>
    </div>
  );
}

function ReviewTable({ reviews }: { reviews: Review[] }) {
  return (
    <div className="overflow-x-auto border border-[#dbe3e7] bg-white">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-[#f4f7f8] text-xs uppercase tracking-wide text-[#6b818e]">
          <tr>
            <th className="px-4 py-3">Employee</th>
            <th className="px-4 py-3">Cycle</th>
            <th className="px-4 py-3">Reviewer</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Action</th>
          </tr>
        </thead>
        <tbody>
          {reviews.map((review) => (
            <tr key={review.id} className="border-t border-[#e5eaed]">
              <td className="px-4 py-4 font-semibold">
                {review.employee.firstName} {review.employee.lastName}
                <span className="block text-xs font-normal text-[#607787]">
                  {review.employee.employeeNumber}
                </span>
              </td>
              <td className="px-4 py-4">{review.cycle.name}</td>
              <td className="px-4 py-4">{clean(review.reviewerType)}</td>
              <td className="px-4 py-4">
                <Status value={review.status} />
              </td>
              <td className="px-4 py-4">
                <Link
                  href={`/dashboard/performance/reviews/${review.id}`}
                  className="font-semibold text-[#08788d] hover:underline"
                >
                  Open
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!reviews.length && <Empty text="No reviews have been assigned." />}
    </div>
  );
}

function Status({ value }: { value: string }) {
  const completed = ["ACTIVE", "COMPLETED", "SUBMITTED"].includes(value);
  const danger = value.includes("OVERDUE") || value === "CANCELLED";
  return (
    <span
      className={`inline-flex px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
        danger
          ? "bg-red-50 text-red-700"
          : completed
            ? "bg-emerald-50 text-emerald-700"
            : "bg-amber-50 text-amber-700"
      }`}
    >
      {clean(value)}
    </span>
  );
}

function CardGrid({ children }: { children: React.ReactNode }) {
  return <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</section>;
}

function Empty({ text }: { text: string }) {
  return (
    <div className="border border-dashed border-[#cbd7dc] bg-white px-6 py-14 text-center text-sm text-[#718793]">
      <CheckCircle2 className="mx-auto mb-3" size={24} />
      {text}
    </div>
  );
}
