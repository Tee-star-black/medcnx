"use client";

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileOutput,
  Files,
  LayoutTemplate,
  LayoutDashboard,
  LogOut,
  Network,
  ReceiptText,
  Search,
  Settings,
  Target,
  UsersRound,
  UserRound,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { canAny } from "@/lib/permissions";
import { api } from "@/lib/api";
import { clearSession } from "@/lib/session";
import type { AuthUser } from "@/types/auth";

type ActivePage =
  | "dashboard"
  | "notifications"
  | "my-team"
  | "employees"
  | "departments"
  | "leave"
  | "attendance"
  | "documents"
  | "performance"
  | "payroll"
  | "payslips"
  | "recruitment"
  | "audit-logs"
  | "reports"
  | "settings";

type DashboardShellProps = {
  children: ReactNode;
  activePage?: ActivePage;
  user?: AuthUser | null;
};

type NavItem = {
  label: string;
  href: string;
  value: ActivePage;
  icon: LucideIcon;
  permissions?: string[];
  exact?: boolean;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    label: "Overview",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        value: "dashboard",
        icon: LayoutDashboard,
        exact: true,
      },
      {
        label: "My Team",
        href: "/dashboard/my-team",
        value: "my-team",
        icon: UsersRound,
        exact: true,
        permissions: ["leave:approve", "employees:read", "performance:read"],
      },
      {
        label: "Notifications",
        href: "/dashboard/notifications",
        value: "notifications",
        icon: Bell,
        exact: true,
      },
    ],
  },
  {
    label: "People",
    items: [
      {
        label: "Employees",
        href: "/dashboard/employees",
        value: "employees",
        icon: UsersRound,
        permissions: ["employees:read"],
      },
      {
        label: "Recruitment",
        href: "/dashboard/recruitment",
        value: "recruitment",
        icon: BriefcaseBusiness,
        permissions: ["recruitment:read"],
      },
      {
        label: "Departments",
        href: "/dashboard/departments",
        value: "departments",
        icon: Network,
        permissions: ["departments:read"],
      },
      {
        label: "Performance",
        href: "/dashboard/performance",
        value: "performance",
        icon: Target,
        permissions: ["performance:read"],
      },
    ],
  },
  {
    label: "Workforce",
    items: [
      {
        label: "Attendance",
        href: "/dashboard/attendance",
        value: "attendance",
        icon: CalendarClock,
        permissions: ["attendance:read", "attendance:view-organisation"],
      },
      {
        label: "Leave",
        href: "/dashboard/leave",
        value: "leave",
        icon: CalendarDays,
        permissions: ["leave:read", "leave:approve"],
      },
    ],
  },
  {
    label: "Documents",
    items: [
      {
        label: "Document register",
        href: "/dashboard/documents",
        value: "documents",
        icon: Files,
        exact: true,
        permissions: ["documents:read", "generated_documents:read"],
      },
      {
        label: "Generate document",
        href: "/dashboard/documents/generated",
        value: "documents",
        icon: FileOutput,
        permissions: ["generated_documents:create", "generated_documents:read"],
      },
      {
        label: "Templates",
        href: "/dashboard/documents/templates",
        value: "documents",
        icon: LayoutTemplate,
        permissions: ["document_templates:read"],
      },
    ],
  },
  {
    label: "Finance",
    items: [
      {
        label: "Payroll",
        href: "/dashboard/payroll",
        value: "payroll",
        icon: WalletCards,
        permissions: ["payroll:read"],
      },
      {
        label: "Payslips",
        href: "/dashboard/payslips",
        value: "payslips",
        icon: ReceiptText,
        permissions: ["payslips:view-all", "payslips:view-own"],
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        label: "Reports",
        href: "/dashboard/reports",
        value: "reports",
        icon: BarChart3,
        permissions: ["reports:read", "payroll:view-reports"],
      },
      {
        label: "Audit Logs",
        href: "/dashboard/audit-logs",
        value: "audit-logs",
        icon: Activity,
        permissions: ["audit_logs:read", "audit:read"],
      },
      {
        label: "Settings",
        href: "/dashboard/settings",
        value: "settings",
        icon: Settings,
        permissions: ["organisation:update", "users:read"],
      },
    ],
  },
];

const allNavItems = navSections.flatMap((section) => section.items);

const pageDescriptions: Record<ActivePage, string> = {
  dashboard: "Organisation overview and workforce command centre.",
  notifications: "Review updates, approvals and items requiring attention.",
  "my-team": "Review your direct reports and current reporting structure.",
  employees: "Manage employee records, profiles and workforce data.",
  departments: "Organise teams, departments and reporting structures.",
  leave: "Review leave requests, balances and approvals.",
  attendance: "Track clock-ins, clock-outs and attendance activity.",
  performance: "Manage reviews, goals, feedback and employee development.",
  documents: "Upload, generate and manage HR documents.",
  payroll: "Run payroll, manage payroll periods and review calculations.",
  payslips: "View and manage employee payslips.",
  recruitment: "Manage jobs, candidates and hiring pipelines.",
  "audit-logs": "Review system activity and compliance events.",
  reports: "Analyse workforce, payroll and HR activity.",
  settings: "Configure organisation and platform preferences.",
};

function getPageTitle(activePage: ActivePage) {
  if (activePage === "documents") {
    return "Documents";
  }

  return (
    allNavItems.find((item) => item.value === activePage)?.label ?? "Dashboard"
  );
}

function getUserInitials(user?: AuthUser | null) {
  if (!user) {
    return "MX";
  }

  const firstInitial = user.firstName?.charAt(0) ?? "";

  const lastInitial = user.lastName?.charAt(0) ?? "";

  return `${firstInitial}${lastInitial}`.toUpperCase().trim() || "MX";
}

function readSavedUser(): AuthUser | null {
  if (typeof window === "undefined") {
    return null;
  }

  const savedUser = window.localStorage.getItem("medcnx_user");

  if (!savedUser) {
    return null;
  }

  try {
    return JSON.parse(savedUser) as AuthUser;
  } catch {
    window.localStorage.removeItem("medcnx_user");

    return null;
  }
}

export function DashboardShell({
  children,
  activePage = "dashboard",
  user = null,
}: DashboardShellProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [collapsed, setCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    Overview: true,
  });

  const [search, setSearch] = useState("");

  const [sessionUser, setSessionUser] = useState<AuthUser | null>(user);

  useEffect(() => {
    if (user) {
      setSessionUser(user);
      return;
    }

    setSessionUser(readSavedUser());
  }, [user]);

  useEffect(() => {
    const savedState = window.localStorage.getItem("medcnx_sidebar_collapsed");

    if (savedState !== null) {
      setCollapsed(savedState === "true");
    }
  }, []);

  useEffect(() => {
    const activeSection = navSections.find((section) =>
      section.items.some((item) => item.value === activePage),
    );

    if (activeSection) {
      setOpenSections((current) => ({
        ...current,
        [activeSection.label]: true,
      }));
    }
  }, [activePage]);

  const activeUser = user ?? sessionUser;

  const pageTitle = useMemo(() => getPageTitle(activePage), [activePage]);

  const pageDescription = pageDescriptions[activePage];

  const visibleNavSections = useMemo(
    () =>
      navSections
        .map((section) => ({
          ...section,

          items: section.items.filter(
            (item) => !item.permissions || canAny(activeUser, item.permissions),
          ),
        }))
        .filter((section) => section.items.length > 0),
    [activeUser],
  );

  const visibleNavItems = useMemo(
    () => visibleNavSections.flatMap((section) => section.items),
    [visibleNavSections],
  );

  const userInitials = getUserInitials(activeUser);

  const userDisplayName = activeUser
    ? `${activeUser.firstName} ${activeUser.lastName}`.trim()
    : "MedCNX User";

  const primaryRole =
    activeUser?.roles?.[0]
      ?.replaceAll("_", " ")
      .toLowerCase()
      .replace(/\b\w/g, (character) => character.toUpperCase()) ??
    "Organisation User";

  function toggleSidebar() {
    setCollapsed((currentValue) => {
      const nextValue = !currentValue;

      window.localStorage.setItem(
        "medcnx_sidebar_collapsed",
        String(nextValue),
      );

      return nextValue;
    });
  }

  function toggleSection(label: string) {
    setOpenSections((current) => ({
      ...current,
      [label]: !current[label],
    }));
  }

  async function handleLogout() {
    try {
      await api.post("/auth/logout");
    } catch {
      // Local session removal still signs the browser out if the API is unavailable.
    }
    clearSession();
    setSessionUser(null);
    router.replace("/");
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const query = search.trim().toLowerCase();

    if (!query) {
      return;
    }

    const matchingItem = visibleNavItems.find((item) =>
      item.label.toLowerCase().includes(query),
    );

    if (matchingItem) {
      router.push(matchingItem.href);

      setSearch("");
    }
  }

  return (
    <div className="app-shell min-h-screen text-[var(--text)]">
      <aside
        className={`clinical-sidebar fixed inset-y-0 left-0 z-50 hidden border-r border-[var(--border-strong)] bg-[var(--surface)] shadow-[8px_0_24px_rgba(6,35,47,0.12)] transition-[width] duration-300 lg:flex lg:flex-col ${
          collapsed ? "w-20" : "w-72"
        }`}
      >
        <div
          className={`flex h-20 shrink-0 items-center border-b border-[var(--border)] ${
            collapsed ? "justify-center px-3" : "justify-between px-5"
          }`}
        >
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className={`flex items-center text-[var(--text)] ${
              collapsed ? "justify-center" : "gap-3"
            }`}
            aria-label="Open MedCNX dashboard"
          >
            <span className="relative flex h-11 w-11 shrink-0 items-center justify-center border border-[#102a3a] bg-[#102a3a] text-xs font-black tracking-tight text-white shadow-sm dark:border-[#6dc7d4]">
              <span className="absolute right-1 top-1 h-1.5 w-1.5 bg-[#6dc7d4]" />
              MX
            </span>

            {!collapsed ? (
              <span className="text-left">
                <span className="block text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--muted)]">
                  Workforce OS
                </span>

                <span className="mt-1 block text-lg font-black tracking-[-0.04em] text-[var(--text)]">
                  MedCNX
                </span>
              </span>
            ) : null}
          </button>

          {!collapsed ? (
            <button
              type="button"
              onClick={toggleSidebar}
              className="flex h-9 w-9 items-center justify-center border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--text)] transition hover:border-[var(--accent)] hover:bg-[var(--surface)] hover:text-[var(--accent)]"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft size={17} />
            </button>
          ) : null}
        </div>

        {collapsed ? (
          <div className="flex justify-center border-b border-[var(--border)] py-3">
            <button
              type="button"
              onClick={toggleSidebar}
              className="flex h-9 w-9 items-center justify-center border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--text)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              aria-label="Expand sidebar"
            >
              <ChevronRight size={17} />
            </button>
          </div>
        ) : (
          <div className="border-b border-[var(--border)] px-5 py-5">
            <div className="flex items-center gap-3 border border-[var(--border)] bg-[var(--surface-soft)] p-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[var(--border)] bg-[var(--surface)] text-[var(--accent)]">
                <Building2 size={18} />
              </div>

              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                  Workspace
                </p>

                <p className="mt-1 truncate text-sm font-bold text-[var(--text)]">
                  {activeUser?.organisation?.name ?? "MedCNX Workspace"}
                </p>
              </div>
            </div>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-4 py-5">
          <div className="space-y-6">
            {visibleNavSections.map((section) => (
              <div key={section.label}>
                {!collapsed ? (
                  <button
                    type="button"
                    onClick={() => toggleSection(section.label)}
                    aria-expanded={Boolean(openSections[section.label])}
                    className="mb-2 flex h-8 w-full items-center justify-between border-0 px-3 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--text)]"
                  >
                    <span>{section.label}</span>
                    <ChevronDown
                      size={14}
                      className={`transition-transform ${
                        openSections[section.label] ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                ) : null}

                <div
                  className={`space-y-1 ${
                    collapsed || openSections[section.label]
                      ? "block"
                      : "hidden"
                  }`}
                >
                  {section.items.map((item) => {
                    const Icon = item.icon;

                    const isActive = item.exact
                      ? pathname === item.href
                      : pathname === item.href ||
                        pathname.startsWith(`${item.href}/`);

                    return (
                      <button
                        key={item.href}
                        type="button"
                        onClick={() => router.push(item.href)}
                        title={collapsed ? item.label : undefined}
                        aria-current={isActive ? "page" : undefined}
                        className={`group relative flex h-11 w-full items-center border text-sm font-semibold transition ${
                          collapsed
                            ? "justify-center px-0"
                            : "justify-start gap-3 px-3"
                        } ${
                          isActive
                            ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-text)] shadow-sm"
                            : "border-transparent text-[var(--muted)] hover:border-[var(--border)] hover:bg-[var(--surface-soft)] hover:text-[var(--text)]"
                        }`}
                      >
                        <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />

                        {!collapsed ? <span>{item.label}</span> : null}

                        {isActive && !collapsed ? (
                          <span className="ml-auto h-1.5 w-1.5 bg-current" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>

        <div className="border-t border-[var(--border)] p-4">
          {activeUser?.permissions.includes("profile:view-own") ? (
            <button
              type="button"
              onClick={() => router.push("/employee")}
              className={`mb-3 flex h-10 w-full items-center border border-[var(--border)] bg-[var(--surface-soft)] text-sm font-bold text-[var(--text)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] ${
                collapsed ? "justify-center px-0" : "gap-3 px-3"
              }`}
              title={collapsed ? "My employee portal" : undefined}
            >
              <UserRound size={17} />
              {!collapsed ? <span>My employee portal</span> : null}
            </button>
          ) : null}
          <div
            className={`flex items-center ${
              collapsed ? "justify-center" : "justify-between gap-3"
            }`}
          >
            <div
              className={`flex min-w-0 items-center ${
                collapsed ? "" : "gap-3"
              }`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[var(--accent)] bg-[var(--accent)] text-xs font-black text-[var(--accent-text)]">
                {userInitials}
              </div>

              {!collapsed ? (
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[var(--text)]">
                    {userDisplayName}
                  </p>

                  <p className="mt-0.5 truncate text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                    {primaryRole}
                  </p>
                </div>
              ) : null}
            </div>

            {!collapsed ? (
              <button
                type="button"
                onClick={handleLogout}
                className="flex h-9 w-9 shrink-0 items-center justify-center border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--text)] transition hover:border-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950 dark:hover:text-red-300"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut size={16} />
              </button>
            ) : null}
          </div>
        </div>
      </aside>

      <div
        className={`min-h-screen transition-[padding] duration-300 ${
          collapsed ? "lg:pl-20" : "lg:pl-72"
        }`}
      >
        <header className="clinical-commandbar sticky top-0 z-40 border-b border-[var(--border-strong)] bg-[var(--surface)] shadow-[var(--shadow-xs)]">
          <div className="flex min-h-20 items-center gap-4 px-5 sm:px-7 lg:px-9">
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="flex h-10 w-10 shrink-0 items-center justify-center border border-[var(--accent)] bg-[var(--accent)] text-xs font-black text-[var(--accent-text)] lg:hidden"
              aria-label="Open dashboard"
            >
              MX
            </button>

            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-[var(--accent)]">
                MedCNX workspace
              </p>

              <div className="mt-1 flex items-end gap-3">
                <h1 className="truncate text-xl font-black tracking-[-0.045em] text-[var(--text)] sm:text-[1.65rem]">
                  {pageTitle}
                </h1>

                <p className="mb-0.5 hidden truncate text-sm font-medium text-[var(--muted)] xl:block">
                  {pageDescription}
                </p>
              </div>
            </div>

            <form
              onSubmit={handleSearchSubmit}
              className="hidden w-full max-w-sm items-center border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 transition focus-within:border-[var(--accent)] focus-within:shadow-[0_0_0_3px_var(--accent-ring)] md:flex"
            >
              <Search size={17} className="shrink-0 text-[var(--muted)]" />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search workspace"
                aria-label="Search workspace"
                className="h-10 min-w-0 flex-1 bg-transparent px-3 text-sm font-medium text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
              />

              <span className="border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--muted)]">
                /
              </span>
            </form>

            <div className="flex items-center gap-2">
              {activeUser?.permissions.includes("profile:view-own") ? (
                <button
                  type="button"
                  onClick={() => router.push("/employee")}
                  className="flex h-10 w-10 items-center justify-center border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--text)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] lg:hidden"
                  aria-label="Open my employee portal"
                  title="My employee portal"
                >
                  <UserRound size={17} />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => router.push("/dashboard/notifications")}
                className="relative flex h-10 w-10 items-center justify-center border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--text)] transition hover:border-[var(--accent)] hover:bg-[var(--surface)] hover:text-[var(--accent)]"
                aria-label="Workspace notifications"
                title="Workspace notifications"
              >
                <Bell size={17} />
              </button>

              <ThemeToggle />
            </div>
          </div>

          <div className="border-t border-[var(--border)] px-5 py-3 md:hidden">
            <form
              onSubmit={handleSearchSubmit}
              className="flex items-center border border-[var(--border)] bg-[var(--surface-soft)] px-3 focus-within:border-[var(--accent)]"
            >
              <Search size={17} className="shrink-0 text-[var(--muted)]" />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search workspace"
                aria-label="Search workspace"
                className="h-10 min-w-0 flex-1 bg-transparent px-3 text-sm font-medium text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
              />
            </form>
          </div>

          <nav className="flex overflow-x-auto border-t border-[var(--border)] px-5 lg:hidden">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;

              const isActive = item.exact
                ? pathname === item.href
                : pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);

              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => router.push(item.href)}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex h-12 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition ${
                    isActive
                      ? "border-[var(--accent)] text-[var(--accent)]"
                      : "border-transparent text-[var(--muted)] hover:text-[var(--text)]"
                  }`}
                >
                  <Icon size={16} />

                  {item.label}
                </button>
              );
            })}
          </nav>
        </header>

        <main className="min-h-[calc(100vh-5rem)] px-5 py-6 text-[var(--text)] sm:px-7 lg:px-9 lg:py-8">
          <div className="workspace-content">{children}</div>
        </main>
      </div>
    </div>
  );
}
