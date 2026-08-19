'use client';

import { useMemo, useState, type FormEvent } from 'react';
import {
  ArrowRightLeft,
  BriefcaseBusiness,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';

type ChangeAction = 'PROMOTE' | 'TRANSFER' | 'EMPLOYMENT_TYPE';

type Position = {
  id: string;
  code: string;
  title: string;
  departmentId?: string | null;
  active: boolean;
  approvedHeadcount: number;
  currentHeadcount: number;
  department?: { id: string; name: string } | null;
};

type EmployeeTarget = {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle?: string | null;
  employmentType?: string | null;
  employmentStatus: string;
  startDate?: string | null;
  department?: { id: string; name: string } | null;
};

type Props = {
  employee: EmployeeTarget;
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
  ChangeAction,
  {
    title: string;
    helper: string;
    submitLabel: string;
  }
> = {
  PROMOTE: {
    title: 'Promote / change position',
    helper:
      'Move the employee to another position in the current department while preserving assignment history.',
    submitLabel: 'Record position change',
  },
  TRANSFER: {
    title: 'Transfer department',
    helper:
      'Move the employee to a position in another department so position, title and department remain aligned.',
    submitLabel: 'Record transfer',
  },
  EMPLOYMENT_TYPE: {
    title: 'Change employment type',
    helper:
      'Record a change such as full-time, part-time, fixed-term or contract.',
    submitLabel: 'Change employment type',
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

function remainingCapacity(position: Position) {
  return Math.max(position.approvedHeadcount - position.currentHeadcount, 0);
}

export function EmployeeEmploymentChanges({
  employee,
  onChanged,
  onError,
}: Props) {
  const [action, setAction] = useState<ChangeAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [positionsLoading, setPositionsLoading] = useState(false);
  const [positions, setPositions] = useState<Position[]>([]);
  const [effectiveDate, setEffectiveDate] = useState(todayIsoDate());
  const [reason, setReason] = useState('');
  const [positionId, setPositionId] = useState('');
  const [employmentType, setEmploymentType] = useState('');

  const today = todayIsoDate();
  const config = action ? actionConfig[action] : null;
  const employmentClosed = ['TERMINATED', 'RESIGNED'].includes(
    employee.employmentStatus,
  );

  const eligiblePositions = useMemo(() => {
    const currentDepartmentId = employee.department?.id ?? null;
    return positions.filter((position) => {
      if (!position.active || remainingCapacity(position) <= 0) return false;
      if (action === 'PROMOTE') {
        return (
          (position.departmentId ?? null) === currentDepartmentId &&
          position.title !== employee.jobTitle
        );
      }
      if (action === 'TRANSFER') {
        return (
          Boolean(position.departmentId) &&
          position.departmentId !== currentDepartmentId
        );
      }
      return false;
    });
  }, [action, employee.department?.id, employee.jobTitle, positions]);

  const selectedPosition = useMemo(
    () => positions.find((position) => position.id === positionId) ?? null,
    [positionId, positions],
  );

  const formError = useMemo(() => {
    if (!action) return '';
    if (!effectiveDate) return 'An effective date is required.';
    if (effectiveDate > today) {
      return 'Future-dated employment changes are not supported yet.';
    }
    if (employee.startDate && effectiveDate < employee.startDate.slice(0, 10)) {
      return 'The effective date cannot be before the employee start date.';
    }
    if (reason.trim().length < 3) {
      return 'Provide a reason of at least 3 characters.';
    }

    if (action === 'PROMOTE' || action === 'TRANSFER') {
      if (!positionId) return 'Select the destination position.';
      if (!selectedPosition) return 'Select a valid destination position.';
      if (remainingCapacity(selectedPosition) <= 0) {
        return 'The selected position has no approved headcount capacity remaining.';
      }
    }

    if (action === 'EMPLOYMENT_TYPE') {
      const nextType = employmentType.trim();
      if (nextType.length < 2) return 'Provide the new employment type.';
      if (nextType === (employee.employmentType ?? '').trim()) {
        return 'The new employment type must differ from the current employment type.';
      }
    }

    return '';
  }, [
    action,
    effectiveDate,
    employee.employmentType,
    employee.startDate,
    employmentType,
    positionId,
    reason,
    selectedPosition,
    today,
  ]);

  async function loadPositions() {
    if (positions.length || positionsLoading) return;
    setPositionsLoading(true);
    try {
      const response = await api.get<Position[]>('/positions');
      setPositions(response.data);
    } catch (error: unknown) {
      onError(
        readError(error, 'Could not load positions for this employment change.'),
      );
    } finally {
      setPositionsLoading(false);
    }
  }

  function openAction(nextAction: ChangeAction) {
    setAction(nextAction);
    setEffectiveDate(todayIsoDate());
    setReason('');
    setPositionId('');
    setEmploymentType('');
    onError('');
    if (nextAction === 'PROMOTE' || nextAction === 'TRANSFER') {
      void loadPositions();
    }
  }

  function close() {
    if (busy) return;
    setAction(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action || !config || formError) return;

    const destination = selectedPosition
      ? ` to ${selectedPosition.title}${selectedPosition.department?.name ? ` (${selectedPosition.department.name})` : ''}`
      : '';
    const confirmed = window.confirm(
      `${config.title} for ${employee.firstName} ${employee.lastName}${destination} effective ${effectiveDate}? This change will be written to employment history.`,
    );
    if (!confirmed) return;

    setBusy(true);
    onError('');
    try {
      if (action === 'PROMOTE' || action === 'TRANSFER') {
        await api.post(`/positions/assignments/${employee.id}`, {
          positionId,
          effectiveDate,
          reason: reason.trim(),
        });
        setAction(null);
        setPositions([]);
        await onChanged(
          action === 'TRANSFER'
            ? `Employee transferred to ${selectedPosition?.title ?? 'the selected position'} successfully.`
            : `Employee position changed to ${selectedPosition?.title ?? 'the selected position'} successfully.`,
        );
      } else {
        const response = await api.post<{ message?: string }>(
          `/employees/${employee.id}/employment/type`,
          {
            effectiveDate,
            reason: reason.trim(),
            employmentType: employmentType.trim(),
          },
        );
        setAction(null);
        await onChanged(
          response.data?.message || 'Employment type changed successfully.',
        );
      }
    } catch (error: unknown) {
      onError(readError(error, `Could not ${config.title.toLowerCase()}.`));
      if (action === 'PROMOTE' || action === 'TRANSFER') {
        setPositions([]);
        setPositionId('');
      }
    } finally {
      setBusy(false);
    }
  }

  if (employmentClosed) {
    return (
      <div className="border border-black/10 bg-[#f8fafc] p-4 text-sm leading-6 text-gray-600">
        Employment is closed. Position, transfer and employment-type changes are no longer available.
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-3">
        <ChangeButton
          title="Promote / change position"
          helper={
            employee.jobTitle
              ? `Current title: ${employee.jobTitle}`
              : 'No current job title recorded.'
          }
          icon={<BriefcaseBusiness size={16} />}
          onClick={() => openAction('PROMOTE')}
        />
        <ChangeButton
          title="Transfer department"
          helper={
            employee.department
              ? `Current department: ${employee.department.name}`
              : 'No current department assigned.'
          }
          icon={<ArrowRightLeft size={16} />}
          onClick={() => openAction('TRANSFER')}
        />
        <ChangeButton
          title="Change employment type"
          helper={
            employee.employmentType
              ? `Current type: ${employee.employmentType}`
              : 'No current employment type recorded.'
          }
          icon={<RefreshCw size={16} />}
          onClick={() => openAction('EMPLOYMENT_TYPE')}
        />
      </div>

      {action && config ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-end bg-black/25 sm:p-5">
          <div className="max-h-[92vh] w-full overflow-y-auto bg-white shadow-2xl sm:max-w-lg">
            <div className="flex items-start justify-between gap-4 border-b border-black/10 p-6">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-gray-400">
                  Employment change
                </p>
                <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[#111827]">
                  {config.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-gray-500">
                  {config.helper}
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                disabled={busy}
                className="border border-black/10 p-2 text-gray-500 transition hover:border-black hover:text-black disabled:opacity-50"
                aria-label="Close employment change"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={submit} className="space-y-5 p-6">
              {action === 'PROMOTE' || action === 'TRANSFER' ? (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
                    Destination position
                  </label>
                  <select
                    required
                    value={positionId}
                    onChange={(event) => setPositionId(event.target.value)}
                    disabled={positionsLoading}
                    className="mt-2 h-11 w-full border border-black/10 bg-[#f8fafc] px-3 text-sm outline-none transition focus:border-black disabled:opacity-60"
                  >
                    <option value="">
                      {positionsLoading
                        ? 'Loading positions...'
                        : 'Select destination position'}
                    </option>
                    {eligiblePositions.map((position) => (
                      <option key={position.id} value={position.id}>
                        {position.code} · {position.title}
                        {position.department?.name
                          ? ` · ${position.department.name}`
                          : ''}{' '}
                        · {remainingCapacity(position)} of{' '}
                        {position.approvedHeadcount} slot
                        {position.approvedHeadcount === 1 ? '' : 's'} available
                      </option>
                    ))}
                  </select>
                  {!positionsLoading && eligiblePositions.length === 0 ? (
                    <p className="mt-2 text-xs leading-5 text-amber-700">
                      No eligible destination positions with approved headcount capacity are currently available for this change.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {action === 'EMPLOYMENT_TYPE' ? (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
                    New employment type
                  </label>
                  <input
                    required
                    minLength={2}
                    maxLength={100}
                    list="employment-type-options"
                    value={employmentType}
                    onChange={(event) => setEmploymentType(event.target.value)}
                    placeholder="e.g. FULL_TIME"
                    className="mt-2 h-11 w-full border border-black/10 bg-[#f8fafc] px-3 text-sm outline-none transition focus:border-black"
                  />
                  <datalist id="employment-type-options">
                    <option value="FULL_TIME" />
                    <option value="PART_TIME" />
                    <option value="FIXED_TERM" />
                    <option value="CONTRACT" />
                    <option value="CASUAL" />
                    <option value="INTERN" />
                  </datalist>
                </div>
              ) : null}

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
                  rows={4}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Document the business or HR reason for this change."
                  className="mt-2 w-full border border-black/10 bg-[#f8fafc] px-3 py-3 text-sm outline-none transition focus:border-black"
                />
              </div>

              {selectedPosition &&
              (action === 'PROMOTE' || action === 'TRANSFER') ? (
                <div className="border border-black/10 bg-[#f8fafc] px-4 py-3 text-sm leading-6 text-gray-600">
                  This will close the current position assignment, open the selected assignment, update the employee job title, and align the department to the destination position when required. The backend rechecks approved headcount capacity transactionally before committing the move.
                </div>
              ) : null}

              {formError ? (
                <div className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {formError}
                </div>
              ) : null}

              <div className="flex flex-col-reverse gap-3 border-t border-black/10 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={close}
                  disabled={busy}
                  className="border border-black/10 bg-white px-5 py-3 text-sm font-medium text-gray-600 hover:border-black disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy || Boolean(formError)}
                  className="inline-flex items-center justify-center gap-2 border border-black bg-black px-5 py-3 text-sm font-medium text-white hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? <Loader2 className="animate-spin" size={16} /> : null}
                  {config.submitLabel}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ChangeButton({
  title,
  helper,
  icon,
  onClick,
}: {
  title: string;
  helper: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 border border-black/10 bg-[#f8fafc] px-4 py-3 text-left text-gray-700 transition hover:border-black hover:text-black"
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-1 block text-xs leading-5 opacity-70">{helper}</span>
      </span>
    </button>
  );
}
