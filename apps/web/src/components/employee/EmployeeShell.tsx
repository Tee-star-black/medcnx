"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Bell,
  CalendarClock,
  CalendarDays,
  FileText,
  Home,
  LayoutDashboard,
  LogOut,
  ReceiptText,
  Search,
  ShieldCheck,
  Target,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { NotificationToast } from "@/components/employee/NotificationToast";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import {
  useEmployeeNotifications,
  type EmployeeNotification,
} from "@/lib/employee-notifications";
import { api } from "@/lib/api";
import { clearSession } from "@/lib/session";

type EmployeeShellProps = {
  children: ReactNode;
};

type EmployeeNavItem = {
  label: string;
  shortLabel: string;
  href: string;
  icon: LucideIcon;
  description: string;
};

type SavedUser = {
  firstName?: string;
  lastName?: string;
  email?: string;
  permissions?: string[];
  organisation?: { name?: string };
};

const navItems: EmployeeNavItem[] = [
  {
    label: "My Portal",
    shortLabel: "Portal",
    href: "/employee",
    icon: Home,
    description: "Your workforce overview and latest activity.",
  },
  {
    label: "My Profile",
    shortLabel: "Profile",
    href: "/employee/profile",
    icon: UserRound,
    description: "Personal, employment and contact information.",
  },
  {
    label: "Attendance",
    shortLabel: "Attendance",
    href: "/employee/attendance",
    icon: CalendarClock,
    description: "Clock-ins, clock-outs and attendance history.",
  },
  {
    label: "Leave",
    shortLabel: "Leave",
    href: "/employee/leave",
    icon: CalendarDays,
    description: "Leave balances, requests and approvals.",
  },
  {
    label: "Documents",
    shortLabel: "Documents",
    href: "/employee/documents",
    icon: FileText,
    description: "Your published employment documents.",
  },
  {
    label: "Payslips",
    shortLabel: "Payslips",
    href: "/employee/payslips",
    icon: ReceiptText,
    description: "Secure payroll records and payslips.",
  },
  {
    label: "Performance",
    shortLabel: "Performance",
    href: "/employee/performance",
    icon: Target,
    description: "Reviews, goals and development plans.",
  },
  {
    label: "Notifications",
    shortLabel: "Alerts",
    href: "/employee/notifications",
    icon: Bell,
    description: "Updates and actions requiring your attention.",
  },
];

function isActiveRoute(pathname: string, href: string) {
  return href === "/employee"
    ? pathname === "/employee"
    : pathname === href || pathname.startsWith(`${href}/`);
}

function readSavedUser(): SavedUser | null {
  try {
    return JSON.parse(
      localStorage.getItem("medcnx_user") ?? "null",
    ) as SavedUser | null;
  } catch {
    return null;
  }
}

export function EmployeeShell({ children }: EmployeeShellProps) {
  const pathname = usePathname();
  const [user, setUser] = useState<SavedUser | null>(null);
  const [canAccessAdmin, setCanAccessAdmin] = useState(false);
  const [search, setSearch] = useState("");
  const {
    unreadCount,
    latestNotification,
    dismissLatest,
    markRead,
  } = useEmployeeNotifications();

  useEffect(() => {
    const savedUser = readSavedUser();
    const permissions = savedUser?.permissions ?? [];

    setUser(savedUser);
    setCanAccessAdmin(
      permissions.some((permission) =>
        [
          "employees:read",
          "organisation:update",
          "payroll:read",
          "leave:approve",
          "attendance:view-organisation",
        ].includes(permission),
      ),
    );
  }, []);

  const activeItem = useMemo(
    () =>
      navItems.find((item) => isActiveRoute(pathname, item.href)) ??
      navItems[0],
    [pathname],
  );

  const visibleNavItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return navItems;

    return navItems.filter((item) =>
      `${item.label} ${item.description}`.toLowerCase().includes(query),
    );
  }, [search]);

  const initials =
    `${user?.firstName?.charAt(0) ?? ""}${user?.lastName?.charAt(0) ?? ""}` ||
    "ME";
  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Employee";

  async function openNotification(notification: EmployeeNotification) {
    if (!notification.readAt) {
      await markRead(notification.id);
    }
  }

  async function logout() {
    try {
      await api.post("/auth/logout");
    } catch {
      // Local session removal still signs the browser out if the API is unavailable.
    }
    clearSession();
    sessionStorage.clear();
    window.location.replace("/");
  }

  return (
    <div className="app-shell min-h-screen text-[var(--text)]">
      <aside className="clinical-sidebar fixed inset-y-0 left-0 z-50 hidden w-72 flex-col border-r border-[var(--border-strong)] shadow-[8px_0_24px_rgba(6,35,47,0.12)] lg:flex">
        <div className="flex h-20 shrink-0 items-center border-b border-[var(--border)] px-5">
          <Link href="/employee" className="flex items-center gap-3">
            <div className="relative flex h-11 w-11 items-center justify-center border border-[var(--accent)] bg-[var(--surface-soft)] text-[var(--accent)]">
              <span className="absolute right-1 top-1 h-1.5 w-1.5 bg-[var(--accent)]" />
              <ShieldCheck size={21} />
            </div>
            <div>
              <p className="text-lg font-black tracking-[-0.04em] text-[var(--text)]">
                MedCNX
              </p>
              <p className="mt-0.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                Employee workspace
              </p>
            </div>
          </Link>
        </div>

        <div className="border-b border-[var(--border)] p-4">
          <div className="border border-[var(--border)] bg-[var(--surface-soft)] p-3">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--muted)]">
              Signed in
            </p>
            <p className="mt-1 truncate text-sm font-extrabold text-[var(--text)]">
              {displayName}
            </p>
            <p className="mt-0.5 truncate text-xs font-semibold text-[var(--muted)]">
              {user?.organisation?.name ?? "MedCNX workspace"}
            </p>
          </div>
        </div>

        <div className="px-4 pt-4">
          <div className="flex items-center border border-[var(--border)] bg-[var(--surface-soft)] px-3 focus-within:border-[var(--accent)]">
            <Search size={16} className="shrink-0 text-[var(--muted)]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Find a section"
              aria-label="Find an employee portal section"
              className="h-10 min-w-0 flex-1 bg-transparent px-3 text-sm font-semibold text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
            />
          </div>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <p className="mb-2 px-3 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--muted)]">
            My workspace
          </p>
          <div className="space-y-1">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const active = isActiveRoute(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex min-h-11 items-center gap-3 border px-3 text-sm font-bold transition ${
                    active
                      ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-text)]"
                      : "border-transparent text-[var(--muted)] hover:border-[var(--border)] hover:bg-[var(--surface-soft)] hover:text-[var(--text)]"
                  }`}
                >
                  <Icon size={18} strokeWidth={active ? 2.25 : 1.9} />
                  <span>{item.label}</span>
                  {item.href === "/employee/notifications" && unreadCount > 0 ? (
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center bg-red-600 px-1 text-[10px] font-black text-white">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  ) : active ? (
                    <span className="ml-auto h-1.5 w-1.5 bg-current" />
                  ) : null}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-[var(--border)] p-4">
          {canAccessAdmin ? (
            <Link
              href="/dashboard"
              className="mb-3 flex min-h-11 items-center gap-3 border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-sm font-extrabold text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              <LayoutDashboard size={17} />
              Admin workspace
            </Link>
          ) : null}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[var(--accent)] bg-[var(--accent)] text-xs font-black uppercase text-[var(--accent-text)]">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-extrabold text-[var(--text)]">
                {displayName}
              </p>
              <p className="text-xs font-semibold text-[var(--muted)]">
                Employee portal
              </p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="flex h-10 w-10 shrink-0 items-center justify-center border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--text)] hover:border-red-500 hover:text-red-400"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <div className="min-h-screen lg:pl-72">
        <header className="employee-commandbar sticky top-0 z-40 border-b border-[var(--border-strong)] bg-[var(--surface)]">
          <div className="flex min-h-20 items-center gap-4 px-5 sm:px-7 lg:px-9">
            <Link
              href="/employee"
              className="flex h-10 w-10 shrink-0 items-center justify-center border border-[var(--accent)] bg-[var(--accent)] text-white lg:hidden"
              aria-label="Open employee portal"
            >
              <ShieldCheck size={19} />
            </Link>

            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[var(--accent)]">
                Employee portal
              </p>
              <div className="mt-1 flex items-end gap-3">
                <p className="truncate text-xl font-black tracking-[-0.04em] text-[var(--text)] sm:text-2xl">
                  {activeItem.label}
                </p>
                <p className="mb-0.5 hidden truncate text-sm font-medium text-[var(--muted)] xl:block">
                  {activeItem.description}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {canAccessAdmin ? (
                <Link
                  href="/dashboard"
                  className="hidden h-10 items-center gap-2 border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm font-extrabold text-[var(--text-soft)] hover:border-[var(--accent)] hover:text-[var(--accent)] sm:flex lg:hidden"
                >
                  <LayoutDashboard size={16} />
                  Admin
                </Link>
              ) : null}
              <Link
                href="/employee/notifications"
                className="relative flex h-10 w-10 items-center justify-center border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                aria-label="Employee notifications"
                title="Notifications"
              >
                <Bell size={17} />
                {unreadCount > 0 ? (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center bg-red-600 px-1 text-[10px] font-black text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                ) : null}
              </Link>
              <ThemeToggle />
              <button
                type="button"
                onClick={logout}
                className="flex h-10 w-10 items-center justify-center border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text)] hover:border-red-500 hover:text-red-700 lg:hidden"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>

          <nav className="flex gap-1 overflow-x-auto border-t border-[var(--border)] px-4 lg:hidden">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActiveRoute(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-12 shrink-0 items-center gap-2 border-b-[3px] px-3 text-sm font-bold ${
                    active
                      ? "border-[var(--accent)] text-[var(--accent)]"
                      : "border-transparent text-[var(--muted)]"
                  }`}
                >
                  <Icon size={16} />
                  {item.shortLabel}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="min-h-[calc(100vh-5rem)] px-5 py-6 sm:px-7 lg:px-9 lg:py-8">
          <div className="employee-content">{children}</div>
        </main>
      </div>

      <NotificationToast
        notification={latestNotification}
        onDismiss={dismissLatest}
        onOpen={openNotification}
      />
    </div>
  );
}
