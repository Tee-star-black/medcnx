import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import type { ReactNode } from "react";

type FeedbackTone = "success" | "error" | "warning" | "info";
type FeedbackBannerProps = { tone: FeedbackTone; title: string; message: string; actions?: ReactNode };

const tones = {
  success: { className: "border-emerald-300 bg-emerald-50 text-emerald-950", icon: CheckCircle2 },
  error: { className: "border-red-300 bg-red-50 text-red-950", icon: XCircle },
  warning: { className: "border-amber-300 bg-amber-50 text-amber-950", icon: AlertTriangle },
  info: { className: "border-blue-300 bg-blue-50 text-blue-950", icon: Info },
} satisfies Record<FeedbackTone, { className: string; icon: typeof Info }>;

export function FeedbackBanner({ tone, title, message, actions }: FeedbackBannerProps) {
  const config = tones[tone];
  const Icon = config.icon;

  return (
    <div role={tone === "error" ? "alert" : "status"} className={`relative border border-l-4 px-5 py-4 ${config.className}`}>
      <span className="absolute right-0 top-0 h-[3px] w-10 bg-current opacity-40" aria-hidden="true" />
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-current/25 bg-white/45">
          <Icon size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold uppercase tracking-[0.04em]">{title}</p>
          <p className="mt-1 text-sm font-medium leading-6">{message}</p>
          {actions ? <div className="mt-4 flex flex-wrap gap-3">{actions}</div> : null}
        </div>
      </div>
    </div>
  );
}
