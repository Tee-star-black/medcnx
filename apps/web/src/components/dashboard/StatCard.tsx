type StatCardProps = {
  title: string;
  value: string;
  description: string;
  icon?: React.ReactNode;
};

export function StatCard({ title, value, description, icon }: StatCardProps) {
  return (
    <div className="group relative min-h-44 border border-[var(--border-strong)] bg-[var(--surface)] p-5 transition hover:border-[var(--accent)] hover:shadow-[var(--shadow-sm)]">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-[var(--accent)]" />

      <div className="flex items-start justify-between gap-4 pt-1">
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--muted)]">
            {title}
          </p>
          <p className="mt-3 text-[2rem] font-black leading-none tracking-[-0.055em] text-[var(--text)] sm:text-[2.25rem]">
            {value}
          </p>
        </div>

        {icon ? (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[var(--border-strong)] bg-[var(--surface-soft)] text-[var(--accent)] transition group-hover:border-[var(--accent)]">
            {icon}
          </div>
        ) : null}
      </div>

      <p className="mt-5 border-t border-[var(--border)] pt-3 text-sm font-medium leading-6 text-[var(--muted)]">
        {description}
      </p>
    </div>
  );
}
