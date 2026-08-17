'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Calculator,
  CalendarRange,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileSearch,
  LockKeyhole,
  Plus,
  ReceiptText,
  ShieldCheck,
  UsersRound,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { can } from '@/lib/permissions';
import type { AuthUser } from '@/types/auth';

type PayrollAction = {
  title: string;
  eyebrow: string;
  description: string;
  href: string;
  icon: LucideIcon;
  permission?: string;
  featured?: boolean;
};

const payrollActions: PayrollAction[] = [
  {
    title: 'Payroll runs',
    eyebrow: 'Periods and history',
    description:
      'View current and previous payroll periods, monitor their status and open individual payroll runs.',
    href: '/dashboard/payroll/runs',
    icon: CalendarRange,
    permission: 'payroll:read',
    featured: true,
  },
  {
    title: 'Create payroll run',
    eyebrow: 'New payroll period',
    description:
      'Start a new payroll run for the selected month and year.',
    href: '/dashboard/payroll/runs',
    icon: Plus,
    permission: 'payroll:create',
  },
  {
    title: 'Payroll calculator',
    eyebrow: 'Earnings and deductions',
    description:
      'Calculate earnings, PAYE, UIF, deductions, contributions and employee net pay.',
    href: '/dashboard/payroll/run',
    icon: Calculator,
    permission: 'payroll:calculate',
  },
  {
    title: 'Compensation profiles',
    eyebrow: 'Employee compensation',
    description:
      'Review employee salaries, payment frequencies, benefits and standard deductions.',
    href: '/dashboard/employees',
    icon: CircleDollarSign,
    permission: 'compensation:read',
  },
  {
    title: 'Payslips',
    eyebrow: 'Payroll documents',
    description:
      'View generated employee payslips and access completed payroll documents.',
    href: '/dashboard/payslips',
    icon: ReceiptText,
    permission: 'payslips:view-all',
  },
  {
    title: 'Payroll reports',
    eyebrow: 'Reporting and analysis',
    description:
      'Review payroll totals, deductions, employer costs and payment information.',
    href: '/dashboard/reports',
    icon: BarChart3,
    permission: 'payroll:view-reports',
  },
];

const workflowStages = [
  {
    number: '01',
    title: 'Prepare',
    description:
      'Create the payroll period and confirm the employees included in the run.',
    icon: UsersRound,
  },
  {
    number: '02',
    title: 'Calculate',
    description:
      'Calculate salary, PAYE, UIF, benefits, deductions and employer costs.',
    icon: Calculator,
  },
  {
    number: '03',
    title: 'Audit',
    description:
      'Run payroll intelligence checks and investigate unusual findings.',
    icon: FileSearch,
  },
  {
    number: '04',
    title: 'Review',
    description:
      'Complete the HR and finance review stages before submission.',
    icon: ShieldCheck,
  },
  {
    number: '05',
    title: 'Approve',
    description:
      'Send the protected approval request to the assigned payroll approver.',
    icon: LockKeyhole,
  },
  {
    number: '06',
    title: 'Finalise',
    description:
      'Finalise the run and make completed payslips available.',
    icon: CheckCircle2,
  },
];

function readSavedUser(): AuthUser | null {
  if (
    typeof window === 'undefined'
  ) {
    return null;
  }

  const savedUser =
    window.localStorage.getItem(
      'medcnx_user',
    );

  if (!savedUser) {
    return null;
  }

  try {
    return JSON.parse(
      savedUser,
    ) as AuthUser;
  } catch {
    window.localStorage.removeItem(
      'medcnx_user',
    );

    return null;
  }
}

function PayrollActionCard({
  action,
}: {
  action: PayrollAction;
}) {
  const Icon = action.icon;

  if (action.featured) {
    return (
      <Link
        href={action.href}
        className="group relative flex min-h-64 flex-col justify-between overflow-hidden border border-[#111827] bg-[#111827] p-6 text-white shadow-[5px_5px_0_var(--accent)] transition duration-200 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0_var(--accent)] dark:border-white dark:bg-white dark:text-[#111827] sm:p-7"
      >
        <div className="flex items-start justify-between gap-5">
          <div className="flex h-12 w-12 items-center justify-center border border-white/25 bg-white/10 dark:border-[#111827]/20 dark:bg-[#111827]/5">
            <Icon
              size={22}
              strokeWidth={1.8}
            />
          </div>

          <div className="flex h-10 w-10 items-center justify-center border border-white/25 dark:border-[#111827]/20">
            <ArrowRight
              size={18}
              className="transition-transform duration-200 group-hover:translate-x-1"
            />
          </div>
        </div>

        <div className="mt-10">
          <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/60 dark:text-[#111827]/60">
            {action.eyebrow}
          </p>

          <h2 className="mt-3 text-2xl font-black tracking-[-0.04em]">
            {action.title}
          </h2>

          <p className="mt-3 max-w-md text-sm font-medium leading-6 text-white/75 dark:text-[#111827]/70">
            {action.description}
          </p>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={action.href}
      className="group flex min-h-64 flex-col justify-between border border-[var(--border)] bg-[var(--surface)] p-6 text-[var(--text)] transition duration-200 hover:-translate-y-0.5 hover:border-[var(--text)] hover:bg-[var(--surface-soft)] sm:p-7"
    >
      <div className="flex items-start justify-between gap-5">
        <div className="flex h-12 w-12 items-center justify-center border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--accent)] transition group-hover:border-[var(--accent)]">
          <Icon
            size={22}
            strokeWidth={1.8}
          />
        </div>

        <div className="flex h-10 w-10 items-center justify-center border border-[var(--border)] text-[var(--muted)] transition group-hover:border-[var(--text)] group-hover:text-[var(--text)]">
          <ArrowRight
            size={18}
            className="transition-transform duration-200 group-hover:translate-x-1"
          />
        </div>
      </div>

      <div className="mt-10">
        <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-[var(--muted)]">
          {action.eyebrow}
        </p>

        <h2 className="mt-3 text-xl font-black tracking-[-0.035em] text-[var(--text)]">
          {action.title}
        </h2>

        <p className="mt-3 text-sm font-medium leading-6 text-[var(--muted)]">
          {action.description}
        </p>
      </div>
    </Link>
  );
}

function PayrollHeaderButtons({
  canCreatePayroll,
}: {
  canCreatePayroll: boolean;
}) {
  return (
    <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
      <Link
        href="/dashboard/payroll/runs"
        className="inline-flex h-11 items-center justify-center gap-2 border border-[var(--border)] bg-[var(--surface)] px-5 text-sm font-semibold text-[var(--text)] transition-colors hover:border-[var(--text)] hover:bg-[var(--surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
      >
        <CalendarRange
          size={17}
          strokeWidth={1.8}
        />

        View payroll runs
      </Link>

      {canCreatePayroll ? (
        <Link
          href="/dashboard/payroll/runs"
          className="inline-flex h-11 items-center justify-center gap-2 border border-[var(--accent)] bg-[var(--accent)] px-5 text-sm font-semibold text-white transition-colors hover:border-[#183c70] hover:bg-[#183c70] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] dark:text-white"
        >
          <Plus
            size={17}
            strokeWidth={2}
          />

          Create payroll run
        </Link>
      ) : null}
    </div>
  );
}

export default function PayrollPage() {
  const [user, setUser] =
    useState<AuthUser | null>(null);

  useEffect(() => {
    setUser(readSavedUser());
  }, []);

  const availableActions =
    useMemo(
      () =>
        payrollActions.filter(
          (action) =>
            !action.permission ||
            can(
              user,
              action.permission,
            ),
        ),
      [user],
    );

  const canCreatePayroll =
    can(user, 'payroll:create');

  const organisationName =
    user?.organisation?.name ??
    'MedCNX Workspace';

  return (
    <DashboardShell
      activePage="payroll"
      user={user}
    >
      <div className="space-y-8">
        <section className="border border-[var(--border)] bg-[var(--surface)]">
          <div className="flex flex-col gap-8 px-6 py-7 sm:px-8 sm:py-9 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3">
                <span className="h-px w-8 bg-[var(--accent)]" />

                <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-[var(--accent)]">
                  Payroll command centre
                </p>
              </div>

              <h1 className="mt-5 text-3xl font-black tracking-[-0.055em] text-[var(--text)] sm:text-4xl">
                Payroll operations
              </h1>

              <p className="mt-4 max-w-2xl text-sm font-medium leading-7 text-[var(--muted)] sm:text-base">
                Prepare, calculate, review and finalise payroll
                for {organisationName}. Every payroll action is
                protected by role-based permissions and
                organisation-level controls.
              </p>
            </div>

            <PayrollHeaderButtons
              canCreatePayroll={
                canCreatePayroll
              }
            />
          </div>

          <div className="grid border-t border-[var(--border)] sm:grid-cols-3">
            <div className="border-b border-[var(--border)] p-5 sm:border-b-0 sm:border-r">
              <div className="flex items-center gap-3">
                <WalletCards
                  size={18}
                  className="text-[var(--accent)]"
                />

                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                  Controlled access
                </p>
              </div>

              <p className="mt-2 text-sm font-bold text-[var(--text)]">
                Permission-based payroll actions
              </p>
            </div>

            <div className="border-b border-[var(--border)] p-5 sm:border-b-0 sm:border-r">
              <div className="flex items-center gap-3">
                <ShieldCheck
                  size={18}
                  className="text-[var(--accent)]"
                />

                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                  Secure workflow
                </p>
              </div>

              <p className="mt-2 text-sm font-bold text-[var(--text)]">
                HR, finance and executive review
              </p>
            </div>

            <div className="p-5">
              <div className="flex items-center gap-3">
                <Clock3
                  size={18}
                  className="text-[var(--accent)]"
                />

                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                  Audit history
                </p>
              </div>

              <p className="mt-2 text-sm font-bold text-[var(--text)]">
                Traceable payroll activity
              </p>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--accent)]">
                Payroll tools
              </p>

              <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--text)]">
                Manage payroll
              </h2>
            </div>

            <p className="max-w-lg text-sm font-medium leading-6 text-[var(--muted)]">
              Only the payroll tools permitted for your current
              role are displayed.
            </p>
          </div>

          {availableActions.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {availableActions.map(
                (action) => (
                  <PayrollActionCard
                    key={action.title}
                    action={action}
                  />
                ),
              )}
            </div>
          ) : (
            <div className="border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--muted)]">
                <LockKeyhole
                  size={23}
                />
              </div>

              <h2 className="mt-4 text-lg font-black text-[var(--text)]">
                Payroll access is restricted
              </h2>

              <p className="mx-auto mt-2 max-w-lg text-sm font-medium leading-6 text-[var(--muted)]">
                Your current role does not contain any payroll
                management permissions. Contact an organisation
                administrator if you require access.
              </p>
            </div>
          )}
        </section>

        <section className="border border-[var(--border)] bg-[var(--surface)]">
          <div className="border-b border-[var(--border)] px-6 py-6 sm:px-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--accent)]">
              Payroll workflow
            </p>

            <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--text)]">
              From preparation to finalisation
            </h2>

            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[var(--muted)]">
              Every payroll period follows a controlled sequence
              before employee payments and payslips are released.
            </p>
          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-3">
            {workflowStages.map(
              (stage, index) => {
                const Icon =
                  stage.icon;

                const hasBottomBorder =
                  index <
                  workflowStages.length -
                    3;

                return (
                  <div
                    key={stage.number}
                    className={`p-6 sm:p-7 ${
                      hasBottomBorder
                        ? 'border-b border-[var(--border)]'
                        : ''
                    } ${
                      index % 3 !== 2
                        ? 'xl:border-r xl:border-[var(--border)]'
                        : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-5">
                      <div className="flex h-11 w-11 items-center justify-center border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--accent)]">
                        <Icon
                          size={20}
                        />
                      </div>

                      <span className="text-xs font-black tracking-[0.18em] text-[var(--muted)]">
                        {stage.number}
                      </span>
                    </div>

                    <h3 className="mt-7 text-lg font-black text-[var(--text)]">
                      {stage.title}
                    </h3>

                    <p className="mt-2 text-sm font-medium leading-6 text-[var(--muted)]">
                      {stage.description}
                    </p>
                  </div>
                );
              },
            )}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}