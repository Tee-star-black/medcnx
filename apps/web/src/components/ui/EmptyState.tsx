import type { ReactNode } from "react";

type EmptyStateProps = {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="border border-dashed border-[var(--border-strong)] bg-[var(--surface-soft)] px-6 py-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--accent)]">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-extrabold text-[var(--text)]">{title}</h3>
      <p className="mx-auto mt-2 max-w-lg text-sm font-medium leading-6 text-[var(--muted)]">
        {description}
      </p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}
