type StatCardProps = {
  title: string;
  value: string;
  description: string;
  icon?: React.ReactNode;
};

export function StatCard({ title, value, description, icon }: StatCardProps) {
  return (
    <div className="med-card group relative overflow-hidden p-5">
      <span className="absolute left-0 top-0 h-full w-1 bg-[var(--accent)] transition-[width] group-hover:w-1.5" />
      {icon ? (
        <div className="mb-4 flex h-10 w-10 items-center justify-center border border-[var(--border-strong)] bg-[var(--accent-soft)] text-[var(--accent)]">
          {icon}
        </div>
      ) : null}

      <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--text-soft)]">{title}</p>

      <p className="mt-2 text-3xl font-black tracking-[-0.05em] text-[var(--text)]">
        {value}
      </p>

      <p className="mt-2 text-sm font-medium leading-6 text-[var(--muted)]">{description}</p>
    </div>
  );
}
