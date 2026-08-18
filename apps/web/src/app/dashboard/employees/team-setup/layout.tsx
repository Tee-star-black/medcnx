'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { AuthUser } from '@/types/auth';

export default function TeamSetupLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let active = true;

    async function verifyAccess() {
      try {
        const response = await api.get<AuthUser>('/auth/me');
        const user = response.data;
        const isAdministrativeRole = user.roles?.some((role) =>
          ['SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'].includes(role),
        );
        const canUpdateEmployees = user.permissions?.includes('employees:update');

        if (!canUpdateEmployees && !isAdministrativeRole) {
          router.replace('/dashboard/employees');
          return;
        }

        window.localStorage.setItem('medcnx_user', JSON.stringify(user));

        if (active) {
          setAllowed(true);
        }
      } catch {
        router.replace('/');
      }
    }

    void verifyAccess();

    return () => {
      active = false;
    };
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
