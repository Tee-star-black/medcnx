"use client";

import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

type DrawerProps = {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
};

export function Drawer({
  open,
  title,
  description,
  children,
  footer,
  onClose,
}: DrawerProps) {
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80]">
      <button
        type="button"
        className="absolute inset-0 h-full w-full cursor-default bg-[#061d27]/55"
        aria-label="Close drawer"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l border-[var(--border-strong)] bg-[var(--surface)] shadow-[-20px_0_50px_rgba(6,35,47,0.18)]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-6 py-5">
          <div>
            <h2 id="drawer-title" className="text-xl font-black">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-sm font-medium text-[var(--muted)]">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center border border-[var(--border-strong)] bg-[var(--surface-soft)] text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
            aria-label="Close drawer"
            title="Close"
          >
            <X size={18} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">{children}</div>
        {footer ? (
          <footer className="border-t border-[var(--border)] bg-[var(--surface-soft)] px-6 py-4">
            {footer}
          </footer>
        ) : null}
      </aside>
    </div>
  );
}
