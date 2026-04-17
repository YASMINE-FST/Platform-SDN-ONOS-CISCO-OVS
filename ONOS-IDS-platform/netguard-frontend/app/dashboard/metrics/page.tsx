'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { apiClient } from '@/lib/api';
import {
  Activity, RefreshCw, Server, TrendingUp, TrendingDown,
  Gauge, Flame, Monitor, GitBranch, AlertTriangle,
  Database, FileDown,
} from 'lucide-react';
import { useExportPDF } from '@/hooks/useExportPDF';

interface DeviceMetric {
  device_id: string;
  type: string;
  available: boolean;
  manufacturer: string;
  sw_version: string;
  total_ports: number;
  live_ports: number;
  total_rx_bytes: number;
  total_tx_bytes: number;
  total_rx_packets: number;
  total_tx_packets: number;
  total_bytes: number;
  ports: PortMetric[];
}

interface PortMetric {
  port: string;
  rx_bytes: number;
  tx_bytes: number;
  rx_packets: number;
  tx_packets: number;
  rx_dropped: number;
  tx_dropped: number;
  duration_sec: number;
}

interface Performance {
  summary: {
    total_rx_bytes: number;
    total_tx_bytes: number;
    total_bytes: number;
    total_rx_packets: number;
    total_tx_packets: number;
    total_drops: number;
    total_errors: number;
    port_count: number;
    device_count: number;
  };
  throughput: { rx_bytes_per_sec: number; tx_bytes_per_sec: number };
  utilization: { average: number };
  health: { score: number; drops_pct: number; errors_pct: number };
}

interface HeatmapLink {
  device_id: string;
  device_short: string;
  port: string;
  label: string;
  rx_bytes: number;
  tx_bytes: number;
  throughput: number;
  throughput_bps: number;
  utilization: number;
}

interface ClusterInfo {
  cluster: {
    totalNodes: number;
    onlineNodes: number;
    offlineNodes: number;
    masterNode: string | null;
    nodes: { id: string; ip: string; status: string; lastUpdated?: string }[];
  };
}

interface IntentsSummary {
  summary: { total: number; installed: number; failed: number; other: number };
  intents: { id: string; type: string; state: string; appId: string; key?: string }[];
}

function fmtBytes(b: number): string {
  if (b <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let val = b;
  let i = 0;
  while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
  return `${val.toFixed(1)} ${units[i]}`;
}

function fmtRate(b: number): string {
  return `${fmtBytes(b)}/s`;
}

function HealthGauge({ score }: { score: number }) {
  const r = 44;
  const c = Math.PI * r; // half circle
  const offset = c - (score / 100) * c;
  const color = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative flex items-center justify-center">
      <svg width="120" height="70" viewBox="0 0 120 70">
        <path
          d="M 10 65 A 50 50 0 0 1 110 65"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-muted/30"
          strokeLinecap="round"
        />
        <path
          d="M 10 65 A 50 50 0 0 1 110 65"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute bottom-0 flex flex-col items-center">
        <span className="text-2xl font-bold" style={{ color }}>{score}</span>
        <span className="text-[10px] text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

export default function MetricsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [deviceMetrics, setDeviceMetrics] = useState<DeviceMetric[]>([]);
  const [performance, setPerformance] = useState<Performance | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapLink[]>([]);
  const [cluster, setCluster] = useState<ClusterInfo | null>(null);
  const [intents, setIntents] = useState<IntentsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'devices' | 'heatmap' | 'cluster'>('overview');
  const [selectedDevice, setSelectedDevice] = useState<DeviceMetric | null>(null);

  // PDF export — hooks must stay before any early return.
  const { exportToPDF } = useExportPDF();
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [user, isLoading, router]);

  const fetchAll = useCallback(async () => {
    try {
      const [devRes, perfRes, heatRes, clusterRes, intentsRes] = await Promise.all([
        apiClient('/metrics/devices'),
        apiClient('/metrics/performance'),
        apiClient('/metrics/heatmap'),
        apiClient('/metrics/cluster'),
        apiClient('/metrics/intents'),
      ]);

      if (devRes.ok) {
        const d = await devRes.json();
        setDeviceMetrics(d.metrics || []);
      }
      if (perfRes.ok) setPerformance(await perfRes.json());
      if (heatRes.ok) {
        const d = await heatRes.json();
        setHeatmap(d.topLinks || []);
      }
      if (clusterRes.ok) setCluster(await clusterRes.json());
      if (intentsRes.ok) setIntents(await intentsRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchAll();
  }, [user, fetchAll]);

  if (isLoading || !user) return null;

  const perf = performance;

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      await exportToPDF('metrics-export-root', {
        filename: `metrics-${new Date().toISOString().slice(0, 10)}.pdf`,
        orientation: 'portrait',
      });
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div id="metrics-export-root" className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Network Metrics & Performance</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Real-time network health · Device metrics · Cluster status
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPDF}
            disabled={exporting || loading}
            className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground/80 hover:bg-muted disabled:opacity-50"
            title="Export metrics report as PDF"
          >
            <FileDown className={`h-4 w-4 ${exporting ? 'animate-pulse' : ''}`} />
            {exporting ? 'Exporting…' : 'PDF'}
          </button>
          <button
            onClick={fetchAll}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm text-foreground/80 hover:bg-muted"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Top KPI row */}
      {perf && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {/* Health gauge */}
          <div className="rounded-xl border border-border bg-card p-4 flex flex-col items-center">
            <HealthGauge score={perf.health.score} />
            <p className="text-xs text-muted-foreground mt-1">Network Health</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Database className="h-4 w-4 text-cyan-500" />
              <p className="text-xs text-muted-foreground">Total Traffic</p>
            </div>
            <p className="text-xl font-bold text-foreground">{fmtBytes(perf.summary.total_bytes)}</p>
            <div className="mt-1 flex gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <TrendingDown className="h-3 w-3 text-green-400" />
                {fmtBytes(perf.summary.total_rx_bytes)}
              </span>
              <span className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-blue-400" />
                {fmtBytes(perf.summary.total_tx_bytes)}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Gauge className="h-4 w-4 text-purple-500" />
              <p className="text-xs text-muted-foreground">Throughput</p>
            </div>
            <p className="text-xl font-bold text-foreground">{fmtRate(perf.throughput.rx_bytes_per_sec + perf.throughput.tx_bytes_per_sec)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {perf.utilization.average}% avg utilization
            </p>
          </div>

          <div className={`rounded-xl border p-4 ${
            perf.summary.total_drops > 0
              ? 'border-orange-500/30 bg-orange-500/5'
              : 'border-border bg-card'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className={`h-4 w-4 ${perf.summary.total_drops > 0 ? 'text-orange-400' : 'text-muted-foreground'}`} />
              <p className="text-xs text-muted-foreground">Drops / Errors</p>
            </div>
            <p className="text-xl font-bold text-foreground">{perf.summary.total_drops}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {perf.health.drops_pct}% drop rate · {perf.summary.total_errors} errors
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Server className="h-4 w-4 text-blue-500" />
              <p className="text-xs text-muted-foreground">Infrastructure</p>
            </div>
            <p className="text-xl font-bold text-foreground">{perf.summary.device_count}</p>
            <p className="text-xs text-muted-foreground mt-1">
              devices · {perf.summary.port_count} ports
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        {(['overview', 'devices', 'heatmap', 'cluster'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm capitalize transition-colors ${
              activeTab === tab
                ? 'bg-primary text-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'overview' && <Activity className="h-4 w-4" />}
            {tab === 'devices' && <Server className="h-4 w-4" />}
            {tab === 'heatmap' && <Flame className="h-4 w-4" />}
            {tab === 'cluster' && <Monitor className="h-4 w-4" />}
            {tab}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Device summary cards */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="mb-4 font-semibold text-foreground flex items-center gap-2">
              <Server className="h-4 w-4 text-blue-400" />
              Device Traffic Summary
            </h3>
            <div className="space-y-3">
              {deviceMetrics.slice(0, 8).map((dev, i) => {
                const maxBytes = Math.max(...deviceMetrics.map(d => d.total_bytes), 1);
                const pct = Math.round(dev.total_bytes / maxBytes * 100);
                return (
                  <div key={dev.device_id} className="flex items-center gap-3">
                    <span className="w-4 text-xs text-muted-foreground">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground truncate">{dev.device_id.slice(-8)}</p>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-medium text-foreground">{fmtBytes(dev.total_bytes)}</p>
                      <p className="text-[10px] text-muted-foreground">{dev.total_ports} ports</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top heatmap links */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="mb-4 font-semibold text-foreground flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-400" />
              Top Links by Throughput
            </h3>
            <div className="space-y-3">
              {heatmap.slice(0, 8).map((link, i) => {
                const barColor =
                  link.utilization > 80 ? 'bg-red-500' :
                  link.utilization > 50 ? 'bg-orange-500' :
                  link.utilization > 25 ? 'bg-yellow-500' :
                  'bg-green-500';
                return (
                  <div key={link.label} className="flex items-center gap-3">
                    <span className="w-4 text-xs text-muted-foreground">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground truncate">{link.label}</p>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${link.utilization}%` }} />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-medium text-foreground">{fmtBytes(link.throughput)}</p>
                      <p className="text-[10px] text-muted-foreground">{link.utilization}%</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cluster + Intents summary */}
          {cluster && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-4 font-semibold text-foreground flex items-center gap-2">
                <Monitor className="h-4 w-4 text-cyan-500" />
                ONOS Cluster
              </h3>
              <div className="flex items-center gap-4 mb-3">
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{cluster.cluster.onlineNodes}</p>
                  <p className="text-[10px] text-emerald-500">online</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{cluster.cluster.offlineNodes}</p>
                  <p className="text-[10px] text-red-500">offline</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{cluster.cluster.totalNodes}</p>
                  <p className="text-[10px] text-muted-foreground">total</p>
                </div>
              </div>
              <div className="space-y-2">
                {cluster.cluster.nodes.map(n => (
                  <div key={n.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${n.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      <span className="text-xs text-foreground">{n.ip}</span>
                    </div>
                    <span className={`text-[10px] ${n.status === 'ACTIVE' ? 'text-emerald-500' : 'text-red-500'}`}>
                      {n.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {intents && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-4 font-semibold text-foreground flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-blue-500" />
                Network Intents
              </h3>
              <div className="flex items-center gap-6 mb-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{intents.summary.total}</p>
                  <p className="text-[10px] text-muted-foreground">total</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-emerald-500">{intents.summary.installed}</p>
                  <p className="text-[10px] text-emerald-500">installed</p>
                </div>
                {intents.summary.failed > 0 && (
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-500">{intents.summary.failed}</p>
                    <p className="text-[10px] text-red-500">failed</p>
                  </div>
                )}
              </div>
              {intents.intents.length > 0 && (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {intents.intents.slice(0, 10).map(intent => (
                    <div key={intent.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          intent.state === 'INSTALLED' ? 'bg-emerald-500' :
                          intent.state === 'FAILED' ? 'bg-red-500' :
                          'bg-yellow-500'
                        }`} />
                        <span className="text-xs text-foreground truncate max-w-[140px]">{intent.key || intent.id}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{intent.type}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── DEVICES TAB ── */}
      {activeTab === 'devices' && (
        <div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {deviceMetrics.map(dev => (
              <div
                key={dev.device_id}
                onClick={() => setSelectedDevice(selectedDevice?.device_id === dev.device_id ? null : dev)}
                className={`cursor-pointer rounded-xl border p-4 transition-all ${
                  selectedDevice?.device_id === dev.device_id
                    ? 'border-cyan-500/50 bg-cyan-500/5'
                    : 'border-border bg-card hover:border-border hover:shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${dev.available ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    <p className="text-sm font-semibold text-foreground">{dev.device_id.slice(-8)}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{dev.type}</span>
                </div>
                <p className="text-xl font-bold text-primary">{fmtBytes(dev.total_bytes)}</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <TrendingDown className="h-3 w-3 text-green-400" />
                    RX {fmtBytes(dev.total_rx_bytes)}
                  </span>
                  <span className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-blue-400" />
                    TX {fmtBytes(dev.total_tx_bytes)}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {dev.live_ports}/{dev.total_ports} ports live
                  {dev.manufacturer && ` · ${dev.manufacturer}`}
                </p>
              </div>
            ))}
          </div>

          {/* Port details */}
          {selectedDevice && (
            <div className="mt-4 rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-foreground">
                  {selectedDevice.device_id} — Port Details
                </p>
                <button onClick={() => setSelectedDevice(null)} className="text-muted-foreground hover:text-foreground">
                  ✕
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border">
                      <th className="pb-2 text-left">Port</th>
                      <th className="pb-2 text-right">RX Bytes</th>
                      <th className="pb-2 text-right">TX Bytes</th>
                      <th className="pb-2 text-right">RX Pkts</th>
                      <th className="pb-2 text-right">TX Pkts</th>
                      <th className="pb-2 text-right">RX Drops</th>
                      <th className="pb-2 text-right">TX Drops</th>
                      <th className="pb-2 text-right">Throughput</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {selectedDevice.ports.map(port => {
                      const dur = Math.max(port.duration_sec, 1);
                      const throughput = (port.rx_bytes + port.tx_bytes) / dur;
                      return (
                        <tr key={port.port} className="text-foreground/80">
                          <td className="py-2 font-medium">Port {port.port}</td>
                          <td className="py-2 text-right">{fmtBytes(port.rx_bytes)}</td>
                          <td className="py-2 text-right">{fmtBytes(port.tx_bytes)}</td>
                          <td className="py-2 text-right">{port.rx_packets.toLocaleString()}</td>
                          <td className="py-2 text-right">{port.tx_packets.toLocaleString()}</td>
                          <td className={`py-2 text-right ${port.rx_dropped > 0 ? 'text-orange-400' : ''}`}>
                            {port.rx_dropped}
                          </td>
                          <td className={`py-2 text-right ${port.tx_dropped > 0 ? 'text-orange-400' : ''}`}>
                            {port.tx_dropped}
                          </td>
                          <td className="py-2 text-right text-primary">{fmtRate(throughput)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── HEATMAP TAB ── */}
      {activeTab === 'heatmap' && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-4 font-semibold text-foreground flex items-center gap-2">
            <Flame className="h-4 w-4 text-orange-400" />
            Link Traffic Heatmap — Top {heatmap.length} links
          </h3>
          {heatmap.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No link data available</p>
          ) : (
            <div className="space-y-2">
              {heatmap.map((link, i) => {
                const barColor =
                  link.utilization > 80 ? 'bg-red-500' :
                  link.utilization > 50 ? 'bg-orange-500' :
                  link.utilization > 25 ? 'bg-yellow-500' :
                  'bg-emerald-500';
                const textColor =
                  link.utilization > 80 ? 'text-red-400' :
                  link.utilization > 50 ? 'text-orange-400' :
                  link.utilization > 25 ? 'text-yellow-400' :
                  'text-emerald-400';
                return (
                  <div key={link.label} className="flex items-center gap-3 rounded-lg bg-muted/30 px-4 py-3">
                    <span className="w-6 text-xs font-medium text-muted-foreground">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm text-foreground">{link.label}</p>
                        <p className={`text-sm font-bold ${textColor}`}>{link.utilization}%</p>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${link.utilization}%` }} />
                      </div>
                      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                        <span>RX {fmtBytes(link.rx_bytes)} · TX {fmtBytes(link.tx_bytes)}</span>
                        <span>{fmtRate(link.throughput_bps)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── CLUSTER TAB ── */}
      {activeTab === 'cluster' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {cluster && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-4 font-semibold text-foreground flex items-center gap-2">
                <Monitor className="h-4 w-4 text-cyan-500" />
                Cluster Nodes
              </h3>
              <div className="space-y-3">
                {cluster.cluster.nodes.map(node => (
                  <div key={node.id} className="rounded-xl border border-border bg-muted/30 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`h-3 w-3 rounded-full ${node.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        <div>
                          <p className="text-sm font-semibold text-foreground">{node.ip}</p>
                          <p className="text-xs text-muted-foreground">ID: {node.id}</p>
                        </div>
                      </div>
                      <span className={`rounded-lg px-2 py-0.5 text-xs ${
                        node.status === 'ACTIVE'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {node.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {cluster.cluster.masterNode && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Master: <span className="text-foreground">{cluster.cluster.masterNode}</span>
                </p>
              )}
            </div>
          )}

          {intents && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-4 font-semibold text-foreground flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-blue-500" />
                Intents ({intents.summary.total})
              </h3>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-xs text-muted-foreground">Installed ({intents.summary.installed})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  <span className="text-xs text-muted-foreground">Failed ({intents.summary.failed})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-yellow-500" />
                  <span className="text-xs text-muted-foreground">Other ({intents.summary.other})</span>
                </div>
              </div>
              {intents.intents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No intents configured</p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-2 text-left text-muted-foreground">ID</th>
                        <th className="px-3 py-2 text-left text-muted-foreground">Type</th>
                        <th className="px-3 py-2 text-left text-muted-foreground">App</th>
                        <th className="px-3 py-2 text-left text-muted-foreground">State</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {intents.intents.map(intent => (
                        <tr key={intent.id} className="hover:bg-muted/30">
                          <td className="px-3 py-2 text-foreground/80 truncate max-w-[120px]">{intent.key || intent.id}</td>
                          <td className="px-3 py-2 text-muted-foreground">{intent.type}</td>
                          <td className="px-3 py-2 text-muted-foreground truncate max-w-[120px]">{intent.appId}</td>
                          <td className="px-3 py-2">
                            <span className={`rounded-lg px-2 py-0.5 text-[10px] ${
                              intent.state === 'INSTALLED' ? 'bg-emerald-500/20 text-emerald-400' :
                              intent.state === 'FAILED' ? 'bg-red-500/20 text-red-400' :
                              'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {intent.state}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
