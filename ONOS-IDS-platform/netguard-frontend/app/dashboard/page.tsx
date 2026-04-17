'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { apiClient } from '@/lib/api';
import {
  Shield, AlertTriangle, Activity, Server, Wifi, Brain,
  RefreshCw, Network, AppWindow, GitBranch, Monitor,
  Heart, Users, ChevronRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface Stats {
  total_alerts: number;
  open_alerts: number;
  critical_alerts: number;
  total_devices: number;
  active_devices: number;
  total_flows: number;
  anomalies_24h: number;
  alerts_by_severity: Record<string, number>;
}

interface Overview {
  timestamp: string;
  controller: { url: string; reachable: boolean };
  cluster: { total: number; online: number; nodes: { id: string; ip: string; status: string }[] };
  devices: { total: number; available: number };
  links: { total: number };
  hosts: { total: number };
  applications: { total: number; active: number };
  flows: { total: number };
  intents: { total: number; installed: number; failed: number };
  alerts: { total: number; open: number; critical: number };
  health: { score: number; status: string };
}

interface TimelinePoint {
  hour: string;
  count: number;
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'bg-critical',
  high:     'bg-warning',
  medium:   'bg-yellow-400',
  low:      'bg-info',
  info:     'bg-muted-foreground',
};

const SEVERITY_BADGE: Record<string, 'critical' | 'warning' | 'info' | 'default'> = {
  critical: 'critical',
  high:     'warning',
  medium:   'warning',
  low:      'info',
  info:     'default',
};

function HealthCircle({ score }: { score: number }) {
  const r = 36;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  const color =
    score >= 80 ? 'text-emerald-500' :
    score >= 50 ? 'text-yellow-500' :
    'text-red-500';

  return (
    <div className="relative flex items-center justify-center">
      <svg width="88" height="88" className="-rotate-90">
        <circle cx="44" cy="44" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/30" />
        <circle
          cx="44" cy="44" r={r} fill="none" strokeWidth="6"
          stroke="currentColor"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={color}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-xl font-bold ${color}`}>{score}</span>
        <span className="text-[10px] text-muted-foreground">health</span>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const [statsRes, overviewRes, timelineRes] = await Promise.all([
        apiClient('/dashboard/stats'),
        apiClient('/dashboard/overview'),
        apiClient('/dashboard/timeline?hours=24'),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (overviewRes.ok) setOverview(await overviewRes.json());
      if (timelineRes.ok) setTimeline(await timelineRes.json());
    } finally {
      setLoadingStats(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user) fetchAll();
  }, [user]);

  const cards = [
    {
      label: 'Total Alerts',
      value: stats?.total_alerts,
      sub: `${stats?.open_alerts ?? 0} open`,
      icon: AlertTriangle,
      iconColor: 'text-warning',
      iconBg: 'bg-warning/10',
      href: '/dashboard/alerts',
    },
    {
      label: 'Critical Alerts',
      value: stats?.critical_alerts,
      sub: 'Immediate attention',
      icon: Shield,
      iconColor: 'text-critical',
      iconBg: 'bg-critical/10',
      href: '/dashboard/alerts',
    },
    {
      label: 'Devices',
      value: overview?.devices.total ?? stats?.total_devices,
      sub: `${overview?.devices.available ?? stats?.active_devices ?? 0} available`,
      icon: Server,
      iconColor: 'text-primary',
      iconBg: 'bg-primary/10',
      href: '/dashboard/devices',
    },
    {
      label: 'Flow Rules',
      value: overview?.flows.total ?? stats?.total_flows,
      sub: 'OpenFlow rules',
      icon: Wifi,
      iconColor: 'text-info',
      iconBg: 'bg-info/10',
      href: '/dashboard/network-flows',
    },
    {
      label: 'AI Anomalies',
      value: stats?.anomalies_24h,
      sub: 'Last 24 h',
      icon: Brain,
      iconColor: 'text-purple-500',
      iconBg: 'bg-purple-500/10',
      href: '/dashboard/ai-detection',
    },
    {
      label: 'Network Links',
      value: overview?.links.total,
      sub: `${overview?.hosts.total ?? 0} hosts`,
      icon: Network,
      iconColor: 'text-cyan-500',
      iconBg: 'bg-cyan-500/10',
      href: '/dashboard/topology',
    },
  ];

  // Mini timeline SVG
  const renderTimeline = () => {
    if (timeline.length < 2) return null;
    const maxCount = Math.max(...timeline.map(t => t.count), 1);
    const W = 500, H = 60;
    const pts = timeline.map((t, i) => {
      const x = (i / (timeline.length - 1)) * W;
      const y = H - (t.count / maxCount) * (H - 4) - 2;
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16" preserveAspectRatio="none">
        <defs>
          <linearGradient id="atg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`0,${H} ${pts} ${W},${H}`} fill="url(#atg)" />
        <polyline points={pts} fill="none" stroke="#f59e0b" strokeWidth="2" />
      </svg>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-serif">Security Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Real-time overview · Welcome, <span className="font-medium text-foreground">{user?.username}</span>
          </p>
        </div>
        <button
          onClick={() => fetchAll(true)}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ONOS Controller Status + Health Score */}
      {overview && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          {/* Health Score */}
          <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-5">
            <HealthCircle score={overview.health.score} />
            <div>
              <p className="text-sm font-semibold text-foreground">System Health</p>
              <p className={`text-xs capitalize ${
                overview.health.status === 'healthy' ? 'text-emerald-500' :
                overview.health.status === 'degraded' ? 'text-yellow-500' :
                'text-red-500'
              }`}>
                {overview.health.status}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Controller {overview.controller.reachable ? 'connected' : 'unreachable'}
              </p>
            </div>
          </div>

          {/* Cluster */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-2">
              <Monitor className="h-4 w-4 text-cyan-500" />
              <p className="text-sm font-semibold text-foreground">Cluster</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{overview.cluster.online}/{overview.cluster.total}</p>
            <p className="text-xs text-muted-foreground">nodes online</p>
            {overview.cluster.nodes.length > 0 && (
              <div className="mt-2 space-y-1">
                {overview.cluster.nodes.map(n => (
                  <div key={n.id} className="flex items-center gap-2 text-xs">
                    <span className={`h-1.5 w-1.5 rounded-full ${n.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    <span className="text-muted-foreground">{n.ip}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Applications */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-2">
              <AppWindow className="h-4 w-4 text-purple-500" />
              <p className="text-sm font-semibold text-foreground">Applications</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{overview.applications.active}</p>
            <p className="text-xs text-muted-foreground">{overview.applications.total} total · {overview.applications.active} active</p>
            <Link
              href="/dashboard/onos-apps"
              className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Manage <ChevronRight className="h-3 w-3" />
            </Link>
          </div>

          {/* Intents */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-2">
              <GitBranch className="h-4 w-4 text-blue-500" />
              <p className="text-sm font-semibold text-foreground">Intents</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{overview.intents.total}</p>
            <div className="mt-1 flex gap-3 text-xs">
              <span className="text-emerald-500">{overview.intents.installed} installed</span>
              {overview.intents.failed > 0 && (
                <span className="text-red-500">{overview.intents.failed} failed</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md group"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{card.label}</p>
                <p className="text-3xl font-bold text-foreground">
                  {loadingStats ? (
                    <span className="inline-block h-8 w-16 animate-pulse rounded bg-muted" />
                  ) : (
                    card.value ?? '—'
                  )}
                </p>
                <p className="text-xs text-muted-foreground">{card.sub}</p>
              </div>
              <div className={`rounded-xl p-3 ${card.iconBg} group-hover:scale-110 transition-transform`}>
                <card.icon className={`h-6 w-6 ${card.iconColor}`} />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Alert Timeline */}
      {timeline.length > 1 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Activity className="h-4 w-4 text-warning" />
              Alert Timeline (24h)
            </h2>
            <span className="text-xs text-muted-foreground">
              {timeline.reduce((s, t) => s + t.count, 0)} alerts
            </span>
          </div>
          {renderTimeline()}
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>{new Date(timeline[0]?.hour).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <span>{new Date(timeline[timeline.length - 1]?.hour).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      )}

      {/* Alerts by Severity */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Alerts by Severity</h2>
          <span className="text-xs text-muted-foreground">
            {stats?.total_alerts ?? 0} total
          </span>
        </div>

        {loadingStats ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                <div className="h-2 flex-1 animate-pulse rounded-full bg-muted" />
                <div className="h-3 w-6 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : stats ? (
          <div className="space-y-3">
            {Object.entries(stats.alerts_by_severity).map(([sev, count]) => {
              const total = stats.total_alerts || 1;
              const pct = Math.round((count / total) * 100);
              return (
                <div key={sev} className="flex items-center gap-3">
                  <div className="flex w-20 items-center gap-2">
                    <Badge variant={SEVERITY_BADGE[sev] ?? 'default'} className="capitalize text-[10px]">
                      {sev}
                    </Badge>
                  </div>
                  <div className="flex-1 overflow-hidden rounded-full bg-muted h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${SEVERITY_COLOR[sev] ?? 'bg-muted-foreground'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-xs font-medium text-muted-foreground">{count}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No data available.</p>
        )}
      </div>

      {/* Quick summary footer */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${overview?.controller.reachable ? 'bg-success' : 'bg-red-500'}`} />
              <span className={`relative inline-flex h-2 w-2 rounded-full ${overview?.controller.reachable ? 'bg-success' : 'bg-red-500'}`} />
            </span>
            <span className="text-muted-foreground">
              ONOS Controller {overview?.controller.reachable ? 'connected' : 'unreachable'}
            </span>
          </div>
          <div className="text-muted-foreground">
            Role: <span className="font-medium text-foreground capitalize">{user?.role}</span>
          </div>
          <div className="text-muted-foreground">
            MFA: <span className={`font-medium ${user?.mfa_enabled ? 'text-success' : 'text-warning'}`}>
              {user?.mfa_enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
