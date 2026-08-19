import type { ReactNode } from "react";

type FormFieldProps = {
  label: string;
  htmlFor: string;
  required?: boolean;
  optional?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
};

export function FormField({ label, htmlFor, required, optional, hint, error, children }: FormFieldProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="text-xs font-extrabold uppercase tracking-[0.08em] text-[var(--text-soft)]">
          {label}
          {required ? <span className="ml-1 text-red-700">*</span> : null}
        </label>
        {optional ? <span className="text-xs font-semibold text-[var(--muted)]">Optional</span> : null}
      </div>
      {children}
      {error ? (
        <p className="border-l-2 border-red-600 pl-2 text-sm font-bold text-red-700">{error}</p>
      ) : hint ? (
        <p className="text-xs font-medium leading-5 text-[var(--muted)]">{hint}</p>
      ) : null}
    </div>
  );
}
