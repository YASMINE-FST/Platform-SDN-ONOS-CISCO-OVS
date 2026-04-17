'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { apiClient } from '@/lib/api';
import {
  Shield, ArrowLeft, RefreshCw, AlertTriangle,
  CheckCircle, Eye, Filter, XCircle
} from 'lucide-react';

interface Alert {
  id: string;
  title: string;
  description?: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  status: 'open' | 'acknowledged' | 'resolved' | 'false_positive';
  source_ip?: string;
  destination_ip?: string;
  protocol?: string;
  mitre_tactic?: string;
  mitre_technique?: string;
  created_at: string;
  acknowledged_at?: string;
  resolved_at?: string;
}

const SEVERITY_STYLES = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high:     'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium:   'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low:      'bg-blue-500/20 text-blue-400 border-blue-500/30',
  info:     'bg-slate-500/20 text-muted-foreground border-slate-500/30',
};

const STATUS_STYLES = {
  open:           'bg-red-500/20 text-red-400',
  acknowledged:   'bg-yellow-500/20 text-yellow-400',
  resolved:       'bg-green-500/20 text-green-400',
  false_positive: 'bg-slate-500/20 text-muted-foreground',
};

const STATUS_ICONS = {
  open:           AlertTriangle,
  acknowledged:   Eye,
  resolved:       CheckCircle,
  false_positive: XCircle,
};

export default function AlertsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selected, setSelected] = useState<Alert | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [user, isLoading, router]);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterSeverity) params.set('severity', filterSeverity);
      if (filterStatus) params.set('status', filterStatus);
      params.set('limit', '100');

      const res = await apiClient(`/alerts?${params}`);
      if (res.ok) setAlerts(await res.json());
    } finally {
      setLoading(false);
    }
  }, [filterSeverity, filterStatus]);

  useEffect(() => {
    if (user) fetchAlerts();
  }, [user, fetchAlerts]);

  const updateStatus = async (id: string, status: string) => {
    if (!['admin', 'manager'].includes(user?.role ?? '')) return;
    setUpdating(true);
    try {
      const res = await apiClient(`/alerts/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        await fetchAlerts();
        setSelected(null);
      }
    } finally {
      setUpdating(false);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleString('en-GB', {
      day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit',
    });

  if (isLoading || !user) return null;

  const canAct = ['admin', 'manager'].includes(user.role);

  return (
    <div className="min-h-screen bg-[#08111d] text-foreground">
      {/* Navbar */}
      <nav className="border-b border-border bg-background/80 backdrop-blur px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
              <Shield className="h-5 w-5 text-foreground" />
            </div>
            <span className="text-lg font-bold">Security Alerts</span>
            <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-400">
              {alerts.filter(a => a.status === 'open').length} open
            </span>
          </div>
          <button
            onClick={fetchAlerts}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm text-foreground/80 hover:bg-muted transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-6 py-6">
        {/* Filters */}
        <div className="mb-6 flex items-center gap-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={filterSeverity}
            onChange={e => setFilterSeverity(e.target.value)}
            className="rounded-xl border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:border-cyan-500"
          >
            <option value="">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="info">Info</option>
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="rounded-xl border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:border-cyan-500"
          >
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="resolved">Resolved</option>
            <option value="false_positive">False Positive</option>
          </select>
          {(filterSeverity || filterStatus) && (
            <button
              onClick={() => { setFilterSeverity(''); setFilterStatus(''); }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear filters
            </button>
          )}
          <span className="ml-auto text-sm text-muted-foreground">
            {alerts.length} alert{alerts.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex gap-6">
          {/* Alerts List */}
          <div className="flex-1 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <CheckCircle className="mb-3 h-12 w-12" />
                <p>No alerts found</p>
              </div>
            ) : (
              alerts.map(alert => {
                const StatusIcon = STATUS_ICONS[alert.status];
                return (
                  <div
                    key={alert.id}
                    onClick={() => setSelected(alert)}
                    className={`cursor-pointer rounded-xl border border-border bg-card/60 p-4 transition-all hover:border-border hover:bg-card ${
                      selected?.id === alert.id ? 'border-cyan-500/50 bg-card' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`rounded-lg border px-2 py-0.5 text-xs font-medium capitalize ${SEVERITY_STYLES[alert.severity]}`}>
                            {alert.severity}
                          </span>
                          <span className={`flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs capitalize ${STATUS_STYLES[alert.status]}`}>
                            <StatusIcon className="h-3 w-3" />
                            {alert.status}
                          </span>
                          {alert.mitre_tactic && (
                            <span className="rounded-lg bg-purple-500/10 px-2 py-0.5 text-xs text-purple-400">
                              {alert.mitre_tactic}
                            </span>
                          )}
                        </div>
                        <p className="mt-1.5 font-medium text-foreground truncate">{alert.title}</p>
                        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                          {alert.source_ip && <span>src: {alert.source_ip}</span>}
                          {alert.destination_ip && <span>dst: {alert.destination_ip}</span>}
                          {alert.protocol && <span>{alert.protocol}</span>}
                        </div>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatDate(alert.created_at)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Detail Panel */}
          {selected && (
            <div className="w-80 shrink-0">
              <div className="sticky top-6 rounded-xl border border-border bg-card/80 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">Alert Detail</h3>
                  <button
                    onClick={() => setSelected(null)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Title</p>
                    <p className="text-foreground">{selected.title}</p>
                  </div>
                  {selected.description && (
                    <div>
                      <p className="text-xs text-muted-foreground">Description</p>
                      <p className="text-foreground/80">{selected.description}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Severity</p>
                      <span className={`inline-block rounded-lg border px-2 py-0.5 text-xs capitalize ${SEVERITY_STYLES[selected.severity]}`}>
                        {selected.severity}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Status</p>
                      <span className={`inline-block rounded-lg px-2 py-0.5 text-xs capitalize ${STATUS_STYLES[selected.status]}`}>
                        {selected.status}
                      </span>
                    </div>
                  </div>
                  {selected.source_ip && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Source IP</p>
                        <p className="font-mono text-xs text-foreground">{selected.source_ip}</p>
                      </div>
                      {selected.destination_ip && (
                        <div>
                          <p className="text-xs text-muted-foreground">Dest IP</p>
                          <p className="font-mono text-xs text-foreground">{selected.destination_ip}</p>
                        </div>
                      )}
                    </div>
                  )}
                  {selected.mitre_technique && (
                    <div>
                      <p className="text-xs text-muted-foreground">MITRE</p>
                      <p className="text-xs text-purple-400">{selected.mitre_technique}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground">Created</p>
                    <p className="text-xs text-foreground/80">{formatDate(selected.created_at)}</p>
                  </div>
                </div>

                {/* Actions */}
                {canAct && selected.status === 'open' && (
                  <div className="mt-5 space-y-2">
                    <p className="text-xs text-muted-foreground">Actions</p>
                    <button
                      onClick={() => updateStatus(selected.id, 'acknowledged')}
                      disabled={updating}
                      className="w-full rounded-xl bg-yellow-500/20 px-3 py-2 text-sm text-yellow-400 hover:bg-yellow-500/30 transition-colors disabled:opacity-50"
                    >
                      Acknowledge
                    </button>
                    <button
                      onClick={() => updateStatus(selected.id, 'resolved')}
                      disabled={updating}
                      className="w-full rounded-xl bg-green-500/20 px-3 py-2 text-sm text-green-400 hover:bg-green-500/30 transition-colors disabled:opacity-50"
                    >
                      Mark Resolved
                    </button>
                    <button
                      onClick={() => updateStatus(selected.id, 'false_positive')}
                      disabled={updating}
                      className="w-full rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground hover:bg-slate-600 transition-colors disabled:opacity-50"
                    >
                      False Positive
                    </button>
                  </div>
                )}

                {selected.status === 'acknowledged' && canAct && (
                  <div className="mt-5">
                    <button
                      onClick={() => updateStatus(selected.id, 'resolved')}
                      disabled={updating}
                      className="w-full rounded-xl bg-green-500/20 px-3 py-2 text-sm text-green-400 hover:bg-green-500/30 transition-colors"
                    >
                      Mark Resolved
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}