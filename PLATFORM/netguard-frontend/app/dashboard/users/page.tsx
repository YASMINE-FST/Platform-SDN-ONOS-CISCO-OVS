'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { apiClient } from '@/lib/api';
import {
  Users, RefreshCw, Plus, Shield,
  Lock, Unlock, Trash2, UserCheck, X
} from 'lucide-react';

interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'manager' | 'viewer';
  is_active: boolean;
  is_locked: boolean;
  mfa_enabled: boolean;
  last_login?: string;
  created_at: string;
}

const ROLE_STYLES = {
  admin:   'bg-red-500/20 text-red-400',
  manager: 'bg-cyan-500/20 text-primary',
  viewer:  'bg-slate-500/20 text-muted-foreground',
};

export default function UsersPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Create form state
  const [form, setForm] = useState({
    username: '', email: '', password: '', role: 'viewer'
  });
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
    if (!isLoading && user && user.role !== 'admin') router.replace('/dashboard');
  }, [user, isLoading, router]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient('/users');
      if (res.ok) setUsers(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'admin') fetchUsers();
  }, [user, fetchUsers]);

  const createUser = async () => {
    setFormError('');
    if (!form.username || !form.email || !form.password) {
      setFormError('All fields are required');
      return;
    }
    setActionLoading('create');
    try {
      const res = await apiClient('/users', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.detail || 'Failed to create user');
        return;
      }
      setShowCreate(false);
      setForm({ username: '', email: '', password: '', role: 'viewer' });
      await fetchUsers();
    } finally {
      setActionLoading(null);
    }
  };

  const unlockUser = async (id: string) => {
    setActionLoading(id);
    try {
      await apiClient(`/users/${id}/unlock`, { method: 'POST' });
      await fetchUsers();
    } finally {
      setActionLoading(null);
    }
  };

  const deleteUser = async (id: string) => {
    if (!confirm('Delete this user?')) return;
    setActionLoading(id);
    try {
      await apiClient(`/users/${id}`, { method: 'DELETE' });
      await fetchUsers();
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (d?: string) =>
    d ? new Date(d).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }) : 'Never';

  if (isLoading || !user || user.role !== 'admin') return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage platform users and their roles
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm text-foreground/80 hover:bg-muted transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm text-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New User
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card/60 p-4">
          <p className="text-sm text-muted-foreground">Total Users</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{users.length}</p>
        </div>
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
          <p className="text-sm text-red-400">Admins</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {users.filter(u => u.role === 'admin').length}
          </p>
        </div>
        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
          <p className="text-sm text-primary">Managers</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {users.filter(u => u.role === 'manager').length}
          </p>
        </div>
        <div className="rounded-2xl border border-border/40 bg-muted/30 p-4">
          <p className="text-sm text-muted-foreground">Viewers</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {users.filter(u => u.role === 'viewer').length}
          </p>
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Create User</h2>
              <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Username</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-cyan-500 focus:outline-none"
                  placeholder="john_doe"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-cyan-500 focus:outline-none"
                  placeholder="john@company.com"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-cyan-500 focus:outline-none"
                  placeholder="Min 8 chars, 1 uppercase, 1 digit"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Role</label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-cyan-500 focus:outline-none"
                >
                  <option value="viewer">Viewer</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              {formError && (
                <p className="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-400">
                  {formError}
                </p>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowCreate(false)}
                  className="flex-1 rounded-xl bg-muted px-4 py-2 text-sm text-foreground/80 hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={createUser}
                  disabled={actionLoading === 'create'}
                  className="flex-1 rounded-xl bg-primary px-4 py-2 text-sm text-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {actionLoading === 'create' ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Users Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-5 py-3 text-left text-xs text-muted-foreground">User</th>
                <th className="px-5 py-3 text-left text-xs text-muted-foreground">Role</th>
                <th className="px-5 py-3 text-left text-xs text-muted-foreground">Status</th>
                <th className="px-5 py-3 text-left text-xs text-muted-foreground">MFA</th>
                <th className="px-5 py-3 text-left text-xs text-muted-foreground">Last Login</th>
                <th className="px-5 py-3 text-left text-xs text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-muted/30">
                  <td className="px-5 py-4">
                    <div>
                      <p className="font-medium text-foreground">{u.username}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`rounded-lg px-2 py-1 text-xs font-medium capitalize ${ROLE_STYLES[u.role]}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${
                        u.is_locked ? 'bg-red-400' :
                        u.is_active ? 'bg-green-400' : 'bg-slate-500'
                      }`} />
                      <span className="text-xs text-muted-foreground">
                        {u.is_locked ? 'Locked' : u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`flex items-center gap-1 text-xs ${
                      u.mfa_enabled ? 'text-green-400' : 'text-muted-foreground'
                    }`}>
                      <Shield className="h-3 w-3" />
                      {u.mfa_enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-xs text-muted-foreground">
                    {formatDate(u.last_login)}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      {u.is_locked && (
                        <button
                          onClick={() => unlockUser(u.id)}
                          disabled={actionLoading === u.id}
                          className="flex items-center gap-1 rounded-lg bg-yellow-500/10 px-2 py-1 text-xs text-yellow-400 hover:bg-yellow-500/20 transition-colors"
                        >
                          <Unlock className="h-3 w-3" />
                          Unlock
                        </button>
                      )}
                      {u.id !== user.id && (
                        <button
                          onClick={() => deleteUser(u.id)}
                          disabled={actionLoading === u.id}
                          className="flex items-center gap-1 rounded-lg bg-red-500/10 px-2 py-1 text-xs text-red-400 hover:bg-red-500/20 transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </button>
                      )}
                      {!u.is_locked && u.id === user.id && (
                        <span className="text-xs text-muted-foreground">You</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}