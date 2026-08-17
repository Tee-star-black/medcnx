"use client";

import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "quiet";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  icon?: ReactNode;
  loading?: boolean;
};

const variants: Record<ButtonVariant, string> = {
  primary:
    "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-text)] hover:border-[var(--accent-hover)] hover:bg-[var(--accent-hover)]",
  secondary:
    "border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text-soft)] hover:border-[var(--accent)] hover:text-[var(--accent)]",
  danger:
    "border-red-700 bg-red-700 text-white hover:border-red-800 hover:bg-red-800",
  quiet:
    "border-transparent bg-transparent text-[var(--text-soft)] hover:border-[var(--border)] hover:bg-[var(--surface-soft)] hover:text-[var(--text)]",
};

export function Button({
  variant = "secondary",
  icon,
  loading,
  disabled,
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`inline-flex min-h-11 items-center justify-center gap-2 border px-4 text-sm font-extrabold transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
    >
      {loading ? <Loader2 className="animate-spin" size={17} /> : icon}
      {children}
    </button>
  );
}
