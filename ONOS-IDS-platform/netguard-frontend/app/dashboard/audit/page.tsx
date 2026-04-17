'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { apiClient } from '@/lib/api';
import {
  FileText, RefreshCw, Download, Filter,
  CheckCircle, XCircle, User, Clock,
  Globe, Activity, Shield, TrendingUp
} from 'lucide-react';

interface AuditLog {
  id: number;
  username?: string;
  action: string;
  ip_address?: string;
  user_agent?: string;
  success: boolean;
  details?: any;
  created_at: string;
}

interface AuditStats {
  period_days: number;
  total_events: number;
  failed_events: number;
  login_failures: number;
  success_rate: number;
  by_action: Array<{ action: string; count: number }>;
  by_user: Array<{ username: string; count: number }>;
  top_ips: Array<{ ip: string; count: number }>;
}

const ACTION_STYLES: Record<string, string> = {
  login_success:  'bg-green-500/20 text-green-400',
  login_failed:   'bg-red-500/20 text-red-400',
  mfa_success:    'bg-cyan-500/20 text-primary',
  mfa_failed:     'bg-orange-500/20 text-orange-400',
  logout:         'bg-slate-500/20 text-muted-foreground',
  incident_created: 'bg-purple-500/20 text-purple-400',
};

export default function AuditPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);
  const [filterAction, setFilterAction] = useState('');
  const [filterSuccess, setFilterSuccess] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [user, isLoading, router]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ days: String(days), limit: '200' });
      if (filterAction) params.set('action', filterAction);
      if (filterSuccess !== '') params.set('success', filterSuccess);

      const [logsRes, statsRes] = await Promise.all([
        apiClient(`/audit/logs?${params}`),
        apiClient(`/audit/stats?days=${days}`),
      ]);
      if (logsRes.ok) setLogs(await logsRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } finally {
      setLoading(false);
    }
  }, [days, filterAction, filterSuccess]);

  useEffect(() => {
    if (user) fetchAll();
  }, [user, fetchAll]);

  const downloadPDF = async () => {
    setDownloading(true);
    try {
      const res = await apiClient(`/audit/report/pdf?days=${days}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `netguard_report_${days}d.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setDownloading(false);
    }
  };

  const downloadJSON = async () => {
    const res = await apiClient(`/audit/export?days=${days}&format=json`);
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `netguard_audit_${days}d.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const downloadCEF = async () => {
    const res = await apiClient(`/audit/export?days=${days}&format=cef`);
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `netguard_audit_${days}d.cef`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleString('en-GB', {
      day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });

  if (isLoading || !user) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Audit Trail</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete activity log — who did what, when and from where
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            className="rounded-xl border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:border-cyan-500"
          >
            <option value={1}>Last 24h</option>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>

          {/* Export buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={downloadPDF}
              disabled={downloading}
              className="flex items-center gap-2 rounded-xl bg-red-700/80 px-3 py-2 text-sm text-foreground hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              <FileText className="h-4 w-4" />
              PDF Report
            </button>
            <button
              onClick={downloadJSON}
              className="flex items-center gap-2 rounded-xl bg-blue-700/80 px-3 py-2 text-sm text-foreground hover:bg-blue-600 transition-colors"
            >
              <Download className="h-4 w-4" />
              JSON
            </button>
            <button
              onClick={downloadCEF}
              className="flex items-center gap-2 rounded-xl bg-purple-700/80 px-3 py-2 text-sm text-foreground hover:bg-purple-600 transition-colors"
            >
              <Download className="h-4 w-4" />
              CEF
            </button>
          </div>

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
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <p className="text-xs text-muted-foreground">Total Events</p>
            </div>
            <p className="mt-2 text-2xl font-bold text-foreground">{stats.total_events}</p>
            <p className="text-xs text-muted-foreground">Last {stats.period_days} days</p>
          </div>
          <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-400" />
              <p className="text-xs text-green-400">Success Rate</p>
            </div>
            <p className="mt-2 text-2xl font-bold text-foreground">{stats.success_rate}%</p>
          </div>
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-400" />
              <p className="text-xs text-red-400">Failed Events</p>
            </div>
            <p className="mt-2 text-2xl font-bold text-foreground">{stats.failed_events}</p>
          </div>
          <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-orange-400" />
              <p className="text-xs text-orange-400">Login Failures</p>
            </div>
            <p className="mt-2 text-2xl font-bold text-foreground">{stats.login_failures}</p>
          </div>
        </div>
      )}

      {/* Charts row */}
      {stats && (
        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* By Action */}
          <div className="rounded-xl border border-border bg-card/60 p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Events by Action</h3>
            <div className="space-y-2">
              {stats.by_action.map(item => {
                const pct = Math.round((item.count / stats.total_events) * 100);
                return (
                  <div key={item.action} className="flex items-center gap-3">
                    <span className="w-28 text-xs text-muted-foreground truncate">{item.action}</span>
                    <div className="flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-1.5 rounded-full bg-cyan-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-8 text-right text-xs text-muted-foreground">{item.count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* By User */}
          <div className="rounded-xl border border-border bg-card/60 p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground flex items-center gap-2">
              <User className="h-4 w-4 text-blue-400" />
              Events by User
            </h3>
            <div className="space-y-2">
              {stats.by_user.map(item => (
                <div key={item.username} className="flex items-center justify-between">
                  <span className="text-xs text-foreground/80 truncate max-w-[150px]">{item.username}</span>
                  <span className="rounded-lg bg-blue-500/20 px-2 py-0.5 text-xs text-blue-400">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Top IPs */}
          <div className="rounded-xl border border-border bg-card/60 p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground flex items-center gap-2">
              <Globe className="h-4 w-4 text-purple-400" />
              Top Source IPs
            </h3>
            <div className="space-y-2">
              {stats.top_ips.map(item => (
                <div key={item.ip} className="flex items-center justify-between">
                  <span className="font-mono text-xs text-foreground/80">{item.ip}</span>
                  <span className="rounded-lg bg-purple-500/20 px-2 py-0.5 text-xs text-purple-400">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <select
          value={filterAction}
          onChange={e => setFilterAction(e.target.value)}
          className="rounded-xl border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:border-cyan-500"
        >
          <option value="">All Actions</option>
          <option value="login_success">Login Success</option>
          <option value="login_failed">Login Failed</option>
          <option value="mfa_success">MFA Success</option>
          <option value="mfa_failed">MFA Failed</option>
          <option value="logout">Logout</option>
        </select>
        <select
          value={filterSuccess}
          onChange={e => setFilterSuccess(e.target.value)}
          className="rounded-xl border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:border-cyan-500"
        >
          <option value="">All Results</option>
          <option value="true">Success only</option>
          <option value="false">Failures only</option>
        </select>
        <span className="ml-auto text-sm text-muted-foreground">{logs.length} events</span>
      </div>

      {/* Logs Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs text-muted-foreground">Time</th>
                <th className="px-4 py-3 text-left text-xs text-muted-foreground">User</th>
                <th className="px-4 py-3 text-left text-xs text-muted-foreground">Action</th>
                <th className="px-4 py-3 text-left text-xs text-muted-foreground">IP Address</th>
                <th className="px-4 py-3 text-left text-xs text-muted-foreground">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {formatDate(log.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-muted">
                        <User className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <span className="text-xs text-foreground">
                        {log.username || 'anonymous'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-lg px-2 py-0.5 text-xs ${
                      ACTION_STYLES[log.action] || 'bg-muted text-foreground/80'
                    }`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {log.ip_address || '—'}
                  </td>
                  <td className="px-4 py-3">
                    {log.success
                      ? <CheckCircle className="h-4 w-4 text-green-400" />
                      : <XCircle className="h-4 w-4 text-red-400" />
                    }
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