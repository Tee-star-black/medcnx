'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import type { AuthUser } from '@/types/auth';

export default function TeamSetupLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const rawUser = window.localStorage.getItem('medcnx_user');

    if (!rawUser) {
      router.replace('/');
      return;
    }

    try {
      const user = JSON.parse(rawUser) as AuthUser;
      if (!user.permissions?.includes('employees:update')) {
        router.replace('/dashboard/employees');
        return;
      }
      setAllowed(true);
    } catch {
      router.replace('/');
    }
  }, [router]);

  if (!allowed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--background)] text-sm text-[var(--muted)]">
        <div className="flex items-center gap-3">
          <Loader2 className="animate-spin" size={18} />
          Verifying reporting-structure access...
        </div>
      </main>
    );
  }

  return children;
}
