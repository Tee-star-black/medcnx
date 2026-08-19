type StatusBadgeProps = {
  status: string;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const formattedStatus = status.replaceAll('_', ' ');

  const isActive = status === 'ACTIVE';
  const isWarning = status === 'SUSPENDED' || status === 'ON_LEAVE';
  const isInactive = status === 'TERMINATED' || status === 'RESIGNED';

  const className = isActive
    ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
    : isWarning
      ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
      : isInactive
        ? 'border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300'
        : 'border-[var(--border-strong)] bg-[var(--surface-soft)] text-[var(--text-soft)]';

  return (
    <span
      className={`inline-flex items-center gap-2 border px-2.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.09em] ${className}`}
    >
      <span className="h-1.5 w-1.5 bg-current" aria-hidden="true" />
      {formattedStatus}
    </span>
  );
}
