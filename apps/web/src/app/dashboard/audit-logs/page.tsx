'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
  XCircle,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { api } from '@/lib/api';

type AuditLog = {
  id: string;
  action: string;
  entity: string;
  entityId?: string | null;
  message?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: unknown;
  createdAt: string;
  actor?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  } | null;
  employee?: {
    id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    email?: string | null;
    jobTitle?: string | null;
  } | null;
};

const actionLabels: Record<string, string> = {
  CREATE: 'Created',
  UPDATE: 'Updated',
  DELETE: 'Deleted',
  LOGIN: 'Logged in',
  LOGOUT: 'Logged out',
  VIEW: 'Viewed',
  DOWNLOAD: 'Downloaded',
  UPLOAD: 'Uploaded',
  APPROVE: 'Approved',
  REJECT: 'Rejected',
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatAction(action: string) {
  return actionLabels[action] ?? action.replaceAll('_', ' ');
}

function actionClass(action: string) {
  if (action === 'CREATE' || action === 'APPROVE') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (action === 'DELETE' || action === 'REJECT') {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  if (action === 'UPLOAD' || action === 'DOWNLOAD') {
    return 'border-blue-200 bg-blue-50 text-blue-700';
  }

  return 'border-black/10 bg-white text-gray-600';
}

function actionIcon(action: string) {
  if (action === 'CREATE') {
    return <CheckCircle2 size={16} />;
  }

  if (action === 'DELETE') {
    return <Trash2 size={16} />;
  }

  if (action === 'UPLOAD') {
    return <Upload size={16} />;
  }

  if (action === 'DOWNLOAD') {
    return <Download size={16} />;
  }

  if (action === 'APPROVE') {
    return <ShieldCheck size={16} />;
  }

  if (action === 'REJECT') {
    return <XCircle size={16} />;
  }

  if (action === 'UPDATE') {
    return <FileText size={16} />;
  }

  return <Activity size={16} />;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [entityFilter, setEntityFilter] = useState('ALL');

  useEffect(() => {
    loadAuditLogs();
  }, []);

  const actions = useMemo(() => {
    return Array.from(new Set(logs.map((log) => log.action))).sort();
  }, [logs]);

  const entities = useMemo(() => {
    return Array.from(new Set(logs.map((log) => log.entity))).sort();
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();

    return logs.filter((log) => {
      const actorName = log.actor
        ? `${log.actor.firstName} ${log.actor.lastName}`.toLowerCase()
        : '';

      const employeeName = log.employee
        ? `${log.employee.firstName} ${log.employee.lastName}`.toLowerCase()
        : '';

      const matchesSearch =
        !query ||
        log.message?.toLowerCase().includes(query) ||
        log.entity.toLowerCase().includes(query) ||
        log.action.toLowerCase().includes(query) ||
        actorName.includes(query) ||
        log.actor?.email.toLowerCase().includes(query) ||
        employeeName.includes(query) ||
        log.employee?.employeeNumber.toLowerCase().includes(query);

      const matchesAction =
        actionFilter === 'ALL' || log.action === actionFilter;

      const matchesEntity =
        entityFilter === 'ALL' || log.entity === entityFilter;

      return matchesSearch && matchesAction && matchesEntity;
    });
  }, [logs, search, actionFilter, entityFilter]);

  const stats = useMemo(() => {
    return {
      total: logs.length,
      uploads: logs.filter((log) => log.action === 'UPLOAD').length,
      downloads: logs.filter((log) => log.action === 'DOWNLOAD').length,
      approvals: logs.filter((log) => log.action === 'APPROVE').length,
      deletions: logs.filter((log) => log.action === 'DELETE').length,
    };
  }, [logs]);

  async function loadAuditLogs() {
    setLoading(true);
    setError('');

    try {
      const response = await api.get<AuditLog[]>('/audit-logs');
      setLogs(response.data);
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ??
        'Could not load audit logs.';

      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardShell activePage="audit-logs">
      <div className="space-y-8">
        <div className="flex flex-col gap-5 border-b border-black/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-sm uppercase tracking-[0.25em] text-gray-400">
              System accountability
            </p>

            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#111827]">
              Audit trail
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              Review recent HR activity, document actions, approvals and user
              events across the organisation.
            </p>
          </div>

          <button
            type="button"
            onClick={loadAuditLogs}
            className="border border-black bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-white hover:text-black"
          >
            Refresh logs
          </button>
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard title="Total events" value={String(stats.total)} />
          <StatCard title="Uploads" value={String(stats.uploads)} />
          <StatCard title="Downloads" value={String(stats.downloads)} />
          <StatCard title="Approvals" value={String(stats.approvals)} />
          <StatCard title="Deletions" value={String(stats.deletions)} />
        </section>

        <section className="border border-black/10 bg-white">
          <div className="grid gap-4 border-b border-black/10 px-6 py-5 lg:grid-cols-[1fr_220px_220px]">
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by user, employee, message, action..."
                className="w-full border border-black/10 bg-[#f8fafc] py-3 pl-11 pr-4 text-sm text-[#111827] outline-none transition focus:border-black"
              />
            </div>

            <select
              value={actionFilter}
              onChange={(event) => setActionFilter(event.target.value)}
              className="border border-black/10 bg-[#f8fafc] px-4 py-3 text-sm text-[#111827] outline-none transition focus:border-black"
            >
              <option value="ALL">All actions</option>
              {actions.map((action) => (
                <option key={action} value={action}>
                  {formatAction(action)}
                </option>
              ))}
            </select>

            <select
              value={entityFilter}
              onChange={(event) => setEntityFilter(event.target.value)}
              className="border border-black/10 bg-[#f8fafc] px-4 py-3 text-sm text-[#111827] outline-none transition focus:border-black"
            >
              <option value="ALL">All entities</option>
              {entities.map((entity) => (
                <option key={entity} value={entity}>
                  {entity}
                </option>
              ))}
            </select>
          </div>

          {error ? (
            <div className="mx-6 mt-5 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="p-6">
            {loading ? (
              <div className="flex min-h-[280px] items-center justify-center">
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <Loader2 className="animate-spin" size={18} />
                  Loading audit logs...
                </div>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="border border-dashed border-black/15 bg-[#f8fafc] px-5 py-14 text-center">
                <Activity size={32} className="mx-auto text-gray-300" />

                <p className="mt-4 text-sm font-medium text-[#111827]">
                  {logs.length === 0
                    ? 'No audit activity recorded yet'
                    : 'No matching logs found'}
                </p>

                <p className="mt-1 text-sm text-gray-500">
                  {logs.length === 0
                    ? 'Activity will appear here as users work in the system.'
                    : 'Try changing the search or filters.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredLogs.map((log) => (
                  <article
                    key={log.id}
                    className="border border-black/10 bg-[#f8fafc] p-5"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-2 border px-3 py-1 text-xs font-medium ${actionClass(
                              log.action,
                            )}`}
                          >
                            {actionIcon(log.action)}
                            {formatAction(log.action)}
                          </span>

                          <span className="border border-black/10 bg-white px-2 py-1 text-[11px] font-medium text-gray-500">
                            {log.entity}
                          </span>

                          <span className="text-xs text-gray-400">
                            {formatDateTime(log.createdAt)}
                          </span>
                        </div>

                        <p className="mt-3 text-sm font-medium text-[#111827]">
                          {log.message || `${formatAction(log.action)} ${log.entity}`}
                        </p>

                        <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-400">
                          {log.actor ? (
                            <span>
                              Actor: {log.actor.firstName} {log.actor.lastName}{' '}
                              · {log.actor.email}
                            </span>
                          ) : (
                            <span>Actor: System</span>
                          )}

                          {log.employee ? (
                            <span>
                              Employee: {log.employee.firstName}{' '}
                              {log.employee.lastName} ·{' '}
                              {log.employee.employeeNumber}
                            </span>
                          ) : null}

                          {log.entityId ? <span>ID: {log.entityId}</span> : null}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2 border border-black/10 bg-white px-3 py-2 text-xs text-gray-500">
                        <UserRound size={14} />
                        {log.actor ? log.actor.email : 'System'}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="border border-black/10 bg-white p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-gray-400">
        {title}
      </p>

      <p className="mt-3 text-3xl font-semibold tracking-[-0.06em] text-[#111827]">
        {value}
      </p>
    </div>
  );
}