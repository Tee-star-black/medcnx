"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Eye,
  EyeOff,
  FileCheck2,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  Wifi,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { api } from "@/lib/api";
import type { AuthResponse } from "@/types/auth";

function landingPage(user?: AuthResponse["user"]) {
  if (user?.roles.includes("EMPLOYEE")) {
    return "/employee";
  }

  if (
    user?.roles.includes("PAYROLL_APPROVER") ||
    user?.permissions.includes("payroll:approve")
  ) {
    return "/dashboard";
  }

  if (
    !user?.permissions.includes("employees:read") &&
    user?.permissions.includes("payroll:read")
  ) {
    return "/dashboard/payroll";
  }

  return "/dashboard";
}

function MedCnxMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3" aria-label="MedCNX">
      <span className={`relative block ${compact ? "h-7 w-7" : "h-9 w-9"}`}>
        <span className="absolute left-1/2 top-0 h-[42%] w-[34%] -translate-x-1/2 bg-[#17789a]" />
        <span className="absolute bottom-0 left-1/2 h-[42%] w-[34%] -translate-x-1/2 bg-[#102f3e]" />
        <span className="absolute left-0 top-1/2 h-[34%] w-[42%] -translate-y-1/2 bg-white shadow-sm" />
        <span className="absolute right-0 top-1/2 h-[34%] w-[42%] -translate-y-1/2 bg-white shadow-sm" />
      </span>
      <span
        className={`${compact ? "text-lg" : "text-[27px]"} font-semibold tracking-[-0.06em]`}
      >
        MedCNX
      </span>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("medcnx_access_token");
    const savedUser = localStorage.getItem("medcnx_user");

    if (token && savedUser) {
      try {
        const user = JSON.parse(savedUser) as AuthResponse["user"];
        router.replace(landingPage(user));
      } catch {
        localStorage.removeItem("medcnx_access_token");
        localStorage.removeItem("medcnx_user");
      }
    }
  }, [router]);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await api.post<AuthResponse>("/auth/login", {
        email: email.trim(),
        password,
      });

      localStorage.setItem("medcnx_access_token", response.data.accessToken);
      localStorage.setItem("medcnx_refresh_token", response.data.refreshToken);
      localStorage.setItem("medcnx_user", JSON.stringify(response.data.user));
      localStorage.setItem("medcnx_remember_session", String(remember));
      router.replace(landingPage(response.data.user));
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ??
        "Could not sign in. Please check your details and try again.";
      setError(Array.isArray(message) ? message.join(" ") : message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-scene relative min-h-[100svh] overflow-x-hidden text-[#102f3e]">
      <div className="absolute inset-0 bg-[url('/medcnx-clinical-login-bg.png')] bg-cover bg-center" />
      <div className="login-wash absolute inset-0" />

      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <div className="flex items-center gap-4 text-[#102f3e]">
          <MedCnxMark compact />
          <span className="hidden h-5 w-px bg-[#102f3e]/25 sm:block" />
          <span className="hidden text-sm font-medium tracking-[-0.01em] text-[#385361] sm:block">
            Healthcare workforce operations
          </span>
        </div>
        <ThemeToggle />
      </header>

      <section className="relative z-10 flex min-h-[100svh] items-center justify-center px-4 pb-20 pt-24 sm:px-6 sm:pb-16 sm:pt-28">
        <div className="login-card w-full max-w-[500px] border border-[#aabdc5] bg-white px-6 py-7 shadow-[0_18px_48px_rgba(16,47,62,0.16)] sm:px-10 sm:py-9">
          <div className="flex flex-col items-center text-center">
            <MedCnxMark />
            <p className="mt-7 text-xs font-extrabold uppercase tracking-[0.18em] text-[#126e8b]">
              Clinical workforce system
            </p>
            <h1 className="mt-2 text-[34px] font-semibold tracking-[-0.055em] text-[#102f3e] sm:text-[38px]">
              Welcome back
            </h1>
            <p className="mt-2 max-w-[360px] text-base leading-7 text-[#405f6c]">
              Secure access to your organisation&apos;s workforce workspace.
            </p>
          </div>

          <form onSubmit={handleLogin} className="mt-8 space-y-5">
            {error ? (
              <div
                role="alert"
                className="border border-red-300 border-l-4 bg-red-50 px-4 py-3 text-sm font-bold text-red-800"
              >
                {error}
              </div>
            ) : null}

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#183b4b]">
                Email address
              </span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="youremail@organisation.co.za"
                required
                autoComplete="email"
                className="h-12 w-full border border-[#91a8b1] bg-white px-4 text-base font-medium text-[#102f3e] outline-none transition placeholder:text-[#718892] focus:border-[#17789a] focus:ring-2 focus:ring-[#17789a]/15"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#183b4b]">
                Password
              </span>
              <span className="relative block">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                  className="h-12 w-full border border-[#91a8b1] bg-white px-4 pr-12 text-base font-medium text-[#102f3e] outline-none transition placeholder:text-[#718892] focus:border-[#17789a] focus:ring-2 focus:ring-[#17789a]/15"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center text-[#617b87] hover:text-[#17789a]"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
            </label>

            <div className="flex items-center justify-between gap-4 text-sm">
              <label className="flex cursor-pointer items-center gap-2.5 text-[#526b77]">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                  className="h-4 w-4 rounded-none border-[#91a7b1] accent-[#17789a]"
                />
                Remember me
              </label>
              <button
                type="button"
                className="font-semibold text-[#17789a] hover:text-[#102f3e]"
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="group flex h-12 w-full items-center justify-center gap-3 border border-[#126682] bg-[#17789a] px-5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(23,120,154,0.18)] hover:bg-[#126682] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 size={17} className="animate-spin" />
              ) : null}
              <span>{submitting ? "Signing in..." : "Sign in securely"}</span>
              {!submitting ? (
                <ArrowRight
                  size={17}
                  className="transition-transform group-hover:translate-x-1"
                />
              ) : null}
            </button>
          </form>

          <div className="mt-6 grid grid-cols-3 border-y border-[#9db0b8] py-4 text-[#405f6c]">
            <div className="flex flex-col items-center gap-1.5 text-center text-xs font-bold sm:flex-row sm:justify-center">
              <ShieldCheck size={16} className="text-[#17789a]" />
              POPIA aligned
            </div>
            <div className="flex flex-col items-center gap-1.5 border-x border-[#9db0b8] text-center text-xs font-bold sm:flex-row sm:justify-center">
              <LockKeyhole size={15} className="text-[#17789a]" />
              Encrypted
            </div>
            <div className="flex flex-col items-center gap-1.5 text-center text-xs font-bold sm:flex-row sm:justify-center">
              <FileCheck2 size={15} className="text-[#17789a]" />
              Audit logged
            </div>
          </div>

          <p className="mt-5 text-center text-xs font-bold uppercase tracking-[0.14em] text-[#526c77]">
            Authorised personnel only
          </p>
        </div>
      </section>

      <footer className="absolute inset-x-0 bottom-0 z-20 flex items-end justify-between px-5 py-5 text-xs font-medium text-[#385361] sm:px-8 lg:px-10">
        <div className="hidden items-center gap-2 md:flex">
          <Wifi size={13} className="text-[#17789a]" />
          HR <span>•</span> Payroll <span>•</span> Compliance <span>•</span>{" "}
          Workforce intelligence
        </div>
        <div className="ml-auto flex items-center gap-4">
          <button type="button" className="hover:text-[#17789a]">
            Privacy
          </button>
          <span>•</span>
          <button type="button" className="hover:text-[#17789a]">
            Support
          </button>
        </div>
      </footer>

      <style jsx global>{`
        .login-wash {
          background:
            linear-gradient(rgba(10, 52, 68, 0.055) 1px, transparent 1px),
            linear-gradient(
              90deg,
              rgba(10, 52, 68, 0.055) 1px,
              transparent 1px
            ),
            rgba(239, 247, 250, 0.24);
          background-size: 40px 40px;
        }

        .dark .login-wash {
          background: rgba(2, 15, 23, 0.48);
        }

        .dark .login-card {
          border-color: rgba(255, 255, 255, 0.2);
          background: #0d1b23;
          color: #f8fafc;
        }

        .dark .login-card h1,
        .dark .login-card label > span,
        .dark .login-card form > div:not([role="alert"]) {
          color: #f8fafc;
        }

        .dark .login-card input:not([type="checkbox"]) {
          border-color: rgba(255, 255, 255, 0.24);
          background: #13252e;
          color: #f8fafc;
        }

        .dark .login-scene > header,
        .dark .login-scene > footer {
          color: #f8fafc;
        }

        @media (prefers-reduced-motion: no-preference) {
          .login-card {
            animation: login-card-enter 550ms cubic-bezier(0.22, 1, 0.36, 1)
              both;
          }

          @keyframes login-card-enter {
            from {
              opacity: 0;
              transform: translateY(14px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        }
      `}</style>
    </main>
  );
}
