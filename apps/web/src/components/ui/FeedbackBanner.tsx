import {
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
} from "lucide-react";
import type { ReactNode } from "react";

type FeedbackTone = "success" | "error" | "warning" | "info";

type FeedbackBannerProps = {
  tone: FeedbackTone;
  title: string;
  message: string;
  actions?: ReactNode;
};

const tones = {
  success: {
    className: "border-emerald-300 bg-emerald-50 text-emerald-950",
    icon: CheckCircle2,
  },
  error: {
    className: "border-red-300 bg-red-50 text-red-950",
    icon: XCircle,
  },
  warning: {
    className: "border-amber-300 bg-amber-50 text-amber-950",
    icon: AlertTriangle,
  },
  info: {
    className: "border-blue-300 bg-blue-50 text-blue-950",
    icon: Info,
  },
} satisfies Record<
  FeedbackTone,
  { className: string; icon: typeof Info }
>;

export function FeedbackBanner({
  tone,
  title,
  message,
  actions,
}: FeedbackBannerProps) {
  const config = tones[tone];
  const Icon = config.icon;

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`border border-l-4 px-5 py-4 ${config.className}`}
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 shrink-0" size={20} />
        <div className="min-w-0 flex-1">
          <p className="font-extrabold">{title}</p>
          <p className="mt-1 text-sm font-medium leading-6">{message}</p>
          {actions ? <div className="mt-4 flex flex-wrap gap-3">{actions}</div> : null}
        </div>
      </div>
    </div>
  );
}
