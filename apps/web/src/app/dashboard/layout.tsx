import type { ReactNode } from 'react';
import { ManagerAttentionBadge } from './ManagerAttentionBadge';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ManagerAttentionBadge />
    </>
  );
}
