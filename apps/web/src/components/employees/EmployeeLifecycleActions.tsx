'use client';

import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Ban, Loader2, RotateCcw, UserMinus, X } from 'lucide-react';
import { EmployeeEmploymentChanges } from '@/components/employees/EmployeeEmploymentChanges';
import { Button, FormField } from '@/components/ui';
import { api } from '@/lib/api';

type EmploymentStatus =
  | 'ACTIVE'
  | 'ON_LEAVE'
  | 'SUSPENDED'
  | 'RESIGNED'
  | 'TERMINATED';

type LifecycleAction = 'SUSPEND' | 'REACTIVATE' | 'RESIGN' | 'TERMINATE';

type EmployeeLifecycleTarget = {
  id: string;
  firstName: string;
  lastName: string;
  employmentStatus: string;
  startDate?: string | null;
  jobTitle?: string | null;
  employmentType?: string | null;
  department?: { id: string; name: string } | null;
};

type Props = {
  employee: EmployeeLifecycleTarget;
  onChanged: (message: string) => Promise<void> | void;
  onError: (message: string) => void;
};

type ApiError = {
  response?: { data?: { message?: string | string[] } };
};

const actionConfig: Record<
  LifecycleAction,
  {
    label: string;
    buttonLabel: string;
    helper: string;
    endpoint: string;
    danger?: boolean;
    icon: ReactNode;
    allowed: EmploymentStatus[];
  }
> = {
  SUSPEND: {
    label: 'Suspend employee',
    buttonLabel: 'Suspend employee',
    helper: 'Temporarily suspend employment access while preserving the employment record.',
    endpoint: 'suspend',
    danger: true,
    icon: <Ban size={16} />,
    allowed: ['ACTIVE', 'ON_LEAVE'],
  },
  REACTIVATE: {
    label: 'Reactivate employee',
    buttonLabel: 'Reactivate employee',
    helper: 'Restore an employee who is currently suspended.',
    endpoint: 'reactivate',
    icon: <RotateCcw size={16} />,
    allowed: ['SUSPENDED'],
  },
  RESIGN: {
    label: 'Record resignation',
    buttonLabel: 'Record resignation',
    helper: 'Close employment and reporting structure using the employee resignation workflow.',
    endpoint: 'resign',
    danger: true,
    icon: <UserMinus size={16} />,
    allowed: ['ACTIVE', 'ON_LEAVE', 'SUSPENDED'],
  },
  TERMINATE: {
    label: 'Terminate employee',
    buttonLabel: 'Terminate employee',
    helper: 'Close employment, reporting structure, active sessions and access using the termination workflow.',
    endpoint: 'terminate',
    danger: true,
    icon: <UserMinus size={16} />,
    allowed: ['ACTIVE', 'ON_LEAVE', 'SUSPENDED'],
  },
};

function todayIsoDate() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function readError(error: unknown, fallback: string) {
  const message = (error as ApiError).response?.data?.message;
  return Array.isArray(message) ? message.join(' ') : message || fallback;
}

export function EmployeeLifecycleActions({ employee, onChanged, onError }: Props) {
  const [dialogAction, setDialogAction] = useState<LifecycleAction | null>(null);
  const [busyAction, setBusyAction] = useState<LifecycleAction | null>(null);
  const [effectiveDate, setEffectiveDate] = useState(todayIsoDate());
  const [reason, setReason] = useState('');

  const currentStatus = employee.employmentStatus as EmploymentStatus;
  const config = dialogAction ? actionConfig[dialogAction] : null;
  const today = todayIsoDate();

  const formError = useMemo(() => {
    if (!dialogAction) return '';
    if (!effectiveDate) return 'An effective date is required.';
    if (effectiveDate > today) return 'Future-dated lifecycle changes are not supported yet.';
    if (employee.startDate && effectiveDate < employee.startDate.slice(0, 10)) {
      return 'The effective date cannot be before the employee start date.';
    }
    if (reason.trim().length < 3) return 'Provide a reason of at least 3 characters.';
    return '';
  }, [dialogAction, effectiveDate, employee.startDate, reason, today]);

  function openAction(action: LifecycleAction) {
    setDialogAction(action);
    setEffectiveDate(todayIsoDate());
    setReason('');
    onError('');
  }

  function closeDialog() {
    if (busyAction) return;
    setDialogAction(null);
    setReason('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dialogAction || !config || formError) return;

    const confirmation = window.confirm(
      `${config.label} for ${employee.firstName} ${employee.lastName} effective ${effectiveDate}? This action is recorded in employment history.`,
    );
    if (!confirmation) return;

    setBusyAction(dialogAction);
    onError('');

    try {
      const response = await api.post<{ message?: string }>(
        `/employees/${employee.id}/lifecycle/${config.endpoint}`,
        { effectiveDate, reason: reason.trim() },
      );
      const successMessage = response.data?.message || `${config.label} completed successfully.`;
      setDialogAction(null);
      setReason('');
      await onChanged(successMessage);
    } catch (error: unknown) {
      onError(readError(error, `Could not ${config.label.toLowerCase()}.`));
    } finally {
      setBusyAction(null);
    }
  }

  if (currentStatus === 'TERMINATED' || currentStatus === 'RESIGNED') {
    return (
      <div className="space-y-5">
        <div className="border border-[var(--border-strong)] border-l-4 border-l-[var(--muted)] bg-[var(--surface-soft)] px-5 py-4">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--muted)]">Employment closed</p>
          <p className="mt-2 text-sm font-medium leading-6 text-[var(--text-soft)]">
            Historical records remain available. No further lifecycle status action is available from this profile.
          </p>
        </div>
        <EmployeeEmploymentChanges employee={employee} onChanged={onChanged} onError={onError} />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--accent)]">Employment structure</p>
              <p className="mt-1 text-sm font-medium text-[var(--muted)]">Role, position, department and employment type changes.</p>
            </div>
          </div>
          <EmployeeEmploymentChanges employee={employee} onChanged={onChanged} onError={onError} />
        </section>

        <section className="border-t border-[var(--border)] pt-6">
          <div className="mb-4">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--accent)]">Lifecycle controls</p>
            <p className="mt-1 text-sm font-medium text-[var(--muted)]">Controlled status transitions with effective-date and audit history.</p>
          </div>

          <div className="grid gap-3">
            {(Object.keys(actionConfig) as LifecycleAction[])
              .filter((action) => actionConfig[action].allowed.includes(currentStatus))
              .map((action) => {
                const item = actionConfig[action];
                return (
                  <button
                    key={action}
                    type="button"
                    onClick={() => openAction(action)}
                    disabled={Boolean(busyAction)}
                    className={`group flex w-full items-start gap-4 border px-4 py-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      item.danger
                        ? 'border-red-300 bg-red-50 text-red-900 hover:border-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200'
                        : 'border-[var(--border-strong)] bg-[var(--surface-soft)] text-[var(--text)] hover:border-[var(--accent)]'
                    }`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center border ${
                      item.danger
                        ? 'border-red-300 bg-white text-red-700 dark:bg-red-950/20 dark:text-red-300'
                        : 'border-[var(--border-strong)] bg-[var(--surface)] text-[var(--accent)]'
                    }`}>
                      {busyAction === action ? <Loader2 className="animate-spin" size={16} /> : item.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-extrabold">{item.buttonLabel}</span>
                      <span className="mt-1 block text-sm font-medium leading-6 opacity-75">{item.helper}</span>
                    </span>
                  </button>
                );
              })}
          </div>

          <p className="mt-4 border-t border-[var(--border)] pt-4 text-xs font-medium leading-5 text-[var(--muted)]">
            Leave status is managed through the leave workflow. Employment changes and lifecycle actions require an effective date and reason and are written to employment history.
          </p>
        </section>
      </div>

      {dialogAction && config ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-end bg-[#061d27]/55 sm:p-5">
          <div className="max-h-[92vh] w-full overflow-y-auto border border-[var(--border-strong)] bg-[var(--surface)] shadow-[var(--shadow-float)] sm:max-w-lg">
            <header className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-6 py-5">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--accent)]">Employment lifecycle</p>
                <h3 className="mt-2 text-xl font-black tracking-[-0.04em] text-[var(--text)]">{config.label}</h3>
                <p className="mt-2 text-sm font-medium leading-6 text-[var(--muted)]">
                  {employee.firstName} {employee.lastName} · Current status {currentStatus.replaceAll('_', ' ')}
                </p>
              </div>
              <button
                type="button"
                onClick={closeDialog}
                disabled={Boolean(busyAction)}
                className="flex h-10 w-10 shrink-0 items-center justify-center border border-[var(--border-strong)] bg-[var(--surface-soft)] text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
                aria-label="Close lifecycle action"
              >
                <X size={18} />
              </button>
            </header>

            <form onSubmit={submit} className="space-y-5 p-6">
              <FormField label="Effective date" htmlFor="lifecycle-effective-date" required>
                <input
                  id="lifecycle-effective-date"
                  required
                  type="date"
                  max={today}
                  min={employee.startDate?.slice(0, 10)}
                  value={effectiveDate}
                  onChange={(event) => setEffectiveDate(event.target.value)}
                  className="control"
                />
              </FormField>

              <FormField
                label="Reason"
                htmlFor="lifecycle-reason"
                required
                error={formError || undefined}
                hint="This reason becomes part of the audit trail."
              >
                <textarea
                  id="lifecycle-reason"
                  required
                  minLength={3}
                  maxLength={500}
                  rows={5}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Record the HR reason for this lifecycle change."
                  className="control min-h-32 resize-y"
                />
                <p className="mt-2 text-right text-xs font-semibold text-[var(--muted)]">{reason.length}/500</p>
              </FormField>

              {dialogAction === 'RESIGN' || dialogAction === 'TERMINATE' ? (
                <div className="border border-red-300 border-l-4 border-l-red-700 bg-red-50 px-4 py-4 text-sm font-semibold leading-6 text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
                  This closes active employment structure, including position and reporting assignments, and disables linked access according to the backend lifecycle workflow.
                </div>
              ) : null}

              <footer className="flex flex-col-reverse gap-3 border-t border-[var(--border)] pt-5 sm:flex-row sm:justify-end">
                <Button type="button" variant="secondary" onClick={closeDialog} disabled={Boolean(busyAction)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant={config.danger ? 'danger' : 'primary'}
                  loading={Boolean(busyAction)}
                  disabled={Boolean(formError) || Boolean(busyAction)}
                >
                  {config.buttonLabel}
                </Button>
              </footer>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
