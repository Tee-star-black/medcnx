"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

type DataTableProps = {
  children: ReactNode;
  caption?: string;
  empty?: ReactNode;
  rowCount: number;
};

type PaginationProps = {
  page: number;
  pageCount: number;
  totalItems: number;
  onPageChange: (page: number) => void;
};

export function DataTable({
  children,
  caption,
  empty,
  rowCount,
}: DataTableProps) {
  if (rowCount === 0 && empty) {
    return <>{empty}</>;
  }

  return (
    <div className="clinical-data-table max-h-[68vh] overflow-auto border border-[var(--border)] bg-[var(--surface)]">
      <table className="min-w-full">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        {children}
      </table>
    </div>
  );
}

export function Pagination({
  page,
  pageCount,
  totalItems,
  onPageChange,
}: PaginationProps) {
  return (
    <div className="flex flex-col gap-3 border-t border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-semibold text-[var(--muted)]">
        {totalItems} record{totalItems === 1 ? "" : "s"} · Page {page} of{" "}
        {Math.max(pageCount, 1)}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="flex h-10 items-center gap-2 border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm font-bold text-[var(--text-soft)] hover:border-[var(--accent)] disabled:opacity-40"
        >
          <ChevronLeft size={16} />
          Previous
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          className="flex h-10 items-center gap-2 border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm font-bold text-[var(--text-soft)] hover:border-[var(--accent)] disabled:opacity-40"
        >
          Next
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
