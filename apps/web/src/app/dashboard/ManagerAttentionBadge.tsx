'use client';

import { useEffect, useMemo, useState } from 'react';
import { BellRing, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

type ManagerContext = {
  directReports: Array<{ id: string }>;
};

type AttendanceResponse = {
  total: number;
};

type PerformanceOverview = {
  metrics: {
    assignedReviews: number;
  };
  goals: Array<{
    targetDate?: string | null;
    status: string;
  }>;
};

function dueWithinSevenDays(value?: string | null) {
  if (!value) return false;
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const days = Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
  return days <= 7;
}

export function ManagerAttentionBadge() {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const contextResponse = await api.get<ManagerContext>('/employees/me/manager-context');
        if (!active) return;

        if (!contextResponse.data.directReports.length) {
          setVisible(false);
          setCount(0);
          return;
        }

        setVisible(true);

        const [leaveResult, attendanceResult, performanceResult] = await Promise.allSettled([
          api.get<Array<{ id: string }>>('/leave/manager/pending'),
          api.get<AttendanceResponse>('/attendance/manager/exceptions?days=14'),
          api.get<PerformanceOverview>('/performance/manager/overview'),
        ]);

        if (!active) return;

        const leaveCount = leaveResult.status === 'fulfilled' ? leaveResult.value.data.length : 0;
        const attendanceCount = attendanceResult.status === 'fulfilled' ? attendanceResult.value.data.total : 0;
        const performanceCount = performanceResult.status === 'fulfilled'
          ? performanceResult.value.data.metrics.assignedReviews +
            performanceResult.value.data.goals.filter((goal) =>
              !['COMPLETED', 'CANCELLED'].includes(goal.status) && dueWithinSevenDays(goal.targetDate),
            ).length
          : 0;

        setCount(leaveCount + attendanceCount + performanceCount);
      } catch {
        if (active) {
          setVisible(false);
          setCount(0);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    const interval = window.setInterval(() => void load(), 120_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const label = useMemo(() => {
    if (loading) return 'Checking manager actions';
    if (count === 0) return 'No manager actions waiting';
    return `${count} manager action${count === 1 ? '' : 's'} waiting`;
  }, [count, loading]);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => router.push('/dashboard/my-team')}
      className="fixed bottom-5 right-5 z-[70] flex items-center gap-3 border border-[var(--accent)] bg-[var(--accent)] px-4 py-3 text-sm font-black text-[var(--accent-text)] shadow-lg transition hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-[var(--accent-ring)]"
      aria-label={label}
      title={label}
    >
      <span className="relative flex h-8 w-8 items-center justify-center border border-current/30">
        {loading ? <Loader2 className="animate-spin" size={16} /> : <BellRing size={17} />}
        {!loading && count > 0 ? (
          <span className="absolute -right-2 -top-2 flex min-h-5 min-w-5 items-center justify-center bg-red-600 px-1 text-[10px] font-black text-white">
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
      </span>
      <span className="hidden sm:block">{loading ? 'Checking actions' : count > 0 ? 'Needs attention' : 'My Team'}</span>
    </button>
  );
}
