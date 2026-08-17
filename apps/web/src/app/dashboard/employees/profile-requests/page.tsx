'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { api } from '@/lib/api';
import type { AuthUser } from '@/types/auth';

type Request = {
  id: string;
  field: string;
  currentValue?: string | null;
  requestedValue: string;
  reason: string;
  status: string;
  reviewComments?: string | null;
  createdAt: string;
  employee: { employeeNumber: string; firstName: string; lastName: string };
};

export default function ProfileRequestsPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [me, result] = await Promise.all([
        api.get<AuthUser>('/auth/me'),
        api.get<Request[]>('/employee-self-service/profile-change-requests'),
      ]);
      setUser(me.data);
      setRequests(result.data);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message ?? 'Could not load profile requests.');
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function review(id: string, decision: 'APPROVED' | 'REJECTED') {
    const comments = window.prompt(decision === 'APPROVED' ? 'Optional approval comment' : 'Reason for rejection');
    if (comments === null) return;
    await api.patch(`/employee-self-service/profile-change-requests/${id}/review`, { decision, comments });
    await load();
  }

  return (
    <DashboardShell user={user} activePage="employees">
      <section className="mx-auto max-w-7xl space-y-6 px-6 py-10">
        <header className="border border-[var(--border)] bg-[var(--surface)] p-6"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent)]">Employee governance</p><h1 className="mt-2 text-3xl font-bold">Profile change requests</h1><p className="mt-2 text-sm text-[var(--muted)]">Approve or reject controlled employee information changes.</p></header>
        {error && <div className="border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{String(error)}</div>}
        {loading ? <div className="flex min-h-64 items-center justify-center gap-3 text-[var(--muted)]"><Loader2 className="animate-spin" size={18} />Loading requests...</div> : requests.length === 0 ? <div className="border border-dashed border-[var(--border-strong)] p-10 text-center text-sm text-[var(--muted)]">No profile change requests have been submitted.</div> : <div className="overflow-x-auto border border-[var(--border)] bg-[var(--surface)]"><table className="w-full min-w-[900px] text-left text-sm"><thead className="border-b border-[var(--border)] bg-[var(--surface-soft)] text-xs uppercase tracking-wider text-[var(--muted)]"><tr><th className="p-4">Employee</th><th className="p-4">Field</th><th className="p-4">Current</th><th className="p-4">Requested</th><th className="p-4">Reason</th><th className="p-4">Status</th><th className="p-4 text-right">Actions</th></tr></thead><tbody className="divide-y divide-[var(--border)]">{requests.map((request) => <tr key={request.id}><td className="p-4 font-semibold">{request.employee.firstName} {request.employee.lastName}<span className="block text-xs font-normal text-[var(--muted)]">{request.employee.employeeNumber}</span></td><td className="p-4">{request.field.replaceAll('_', ' ')}</td><td className="max-w-40 break-words p-4 text-[var(--muted)]">{request.currentValue || 'Not set'}</td><td className="max-w-40 break-words p-4 font-semibold">{request.requestedValue}</td><td className="max-w-52 break-words p-4">{request.reason}</td><td className="p-4"><span className="border border-[var(--border-strong)] px-2 py-1 text-xs font-bold">{request.status}</span></td><td className="p-4"><div className="flex justify-end gap-2">{request.status === 'PENDING' && <><button onClick={() => void review(request.id, 'APPROVED')} className="inline-flex h-9 items-center gap-2 bg-emerald-700 px-3 text-xs font-bold text-white"><Check size={14} />Approve</button><button onClick={() => void review(request.id, 'REJECTED')} className="inline-flex h-9 items-center gap-2 bg-red-700 px-3 text-xs font-bold text-white"><X size={14} />Reject</button></>}</div></td></tr>)}</tbody></table></div>}
      </section>
    </DashboardShell>
  );
}
