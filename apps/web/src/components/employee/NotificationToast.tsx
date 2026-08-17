'use client';

import { Bell, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

import type { EmployeeNotification } from '@/lib/employee-notifications';

type NotificationToastProps = {
  notification: EmployeeNotification | null;
  onDismiss: () => void;
  onOpen: (notification: EmployeeNotification) => Promise<void> | void;
};

export function NotificationToast({
  notification,
  onDismiss,
  onOpen,
}: NotificationToastProps) {
  const router = useRouter();

  if (!notification) return null;

  async function openNotification() {
    if (!notification) return;

    try {
      await onOpen(notification);
    } finally {
      onDismiss();
      router.push(notification.href ?? '/employee/notifications');
    }
  }

  return (
    <aside
      role="status"
      aria-live="polite"
      className="fixed bottom-5 right-5 z-[100] w-[calc(100%-2.5rem)] max-w-sm border border-[var(--border-strong)] bg-[var(--surface)] shadow-[0_18px_50px_rgba(15,23,42,0.22)]"
    >
      <div className="flex items-start gap-3 border-l-4 border-l-[var(--accent)] p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-[var(--accent)] text-[var(--accent-text)]">
          <Bell size={18} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--accent)]">
            New notification
          </p>
          <h2 className="mt-1 text-sm font-black text-[var(--text)]">
            {notification.title}
          </h2>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--muted)]">
            {notification.message}
          </p>

          <button
            type="button"
            onClick={() => void openNotification()}
            className="mt-3 h-9 border border-[var(--accent)] bg-[var(--accent)] px-4 text-xs font-bold text-[var(--accent-text)] transition hover:bg-[var(--accent-hover)]"
          >
            View details
          </button>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="flex h-8 w-8 shrink-0 items-center justify-center border border-[var(--border)] text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
          aria-label="Dismiss notification"
        >
          <X size={15} />
        </button>
      </div>
    </aside>
  );
}
