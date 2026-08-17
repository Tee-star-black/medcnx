import type { ReactNode } from "react";

type TooltipProps = {
  label: string;
  children: ReactNode;
};

export function Tooltip({ label, children }: TooltipProps) {
  return (
    <span className="group/tooltip relative inline-flex">
      <span aria-label={label}>{children}</span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden -translate-x-1/2 whitespace-nowrap border border-[#31515e] bg-[#082938] px-2.5 py-1.5 text-xs font-bold text-white shadow-lg group-hover/tooltip:block group-focus-within/tooltip:block"
      >
        {label}
      </span>
    </span>
  );
}
