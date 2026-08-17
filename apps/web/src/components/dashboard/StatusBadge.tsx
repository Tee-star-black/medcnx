type StatusBadgeProps = {
  status: string;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const formattedStatus = status.replace('_', ' ');

  const isActive = status === 'ACTIVE';
  const isWarning = status === 'SUSPENDED' || status === 'ON_LEAVE';
  const isInactive = status === 'TERMINATED' || status === 'RESIGNED';

  const className = isActive
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : isWarning
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : isInactive
        ? 'border-red-200 bg-red-50 text-red-700'
        : 'border-[var(--border)] bg-[var(--surface-soft)] text-[var(--text-soft)]';

  return (
    <span
      className={`inline-flex border border-l-[3px] px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.05em] ${className}`}
    >
      {formattedStatus}
    </span>
  );
}
