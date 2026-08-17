'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { EmployeeShell } from '@/components/employee/EmployeeShell';
import { api } from '@/lib/api';
import { announceNotificationsChanged } from '@/lib/employee-notifications';

type Notification = {
  id: string;
  category: string;
  title: string;
  message: string;
  href?: string | null;
  readAt?: string | null;
  createdAt: string;
};

export default function EmployeeNotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load(showLoading = true) {
    if (showLoading) setLoading(true);
    setError('');
    try {
      const response = await api.get<{ unreadCount: number; notifications: Notification[] }>(
        '/employee-self-service/notifications',
      );
      setItems(response.data.notifications);
      setUnreadCount(response.data.unreadCount);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message ?? 'Could not load notifications.');
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  useEffect(() => {
    void load();

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void load(false);
      }
    }, 15_000);

    return () => window.clearInterval(timer);
  }, []);

  async function markRead(id: string) {
    await api.patch(`/employee-self-service/notifications/${id}/read`);
    setItems((current) => current.map((item) => item.id === id ? { ...item, readAt: new Date().toISOString() } : item));
    setUnreadCount((count) => Math.max(0, count - 1));
    announceNotificationsChanged();
  }

  async function markAllRead() {
    await api.patch('/employee-self-service/notifications/read-all');
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
    setUnreadCount(0);
    announceNotificationsChanged();
  }

  return (
    <EmployeeShell>
      <div className="space-y-6">
        <header className="flex flex-col gap-4 border border-[var(--border)] bg-[var(--surface)] p-6 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent)]">Employee centre</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Notifications</h1><p className="mt-2 text-sm text-[var(--muted)]">{unreadCount} unread notification{unreadCount === 1 ? '' : 's'}.</p></div>
          <button disabled={!unreadCount} onClick={() => void markAllRead()} className="inline-flex h-11 items-center justify-center gap-2 border border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 text-sm font-bold disabled:opacity-40"><CheckCheck size={17} />Mark all as read</button>
        </header>

        {error && <div className="border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{String(error)}</div>}
        {loading ? <div className="flex min-h-64 items-center justify-center gap-3 text-[var(--muted)]"><Loader2 className="animate-spin" size={18} />Loading notifications...</div> : items.length === 0 ? <div className="flex min-h-72 flex-col items-center justify-center border border-dashed border-[var(--border-strong)] bg-[var(--surface-soft)] p-8 text-center"><Bell size={30} className="text-[var(--muted)]" /><h2 className="mt-4 font-bold">No notifications yet</h2><p className="mt-2 text-sm text-[var(--muted)]">Leave, attendance, payslip and profile updates will appear here.</p></div> : <section className="divide-y divide-[var(--border)] border border-[var(--border)] bg-[var(--surface)]">{items.map((item) => <article key={item.id} className={`p-5 ${item.readAt ? '' : 'border-l-4 border-l-[var(--accent)] bg-[var(--surface-soft)]'}`}><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">{item.category.replaceAll('_', ' ')}</p><h2 className="mt-1 font-bold">{item.title}</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.message}</p><p className="mt-3 text-xs text-[var(--muted)]">{new Intl.DateTimeFormat('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.createdAt))}</p></div><div className="flex shrink-0 gap-2">{item.href && <Link href={item.href} onClick={() => !item.readAt && void markRead(item.id)} className="inline-flex h-9 items-center border border-[var(--border-strong)] px-3 text-xs font-bold">Open</Link>}{!item.readAt && <button onClick={() => void markRead(item.id)} className="inline-flex h-9 items-center bg-[var(--accent)] px-3 text-xs font-bold text-[var(--accent-text)]">Mark read</button>}</div></div></article>)}</section>}
      </div>
    </EmployeeShell>
  );
}
