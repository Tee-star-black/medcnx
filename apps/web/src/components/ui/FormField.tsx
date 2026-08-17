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

export function FormField({
  label,
  htmlFor,
  required,
  optional,
  hint,
  error,
  children,
}: FormFieldProps) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label
          htmlFor={htmlFor}
          className="text-sm font-extrabold text-[var(--text-soft)]"
        >
          {label}
          {required ? <span className="ml-1 text-red-700">*</span> : null}
        </label>
        {optional ? (
          <span className="text-xs font-semibold text-[var(--muted)]">
            Optional
          </span>
        ) : null}
      </div>
      {children}
      {error ? (
        <p className="mt-2 text-sm font-bold text-red-700">{error}</p>
      ) : hint ? (
        <p className="mt-2 text-sm font-medium text-[var(--muted)]">{hint}</p>
      ) : null}
    </div>
  );
}
