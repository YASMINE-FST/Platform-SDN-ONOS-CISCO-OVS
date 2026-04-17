'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { apiClient } from '@/lib/api';
import {
  Shield, RefreshCw, AlertTriangle, CheckCircle,
  Clock, User, ChevronRight, X, Activity,
  Zap, Target, Globe, Filter
} from 'lucide-react';

interface Incident {
  id: string;
  title: string;
  description?: string;
  severity: string;
  status: string;
  alert_count: number;
  source_ips: string[];
  mitre_tactics: string[];
  mitre_techniques: string[];
  first_seen: string;
  last_seen: string;
  created_at: string;
}

interface SIEMStats {
  total_incidents: number;
  open_incidents: number;
  critical_incidents: number;
  total_events: number;
  incidents_by_severity: Record<string, number>;
  incidents_by_status: Record<string, number>;
  top_source_ips: Array<{ ip: string; count: number }>;
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high:     'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium:   'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low:      'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

const STATUS_STYLES: Record<string, string> = {
  open:          'bg-red-500/20 text-red-400',
  investigating: 'bg-yellow-500/20 text-yellow-400',
  contained:     'bg-blue-500/20 text-blue-400',
  resolved:      'bg-green-500/20 text-green-400',
};

const SEVERITY_BAR: Record<string, string> = {
  critical: 'bg-red-500',
  high:     'bg-orange-500',
  medium:   'bg-yellow-500',
  low:      'bg-blue-500',
};

export default function SIEMPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [stats, setStats] = useState<SIEMStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Incident | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [updating, setUpdating] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [user, isLoading, router]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (filterStatus) params.set('status', filterStatus);
      if (filterSeverity) params.set('severity', filterSeverity);

      const [incRes, statsRes] = await Promise.all([
        apiClient(`/siem/incidents?${params}`),
        apiClient('/siem/stats'),
      ]);
      if (incRes.ok) setIncidents(await incRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterSeverity]);

  useEffect(() => {
    if (user) fetchAll();
  }, [user, fetchAll]);

  const triggerSIEM = async () => {
    setTriggering(true);
    try {
      await apiClient('/siem/trigger', { method: 'POST' });
      await fetchAll();
    } finally {
      setTriggering(false);
    }
  };

  const updateIncident = async (id: string, body: object) => {
    setUpdating(true);
    try {
      const res = await apiClient(`/siem/incidents/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      if (res.ok) {
        await fetchAll();
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
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">SIEM — Security Incidents</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Automated correlation engine • Rules fire every 30 seconds
          </p>
        </div>
        <div className="flex items-center gap-3">
          {canAct && (
            <button
              onClick={triggerSIEM}
              disabled={triggering}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm text-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Zap className={`h-4 w-4 ${triggering ? 'animate-pulse' : ''}`} />
              {triggering ? 'Running...' : 'Trigger SIEM'}
            </button>
          )}
          <button
            onClick={fetchAll}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm text-foreground/80 hover:bg-muted"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-xl border border-border bg-card/60 p-4">
            <p className="text-sm text-muted-foreground">Total Incidents</p>
            <p className="mt-1 text-3xl font-bold text-foreground">{stats.total_incidents}</p>
          </div>
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
            <p className="text-sm text-red-400">Open</p>
            <p className="mt-1 text-3xl font-bold text-foreground">{stats.open_incidents}</p>
          </div>
          <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-4">
            <p className="text-sm text-orange-400">Critical</p>
            <p className="mt-1 text-3xl font-bold text-foreground">{stats.critical_incidents}</p>
          </div>
          <div className="rounded-2xl border border-border/40 bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">SIEM Events</p>
            <p className="mt-1 text-3xl font-bold text-foreground">{stats.total_events}</p>
          </div>
        </div>
      )}

      {/* Severity bars + Top IPs */}
      {stats && (
        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card/60 p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Incidents by Severity</h3>
            <div className="space-y-2">
              {Object.entries(stats.incidents_by_severity).map(([sev, cnt]) => {
                const total = stats.total_incidents || 1;
                const pct = Math.round((cnt / total) * 100);
                return (
                  <div key={sev} className="flex items-center gap-3">
                    <span className="w-16 text-xs capitalize text-muted-foreground">{sev}</span>
                    <div className="flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-2 rounded-full transition-all ${SEVERITY_BAR[sev] || 'bg-slate-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-6 text-right text-xs text-muted-foreground">{cnt}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card/60 p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground flex items-center gap-2">
              <Globe className="h-4 w-4 text-red-400" />
              Top Threat IPs
            </h3>
            {stats.top_source_ips.length === 0 ? (
              <p className="text-sm text-muted-foreground">No threat IPs detected</p>
            ) : (
              <div className="space-y-2">
                {stats.top_source_ips.slice(0, 5).map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="font-mono text-xs text-foreground">{item.ip}</span>
                    <span className="rounded-lg bg-red-500/20 px-2 py-0.5 text-xs text-red-400">
                      {item.count} incidents
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex items-center gap-3">
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
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="rounded-xl border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:border-cyan-500"
        >
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="investigating">Investigating</option>
          <option value="contained">Contained</option>
          <option value="resolved">Resolved</option>
        </select>
        <span className="ml-auto text-sm text-muted-foreground">
          {incidents.length} incident{incidents.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex gap-6">
        {/* Incidents List */}
        <div className="flex-1 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : incidents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <CheckCircle className="mb-3 h-12 w-12" />
              <p>No incidents — network is clean</p>
              {canAct && (
                <button
                  onClick={triggerSIEM}
                  className="mt-4 rounded-xl bg-primary/20 px-4 py-2 text-sm text-primary hover:bg-primary/30"
                >
                  Run SIEM Analysis
                </button>
              )}
            </div>
          ) : (
            incidents.map(inc => (
              <div
                key={inc.id}
                onClick={() => { setSelected(inc); setNotes(inc.description || ''); }}
                className={`cursor-pointer rounded-xl border border-border bg-card/60 p-4 transition-all hover:border-border ${
                  selected?.id === inc.id ? 'border-cyan-500/50' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`rounded-lg border px-2 py-0.5 text-xs font-medium capitalize ${SEVERITY_STYLES[inc.severity] || ''}`}>
                        {inc.severity}
                      </span>
                      <span className={`rounded-lg px-2 py-0.5 text-xs capitalize ${STATUS_STYLES[inc.status] || ''}`}>
                        {inc.status}
                      </span>
                      <span className="rounded-lg bg-muted px-2 py-0.5 text-xs text-foreground/80">
                        {inc.alert_count} alerts
                      </span>
                      {inc.mitre_tactics.slice(0, 2).map(t => (
                        <span key={t} className="rounded-lg bg-purple-500/10 px-2 py-0.5 text-xs text-purple-400">
                          {t}
                        </span>
                      ))}
                    </div>
                    <p className="mt-1.5 font-medium text-foreground truncate">{inc.title}</p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      {inc.source_ips.slice(0, 2).map(ip => (
                        <span key={ip} className="font-mono">{ip}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-xs text-muted-foreground">{formatDate(inc.created_at)}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Detail Panel */}
        {selected && (
          <div className="w-80 shrink-0">
            <div className="sticky top-6 rounded-xl border border-border bg-card/80 p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Incident Detail</h3>
                <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Title</p>
                  <p className="text-xs text-foreground">{selected.title}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Severity</p>
                    <span className={`inline-block rounded-lg border px-2 py-0.5 text-xs capitalize ${SEVERITY_STYLES[selected.severity] || ''}`}>
                      {selected.severity}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Alerts</p>
                    <p className="text-xs font-bold text-foreground">{selected.alert_count}</p>
                  </div>
                </div>

                {selected.source_ips.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Source IPs</p>
                    {selected.source_ips.map(ip => (
                      <span key={ip} className="mr-1 inline-block rounded-lg bg-red-500/10 px-2 py-0.5 font-mono text-xs text-red-400">
                        {ip}
                      </span>
                    ))}
                  </div>
                )}

                {selected.mitre_tactics.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">MITRE Tactics</p>
                    <div className="flex flex-wrap gap-1">
                      {selected.mitre_tactics.map(t => (
                        <span key={t} className="rounded-lg bg-purple-500/10 px-2 py-0.5 text-xs text-purple-400">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selected.mitre_techniques.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Techniques</p>
                    {selected.mitre_techniques.slice(0, 3).map(t => (
                      <p key={t} className="text-xs text-foreground/80">{t}</p>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">First seen</p>
                    <p className="text-xs text-foreground/80">{formatDate(selected.first_seen)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Last seen</p>
                    <p className="text-xs text-foreground/80">{formatDate(selected.last_seen)}</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              {canAct && selected.status !== 'resolved' && (
                <div className="mt-5 space-y-2">
                  <p className="text-xs text-muted-foreground">Update Status</p>
                  <div className="grid grid-cols-2 gap-2">
                    {selected.status === 'open' && (
                      <button
                        onClick={() => updateIncident(selected.id, { status: 'investigating' })}
                        disabled={updating}
                        className="rounded-xl bg-yellow-500/20 px-2 py-1.5 text-xs text-yellow-400 hover:bg-yellow-500/30 transition-colors"
                      >
                        Investigating
                      </button>
                    )}
                    {['open', 'investigating'].includes(selected.status) && (
                      <button
                        onClick={() => updateIncident(selected.id, { status: 'contained' })}
                        disabled={updating}
                        className="rounded-xl bg-blue-500/20 px-2 py-1.5 text-xs text-blue-400 hover:bg-blue-500/30 transition-colors"
                      >
                        Contained
                      </button>
                    )}
                    <button
                      onClick={() => updateIncident(selected.id, { status: 'resolved' })}
                      disabled={updating}
                      className="col-span-2 rounded-xl bg-green-500/20 px-2 py-1.5 text-xs text-green-400 hover:bg-green-500/30 transition-colors"
                    >
                      Mark Resolved
                    </button>
                  </div>

                  <div className="mt-3">
                    <p className="mb-1 text-xs text-muted-foreground">Notes</p>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      rows={3}
                      className="w-full rounded-xl border border-border bg-muted px-3 py-2 text-xs text-foreground placeholder-slate-500 focus:border-cyan-500 focus:outline-none resize-none"
                      placeholder="Add investigation notes..."
                    />
                    <button
                      onClick={() => updateIncident(selected.id, { notes })}
                      disabled={updating}
                      className="mt-1 w-full rounded-xl bg-muted px-3 py-1.5 text-xs text-foreground/80 hover:bg-slate-600 transition-colors"
                    >
                      Save Notes
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}