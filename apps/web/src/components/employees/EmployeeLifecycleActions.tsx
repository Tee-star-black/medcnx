'use client';

import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Ban, Loader2, RotateCcw, UserMinus, X } from 'lucide-react';
import { EmployeeEmploymentChanges } from '@/components/employees/EmployeeEmploymentChanges';
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
  response?: {
    data?: {
      message?: string | string[];
    };
  };
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
    if (effectiveDate > today) {
      return 'Future-dated lifecycle changes are not supported yet.';
    }
    if (employee.startDate && effectiveDate < employee.startDate.slice(0, 10)) {
      return 'The effective date cannot be before the employee start date.';
    }
    if (reason.trim().length < 3) {
      return 'Provide a reason of at least 3 characters.';
    }
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
        {
          effectiveDate,
          reason: reason.trim(),
        },
      );

      const successMessage =
        response.data?.message || `${config.label} completed successfully.`;
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
      <div className="space-y-4">
        <div className="border border-black/10 bg-[#f8fafc] p-4 text-sm leading-6 text-gray-600">
          Employment is closed. Historical records remain available, but no further lifecycle action is available from this profile.
        </div>
        <EmployeeEmploymentChanges
          employee={employee}
          onChanged={onChanged}
          onError={onError}
        />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">
            Employment changes
          </p>
          <EmployeeEmploymentChanges
            employee={employee}
            onChanged={onChanged}
            onError={onError}
          />
        </div>

        <div className="border-t border-black/10 pt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">
            Status transitions
          </p>
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
                    className={`flex w-full items-start gap-3 border px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      item.danger
                        ? 'border-red-200 bg-red-50 text-red-700 hover:border-red-600'
                        : 'border-black/10 bg-[#f8fafc] text-gray-700 hover:border-black hover:text-black'
                    }`}
                  >
                    <span className="mt-0.5 shrink-0">
                      {busyAction === action ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : (
                        item.icon
                      )}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">{item.buttonLabel}</span>
                      <span className="mt-1 block text-xs leading-5 opacity-70">
                        {item.helper}
                      </span>
                    </span>
                  </button>
                );
              })}

            <p className="border-t border-black/10 pt-3 text-xs leading-5 text-gray-500">
              Leave status is managed through the leave workflow. Employment changes and lifecycle actions require an effective date and reason and are written to employment history.
            </p>
          </div>
        </div>
      </div>

      {dialogAction && config ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-end bg-black/25 sm:p-5">
          <div className="max-h-[92vh] w-full overflow-y-auto bg-white shadow-2xl sm:max-w-lg">
            <div className="flex items-start justify-between gap-4 border-b border-black/10 p-6">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Employment lifecycle</p>
                <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[#111827]">
                  {config.label}
                </h3>
                <p className="mt-2 text-sm leading-6 text-gray-500">
                  {employee.firstName} {employee.lastName} · Current status {currentStatus.replaceAll('_', ' ')}
                </p>
              </div>
              <button
                type="button"
                onClick={closeDialog}
                disabled={Boolean(busyAction)}
                className="border border-black/10 p-2 text-gray-500 transition hover:border-black hover:text-black disabled:opacity-50"
                aria-label="Close lifecycle action"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={submit} className="space-y-5 p-6">
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
                  Effective date
                </label>
                <input
                  required
                  type="date"
                  max={today}
                  min={employee.startDate?.slice(0, 10)}
                  value={effectiveDate}
                  onChange={(event) => setEffectiveDate(event.target.value)}
                  className="mt-2 h-11 w-full border border-black/10 bg-[#f8fafc] px-3 text-sm outline-none transition focus:border-black"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
                  Reason
                </label>
                <textarea
                  required
                  minLength={3}
                  maxLength={500}
                  rows={5}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Record the HR reason for this lifecycle change."
                  className="mt-2 w-full border border-black/10 bg-[#f8fafc] px-3 py-3 text-sm outline-none transition focus:border-black"
                />
                <div className="mt-1 flex justify-between gap-3 text-xs text-gray-400">
                  <span>{formError || 'This reason becomes part of the audit trail.'}</span>
                  <span>{reason.length}/500</span>
                </div>
              </div>

              {(dialogAction === 'RESIGN' || dialogAction === 'TERMINATE') ? (
                <div className="border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
                  This closes active employment structure, including position and reporting assignments, and disables linked access according to the backend lifecycle workflow.
                </div>
              ) : null}

              <div className="flex flex-col-reverse gap-3 border-t border-black/10 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeDialog}
                  disabled={Boolean(busyAction)}
                  className="border border-black/10 bg-white px-5 py-3 text-sm font-medium text-gray-600 transition hover:border-black hover:text-black disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={Boolean(formError) || Boolean(busyAction)}
                  className={`inline-flex items-center justify-center gap-2 border px-5 py-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    config.danger
                      ? 'border-red-700 bg-red-700 text-white hover:bg-white hover:text-red-700'
                      : 'border-black bg-black text-white hover:bg-white hover:text-black'
                  }`}
                >
                  {busyAction ? <Loader2 className="animate-spin" size={16} /> : null}
                  {config.buttonLabel}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
