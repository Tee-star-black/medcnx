import Link from "next/link";
import type { ReactNode } from "react";

type PageAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: ReactNode;
};

type PageHeaderProps = {
  category: string;
  title: string;
  description: string;
  primaryAction?: PageAction;
  secondaryAction?: PageAction;
  tools?: ReactNode;
};

function Action({
  action,
  primary,
}: {
  action: PageAction;
  primary?: boolean;
}) {
  const className = primary
    ? "inline-flex min-h-11 items-center justify-center gap-2 border border-[var(--accent)] bg-[var(--accent)] px-5 text-sm font-extrabold text-[var(--accent-text)] hover:border-[var(--accent-hover)] hover:bg-[var(--accent-hover)]"
    : "inline-flex min-h-11 items-center justify-center gap-2 border border-[var(--border-strong)] bg-[var(--surface)] px-5 text-sm font-bold text-[var(--text-soft)] hover:border-[var(--accent)] hover:text-[var(--accent)]";

  if (action.href) {
    return (
      <Link href={action.href} className={className}>
        {action.icon}
        {action.label}
      </Link>
    );
  }

  return (
    <button type="button" onClick={action.onClick} className={className}>
      {action.icon}
      {action.label}
    </button>
  );
}

export function PageHeader({
  category,
  title,
  description,
  primaryAction,
  secondaryAction,
  tools,
}: PageHeaderProps) {
  return (
    <header className="clinical-page-header border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex min-h-[164px] flex-col gap-6 px-6 py-7 lg:flex-row lg:items-end lg:justify-between lg:px-8">
        <div className="max-w-3xl">
          <p className="clinical-page-eyebrow">
            {category}
          </p>
          <h1 className="clinical-page-title">
            {title}
          </h1>
          <p className="clinical-page-description">
            {description}
          </p>
        </div>

        {primaryAction || secondaryAction ? (
          <div className="flex flex-wrap gap-3">
            {secondaryAction ? <Action action={secondaryAction} /> : null}
            {primaryAction ? <Action action={primaryAction} primary /> : null}
          </div>
        ) : null}
      </div>

      {tools ? (
        <div className="border-t border-[var(--border)] bg-[var(--surface-soft)] px-6 py-4 lg:px-7">
          {tools}
        </div>
      ) : null}
    </header>
  );
}
