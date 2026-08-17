'use client';

import {
  Check,
  KeyRound,
  Loader2,
  LockKeyhole,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCog,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { api } from '@/lib/api';

type Permission = { id: string; key: string; description?: string | null };
type Role = {
  id: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  userCount: number;
  permissionIds: string[];
};
type AccessUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  lastLoginAt?: string | null;
  employeeProfile?: {
    id: string;
    employeeNumber: string;
    jobTitle?: string | null;
    employmentStatus: string;
  } | null;
  userRoles: { role: Pick<Role, 'id' | 'name' | 'isSystem'> }[];
};
type Overview = { users: AccessUser[]; roles: Role[]; permissions: Permission[] };

function friendly(value: string) {
  return value
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function errorMessage(error: unknown, fallback: string) {
  const requestError = error as {
    response?: { data?: { message?: string | string[] } };
  };
  const message = requestError.response?.data?.message ?? fallback;
  return Array.isArray(message) ? message.join(' ') : String(message);
}

export default function AccessControlPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [tab, setTab] = useState<'users' | 'roles'>('users');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [query, setQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([]);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<Overview>('/access-control');
      setOverview(response.data);
    } catch (requestError) {
      setError(errorMessage(requestError, 'Could not load access control.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const filteredUsers = useMemo(() => {
    const normalised = query.trim().toLowerCase();
    if (!overview || !normalised) return overview?.users ?? [];
    return overview.users.filter((user) =>
      [
        user.firstName,
        user.lastName,
        user.email,
        user.employeeProfile?.employeeNumber,
        user.employeeProfile?.jobTitle,
      ].some((value) => value?.toLowerCase().includes(normalised)),
    );
  }, [overview, query]);

  const selectedUser = overview?.users.find((item) => item.id === selectedUserId);
  const selectedRole = overview?.roles.find((item) => item.id === selectedRoleId);

  const permissionGroups = useMemo(() => {
    const groups = new Map<string, Permission[]>();
    for (const permission of overview?.permissions ?? []) {
      const groupName = permission.key.split(':')[0] ?? 'general';
      groups.set(groupName, [...(groups.get(groupName) ?? []), permission]);
    }
    return [...groups.entries()];
  }, [overview]);

  function editUser(user: AccessUser) {
    setSelectedUserId(user.id);
    setSelectedRoleIds(user.userRoles.map((item) => item.role.id));
    setError('');
    setSuccess('');
  }

  function editRole(role: Role) {
    setSelectedRoleId(role.id);
    setSelectedPermissionIds(role.permissionIds);
    setError('');
    setSuccess('');
  }

  async function saveUserRoles() {
    if (!selectedUserId || selectedRoleIds.length === 0) return;
    setSaving(true);
    setError('');
    try {
      await api.patch(`/access-control/users/${selectedUserId}/roles`, {
        roleIds: selectedRoleIds,
      });
      setSuccess('User roles updated. API permissions are effective immediately.');
      await load();
      setSelectedUserId(null);
    } catch (requestError) {
      setError(errorMessage(requestError, 'Could not update user roles.'));
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(user: AccessUser) {
    const nextStatus = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    if (!window.confirm(`${nextStatus === 'ACTIVE' ? 'Activate' : 'Suspend'} ${user.email}?`)) return;
    setSaving(true);
    setError('');
    try {
      await api.patch(`/access-control/users/${user.id}/status`, {
        status: nextStatus,
      });
      setSuccess(`${user.email} is now ${nextStatus.toLowerCase()}.`);
      await load();
    } catch (requestError) {
      setError(errorMessage(requestError, 'Could not update account status.'));
    } finally {
      setSaving(false);
    }
  }

  async function saveRolePermissions() {
    if (!selectedRole || selectedRole.isSystem || selectedPermissionIds.length === 0) return;
    setSaving(true);
    setError('');
    try {
      await api.patch(`/access-control/roles/${selectedRole.id}/permissions`, {
        permissionIds: selectedPermissionIds,
      });
      setSuccess(`Permissions updated for ${friendly(selectedRole.name)}.`);
      await load();
    } catch (requestError) {
      setError(errorMessage(requestError, 'Could not update role permissions.'));
    } finally {
      setSaving(false);
    }
  }

  async function createRole() {
    if (!newRoleName.trim() || selectedPermissionIds.length === 0) return;
    setSaving(true);
    setError('');
    try {
      await api.post('/access-control/roles', {
        name: newRoleName,
        description: newRoleDescription || undefined,
        permissionIds: selectedPermissionIds,
      });
      setNewRoleName('');
      setNewRoleDescription('');
      setSelectedPermissionIds([]);
      setSuccess('Custom role created successfully.');
      await load();
    } catch (requestError) {
      setError(errorMessage(requestError, 'Could not create custom role.'));
    } finally {
      setSaving(false);
    }
  }

  function toggleSelection(id: string, values: string[], update: (items: string[]) => void) {
    update(values.includes(id) ? values.filter((item) => item !== id) : [...values, id]);
  }

  return (
    <DashboardShell activePage="settings">
      <div className="space-y-6">
        <header className="border border-[var(--border)] bg-[var(--surface)] p-6 lg:flex lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--accent)]">Security administration</p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] text-[var(--text)]">Access control</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Assign user roles, create controlled custom roles and review permissions across MedCNX.
            </p>
          </div>
          <button type="button" onClick={() => void load()} className="mt-4 inline-flex h-10 items-center gap-2 border border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 text-sm font-bold lg:mt-0">
            <RefreshCw size={16} /> Refresh
          </button>
        </header>

        {error ? <div className="border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:bg-red-950 dark:text-red-200">{error}</div> : null}
        {success ? <div className="border border-emerald-300 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">{success}</div> : null}

        <div className="flex border-b border-[var(--border-strong)]">
          <TabButton active={tab === 'users'} onClick={() => setTab('users')} icon={<Users size={16} />} label="Users and access" />
          <TabButton active={tab === 'roles'} onClick={() => setTab('roles')} icon={<KeyRound size={16} />} label="Roles and permissions" />
        </div>

        {loading ? (
          <div className="flex min-h-96 items-center justify-center border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--muted)]">
            <Loader2 className="mr-3 animate-spin" size={18} /> Loading access controls...
          </div>
        ) : tab === 'users' ? (
          <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
            <section className="border border-[var(--border)] bg-[var(--surface)]">
              <div className="border-b border-[var(--border)] p-4">
                <div className="flex h-11 items-center border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3">
                  <Search size={17} className="text-[var(--muted)]" />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, employee number or job title" className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm outline-none" />
                </div>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {filteredUsers.map((user) => (
                  <article key={user.id} className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[var(--border-strong)] bg-[var(--surface-soft)] text-xs font-black">
                        {user.firstName[0]}{user.lastName[0]}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-black text-[var(--text)]">{user.firstName} {user.lastName}</h2>
                          <StatusBadge status={user.status} />
                        </div>
                        <p className="mt-1 truncate text-sm text-[var(--muted)]">{user.email}</p>
                        <p className="mt-2 text-xs text-[var(--muted)]">
                          {user.employeeProfile ? `${user.employeeProfile.employeeNumber} · ${user.employeeProfile.jobTitle ?? 'No job title'}` : 'No linked employee profile'}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {user.userRoles.map(({ role }) => <span key={role.id} className="border border-[var(--border)] bg-[var(--surface-soft)] px-2 py-1 text-[10px] font-bold uppercase tracking-wider">{friendly(role.name)}</span>)}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => editUser(user)} className="h-10 border border-[var(--accent)] bg-[var(--accent)] px-4 text-xs font-bold text-[var(--accent-text)]">Manage access</button>
                      <button type="button" disabled={saving} onClick={() => void updateStatus(user)} className="h-10 border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 text-xs font-bold">
                        {user.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <aside className="h-fit border border-[var(--border)] bg-[var(--surface)] p-5 xl:sticky xl:top-28">
              <div className="flex h-10 w-10 items-center justify-center bg-[var(--accent)] text-[var(--accent-text)]"><UserCog size={18} /></div>
              <h2 className="mt-4 text-lg font-black">{selectedUser ? `Access for ${selectedUser.firstName}` : 'Select a user'}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Roles combine permissions into safe, reusable access profiles.</p>
              {selectedUser ? (
                <div className="mt-5 space-y-2">
                  {overview?.roles.map((role) => (
                    <label key={role.id} className="flex cursor-pointer items-start gap-3 border border-[var(--border)] p-3 hover:border-[var(--accent)]">
                      <input type="checkbox" checked={selectedRoleIds.includes(role.id)} onChange={() => toggleSelection(role.id, selectedRoleIds, setSelectedRoleIds)} className="mt-1 h-4 w-4 accent-[var(--accent)]" />
                      <span><span className="block text-sm font-bold">{friendly(role.name)}</span><span className="mt-1 block text-xs text-[var(--muted)]">{role.permissionIds.length} permissions{role.isSystem ? ' · protected system role' : ''}</span></span>
                    </label>
                  ))}
                  <button type="button" disabled={saving || selectedRoleIds.length === 0} onClick={() => void saveUserRoles()} className="mt-3 flex h-11 w-full items-center justify-center gap-2 bg-[var(--accent)] px-4 text-sm font-bold text-[var(--accent-text)] disabled:opacity-40">
                    {saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Save role assignments
                  </button>
                </div>
              ) : null}
            </aside>
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[330px_1fr]">
            <aside className="h-fit border border-[var(--border)] bg-[var(--surface)] p-4">
              <h2 className="px-2 text-sm font-black uppercase tracking-wider">Organisation roles</h2>
              <div className="mt-3 space-y-2">
                {overview?.roles.map((role) => (
                  <button key={role.id} type="button" onClick={() => editRole(role)} className={`w-full border p-3 text-left ${selectedRoleId === role.id ? 'border-[var(--accent)] bg-[var(--surface-soft)]' : 'border-[var(--border)]'}`}>
                    <span className="flex items-center justify-between gap-2"><span className="text-sm font-bold">{friendly(role.name)}</span>{role.isSystem ? <LockKeyhole size={14} className="text-[var(--muted)]" /> : null}</span>
                    <span className="mt-1 block text-xs text-[var(--muted)]">{role.permissionIds.length} permissions · {role.userCount} users</span>
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => { setSelectedRoleId(null); setSelectedPermissionIds([]); }} className="mt-4 flex h-10 w-full items-center justify-center gap-2 border border-[var(--accent)] text-sm font-bold text-[var(--accent)]"><Plus size={16} /> New custom role</button>
            </aside>

            <section className="border border-[var(--border)] bg-[var(--surface)]">
              <div className="border-b border-[var(--border)] p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center bg-[var(--accent)] text-[var(--accent-text)]"><ShieldCheck size={18} /></div>
                  <div>
                    <h2 className="text-lg font-black">{selectedRole ? friendly(selectedRole.name) : 'Create custom role'}</h2>
                    <p className="mt-1 text-sm text-[var(--muted)]">{selectedRole?.isSystem ? 'System roles can be inspected but cannot be modified.' : 'Select the exact capabilities granted by this role.'}</p>
                  </div>
                </div>
                {!selectedRole ? (
                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <input value={newRoleName} onChange={(event) => setNewRoleName(event.target.value)} placeholder="Role name, e.g. Senior Nurse" className="h-11 border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 text-sm outline-none focus:border-[var(--accent)]" />
                    <input value={newRoleDescription} onChange={(event) => setNewRoleDescription(event.target.value)} placeholder="Short description (optional)" className="h-11 border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 text-sm outline-none focus:border-[var(--accent)]" />
                  </div>
                ) : null}
              </div>

              <div className="divide-y divide-[var(--border)]">
                {permissionGroups.map(([groupName, permissions]) => (
                  <div key={groupName} className="p-5">
                    <h3 className="text-xs font-black uppercase tracking-[0.16em] text-[var(--accent)]">{friendly(groupName)}</h3>
                    <div className="mt-3 grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
                      {permissions.map((permission) => {
                        const checked = selectedPermissionIds.includes(permission.id);
                        return (
                          <label key={permission.id} className={`flex items-start gap-3 border p-3 ${checked ? 'border-[var(--accent)] bg-[var(--surface-soft)]' : 'border-[var(--border)]'} ${selectedRole?.isSystem ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}`}>
                            <input type="checkbox" disabled={selectedRole?.isSystem} checked={checked} onChange={() => toggleSelection(permission.id, selectedPermissionIds, setSelectedPermissionIds)} className="mt-1 h-4 w-4 accent-[var(--accent)]" />
                            <span><span className="block text-xs font-bold text-[var(--text)]">{permission.key}</span><span className="mt-1 block text-[11px] leading-4 text-[var(--muted)]">{permission.description ?? friendly(permission.key.split(':')[1] ?? permission.key)}</span></span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {!selectedRole?.isSystem ? (
                <div className="sticky bottom-0 flex justify-end border-t border-[var(--border-strong)] bg-[var(--surface)] p-4">
                  <button type="button" disabled={saving || selectedPermissionIds.length === 0 || (!selectedRole && !newRoleName.trim())} onClick={() => void (selectedRole ? saveRolePermissions() : createRole())} className="flex h-11 items-center gap-2 bg-[var(--accent)] px-5 text-sm font-bold text-[var(--accent-text)] disabled:opacity-40">
                    {saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} {selectedRole ? 'Save permissions' : 'Create custom role'}
                  </button>
                </div>
              ) : null}
            </section>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return <button type="button" onClick={onClick} className={`flex h-12 items-center gap-2 border-b-2 px-5 text-sm font-bold ${active ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--muted)]'}`}>{icon}{label}</button>;
}

function StatusBadge({ status }: { status: string }) {
  const active = status === 'ACTIVE';
  return <span className={`border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${active ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200' : 'border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200'}`}>{status}</span>;
}
