'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { apiClient } from '@/lib/api';
import {
  Network, RefreshCw, Plus, Trash2, X, Check, Power, PowerOff, Cable,
  AlertTriangle, CheckCircle2, XCircle, Download, History, List, Share2,
  BookOpen, Server,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface VPLSInterface {
  name: string;
  'connect point'?: string;
  ips?: string[];
  mac?: string;
  vlan?: string;
}

interface VPLSService {
  name: string;
  encapsulation?: string;
  interfaces?: Array<VPLSInterface | string>;
}

interface AppStatus {
  appId: string;
  active: boolean;
  state: string;
  version: string | null;
}

interface OnosPort {
  port: string;
  isEnabled: boolean;
  type?: string | null;
  portSpeed?: number | null;
  name?: string | null;
}

interface DeviceItem {
  id: string;
  onos_id: string;
  name?: string | null;
  status?: string | null;
}

type AuditAction = 'create' | 'delete' | 'add_iface' | 'del_iface' | 'activate';

interface AuditEntry {
  id: string;
  ts: string;
  action: AuditAction;
  target: string;
  ok: boolean;
  detail?: string;
}

type TabKey = 'list' | 'topology' | 'audit' | 'docs';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AUDIT_STORAGE_KEY = 'netguard.vpls.audit';
const MAX_AUDIT = 50;
const CONNECT_POINT_RE = /^of:[0-9a-f]{16}\/\d+$/;

const ACTION_LABELS: Record<AuditAction, string> = {
  create: 'Network created',
  delete: 'Network deleted',
  add_iface: 'Interface added',
  del_iface: 'Interface removed',
  activate: 'App activated',
};

function nowTime() {
  return new Date().toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function normalizeInterfaces(raw: VPLSService['interfaces']): VPLSInterface[] {
  if (!raw) return [];
  return raw.map(i => typeof i === 'string' ? { name: i } : i);
}

function validateConnectPoint(cp: string) {
  return CONNECT_POINT_RE.test(cp.trim());
}

// ─── Audit persistence ────────────────────────────────────────────────────────

function loadAudit(): AuditEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(AUDIT_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuditEntry[]) : [];
  } catch {
    return [];
  }
}

function saveAudit(entries: AuditEntry[]) {
  try {
    window.localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* quota exceeded — ignore */
  }
}

// ─── Topology SVG ─────────────────────────────────────────────────────────────

function VplsTopology({ service }: { service: VPLSService }) {
  const ifaces = normalizeInterfaces(service.interfaces);
  if (ifaces.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-xs">
        <Cable className="mb-2 h-6 w-6 opacity-40" />
        No interfaces
      </div>
    );
  }

  const cx = 160, cy = 100, r = 70, nodeR = 20;
  const nodes = ifaces.map((iface, i) => {
    const angle = (2 * Math.PI * i) / ifaces.length - Math.PI / 2;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      iface,
    };
  });

  return (
    <svg viewBox="0 0 320 200" className="w-full max-w-xs" style={{ height: 170 }}
         aria-label={`Topology for ${service.name}`}>
      <circle cx={cx} cy={cy} r={24} className="fill-primary" opacity={0.9} />
      <text x={cx} y={cy - 1} textAnchor="middle" dominantBaseline="middle"
            className="fill-primary-foreground" fontSize={9} fontWeight="bold">
        {service.name.length > 9 ? service.name.slice(0, 9) + '…' : service.name}
      </text>
      <text x={cx} y={cy + 11} textAnchor="middle" dominantBaseline="middle"
            className="fill-primary-foreground" fontSize={7} opacity={0.75}>
        {service.encapsulation ?? 'NONE'}
      </text>

      {nodes.map(({ x, y, iface }) => (
        <line key={iface.name + '-line'} x1={cx} y1={cy} x2={x} y2={y}
              className="stroke-primary" strokeWidth={1.5} strokeDasharray="4 2" opacity={0.55} />
      ))}
      {nodes.map(({ x, y, iface }) => (
        <g key={iface.name}>
          <circle cx={x} cy={y} r={nodeR} className="fill-muted stroke-primary" strokeWidth={1.5} />
          <text x={x} y={y - 2} textAnchor="middle" dominantBaseline="middle"
                className="fill-foreground" fontSize={7} fontWeight="bold">
            {iface.name.length > 7 ? iface.name.slice(0, 7) + '…' : iface.name}
          </text>
          {iface.vlan && (
            <text x={x} y={y + 7} textAnchor="middle" dominantBaseline="middle"
                  className="fill-muted-foreground" fontSize={6}>
              v{iface.vlan}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function VPLSPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<TabKey>('list');
  const [appStatus, setAppStatus] = useState<AppStatus | null>(null);
  const [services, setServices] = useState<VPLSService[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [audit, setAudit] = useState<AuditEntry[]>([]);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '', encapsulation: 'NONE', interfaces: '',
  });
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);

  // Add interface (advanced)
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [addingIface, setAddingIface] = useState(false);
  const [ifaceForm, setIfaceForm] = useState({
    name: '', deviceId: '', portId: '', useManual: false, manualCp: '',
    ips: '', mac: '', vlan: '',
  });
  const [ifaceErr, setIfaceErr] = useState<string | null>(null);

  // Device + port options for picker
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [ports, setPorts] = useState<OnosPort[]>([]);
  const [loadingPorts, setLoadingPorts] = useState(false);

  const [deleting, setDeleting] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Hydrate audit on mount ──
  useEffect(() => {
    setAudit(loadAudit());
  }, []);

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [user, isLoading, router]);

  const canManage = user?.role === 'admin' || user?.role === 'manager';

  const pushAudit = useCallback((entry: Omit<AuditEntry, 'id' | 'ts'>) => {
    setAudit(prev => {
      const next = [
        { ...entry, id: `${Date.now()}-${Math.random()}`, ts: nowTime() },
        ...prev,
      ].slice(0, MAX_AUDIT);
      saveAudit(next);
      return next;
    });
  }, []);

  const showMsg = useCallback((text: string) => {
    setMessage(text);
    if (msgTimer.current) clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => setMessage(null), 4000);
  }, []);

  // ── Fetch core data ──
  const fetchAll = useCallback(async () => {
    try {
      const [statusRes, listRes] = await Promise.all([
        apiClient('/vpls/app-status'),
        apiClient('/vpls'),
      ]);
      if (statusRes.ok) setAppStatus(await statusRes.json());
      if (listRes.ok) {
        const data = await listRes.json();
        setServices(data.vpls || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchAll();
  }, [user, fetchAll]);

  // ── Fetch devices (lazy — only when add-interface opened) ──
  const fetchDevices = useCallback(async () => {
    try {
      const res = await apiClient('/devices');
      if (res.ok) setDevices(await res.json());
    } catch {
      setDevices([]);
    }
  }, []);

  // ── Fetch ports for selected device ──
  useEffect(() => {
    const onosId = devices.find(d => d.id === ifaceForm.deviceId)?.onos_id;
    if (!onosId || ifaceForm.useManual) { setPorts([]); return; }

    setLoadingPorts(true);
    apiClient(`/devices/by-onos/${onosId}/ports`)
      .then(async r => {
        if (!r.ok) { setPorts([]); return; }
        const data = await r.json();
        setPorts(data.ports || []);
      })
      .catch(() => setPorts([]))
      .finally(() => setLoadingPorts(false));
  }, [ifaceForm.deviceId, ifaceForm.useManual, devices]);

  // ── Derived connect point from picker ──
  const derivedConnectPoint = useMemo(() => {
    if (ifaceForm.useManual) return ifaceForm.manualCp.trim();
    const dev = devices.find(d => d.id === ifaceForm.deviceId);
    if (dev && ifaceForm.portId) return `${dev.onos_id}/${ifaceForm.portId}`;
    return '';
  }, [ifaceForm, devices]);

  // ── Actions ──
  const handleActivate = async () => {
    setActivating(true);
    try {
      const res = await apiClient('/vpls/activate', { method: 'POST' });
      pushAudit({ action: 'activate', target: 'org.onosproject.vpls', ok: res.ok });
      showMsg('VPLS app activation requested — refreshing…');
      await new Promise(r => setTimeout(r, 2000));
      await fetchAll();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Activation failed';
      pushAudit({ action: 'activate', target: 'org.onosproject.vpls', ok: false, detail: msg });
    } finally {
      setActivating(false);
    }
  };

  const handleCreate = async () => {
    setCreateErr(null);
    const name = createForm.name.trim();
    if (!name) { setCreateErr('Network name is required'); return; }
    if (services.some(s => s.name === name)) {
      setCreateErr('A network with this name already exists'); return;
    }
    setCreating(true);
    try {
      const interfaces = createForm.interfaces.split(',').map(s => s.trim()).filter(Boolean);
      const res = await apiClient('/vpls', {
        method: 'POST',
        body: JSON.stringify({ name, encapsulation: createForm.encapsulation, interfaces }),
      });
      if (res.ok) {
        pushAudit({ action: 'create', target: name, ok: true, detail: createForm.encapsulation });
        showMsg(`VPLS network "${name}" created`);
        setShowCreate(false);
        setCreateForm({ name: '', encapsulation: 'NONE', interfaces: '' });
        await fetchAll();
      } else {
        const msg = `HTTP ${res.status}`;
        pushAudit({ action: 'create', target: name, ok: false, detail: msg });
        setCreateErr(msg);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Create failed';
      pushAudit({ action: 'create', target: name, ok: false, detail: msg });
      setCreateErr(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (name: string) => {
    setDeleting(name);
    try {
      const res = await apiClient(`/vpls/${encodeURIComponent(name)}`, { method: 'DELETE' });
      pushAudit({ action: 'delete', target: name, ok: res.ok });
      showMsg(`Network "${name}" deleted`);
      await fetchAll();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Delete failed';
      pushAudit({ action: 'delete', target: name, ok: false, detail: msg });
    } finally {
      setDeleting(null);
    }
  };

  const openAddInterface = (svcName: string) => {
    setAddingTo(svcName);
    setIfaceErr(null);
    setIfaceForm({
      name: '', deviceId: '', portId: '', useManual: false,
      manualCp: '', ips: '', mac: '', vlan: '',
    });
    if (devices.length === 0) fetchDevices();
  };

  const handleAddInterface = async () => {
    if (!addingTo) return;
    setIfaceErr(null);
    const ifaceName = ifaceForm.name.trim();
    if (!ifaceName) { setIfaceErr('Interface name is required'); return; }

    const cp = derivedConnectPoint;
    if (cp && !validateConnectPoint(cp)) {
      setIfaceErr('Connect point must match of:XXXXXXXXXXXXXXXX/N'); return;
    }

    const body: Record<string, unknown> = { name: ifaceName };
    if (cp) body.connect_point = cp;
    const ipsList = ifaceForm.ips.split(',').map(s => s.trim()).filter(Boolean);
    if (ipsList.length > 0) body.ips = ipsList;
    if (ifaceForm.mac.trim()) body.mac = ifaceForm.mac.trim();
    if (ifaceForm.vlan.trim()) body.vlan = ifaceForm.vlan.trim();

    setAddingIface(true);
    try {
      const res = await apiClient(
        `/vpls/${encodeURIComponent(addingTo)}/interfaces`,
        { method: 'POST', body: JSON.stringify(body) },
      );
      if (res.ok) {
        pushAudit({
          action: 'add_iface', target: `${ifaceName} → ${addingTo}`,
          ok: true, detail: cp || undefined,
        });
        showMsg(`Interface "${ifaceName}" added to ${addingTo}`);
        setAddingTo(null);
        await fetchAll();
      } else {
        const msg = `HTTP ${res.status}`;
        pushAudit({ action: 'add_iface', target: `${ifaceName} → ${addingTo}`, ok: false, detail: msg });
        setIfaceErr(msg);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to add interface';
      pushAudit({ action: 'add_iface', target: `${ifaceName} → ${addingTo}`, ok: false, detail: msg });
      setIfaceErr(msg);
    } finally {
      setAddingIface(false);
    }
  };

  const handleRemoveInterface = async (svcName: string, ifaceName: string) => {
    try {
      const res = await apiClient(
        `/vpls/${encodeURIComponent(svcName)}/interfaces/${encodeURIComponent(ifaceName)}`,
        { method: 'DELETE' },
      );
      pushAudit({ action: 'del_iface', target: `${ifaceName} from ${svcName}`, ok: res.ok });
      await fetchAll();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Remove failed';
      pushAudit({ action: 'del_iface', target: `${ifaceName} from ${svcName}`, ok: false, detail: msg });
    }
  };

  const handleExport = () => {
    const blob = new Blob(
      [JSON.stringify({ vpls: services, exportedAt: new Date().toISOString() }, null, 2)],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vpls-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearAudit = () => {
    setAudit([]);
    saveAudit([]);
  };

  const totalInterfaces = useMemo(
    () => services.reduce((s, svc) => s + normalizeInterfaces(svc.interfaces).length, 0),
    [services],
  );

  if (isLoading || !user) return null;

  // ── Render ──
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">VPLS Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Virtual Private LAN Service · {services.length} network(s) · {totalInterfaces} interface(s)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={services.length === 0}
            className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground/80 hover:bg-muted disabled:opacity-40 transition-colors"
            title="Export JSON"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <button
            onClick={fetchAll}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm text-foreground/80 hover:bg-muted transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Flash message */}
      {message && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-sm text-primary">
          {message}
        </div>
      )}

      {/* App status */}
      <div className={`rounded-xl border p-5 ${
        appStatus?.active
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : 'border-yellow-500/30 bg-yellow-500/5'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {appStatus?.active
              ? <Power className="h-5 w-5 text-emerald-500" />
              : <PowerOff className="h-5 w-5 text-yellow-500" />}
            <div>
              <p className="font-semibold text-foreground">
                VPLS Application — {appStatus?.state ?? 'Loading...'}
              </p>
              <p className="text-xs text-muted-foreground">
                {appStatus?.appId} {appStatus?.version ? `· v${appStatus.version}` : ''}
              </p>
            </div>
          </div>
          {canManage && !appStatus?.active && (
            <button
              onClick={handleActivate}
              disabled={activating}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {activating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
              Activate
            </button>
          )}
        </div>
      </div>

      {!appStatus?.active ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <AlertTriangle className="mb-3 h-12 w-12 text-yellow-500" />
          <p className="text-yellow-500 font-medium">VPLS App is not active</p>
          <p className="text-sm mt-1">Activate the VPLS application in ONOS to manage virtual networks</p>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex gap-1 border-b border-border">
            {([
              { k: 'list',     label: 'Networks',   icon: List },
              { k: 'topology', label: 'Topology',   icon: Share2 },
              { k: 'audit',    label: 'Audit log',  icon: History },
              { k: 'docs',     label: 'API docs',   icon: BookOpen },
            ] as const).map(({ k, label, icon: Icon }) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                  tab === k
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
                {k === 'audit' && audit.length > 0 && (
                  <span className="ml-1 rounded-full bg-primary/20 px-1.5 text-xs text-primary">
                    {audit.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── Tab: List ── */}
          {tab === 'list' && (
            <>
              {canManage && (
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowCreate(!showCreate)}
                    className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Create VPLS Network
                  </button>
                </div>
              )}

              {showCreate && canManage && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-4">New VPLS Network</h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Network Name *</label>
                      <input
                        type="text"
                        value={createForm.name}
                        onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                        placeholder="e.g. vlan100"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Encapsulation</label>
                      <select
                        value={createForm.encapsulation}
                        onChange={e => setCreateForm({ ...createForm, encapsulation: e.target.value })}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                      >
                        <option value="NONE">NONE</option>
                        <option value="VLAN">VLAN</option>
                        <option value="MPLS">MPLS</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Interfaces (comma-separated)</label>
                      <input
                        type="text"
                        value={createForm.interfaces}
                        onChange={e => setCreateForm({ ...createForm, interfaces: e.target.value })}
                        placeholder="e.g. h1, h2, h3"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                      />
                    </div>
                  </div>
                  {createErr && (
                    <p className="mt-3 text-xs text-red-400">{createErr}</p>
                  )}
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={handleCreate}
                      disabled={creating || !createForm.name}
                      className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      {creating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Create
                    </button>
                    <button
                      onClick={() => { setShowCreate(false); setCreateErr(null); }}
                      className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {services.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Network className="mb-3 h-12 w-12 text-muted-foreground/50" />
                  <p className="font-medium">No VPLS networks</p>
                  <p className="text-sm mt-1">Create a VPLS network to get started</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {services.map(svc => {
                    const ifaces = normalizeInterfaces(svc.interfaces);
                    return (
                      <div
                        key={svc.name}
                        className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-semibold text-foreground flex items-center gap-2">
                              <Network className="h-4 w-4 text-primary" />
                              {svc.name}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-1">
                              Encapsulation: <span className="text-foreground">{svc.encapsulation || 'NONE'}</span>
                            </p>
                          </div>
                          {canManage && (
                            <button
                              onClick={() => handleDelete(svc.name)}
                              disabled={deleting === svc.name}
                              className="rounded-lg p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              title="Delete VPLS network"
                            >
                              {deleting === svc.name
                                ? <RefreshCw className="h-4 w-4 animate-spin" />
                                : <Trash2 className="h-4 w-4" />}
                            </button>
                          )}
                        </div>

                        <div className="mt-3">
                          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                            <Cable className="h-3 w-3" />
                            Interfaces ({ifaces.length})
                          </p>
                          <div className="space-y-1">
                            {ifaces.map(iface => (
                              <div
                                key={iface.name}
                                className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-1.5"
                              >
                                <div className="min-w-0 flex-1">
                                  <span className="text-xs text-foreground">{iface.name}</span>
                                  {iface['connect point'] && (
                                    <p className="text-[10px] text-muted-foreground truncate">
                                      {iface['connect point']}
                                      {iface.vlan && ` · vlan ${iface.vlan}`}
                                    </p>
                                  )}
                                </div>
                                {canManage && (
                                  <button
                                    onClick={() => handleRemoveInterface(svc.name, iface.name)}
                                    className="text-muted-foreground hover:text-red-400 transition-colors"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>

                          {canManage && (
                            addingTo === svc.name ? (
                              <div className="mt-3 space-y-2 rounded-lg border border-border bg-background/50 p-3">
                                <div>
                                  <label className="block text-[10px] text-muted-foreground mb-1">Interface name *</label>
                                  <input
                                    type="text"
                                    value={ifaceForm.name}
                                    onChange={e => setIfaceForm({ ...ifaceForm, name: e.target.value })}
                                    placeholder="e.g. site-a"
                                    className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
                                  />
                                </div>

                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                  <input
                                    id={`manual-cp-${svc.name}`}
                                    type="checkbox"
                                    checked={ifaceForm.useManual}
                                    onChange={e => setIfaceForm({ ...ifaceForm, useManual: e.target.checked })}
                                    className="h-3 w-3"
                                  />
                                  <label htmlFor={`manual-cp-${svc.name}`}>Manual connect-point</label>
                                </div>

                                {ifaceForm.useManual ? (
                                  <div>
                                    <label className="block text-[10px] text-muted-foreground mb-1">Connect point</label>
                                    <input
                                      type="text"
                                      value={ifaceForm.manualCp}
                                      onChange={e => setIfaceForm({ ...ifaceForm, manualCp: e.target.value })}
                                      placeholder="of:0000000000000001/1"
                                      className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground font-mono"
                                    />
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="block text-[10px] text-muted-foreground mb-1">Device</label>
                                      <select
                                        value={ifaceForm.deviceId}
                                        onChange={e => setIfaceForm({ ...ifaceForm, deviceId: e.target.value, portId: '' })}
                                        className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
                                      >
                                        <option value="">Select…</option>
                                        {devices.map(d => (
                                          <option key={d.id} value={d.id}>
                                            {d.name || d.onos_id.slice(-6)}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-[10px] text-muted-foreground mb-1">
                                        Port {loadingPorts && '…'}
                                      </label>
                                      <select
                                        value={ifaceForm.portId}
                                        onChange={e => setIfaceForm({ ...ifaceForm, portId: e.target.value })}
                                        disabled={!ifaceForm.deviceId || loadingPorts}
                                        className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground disabled:opacity-50"
                                      >
                                        <option value="">Select…</option>
                                        {ports.map(p => (
                                          <option key={p.port} value={p.port}>
                                            {p.port}{p.isEnabled ? '' : ' (down)'}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                                )}

                                {derivedConnectPoint && (
                                  <p className="text-[10px] text-muted-foreground font-mono">
                                    → {derivedConnectPoint}
                                  </p>
                                )}

                                <details className="text-[10px]">
                                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                    Optional (IPs, MAC, VLAN)
                                  </summary>
                                  <div className="mt-2 space-y-2">
                                    <input
                                      type="text"
                                      value={ifaceForm.ips}
                                      onChange={e => setIfaceForm({ ...ifaceForm, ips: e.target.value })}
                                      placeholder="IPs (e.g. 10.0.1.1/24)"
                                      className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
                                    />
                                    <div className="grid grid-cols-2 gap-2">
                                      <input
                                        type="text"
                                        value={ifaceForm.mac}
                                        onChange={e => setIfaceForm({ ...ifaceForm, mac: e.target.value })}
                                        placeholder="MAC"
                                        className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
                                      />
                                      <input
                                        type="text"
                                        value={ifaceForm.vlan}
                                        onChange={e => setIfaceForm({ ...ifaceForm, vlan: e.target.value })}
                                        placeholder="VLAN"
                                        className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
                                      />
                                    </div>
                                  </div>
                                </details>

                                {ifaceErr && <p className="text-[10px] text-red-400">{ifaceErr}</p>}

                                <div className="flex gap-2 pt-1">
                                  <button
                                    onClick={handleAddInterface}
                                    disabled={addingIface || !ifaceForm.name}
                                    className="flex-1 rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                                  >
                                    {addingIface ? 'Adding…' : 'Add'}
                                  </button>
                                  <button
                                    onClick={() => setAddingTo(null)}
                                    className="rounded border border-border px-2 py-1 text-xs text-muted-foreground"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => openAddInterface(svc.name)}
                                className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline"
                              >
                                <Plus className="h-3 w-3" />
                                Add interface
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ── Tab: Topology ── */}
          {tab === 'topology' && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {services.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Share2 className="mb-3 h-12 w-12 opacity-40" />
                  <p className="font-medium">No topology to display</p>
                </div>
              ) : services.map(svc => (
                <div key={svc.name} className="rounded-xl border border-border bg-card p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                      <Server className="h-4 w-4 text-primary" />
                      {svc.name}
                    </h3>
                    <span className="text-[10px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                      {svc.encapsulation || 'NONE'}
                    </span>
                  </div>
                  <VplsTopology service={svc} />
                </div>
              ))}
            </div>
          )}

          {/* ── Tab: Audit ── */}
          {tab === 'audit' && (
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Local audit log — {audit.length}/{MAX_AUDIT} most recent operations
                </p>
                {audit.length > 0 && (
                  <button
                    onClick={clearAudit}
                    className="text-xs text-muted-foreground hover:text-red-400"
                  >
                    Clear
                  </button>
                )}
              </div>
              {audit.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">No audit entries yet</p>
              ) : (
                <div className="space-y-0">
                  {audit.map(e => (
                    <div key={e.id} className="flex items-start gap-3 border-b border-border py-2 text-xs last:border-0">
                      <span className="w-20 flex-shrink-0 font-mono text-muted-foreground">{e.ts}</span>
                      {e.ok
                        ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
                        : <XCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-red-500" />}
                      <span className="font-medium text-foreground">{ACTION_LABELS[e.action]}</span>
                      <span className="truncate text-muted-foreground">{e.target}</span>
                      {e.detail && (
                        <span className={`ml-auto truncate ${e.ok ? 'text-muted-foreground' : 'text-red-400'}`}>
                          {e.detail}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Docs ── */}
          {tab === 'docs' && (
            <div className="rounded-xl border border-border bg-card p-6 text-sm">
              <h2 className="mb-2 text-lg font-semibold text-foreground">VPLS REST API reference</h2>
              <p className="text-muted-foreground mb-4">
                Backend endpoints proxied to the ONOS VPLS application.
              </p>
              <div className="space-y-2 font-mono text-xs">
                {[
                  ['GET',    '/vpls/app-status',                   'Check whether the VPLS app is installed/active'],
                  ['POST',   '/vpls/activate',                     'Activate the VPLS ONOS app (admin/manager)'],
                  ['GET',    '/vpls',                              'List all VPLS networks'],
                  ['POST',   '/vpls',                              'Create a VPLS network (name, encapsulation, interfaces)'],
                  ['DELETE', '/vpls/{name}',                       'Delete a VPLS network'],
                  ['POST',   '/vpls/{name}/interfaces',            'Add interface (name + optional connect_point, ips, mac, vlan)'],
                  ['DELETE', '/vpls/{name}/interfaces/{iface}',    'Remove interface'],
                  ['GET',    '/devices/by-onos/{onos_id}/ports',   'List ONOS ports for the device'],
                ].map(([method, path, desc]) => (
                  <div key={path} className="flex items-start gap-3 rounded border border-border bg-background/50 p-2">
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                      method === 'GET'    ? 'bg-blue-500/20 text-blue-400' :
                      method === 'POST'   ? 'bg-emerald-500/20 text-emerald-400' :
                      method === 'DELETE' ? 'bg-red-500/20 text-red-400' :
                                            'bg-muted text-muted-foreground'
                    }`}>
                      {method}
                    </span>
                    <span className="text-foreground break-all">{path}</span>
                    <span className="ml-auto text-muted-foreground font-sans text-[11px] text-right">
                      {desc}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Connect-point format: <code className="font-mono text-foreground">of:XXXXXXXXXXXXXXXX/N</code> — 16 hex chars + port number.
                Encapsulations: <code className="font-mono">NONE</code>, <code className="font-mono">VLAN</code>, <code className="font-mono">MPLS</code>.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
