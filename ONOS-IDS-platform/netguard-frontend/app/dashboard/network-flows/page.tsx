'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { apiClient } from '@/lib/api';
import {
  Activity, RefreshCw, AlertTriangle, Network,
  TrendingUp, TrendingDown, Zap, Database,
  Server, ChevronRight, X, Play, Square,
  Plus, Trash2, Check,
} from 'lucide-react';

interface FlowSummary {
  total_rx_bytes: number;
  total_tx_bytes: number;
  total_bytes: number;
  total_rx_packets: number;
  total_tx_packets: number;
  total_drops: number;
  total_errors: number;
}

interface DeviceStat {
  device_id: string;
  device_name: string;
  bytes_rx: number;
  bytes_tx: number;
  total_bytes: number;
  total_packets: number;
  ports: PortStat[];
}

interface PortStat {
  port: string;
  bytes_rx: number;
  bytes_tx: number;
  packets_rx: number;
  packets_tx: number;
  throughput_rx_bps: number;
  throughput_tx_bps: number;
  drops: number;
  errors: number;
}

interface TopPort {
  device_name: string;
  port: string;
  label: string;
  bytes_rx: number;
  bytes_tx: number;
  total_bytes: number;
  throughput_bps: number;
  packets: number;
  percentage: number;
}

interface Protocol {
  protocol: string;
  eth_type: string;
  packets: number;
  bytes: number;
  flows: number;
  packet_pct: number;
  bytes_pct: number;
}

interface FlowRule {
  id: string;
  device_id: string;
  device_name: string;
  state: string;
  priority: number;
  packets: number;
  bytes: number;
  match: string;
  action: string;
  life_sec: number;
  is_permanent: boolean;
  app_id: string;
}

interface Anomaly {
  type: string;
  severity: string;
  device: string;
  port: string;
  label: string;
  drops?: number;
  drop_rate?: number;
  errors?: number;
  description: string;
}

interface TimelinePoint {
  timestamp: string;
  total_bytes: number;
  rx_bytes: number;
  tx_bytes: number;
  total_packets: number;
}

function fmtBytes(b: number): string {
  if (b <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let val = b;
  let i = 0;
  while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
  return `${val.toFixed(1)} ${units[i]}`;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'text-red-400 bg-red-500/20 border-red-500/30',
  high:     'text-orange-400 bg-orange-500/20 border-orange-500/30',
  medium:   'text-yellow-400 bg-yellow-500/20 border-yellow-500/30',
  low:      'text-blue-400 bg-blue-500/20 border-blue-500/30',
};

const PROTO_COLORS: Record<string, string> = {
  'IPv4': 'bg-blue-500',
  'ARP':  'bg-green-500',
  'LLDP': 'bg-purple-500',
  'ONOS': 'bg-cyan-500',
  'IPv6': 'bg-orange-500',
  'VLAN': 'bg-yellow-500',
};

const ETH_TYPE_OPTIONS = [
  { label: 'IPv4 (0x0800)', value: '0x0800' },
  { label: 'ARP (0x0806)', value: '0x0806' },
  { label: 'IPv6 (0x86dd)', value: '0x86dd' },
  { label: 'LLDP (0x88cc)', value: '0x88cc' },
];

export default function NetworkFlowsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState<FlowSummary | null>(null);
  const [devices, setDevices] = useState<DeviceStat[]>([]);
  const [topPorts, setTopPorts] = useState<TopPort[]>([]);
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [flowRules, setFlowRules] = useState<FlowRule[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'flows' | 'anomalies'>('overview');
  const [selectedDevice, setSelectedDevice] = useState<DeviceStat | null>(null);
  const [liveMode, setLiveMode] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Flow creation state
  const [showCreateFlow, setShowCreateFlow] = useState(false);
  const [flowForm, setFlowForm] = useState({
    deviceId: '',
    priority: 40000,
    ethType: '0x0800',
    inPort: '',
    outPort: '',
    ipSrc: '',
    ipDst: '',
  });
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [user, isLoading, router]);

  const fetchAll = useCallback(async () => {
    try {
      const [analysisRes, topRes, protoRes, rulesRes, anomRes, timelineRes] = await Promise.all([
        apiClient('/flows/analysis'),
        apiClient('/flows/top-talkers'),
        apiClient('/flows/protocols'),
        apiClient('/flows/rules'),
        apiClient('/flows/anomalies'),
        apiClient('/flows/timeline'),
      ]);

      if (analysisRes.ok) {
        const d = await analysisRes.json();
        setSummary(d.summary);
        setDevices(d.devices);
      }
      if (topRes.ok) {
        const d = await topRes.json();
        setTopPorts(d.top_ports);
      }
      if (protoRes.ok) {
        const d = await protoRes.json();
        setProtocols(d.protocols);
      }
      if (rulesRes.ok) {
        const d = await rulesRes.json();
        setFlowRules(d.flows);
      }
      if (anomRes.ok) {
        const d = await anomRes.json();
        setAnomalies(d.anomalies);
      }
      if (timelineRes.ok) {
        const d = await timelineRes.json();
        setTimeline(d.timeline);
      }
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchAll();
  }, [user, fetchAll]);

  useEffect(() => {
    if (liveMode) {
      intervalRef.current = setInterval(fetchAll, 5000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [liveMode, fetchAll]);

  const canManage = user?.role === 'admin' || user?.role === 'manager';

  const handleCreateFlow = async () => {
    if (!flowForm.deviceId) return;
    setCreating(true);
    try {
      const criteria: Record<string, unknown>[] = [];
      if (flowForm.ethType) {
        criteria.push({ type: 'ETH_TYPE', ethType: flowForm.ethType });
      }
      if (flowForm.inPort) {
        criteria.push({ type: 'IN_PORT', port: Number(flowForm.inPort) });
      }
      if (flowForm.ipSrc) {
        criteria.push({ type: 'IPV4_SRC', ip: flowForm.ipSrc });
      }
      if (flowForm.ipDst) {
        criteria.push({ type: 'IPV4_DST', ip: flowForm.ipDst });
      }

      const instructions: Record<string, unknown>[] = [];
      if (flowForm.outPort) {
        instructions.push({ type: 'OUTPUT', port: flowForm.outPort });
      }

      const res = await apiClient(`/flows/${flowForm.deviceId}`, {
        method: 'POST',
        body: JSON.stringify({
          priority: flowForm.priority,
          isPermanent: true,
          timeout: 0,
          appId: 'org.onosproject.netguard',
          selector: { criteria },
          treatment: { instructions },
        }),
      });

      if (res.ok) {
        setShowCreateFlow(false);
        setFlowForm({ deviceId: '', priority: 40000, ethType: '0x0800', inPort: '', outPort: '', ipSrc: '', ipDst: '' });
        await fetchAll();
      }
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteFlow = async (deviceId: string, flowId: string) => {
    setDeleting(flowId);
    try {
      const res = await apiClient(`/flows/${deviceId}/${flowId}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchAll();
      }
    } finally {
      setDeleting(null);
    }
  };

  if (isLoading || !user) return null;

  // Get unique device IDs for the flow creation form
  const deviceIds = [...new Set(flowRules.map(f => f.device_id))];

  // Mini timeline SVG
  const renderTimeline = () => {
    if (timeline.length < 2) return null;
    const maxBytes = Math.max(...timeline.map(t => t.total_bytes), 1);
    const W = 400, H = 60;
    const pts = timeline.map((t, i) => {
      const x = (i / (timeline.length - 1)) * W;
      const y = H - (t.total_bytes / maxBytes) * H;
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16" preserveAspectRatio="none">
        <defs>
          <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`0,${H} ${pts} ${W},${H}`} fill="url(#tg)" />
        <polyline points={pts} fill="none" stroke="#06b6d4" strokeWidth="2" />
      </svg>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Network Flows Analysis</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Real-time traffic monitoring · OpenFlow statistics · Anomaly detection
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">{lastUpdated.toLocaleTimeString()}</span>
          )}
          <button
            onClick={() => setLiveMode(!liveMode)}
            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors ${
              liveMode
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {liveMode ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {liveMode ? 'Live 5s' : 'Live'}
          </button>
          <button
            onClick={fetchAll}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm text-foreground/80 hover:bg-muted"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-xl border border-border bg-card/60 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Database className="h-4 w-4 text-primary" />
              <p className="text-xs text-muted-foreground">Total Traffic</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{fmtBytes(summary.total_bytes)}</p>
            <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <TrendingDown className="h-3 w-3 text-green-400" />
                RX {fmtBytes(summary.total_rx_bytes)}
              </span>
              <span className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-blue-400" />
                TX {fmtBytes(summary.total_tx_bytes)}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card/60 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-4 w-4 text-purple-400" />
              <p className="text-xs text-muted-foreground">Total Packets</p>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {(summary.total_rx_packets + summary.total_tx_packets).toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {summary.total_rx_packets.toLocaleString()} RX · {summary.total_tx_packets.toLocaleString()} TX
            </p>
          </div>

          <div className={`rounded-2xl border p-4 ${
            summary.total_drops > 0
              ? 'border-orange-500/30 bg-orange-500/5'
              : 'border-border bg-card/60'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className={`h-4 w-4 ${summary.total_drops > 0 ? 'text-orange-400' : 'text-muted-foreground'}`} />
              <p className={`text-xs ${summary.total_drops > 0 ? 'text-orange-400' : 'text-muted-foreground'}`}>
                Packet Drops
              </p>
            </div>
            <p className="text-2xl font-bold text-foreground">{summary.total_drops}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {summary.total_errors} errors
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card/60 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-yellow-400" />
              <p className="text-xs text-muted-foreground">Flow Rules</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{flowRules.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {anomalies.length} anomal{anomalies.length !== 1 ? 'ies' : 'y'}
            </p>
          </div>
        </div>
      )}

      {/* Timeline */}
      {timeline.length > 1 && (
        <div className="mb-6 rounded-xl border border-border bg-card/60 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Traffic Timeline
            </p>
            <span className="text-xs text-muted-foreground">{timeline.length} snapshots</span>
          </div>
          {renderTimeline()}
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>{new Date(timeline[0]?.timestamp).toLocaleTimeString()}</span>
            <span>{new Date(timeline[timeline.length - 1]?.timestamp).toLocaleTimeString()}</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-4 flex gap-2">
        {(['overview', 'flows', 'anomalies'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm capitalize transition-colors ${
              activeTab === tab
                ? 'bg-primary text-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'overview' && <Network className="h-4 w-4" />}
            {tab === 'flows' && <Activity className="h-4 w-4" />}
            {tab === 'anomalies' && <AlertTriangle className="h-4 w-4" />}
            {tab}
            {tab === 'anomalies' && anomalies.length > 0 && (
              <span className="rounded-full bg-orange-500/20 px-1.5 py-0.5 text-[10px] text-orange-400">
                {anomalies.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Top Ports */}
          <div className="rounded-xl border border-border bg-card/60 p-5">
            <h3 className="mb-4 font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Top Talkers — Ports
            </h3>
            <div className="space-y-3">
              {topPorts.slice(0, 6).map((port, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-4 text-xs text-muted-foreground">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground truncate">{port.label}</p>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-cyan-500"
                        style={{ width: `${port.percentage}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-medium text-foreground">{fmtBytes(port.total_bytes)}</p>
                    <p className="text-[10px] text-muted-foreground">{port.packets.toLocaleString()} pkts</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Protocol Distribution */}
          <div className="rounded-xl border border-border bg-card/60 p-5">
            <h3 className="mb-4 font-semibold text-foreground flex items-center gap-2">
              <Network className="h-4 w-4 text-purple-400" />
              Protocol Distribution
            </h3>
            <div className="space-y-3">
              {protocols.map((proto, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`h-3 w-3 shrink-0 rounded-full ${PROTO_COLORS[proto.protocol] || 'bg-slate-500'}`} />
                  <span className="flex-1 text-xs text-foreground">{proto.protocol}</span>
                  <div className="w-24 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-2 rounded-full ${PROTO_COLORS[proto.protocol] || 'bg-slate-500'}`}
                      style={{ width: `${proto.bytes_pct}%` }}
                    />
                  </div>
                  <span className="w-10 text-right text-xs text-muted-foreground">{proto.bytes_pct}%</span>
                  <span className="w-16 text-right text-xs text-muted-foreground">{fmtBytes(proto.bytes)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Device Breakdown */}
          <div className="lg:col-span-2 rounded-xl border border-border bg-card/60 p-5">
            <h3 className="mb-4 font-semibold text-foreground flex items-center gap-2">
              <Server className="h-4 w-4 text-blue-400" />
              Device Traffic Breakdown
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {devices.map(dev => {
                const maxBytes = Math.max(...devices.map(d => d.total_bytes), 1);
                const pct = Math.round(dev.total_bytes / maxBytes * 100);
                return (
                  <div
                    key={dev.device_id}
                    onClick={() => setSelectedDevice(selectedDevice?.device_id === dev.device_id ? null : dev)}
                    className={`cursor-pointer rounded-xl border p-4 transition-all hover:border-border ${
                      selectedDevice?.device_id === dev.device_id
                        ? 'border-cyan-500/50 bg-cyan-500/5'
                        : 'border-border bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-foreground">{dev.device_name}</p>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="text-xl font-bold text-primary">{fmtBytes(dev.total_bytes)}</p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-cyan-500" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                      <span>RX {fmtBytes(dev.bytes_rx)}</span>
                      <span>TX {fmtBytes(dev.bytes_tx)}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {dev.total_packets.toLocaleString()} packets · {dev.ports.length} ports
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Port details when device selected */}
            {selectedDevice && (
              <div className="mt-4 rounded-xl border border-border bg-muted/50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-foreground">
                    {selectedDevice.device_name} — Port Details
                  </p>
                  <button onClick={() => setSelectedDevice(null)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
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
                        <th className="pb-2 text-right">Drops</th>
                        <th className="pb-2 text-right">Throughput</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {selectedDevice.ports.map(port => (
                        <tr key={port.port} className="text-foreground/80">
                          <td className="py-2 font-medium">Port {port.port}</td>
                          <td className="py-2 text-right">{fmtBytes(port.bytes_rx)}</td>
                          <td className="py-2 text-right">{fmtBytes(port.bytes_tx)}</td>
                          <td className="py-2 text-right">{port.packets_rx.toLocaleString()}</td>
                          <td className="py-2 text-right">{port.packets_tx.toLocaleString()}</td>
                          <td className={`py-2 text-right ${port.drops > 0 ? 'text-orange-400' : ''}`}>
                            {port.drops}
                          </td>
                          <td className="py-2 text-right text-primary">
                            {fmtBytes(port.throughput_rx_bps + port.throughput_tx_bps)}/s
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── FLOWS TAB ── */}
      {activeTab === 'flows' && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{flowRules.length} flow rules active</p>
            {canManage && (
              <button
                onClick={() => setShowCreateFlow(!showCreateFlow)}
                className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add Flow Rule
              </button>
            )}
          </div>

          {/* Create Flow Form */}
          {showCreateFlow && canManage && (
            <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Create Flow Rule</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Device ID *</label>
                  <select
                    value={flowForm.deviceId}
                    onChange={e => setFlowForm({ ...flowForm, deviceId: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                  >
                    <option value="">Select device...</option>
                    {deviceIds.map(id => (
                      <option key={id} value={id}>{id}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Priority</label>
                  <input
                    type="number"
                    value={flowForm.priority}
                    onChange={e => setFlowForm({ ...flowForm, priority: Number(e.target.value) })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                    min={0}
                    max={65535}
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">ETH Type</label>
                  <select
                    value={flowForm.ethType}
                    onChange={e => setFlowForm({ ...flowForm, ethType: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                  >
                    {ETH_TYPE_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">In Port</label>
                  <input
                    type="text"
                    value={flowForm.inPort}
                    onChange={e => setFlowForm({ ...flowForm, inPort: e.target.value })}
                    placeholder="e.g. 1"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Output Port *</label>
                  <input
                    type="text"
                    value={flowForm.outPort}
                    onChange={e => setFlowForm({ ...flowForm, outPort: e.target.value })}
                    placeholder="e.g. 2 or CONTROLLER"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">IP Source</label>
                  <input
                    type="text"
                    value={flowForm.ipSrc}
                    onChange={e => setFlowForm({ ...flowForm, ipSrc: e.target.value })}
                    placeholder="e.g. 10.0.0.1/32"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">IP Destination</label>
                  <input
                    type="text"
                    value={flowForm.ipDst}
                    onChange={e => setFlowForm({ ...flowForm, ipDst: e.target.value })}
                    placeholder="e.g. 10.0.0.2/32"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <button
                    onClick={handleCreateFlow}
                    disabled={creating || !flowForm.deviceId}
                    className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {creating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Create
                  </button>
                  <button
                    onClick={() => setShowCreateFlow(false)}
                    className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs text-muted-foreground">Device</th>
                  <th className="px-4 py-3 text-left text-xs text-muted-foreground">Match</th>
                  <th className="px-4 py-3 text-left text-xs text-muted-foreground">Action</th>
                  <th className="px-4 py-3 text-right text-xs text-muted-foreground">Priority</th>
                  <th className="px-4 py-3 text-right text-xs text-muted-foreground">Packets</th>
                  <th className="px-4 py-3 text-right text-xs text-muted-foreground">Bytes</th>
                  <th className="px-4 py-3 text-right text-xs text-muted-foreground">Life</th>
                  <th className="px-4 py-3 text-left text-xs text-muted-foreground">State</th>
                  {canManage && (
                    <th className="px-4 py-3 text-center text-xs text-muted-foreground">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {flowRules.map(rule => (
                  <tr key={rule.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-xs text-primary">{rule.device_name}</td>
                    <td className="px-4 py-3 text-xs text-foreground/80 max-w-[200px] truncate">
                      {rule.match}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{rule.action}</td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground">{rule.priority}</td>
                    <td className="px-4 py-3 text-right text-xs text-foreground">{rule.packets.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground">{fmtBytes(rule.bytes)}</td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground">{rule.life_sec}s</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-lg px-2 py-0.5 text-[10px] ${
                        rule.state === 'ADDED'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {rule.state}
                      </span>
                    </td>
                    {canManage && (
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleDeleteFlow(rule.device_id, rule.id)}
                          disabled={deleting === rule.id}
                          className="rounded-lg p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                          title="Delete flow rule"
                        >
                          {deleting === rule.id ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── ANOMALIES TAB ── */}
      {activeTab === 'anomalies' && (
        <div>
          {anomalies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Activity className="mb-3 h-12 w-12 text-green-400" />
              <p className="text-green-400 font-medium">Network is healthy</p>
              <p className="text-sm mt-1">No anomalies detected</p>
            </div>
          ) : (
            <div className="space-y-3">
              {anomalies.map((anomaly, i) => (
                <div key={i} className={`rounded-2xl border p-4 ${SEVERITY_COLORS[anomaly.severity] || ''}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="font-semibold capitalize">{anomaly.type.replace('_', ' ')}</span>
                        <span className={`rounded-lg border px-2 py-0.5 text-xs capitalize ${SEVERITY_COLORS[anomaly.severity]}`}>
                          {anomaly.severity}
                        </span>
                      </div>
                      <p className="mt-1 text-sm">{anomaly.label}</p>
                      <p className="mt-0.5 text-xs opacity-70">{anomaly.description}</p>
                    </div>
                    {anomaly.drop_rate !== undefined && (
                      <div className="text-right">
                        <p className="text-lg font-bold">{anomaly.drop_rate}%</p>
                        <p className="text-xs opacity-70">drop rate</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
