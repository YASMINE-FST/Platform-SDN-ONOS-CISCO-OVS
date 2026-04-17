'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { apiClient } from '@/lib/api';
import {
  TopologyMap, type TopoNode, type TopoEdge, type LayoutMode,
} from '@/components/TopologyMap';
import {
  Server, Monitor, RefreshCw, X, ToggleLeft, ToggleRight,
  GitBranch, Activity, Gauge, Router, Layers, Flame, Zap, FileDown,
} from 'lucide-react';
import { useExportPDF } from '@/hooks/useExportPDF';

// ── Types ─────────────────────────────────────────────────────────────
interface PortStat {
  port: string;
  bytesReceived: number; bytesSent: number;
  packetsReceived: number; packetsSent: number;
  packetsRxDropped: number; packetsTxDropped: number;
  packetsRxErrors: number; packetsTxErrors: number;
  throughput_bps: number; utilization: number;
  durationSec: number; live: boolean;
}

interface EnrichedNode {
  id: string; label: string; type: string; status: string;
  manufacturer?: string; hw_version?: string; sw_version?: string;
  serial?: string; chassis_id?: string;
  ports_count: number; flows_count: number;
  flows_added: number; flows_pending: number;
}

interface EnrichedEdge {
  id: string; source: string; source_port: string;
  target: string; target_port: string;
  type: string; state: string;
  utilization: number; throughput_bps: number;
  load_state: 'hot' | 'warm' | 'nominal' | 'unknown';
}

interface EnrichedHost {
  id: string; mac?: string; ip?: string;
  ipAddresses: string[];
  location_device?: string; location_port?: string;
  vlan?: string;
}

interface EnrichedTopology {
  nodes: EnrichedNode[];
  edges: EnrichedEdge[];
  hosts: EnrichedHost[];
  port_stats: Record<string, PortStat[]>;
  counters: {
    devices: number; links: number; hosts: number;
    flows_total: number; flows_pending: number;
    clusters: number; hot_links: number;
  };
  source: string;
}

function fmtBytes(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let val = v, i = 0;
  while (val >= 1024 && i < u.length - 1) { val /= 1024; i++; }
  return `${val.toFixed(val >= 100 ? 0 : 1)} ${u[i]}`;
}
function fmtBps(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return '0 bps';
  const u = ['bps', 'Kbps', 'Mbps', 'Gbps'];
  let val = v * 8, i = 0;
  while (val >= 1000 && i < u.length - 1) { val /= 1000; i++; }
  return `${val.toFixed(val >= 100 ? 0 : 1)} ${u[i]}`;
}
function shortId(id: string): string {
  return id.replace('of:00000000000000', 'SW-').replace('of:0000000000000', 'SW-');
}
function deviceKind(type: string): 'switch' | 'router' {
  if ((type || '').toLowerCase().includes('router')) return 'router';
  return 'switch';
}

export default function TopologyPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [topo, setTopo] = useState<EnrichedTopology | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [layout, setLayout] = useState<LayoutMode>('cose');
  const [showHosts, setShowHosts] = useState(true);
  const [showEdgeLabels, setShowEdgeLabels] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // Path analysis
  const [pathSrc, setPathSrc] = useState('');
  const [pathDst, setPathDst] = useState('');
  const [pathResult, setPathResult] = useState<any>(null);
  const [pathLoading, setPathLoading] = useState(false);
  const [highlightedEdges, setHighlightedEdges] = useState<string[]>([]);
  const [highlightedNodes, setHighlightedNodes] = useState<string[]>([]);

  // Link toggle modal
  const [toggling, setToggling] = useState(false);

  // PDF export — MUST stay before any early return to respect hook order.
  const { exportToPDF } = useExportPDF();
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [user, isLoading, router]);

  const fetchTopology = useCallback(async (bg = false) => {
    bg ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const res = await apiClient('/topology/enriched');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: EnrichedTopology = await res.json();
      setTopo(data);
      setLastSync(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load topology');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { if (user) fetchTopology(); }, [user, fetchTopology]);

  useEffect(() => {
    if (!autoRefresh || !user) return;
    const i = setInterval(() => fetchTopology(true), 5000);
    return () => clearInterval(i);
  }, [autoRefresh, user, fetchTopology]);

  const mapNodes: TopoNode[] = useMemo(() => {
    if (!topo) return [];
    const n: TopoNode[] = topo.nodes.map(d => ({
      id: d.id,
      label: shortId(d.id),
      kind: deviceKind(d.type),
      status: d.status === 'active' ? 'active' : 'inactive',
      subtitle: d.manufacturer || '',
      flows: d.flows_count,
    }));
    if (showHosts) {
      topo.hosts.forEach(h => {
        n.push({
          id: h.id, label: h.ip || h.mac || 'host',
          kind: 'host', status: 'active',
          subtitle: h.mac,
        });
      });
    }
    return n;
  }, [topo, showHosts]);

  const mapEdges: TopoEdge[] = useMemo(() => {
    if (!topo) return [];
    const edges: TopoEdge[] = topo.edges.map(e => ({
      id: e.id,
      source: e.source, target: e.target,
      label: `${e.source_port}↔${e.target_port}${e.utilization > 0 ? ` · ${e.utilization.toFixed(0)}%` : ''}`,
      loadState: e.load_state,
      utilization: e.utilization,
      enabled: e.state === 'ACTIVE',
      kind: 'infrastructure',
    }));
    if (showHosts) {
      topo.hosts.forEach(h => {
        if (h.location_device) {
          edges.push({
            id: `host-${h.id}`,
            source: h.location_device, target: h.id,
            label: `p${h.location_port}`,
            kind: 'access', loadState: 'unknown', enabled: true,
          });
        }
      });
    }
    return edges;
  }, [topo, showHosts]);

  const selectedNode = useMemo(() => {
    if (!topo || !selectedNodeId) return null;
    return topo.nodes.find(n => n.id === selectedNodeId) || null;
  }, [topo, selectedNodeId]);

  const selectedHost = useMemo(() => {
    if (!topo || !selectedNodeId) return null;
    return topo.hosts.find(h => h.id === selectedNodeId) || null;
  }, [topo, selectedNodeId]);

  const selectedEdge = useMemo(() => {
    if (!topo || !selectedEdgeId) return null;
    return topo.edges.find(e => e.id === selectedEdgeId) || null;
  }, [topo, selectedEdgeId]);

  const hottestLinks = useMemo(() => {
    if (!topo) return [];
    return [...topo.edges]
      .filter(e => e.utilization > 0)
      .sort((a, b) => b.utilization - a.utilization)
      .slice(0, 5);
  }, [topo]);

  const runPathAnalysis = async () => {
    if (!pathSrc || !pathDst || pathSrc === pathDst) return;
    setPathLoading(true); setPathResult(null);
    setHighlightedEdges([]); setHighlightedNodes([]);
    try {
      const res = await apiClient(`/topology/paths/${pathSrc}/${pathDst}`);
      if (res.ok) {
        const data = await res.json();
        setPathResult(data);
        if (data.found && data.paths[0]) {
          setHighlightedEdges(data.paths[0].edge_refs || []);
          setHighlightedNodes(data.paths[0].nodes || []);
        }
      }
    } finally { setPathLoading(false); }
  };

  const clearPath = () => {
    setPathResult(null); setHighlightedEdges([]); setHighlightedNodes([]);
    setPathSrc(''); setPathDst('');
  };

  const canToggle = user ? ['admin', 'manager'].includes(user.role) : false;

  const toggleLink = async () => {
    if (!selectedEdge || !canToggle) return;
    setToggling(true);
    try {
      const res = await apiClient('/topology/links/toggle', {
        method: 'POST',
        body: JSON.stringify({
          src_device: selectedEdge.source, src_port: selectedEdge.source_port,
          dst_device: selectedEdge.target, dst_port: selectedEdge.target_port,
          enable: selectedEdge.state !== 'ACTIVE',
        }),
      });
      if (res.ok) { setSelectedEdgeId(null); setTimeout(() => fetchTopology(true), 1000); }
    } finally { setToggling(false); }
  };

  if (isLoading || !user) return null;

  const c = topo?.counters;
  const portsForSelected = selectedNode ? (topo?.port_stats[selectedNode.id] || []) : [];

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      await exportToPDF('topology-export-root', {
        filename: `topology-${new Date().toISOString().slice(0, 10)}.pdf`,
        orientation: 'landscape',
      });
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div id="topology-export-root" className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div>
          <h1 className="text-lg font-bold">Network Topology</h1>
          <p className="text-xs text-muted-foreground">
            Live ONOS topology · metrics every 5s · {topo?.source || 'loading'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastSync && (
            <span className="text-xs text-muted-foreground">
              {lastSync.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs ${
              autoRefresh ? 'bg-green-500/20 text-green-400' : 'bg-muted text-muted-foreground'
            }`}
          >
            <Activity className="h-3 w-3" />
            {autoRefresh ? 'Live 5s' : 'Manual'}
          </button>
          <button
            onClick={handleExportPDF}
            disabled={exporting || loading}
            className="flex items-center gap-1.5 rounded-xl bg-muted px-3 py-1.5 text-xs hover:bg-muted/80 disabled:opacity-50"
            title="Export topology snapshot as PDF"
          >
            <FileDown className={`h-3.5 w-3.5 ${exporting ? 'animate-pulse' : ''}`} />
            {exporting ? 'Exporting…' : 'PDF'}
          </button>
          <button
            onClick={() => fetchTopology(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-2 rounded-xl bg-muted px-3 py-1.5 text-sm hover:bg-muted/80"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing || loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Metrics strip */}
      <div className="grid grid-cols-2 gap-2 border-b border-border bg-background/40 px-6 py-3 md:grid-cols-6">
        <MetricCard icon={<Server className="h-4 w-4 text-cyan-400" />} label="Switches" value={c?.devices ?? '–'} />
        <MetricCard icon={<GitBranch className="h-4 w-4 text-emerald-400" />} label="Links" value={c?.links ?? '–'} />
        <MetricCard icon={<Monitor className="h-4 w-4 text-teal-400" />} label="Hosts" value={c?.hosts ?? '–'} />
        <MetricCard icon={<Layers className="h-4 w-4 text-indigo-400" />} label="Flows" value={c?.flows_total ?? '–'} sub={c?.flows_pending ? `${c.flows_pending} pending` : undefined} />
        <MetricCard icon={<Flame className="h-4 w-4 text-red-400" />} label="Hot Links" value={c?.hot_links ?? '–'} />
        <MetricCard icon={<Zap className="h-4 w-4 text-violet-400" />} label="Clusters" value={c?.clusters ?? '–'} />
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-background/30 px-6 py-2">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Layout:
          <select
            value={layout} onChange={e => setLayout(e.target.value as LayoutMode)}
            className="rounded-lg border border-border bg-muted px-2 py-1 text-xs"
          >
            <option value="cose">Adaptive</option>
            <option value="breadthfirst">Hierarchy</option>
            <option value="circle">Ring</option>
            <option value="concentric">Concentric</option>
            <option value="grid">Grid</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" checked={showHosts} onChange={e => setShowHosts(e.target.checked)} />
          Hosts
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" checked={showEdgeLabels} onChange={e => setShowEdgeLabels(e.target.checked)} />
          Edge labels
        </label>

        {/* Path analysis */}
        <div className="flex items-center gap-2 ml-auto">
          <GitBranch className="h-3.5 w-3.5 text-purple-400" />
          <select
            value={pathSrc} onChange={e => setPathSrc(e.target.value)}
            className="rounded-lg border border-border bg-muted px-2 py-1 text-xs"
          >
            <option value="">Source</option>
            {topo?.nodes.map(n => <option key={n.id} value={n.id}>{shortId(n.id)}</option>)}
          </select>
          <span className="text-xs text-muted-foreground">→</span>
          <select
            value={pathDst} onChange={e => setPathDst(e.target.value)}
            className="rounded-lg border border-border bg-muted px-2 py-1 text-xs"
          >
            <option value="">Destination</option>
            {topo?.nodes.map(n => <option key={n.id} value={n.id}>{shortId(n.id)}</option>)}
          </select>
          <button
            onClick={runPathAnalysis}
            disabled={pathLoading || !pathSrc || !pathDst || pathSrc === pathDst}
            className="rounded-lg bg-purple-700/80 px-2.5 py-1 text-xs text-white disabled:opacity-50"
          >
            {pathLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'Path'}
          </button>
          {pathResult && (
            <button onClick={clearPath} className="text-xs text-muted-foreground hover:text-foreground">
              Clear
            </button>
          )}
        </div>
      </div>

      {pathResult && (
        <div className="border-b border-border bg-background/30 px-6 py-1.5 text-xs">
          {pathResult.found ? (
            <span className="text-green-400">
              ✓ {pathResult.paths[0].summary} · {pathResult.paths[0].nodes.map((n: string) => shortId(n)).join(' → ')}
            </span>
          ) : (
            <span className="text-red-400">✗ No path found</span>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-background/20 px-6 py-1.5">
        <span className="text-[10px] text-muted-foreground">Load:</span>
        <Legend color="#22c55e" label="Nominal <40%" />
        <Legend color="#f59e0b" label="Warm 40–70%" />
        <Legend color="#ef4444" label="Hot >70%" />
        <Legend color="#facc15" label="Path" />
        <Legend color="#94a3b8" label="Disabled" dashed />
      </div>

      {/* Main: map + side panels */}
      <div className="flex flex-1 overflow-hidden">
        <div className="relative flex-1">
          {error && (
            <div className="absolute left-4 top-4 z-10 rounded-xl border border-red-800 bg-red-950/80 px-4 py-2 text-sm text-red-300">
              ⚠ {error}
            </div>
          )}
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading ONOS topology...</p>
              </div>
            </div>
          ) : (
            <TopologyMap
              nodes={mapNodes} edges={mapEdges}
              layout={layout}
              showEdgeLabels={showEdgeLabels}
              selectedNode={selectedNodeId}
              selectedEdge={selectedEdgeId}
              highlightedNodeIds={highlightedNodes}
              highlightedEdgeIds={highlightedEdges}
              onNodeClick={setSelectedNodeId}
              onEdgeClick={setSelectedEdgeId}
              onBackgroundClick={() => { setSelectedNodeId(null); setSelectedEdgeId(null); }}
            />
          )}
        </div>

        {/* Side panel: node/edge detail + hottest links */}
        <div className="w-80 shrink-0 overflow-y-auto border-l border-border bg-background/60 p-4 space-y-4">
          {selectedNode ? (
            <NodeDetail
              node={selectedNode}
              ports={portsForSelected}
              onSetSrc={() => setPathSrc(selectedNode.id)}
              onSetDst={() => setPathDst(selectedNode.id)}
              onClose={() => setSelectedNodeId(null)}
              canPath={canToggle}
            />
          ) : selectedHost ? (
            <HostDetail host={selectedHost} onClose={() => setSelectedNodeId(null)} />
          ) : selectedEdge ? (
            <EdgeDetail
              edge={selectedEdge}
              canToggle={canToggle}
              toggling={toggling}
              onToggle={toggleLink}
              onClose={() => setSelectedEdgeId(null)}
            />
          ) : (
            <div className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
              Click a device, host, or link to inspect it.
            </div>
          )}

          {/* Hottest links always visible */}
          <div className="rounded-xl border border-border bg-card p-3">
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
              <Flame className="h-3.5 w-3.5 text-red-400" /> Hottest Links
            </h4>
            {hottestLinks.length === 0 ? (
              <p className="text-[10px] text-muted-foreground">No traffic detected.</p>
            ) : (
              <div className="space-y-1.5">
                {hottestLinks.map(e => (
                  <button
                    key={e.id}
                    onClick={() => { setSelectedEdgeId(e.id); setSelectedNodeId(null); }}
                    className="w-full rounded-lg bg-muted/50 p-2 text-left hover:bg-muted"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono">
                        {shortId(e.source)}:{e.source_port} → {shortId(e.target)}:{e.target_port}
                      </span>
                      <span className={`rounded px-1.5 py-0.5 text-[9px] ${
                        e.load_state === 'hot' ? 'bg-red-500/20 text-red-400' :
                        e.load_state === 'warm' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-emerald-500/20 text-emerald-400'
                      }`}>
                        {e.utilization.toFixed(1)}%
                      </span>
                    </div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-background">
                      <div className={`h-full ${
                        e.load_state === 'hot' ? 'bg-red-500' :
                        e.load_state === 'warm' ? 'bg-amber-500' : 'bg-emerald-500'
                      }`} style={{ width: `${Math.max(4, e.utilization)}%` }} />
                    </div>
                    <p className="mt-0.5 text-[9px] text-muted-foreground">{fmtBps(e.throughput_bps)}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────

function MetricCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-2.5">
      <div className="flex items-center justify-between">
        {icon}
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      </div>
      <p className="mt-1 text-xl font-bold">{value}</p>
      {sub && <p className="text-[10px] text-amber-400">{sub}</p>}
    </div>
  );
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
      <span className="inline-block h-0.5 w-5" style={{ background: color, ...(dashed ? { borderTop: `1px dashed ${color}`, background: 'transparent', height: 0 } : {}) }} />
      {label}
    </span>
  );
}

function NodeDetail({ node, ports, onSetSrc, onSetDst, onClose, canPath }: {
  node: EnrichedNode; ports: PortStat[];
  onSetSrc: () => void; onSetDst: () => void; onClose: () => void;
  canPath: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {deviceKind(node.type) === 'router'
            ? <Router className="h-4 w-4 text-blue-400" />
            : <Server className="h-4 w-4 text-cyan-400" />
          }
          <h3 className="text-sm font-semibold">{shortId(node.id)}</h3>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-2 text-xs">
        <div className="rounded-lg bg-muted/50 p-2">
          <p className="text-muted-foreground">ONOS ID</p>
          <p className="font-mono text-[10px] text-primary break-all">{node.id}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Chip label="Status" value={node.status} color={node.status === 'active' ? 'green' : 'red'} />
          <Chip label="Type" value={node.type} />
          <Chip label="Flows" value={`${node.flows_count}`} color="indigo" />
          <Chip label="Ports" value={`${node.ports_count}`} />
        </div>

        {node.manufacturer && <KV k="Manufacturer" v={node.manufacturer} />}
        {node.hw_version && <KV k="HW" v={node.hw_version} />}
        {node.sw_version && <KV k="SW" v={node.sw_version} />}
        {node.serial && <KV k="Serial" v={node.serial} />}
        {node.chassis_id && <KV k="Chassis" v={node.chassis_id} />}

        {ports.length > 0 && (
          <div>
            <p className="mb-1.5 flex items-center gap-1 text-muted-foreground">
              <Gauge className="h-3 w-3" /> Live Ports
            </p>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {ports.map(p => (
                <div key={p.port} className="rounded-lg bg-muted/50 px-2 py-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold">Port {p.port}</span>
                    <span className={`rounded text-[9px] px-1 ${p.live ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {p.live ? 'up' : 'down'} · {p.utilization.toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-1 grid grid-cols-2 gap-1 text-[9px] text-muted-foreground">
                    <span>RX {fmtBytes(p.bytesReceived)}</span>
                    <span>TX {fmtBytes(p.bytesSent)}</span>
                    <span>rx-pkts {p.packetsReceived}</span>
                    <span>tx-pkts {p.packetsSent}</span>
                    {(p.packetsRxDropped + p.packetsTxDropped) > 0 && (
                      <span className="col-span-2 text-amber-400">
                        drops: rx={p.packetsRxDropped} tx={p.packetsTxDropped}
                      </span>
                    )}
                    {(p.packetsRxErrors + p.packetsTxErrors) > 0 && (
                      <span className="col-span-2 text-red-400">
                        errors: rx={p.packetsRxErrors} tx={p.packetsTxErrors}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-background">
                    <div className="h-full bg-cyan-500" style={{ width: `${Math.max(1, p.utilization)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {canPath && (
          <div className="grid grid-cols-2 gap-1.5 pt-1">
            <button onClick={onSetSrc} className="rounded-lg bg-purple-700/20 px-2 py-1 text-[10px] text-purple-400 hover:bg-purple-700/30">
              Set source
            </button>
            <button onClick={onSetDst} className="rounded-lg bg-purple-700/20 px-2 py-1 text-[10px] text-purple-400 hover:bg-purple-700/30">
              Set destination
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function HostDetail({ host, onClose }: { host: EnrichedHost; onClose: () => void }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Monitor className="h-4 w-4 text-teal-400" />
          <h3 className="text-sm font-semibold">{host.ip || host.mac || 'host'}</h3>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="space-y-1.5 text-xs">
        {host.mac && <KV k="MAC" v={host.mac} />}
        {host.ipAddresses?.map(ip => <KV key={ip} k="IP" v={ip} />)}
        {host.vlan && <KV k="VLAN" v={host.vlan} />}
        {host.location_device && <KV k="Attached" v={`${shortId(host.location_device)}:p${host.location_port}`} />}
      </div>
    </div>
  );
}

function EdgeDetail({ edge, canToggle, toggling, onToggle, onClose }: {
  edge: EnrichedEdge;
  canToggle: boolean; toggling: boolean;
  onToggle: () => void; onClose: () => void;
}) {
  const enabled = edge.state === 'ACTIVE';
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-emerald-400" />
          <h3 className="text-sm font-semibold">Link</h3>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="space-y-2 text-xs">
        <KV k="Source" v={`${shortId(edge.source)} : p${edge.source_port}`} />
        <KV k="Destination" v={`${shortId(edge.target)} : p${edge.target_port}`} />
        <KV k="Type" v={edge.type} />
        <div className="rounded-lg bg-muted/50 p-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Utilization</span>
            <span className={`rounded px-1.5 py-0.5 text-[10px] ${
              edge.load_state === 'hot' ? 'bg-red-500/20 text-red-400' :
              edge.load_state === 'warm' ? 'bg-amber-500/20 text-amber-400' :
              edge.load_state === 'nominal' ? 'bg-emerald-500/20 text-emerald-400' :
              'bg-muted text-muted-foreground'
            }`}>{edge.utilization.toFixed(1)}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-background">
            <div className={`h-full ${
              edge.load_state === 'hot' ? 'bg-red-500' :
              edge.load_state === 'warm' ? 'bg-amber-500' :
              edge.load_state === 'nominal' ? 'bg-emerald-500' : 'bg-slate-500'
            }`} style={{ width: `${Math.max(2, edge.utilization)}%` }} />
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">{fmtBps(edge.throughput_bps)}</p>
        </div>

        <Chip label="State" value={enabled ? 'ACTIVE' : 'INACTIVE'} color={enabled ? 'green' : 'red'} />

        {canToggle && (
          <button
            onClick={onToggle} disabled={toggling}
            className={`mt-2 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs transition-colors disabled:opacity-50 ${
              enabled ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                      : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
            }`}
          >
            {toggling
              ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              : enabled
                ? <><ToggleLeft className="h-3.5 w-3.5" /> Disable link</>
                : <><ToggleRight className="h-3.5 w-3.5" /> Enable link</>
            }
          </button>
        )}
      </div>
    </div>
  );
}

function Chip({ label, value, color }: { label: string; value: string; color?: 'green' | 'red' | 'indigo' }) {
  const cls =
    color === 'green' ? 'bg-green-500/20 text-green-400' :
    color === 'red' ? 'bg-red-500/20 text-red-400' :
    color === 'indigo' ? 'bg-indigo-500/20 text-indigo-400' :
    'bg-muted/50 text-foreground/80';
  return (
    <div className="rounded-lg bg-muted/50 p-2">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <span className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] ${cls}`}>{value}</span>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/30 px-2 py-1">
      <span className="text-[10px] text-muted-foreground">{k}</span>
      <span className="font-mono text-[10px] truncate">{v}</span>
    </div>
  );
}
