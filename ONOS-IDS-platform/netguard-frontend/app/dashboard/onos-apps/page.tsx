'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { apiClient } from '@/lib/api';
import {
  AppWindow, RefreshCw, Play, Square,
  Search, CheckCircle, Package, Zap,
} from 'lucide-react';

interface ONOSApp {
  id: number;
  name: string;
  version: string;
  state: 'ACTIVE' | 'INSTALLED';
  category?: string;
  description?: string;
  origin?: string;
  required_apps: string[];
}

const CATEGORY_COLORS: Record<string, string> = {
  'Security':           'bg-red-500/20 text-red-400',
  'Traffic Engineering':'bg-blue-500/20 text-blue-400',
  'Provider':           'bg-purple-500/20 text-purple-400',
  'Drivers':            'bg-yellow-500/20 text-yellow-400',
  'Monitoring':         'bg-green-500/20 text-green-400',
  'Integration':        'bg-cyan-500/20 text-primary',
  'Test Utility':       'bg-slate-500/20 text-muted-foreground',
};

export default function ONOSAppsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [apps, setApps] = useState<ONOSApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterState, setFilterState] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [essentialsLoading, setEssentialsLoading] = useState(false);
  const [essentialsResult, setEssentialsResult] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [user, isLoading, router]);

  const fetchApps = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient('/onos/apps');
      if (res.ok) {
        const data = await res.json();
        setApps(data.apps || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchApps();
  }, [user, fetchApps]);

  const activateEssentials = async () => {
    if (user?.role !== 'admin') return;
    setEssentialsLoading(true);
    setEssentialsResult(null);
    try {
      const res = await apiClient('/onos/apps/essentials/activate', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        const results = data.results || {};
        const ok = Object.values(results).filter((v) => v === 'ACTIVE').length;
        const total = Object.keys(results).length;
        setEssentialsResult(`${ok}/${total} essential apps active`);
        await fetchApps();
      } else {
        setEssentialsResult(`Failed: HTTP ${res.status}`);
      }
    } catch (e) {
      setEssentialsResult(`Error: ${(e as Error).message}`);
    } finally {
      setEssentialsLoading(false);
      setTimeout(() => setEssentialsResult(null), 4000);
    }
  };

  const toggleApp = async (app: ONOSApp) => {
    if (user?.role !== 'admin') return;
    setActionLoading(app.name);
    try {
      if (app.state === 'ACTIVE') {
        await apiClient(`/onos/apps/${app.name}/activate`, { method: 'DELETE' });
      } else {
        await apiClient(`/onos/apps/${app.name}/activate`, { method: 'POST' });
      }
      await fetchApps();
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = apps.filter(a => {
    const matchSearch = a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.description?.toLowerCase().includes(search.toLowerCase()) ||
      a.category?.toLowerCase().includes(search.toLowerCase());
    const matchState = filterState ? a.state === filterState : true;
    return matchSearch && matchState;
  });

  const active = apps.filter(a => a.state === 'ACTIVE').length;
  const installed = apps.filter(a => a.state === 'INSTALLED').length;

  if (isLoading || !user) return null;

  const isAdmin = user.role === 'admin';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">ONOS Applications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage ONOS apps — activate or deactivate network services
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={activateEssentials}
              disabled={essentialsLoading}
              title="Active en un clic fwd, proxyarp, vpls, lldp, hostprovider, netcfghostprovider…"
              className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-sm text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              <Zap className={`h-4 w-4 ${essentialsLoading ? 'animate-pulse' : ''}`} />
              {essentialsLoading ? 'Activating…' : 'Activate essentials'}
            </button>
          )}
          <button
            onClick={fetchApps}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm text-foreground/80 hover:bg-muted transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>
      {essentialsResult && (
        <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary">
          {essentialsResult}
        </div>
      )}

      {/* Stats */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card/60 p-4">
          <p className="text-sm text-muted-foreground">Total Apps</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{apps.length}</p>
        </div>
        <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-4">
          <p className="text-sm text-green-400">Active</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{active}</p>
        </div>
        <div className="rounded-2xl border border-border/40 bg-muted/30 p-4">
          <p className="text-sm text-muted-foreground">Installed</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{installed}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search apps..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-xl border border-border bg-muted py-2 pl-9 pr-3 text-sm text-foreground placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>
        <select
          value={filterState}
          onChange={e => setFilterState(e.target.value)}
          className="rounded-xl border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:border-cyan-500"
        >
          <option value="">All States</option>
          <option value="ACTIVE">Active</option>
          <option value="INSTALLED">Installed</option>
        </select>
        <span className="ml-auto text-sm text-muted-foreground">
          {filtered.length} app{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Apps List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(app => (
            <div
              key={app.name}
              className="flex items-center gap-4 rounded-xl border border-border bg-card/60 px-5 py-4 transition-all hover:border-border"
            >
              {/* Icon */}
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                app.state === 'ACTIVE' ? 'bg-green-500/10' : 'bg-muted'
              }`}>
                {app.state === 'ACTIVE'
                  ? <CheckCircle className="h-5 w-5 text-green-400" />
                  : <Package className="h-5 w-5 text-muted-foreground" />
                }
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-foreground text-sm truncate">
                    {app.name.replace('org.onosproject.', '')}
                  </p>
                  <span className="text-xs text-muted-foreground">v{app.version.replace('.SNAPSHOT', '')}</span>
                  {app.category && (
                    <span className={`rounded-lg px-2 py-0.5 text-xs ${
                      CATEGORY_COLORS[app.category] || 'bg-muted text-muted-foreground'
                    }`}>
                      {app.category}
                    </span>
                  )}
                </div>
                {app.description && (
                  <p className="mt-0.5 text-xs text-muted-foreground truncate max-w-xl">
                    {app.description}
                  </p>
                )}
              </div>

              {/* State badge */}
              <span className={`shrink-0 rounded-lg px-2 py-1 text-xs font-medium ${
                app.state === 'ACTIVE'
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {app.state}
              </span>

              {/* Toggle button — admin only */}
              {isAdmin && (
                <button
                  onClick={() => toggleApp(app)}
                  disabled={actionLoading === app.name}
                  className={`shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs transition-colors disabled:opacity-50 ${
                    app.state === 'ACTIVE'
                      ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                      : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                  }`}
                >
                  {actionLoading === app.name ? (
                    <RefreshCw className="h-3 w-3 animate-spin" />
                  ) : app.state === 'ACTIVE' ? (
                    <><Square className="h-3 w-3" /> Deactivate</>
                  ) : (
                    <><Play className="h-3 w-3" /> Activate</>
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}