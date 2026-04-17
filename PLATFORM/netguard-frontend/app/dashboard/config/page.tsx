'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { apiClient } from '@/lib/api';
import {
  Server, RefreshCw, ToggleLeft, ToggleRight,
  Plus, History, Wifi, WifiOff, Settings,
  ChevronRight, Save, Network, Monitor
} from 'lucide-react';

interface Device {
  id: string;
  onos_id: string;
  name: string;
  type?: string;
  status: string;
  manufacturer?: string;
  sw_version?: string;
}

interface Port {
  port: string;
  is_enabled: boolean;
  type: string;
  speed: number;
  annotations: Record<string, string>;
  last_changed?: string;
}

interface VLAN {
  id: string;
  vlan_id: number;
  name: string;
  ports: string[];
  mode: string;
  applied_at: string;
  notes?: string;
}

interface Host {
  id: string;
  mac: string;
  vlan: string;
  ip_addresses: string[];
  location_device?: string;
  location_port?: string;
  configured: boolean;
  suspended: boolean;
}

interface HistoryEntry {
  id: string;
  config_type: string;
  config_data: any;
  applied_at: string;
  is_active: boolean;
  notes?: string;
}

export default function ConfigPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [activeTab, setActiveTab] = useState<'ports' | 'vlans' | 'hosts' | 'history'>('ports');
  const [ports, setPorts] = useState<Port[]>([]);
  const [vlans, setVLANs] = useState<VLAN[]>([]);
  const [hosts, setHosts] = useState<Host[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [togglingPort, setTogglingPort] = useState<string | null>(null);
  const [togglingHost, setTogglingHost] = useState<string | null>(null);
  const [showVLANForm, setShowVLANForm] = useState(false);
  const [savingVLAN, setSavingVLAN] = useState(false);

  const [vlanForm, setVlanForm] = useState({
    vlan_id: '',
    name: '',
    ports: '',
    mode: 'access',
    notes: '',
  });

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [user, isLoading, router]);

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient('/devices');
      if (res.ok) setDevices(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchDevices();
  }, [user, fetchDevices]);

  const selectDevice = useCallback(async (device: Device) => {
    setSelectedDevice(device);
    setDetailLoading(true);
    try {
      const [portsRes, vlansRes, histRes, hostsRes] = await Promise.all([
        apiClient(`/config/devices/${device.onos_id}/ports`),
        apiClient(`/config/devices/${device.onos_id}/vlans`),
        apiClient(`/config/devices/${device.onos_id}/history`),
        apiClient('/config/hosts'),
      ]);
      if (portsRes.ok) {
        const d = await portsRes.json();
        setPorts(d.ports || []);
      }
      if (vlansRes.ok) {
        const d = await vlansRes.json();
        setVLANs(d.vlans || []);
      }
      if (histRes.ok) {
        const d = await histRes.json();
        setHistory(d.history || []);
      }
      if (hostsRes.ok) {
        const d = await hostsRes.json();
        const deviceHosts = (d.hosts || []).filter(
          (h: Host) => h.location_device === device.onos_id
        );
        setHosts(prev => {
          const existing = prev.filter(h => h.location_device === device.onos_id);
          const newIds = deviceHosts.map((h: Host) => h.id);
          const disappeared = existing.filter(h => !newIds.includes(h.id));
          const markedDisappeared = disappeared.map(h => ({ ...h, suspended: true }));
          return [...deviceHosts, ...markedDisappeared];
        });
      }
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const togglePort = async (portNum: string, currentEnabled: boolean) => {
    if (!selectedDevice || !['admin', 'manager'].includes(user?.role ?? '')) return;
    setTogglingPort(portNum);
    try {
      const res = await apiClient(
        `/config/devices/${selectedDevice.onos_id}/ports/${portNum}/toggle?enable=${!currentEnabled}`,
        { method: 'POST' }
      );
      if (res.ok) await selectDevice(selectedDevice);
    } finally {
      setTogglingPort(null);
    }
  };

  const toggleHostLink = async (host: Host, enable: boolean) => {
    if (!host.location_device || !host.location_port) return;
    setTogglingHost(host.id);
    try {
      const res = await apiClient('/config/hosts/toggle-link', {
        method: 'POST',
        body: JSON.stringify({
          switch_device: host.location_device,
          switch_port: host.location_port,
          enable,
        }),
      });
      if (res.ok) {
        setHosts(prev =>
          prev.map(h =>
            h.id === host.id ? { ...h, suspended: !enable } : h
          )
        );
        // Disconnect → refresh après 1s
        // Reconnect → pas de refresh auto (ONOS met du temps)
        if (!enable) {
          setTimeout(() => {
            if (selectedDevice) selectDevice(selectedDevice);
          }, 1000);
        }
      }
    } finally {
      setTogglingHost(null);
    }
  };

  const saveVLAN = async () => {
    if (!selectedDevice || !vlanForm.vlan_id) return;
    setSavingVLAN(true);
    try {
      const portList = vlanForm.ports.split(',').map(p => p.trim()).filter(Boolean);
      const res = await apiClient(`/config/devices/${selectedDevice.onos_id}/vlans`, {
        method: 'POST',
        body: JSON.stringify({
          vlan_id: parseInt(vlanForm.vlan_id),
          name: vlanForm.name || `VLAN-${vlanForm.vlan_id}`,
          ports: portList,
          mode: vlanForm.mode,
          notes: vlanForm.notes,
        }),
      });
      if (res.ok) {
        setShowVLANForm(false);
        setVlanForm({ vlan_id: '', name: '', ports: '', mode: 'access', notes: '' });
        await selectDevice(selectedDevice);
      }
    } finally {
      setSavingVLAN(false);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleString('en-GB', {
      day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit',
    });

  if (isLoading || !user) return null;
  const canEdit = ['admin', 'manager'].includes(user.role);

  return (
    <div className="flex h-full">
      {/* ── Device Sidebar ── */}
      <div className="w-56 shrink-0 border-r border-border bg-background overflow-y-auto">
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Settings className="h-4 w-4 text-primary" />
            Device Config
          </h2>
        </div>
        <div className="p-2 space-y-1">
          {loading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : devices.map(device => (
            <button
              key={device.id}
              onClick={() => { setHosts([]); selectDevice(device); }}
              className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                selectedDevice?.id === device.id
                  ? 'bg-primary/20 border border-cyan-700/50'
                  : 'hover:bg-muted border border-transparent'
              }`}
            >
              <div className={`h-8 w-8 shrink-0 flex items-center justify-center rounded-lg ${
                device.status === 'active' ? 'bg-primary/30' : 'bg-muted'
              }`}>
                <Server className={`h-4 w-4 ${
                  device.status === 'active' ? 'text-primary' : 'text-muted-foreground'
                }`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{device.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {device.onos_id?.replace('of:00000000000000', 'SW-')}
                </p>
              </div>
              <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 overflow-y-auto">
        {!selectedDevice ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <Network className="mx-auto mb-4 h-12 w-12 text-slate-700" />
              <p className="text-muted-foreground">Select a device to configure</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Device Header */}
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-foreground">{selectedDevice.name}</h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedDevice.onos_id} · {selectedDevice.manufacturer} v{selectedDevice.sw_version}
                </p>
              </div>
              <span className={`rounded-xl border px-3 py-1 text-xs capitalize ${
                selectedDevice.status === 'active'
                  ? 'border-green-500/30 bg-green-500/10 text-green-400'
                  : 'border-red-500/30 bg-red-500/10 text-red-400'
              }`}>
                {selectedDevice.status}
              </span>
            </div>

            {/* Tabs */}
            <div className="mb-5 flex gap-2 flex-wrap">
              {(['ports', 'vlans', 'hosts', 'history'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm capitalize transition-colors ${
                    activeTab === tab
                      ? 'bg-primary text-foreground'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab === 'ports' && <Wifi className="h-4 w-4" />}
                  {tab === 'vlans' && <Network className="h-4 w-4" />}
                  {tab === 'hosts' && <Monitor className="h-4 w-4" />}
                  {tab === 'history' && <History className="h-4 w-4" />}
                  {tab}
                  {tab === 'hosts' && hosts.length > 0 && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
                      {hosts.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {detailLoading ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {/* ── PORTS TAB ── */}
                {activeTab === 'ports' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-sm font-semibold text-foreground">
                        Port Configuration ({ports.length} ports)
                      </h2>
                      {!canEdit && (
                        <span className="text-xs text-muted-foreground">Read-only — viewer role</span>
                      )}
                    </div>
                    {ports.length === 0 ? (
                      <div className="rounded-xl border border-border bg-card/60 p-8 text-center text-muted-foreground">
                        <Wifi className="mx-auto mb-2 h-8 w-8" />
                        <p>No ports available</p>
                        <p className="text-xs mt-1">ONOS may not have port data for this device</p>
                      </div>
                    ) : ports.map(port => (
                      <div key={port.port} className="rounded-xl border border-border bg-card/60 p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                              port.is_enabled ? 'bg-green-500/20' : 'bg-red-500/20'
                            }`}>
                              {port.is_enabled
                                ? <Wifi className="h-5 w-5 text-green-400" />
                                : <WifiOff className="h-5 w-5 text-red-400" />
                              }
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-foreground">
                                  {port.port === 'local' || port.port === '0'
                                    ? 'Port local'
                                    : `Port ${port.port}`
                                  }
                                </p>
                                <span className={`rounded-lg border px-2 py-0.5 text-xs ${
                                  port.is_enabled
                                    ? 'border-green-500/30 bg-green-500/10 text-green-400'
                                    : 'border-red-500/30 bg-red-500/10 text-red-400'
                                }`}>
                                  {port.is_enabled ? 'Enabled' : 'Disabled'}
                                </span>
                                <span className="rounded-lg bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                  {port.type}
                                </span>
                              </div>
                              <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                                <span>
                                  {port.speed > 0 ? `${port.speed / 1000}Gbps` : 'No speed'}
                                </span>
                                {port.annotations?.portName && (
                                  <span className="font-mono">{port.annotations.portName}</span>
                                )}
                                {port.last_changed && (
                                  <span>Changed: {formatDate(port.last_changed)}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          {canEdit && 
                              port.port !== 'local' && 
                              port.port !== '0' && 
                              selectedDevice.onos_id.startsWith('of:') &&  // ← ajoute
                              (
                                <button
                                  onClick={() => togglePort(port.port, port.is_enabled)}
                              disabled={togglingPort === port.port}
                              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm transition-colors disabled:opacity-50 ${
                                port.is_enabled
                                  ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                                  : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                              }`}
                            >
                              {togglingPort === port.port ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : port.is_enabled ? (
                                <><ToggleLeft className="h-4 w-4" /> Disable</>
                              ) : (
                                <><ToggleRight className="h-4 w-4" /> Enable</>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── VLANs TAB ── */}
                {activeTab === 'vlans' && (
                  <div>
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-foreground">
                        VLAN Configuration ({vlans.length} VLANs)
                      </h2>
                      {canEdit && (
                        <button
                          onClick={() => setShowVLANForm(!showVLANForm)}
                          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm text-foreground hover:bg-primary/90"
                        >
                          <Plus className="h-4 w-4" />
                          Add VLAN
                        </button>
                      )}
                    </div>

                    {showVLANForm && (
                      <div className="mb-4 rounded-2xl border border-cyan-700/30 bg-primary/5 p-5">
                        <h3 className="mb-4 font-semibold text-foreground">Configure New VLAN</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="mb-1 block text-xs text-muted-foreground">VLAN ID *</label>
                            <input
                              type="number"
                              value={vlanForm.vlan_id}
                              onChange={e => setVlanForm(f => ({ ...f, vlan_id: e.target.value }))}
                              className="w-full rounded-xl border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-cyan-500 focus:outline-none"
                              placeholder="10"
                              min="1" max="4094"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-muted-foreground">Name</label>
                            <input
                              type="text"
                              value={vlanForm.name}
                              onChange={e => setVlanForm(f => ({ ...f, name: e.target.value }))}
                              className="w-full rounded-xl border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-cyan-500 focus:outline-none"
                              placeholder="Management"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-muted-foreground">Ports (comma separated)</label>
                            <input
                              type="text"
                              value={vlanForm.ports}
                              onChange={e => setVlanForm(f => ({ ...f, ports: e.target.value }))}
                              className="w-full rounded-xl border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-cyan-500 focus:outline-none"
                              placeholder="1, 2, 3"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-muted-foreground">Mode</label>
                            <select
                              value={vlanForm.mode}
                              onChange={e => setVlanForm(f => ({ ...f, mode: e.target.value }))}
                              className="w-full rounded-xl border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-cyan-500 focus:outline-none"
                            >
                              <option value="access">Access</option>
                              <option value="trunk">Trunk</option>
                            </select>
                          </div>
                          <div className="col-span-2">
                            <label className="mb-1 block text-xs text-muted-foreground">Notes</label>
                            <input
                              type="text"
                              value={vlanForm.notes}
                              onChange={e => setVlanForm(f => ({ ...f, notes: e.target.value }))}
                              className="w-full rounded-xl border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-cyan-500 focus:outline-none"
                              placeholder="Optional notes"
                            />
                          </div>
                        </div>
                        <div className="mt-4 flex gap-3">
                          <button
                            onClick={() => setShowVLANForm(false)}
                            className="flex-1 rounded-xl bg-muted px-4 py-2 text-sm text-foreground/80 hover:bg-muted"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={saveVLAN}
                            disabled={savingVLAN || !vlanForm.vlan_id}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm text-foreground hover:bg-primary/90 disabled:opacity-50"
                          >
                            {savingVLAN
                              ? <RefreshCw className="h-4 w-4 animate-spin" />
                              : <Save className="h-4 w-4" />
                            }
                            Save VLAN
                          </button>
                        </div>
                      </div>
                    )}

                    {vlans.length === 0 ? (
                      <div className="rounded-xl border border-border bg-card/60 p-8 text-center text-muted-foreground">
                        <Network className="mx-auto mb-2 h-8 w-8" />
                        <p>No VLANs configured</p>
                        {canEdit && (
                          <button
                            onClick={() => setShowVLANForm(true)}
                            className="mt-3 rounded-xl bg-primary/20 px-4 py-2 text-sm text-primary hover:bg-primary/30"
                          >
                            Add first VLAN
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {vlans.map(vlan => (
                          <div key={vlan.id} className="rounded-xl border border-border bg-card/60 p-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="rounded-lg bg-blue-500/20 px-2 py-0.5 text-xs font-bold text-blue-400">
                                    VLAN {vlan.vlan_id}
                                  </span>
                                  <span className="font-medium text-foreground">{vlan.name}</span>
                                  <span className="rounded-lg bg-muted px-2 py-0.5 text-xs text-muted-foreground capitalize">
                                    {vlan.mode}
                                  </span>
                                </div>
                                <div className="mt-2 flex items-center gap-2 flex-wrap">
                                  {vlan.ports.map(p => (
                                    <span key={p} className="rounded-md bg-muted px-2 py-0.5 text-xs text-foreground/80">
                                      port {p}
                                    </span>
                                  ))}
                                </div>
                                {vlan.notes && (
                                  <p className="mt-1 text-xs text-muted-foreground">{vlan.notes}</p>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground shrink-0">
                                {formatDate(vlan.applied_at)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── HOSTS TAB ── */}
                {activeTab === 'hosts' && (
                  <div>
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-foreground">
                        Connected Hosts ({hosts.length})
                      </h2>
                      <button
                        onClick={() => selectedDevice && selectDevice(selectedDevice)}
                        className="flex items-center gap-2 rounded-xl bg-muted px-3 py-1.5 text-xs text-foreground/80 hover:bg-muted"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Refresh
                      </button>
                    </div>
                    {hosts.length === 0 ? (
                      <div className="rounded-xl border border-border bg-card/60 p-8 text-center text-muted-foreground">
                        <Monitor className="mx-auto mb-2 h-8 w-8" />
                        <p>No hosts connected to this device</p>
                        <p className="text-xs mt-1">Hosts appear after they send traffic</p>
                      </div>
                    ) : hosts.map(host => (
                      <div
                        key={host.id}
                        className={`mb-3 rounded-2xl border p-4 transition-colors ${
                          host.suspended
                            ? 'border-red-800/50 bg-red-950/20'
                            : 'border-border bg-card/60'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                              host.suspended ? 'bg-red-500/20' : 'bg-muted'
                            }`}>
                              <Monitor className={`h-5 w-5 ${
                                host.suspended ? 'text-red-400' : 'text-foreground/80'
                              }`} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-foreground">
                                  {host.ip_addresses[0] || 'Unknown IP'}
                                </p>
                                {host.ip_addresses.slice(1).map(ip => (
                                  <span key={ip} className="text-xs text-muted-foreground">{ip}</span>
                                ))}
                                {host.suspended ? (
                                  <span className="rounded-lg bg-red-500/20 px-2 py-0.5 text-xs text-red-400">
                                    Disconnected
                                  </span>
                                ) : (
                                  <span className="rounded-lg bg-green-500/20 px-2 py-0.5 text-xs text-green-400">
                                    Connected
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                                <span className="font-mono">{host.mac}</span>
                                {host.location_port && (
                                  <span className="flex items-center gap-1">
                                    <Wifi className="h-3 w-3" />
                                    Port {host.location_port}
                                  </span>
                                )}
                                {host.vlan !== 'None' && host.vlan && (
                                  <span className="rounded-md bg-blue-500/10 px-1.5 py-0.5 text-blue-400">
                                    VLAN {host.vlan}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {canEdit && host.location_port && (
                            <div className="flex items-center gap-2">
                              {!host.suspended ? (
                                <button
                                  onClick={() => toggleHostLink(host, false)}
                                  disabled={togglingHost === host.id}
                                  className="flex items-center gap-1.5 rounded-xl bg-red-500/10 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                                >
                                  {togglingHost === host.id
                                    ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                    : <WifiOff className="h-3.5 w-3.5" />
                                  }
                                  Disconnect
                                </button>
                              ) : (
                                <button
                                  onClick={() => toggleHostLink(host, true)}
                                  disabled={togglingHost === host.id}
                                  className="flex items-center gap-1.5 rounded-xl bg-green-500/10 px-3 py-1.5 text-xs text-green-400 hover:bg-green-500/20 disabled:opacity-50 transition-colors"
                                >
                                  {togglingHost === host.id
                                    ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                    : <Wifi className="h-3.5 w-3.5" />
                                  }
                                  Reconnect
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── HISTORY TAB ── */}
                {activeTab === 'history' && (
                  <div>
                    <h2 className="mb-4 text-sm font-semibold text-foreground">
                      Configuration History ({history.length} entries)
                    </h2>
                    {history.length === 0 ? (
                      <div className="rounded-xl border border-border bg-card/60 p-8 text-center text-muted-foreground">
                        <History className="mx-auto mb-2 h-8 w-8" />
                        <p>No configuration history yet</p>
                        <p className="text-xs mt-1">
                          Changes will appear here after port toggles and VLAN configs
                        </p>
                      </div>
                    ) : (
                      <div className="relative">
                        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-muted" />
                        <div className="space-y-3">
                          {history.map(entry => (
                            <div key={entry.id} className="relative flex gap-4">
                              <div className={`relative z-10 mt-2 h-3 w-3 shrink-0 rounded-full border-2 border-border ${
                                entry.config_type === 'port' ? 'bg-cyan-400' :
                                entry.config_type === 'vlan' ? 'bg-blue-400' :
                                'bg-slate-500'
                              }`} />
                              <div className="flex-1 rounded-xl border border-border bg-card/60 p-4">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className={`rounded-lg px-2 py-0.5 text-xs capitalize ${
                                        entry.config_type === 'port'
                                          ? 'bg-cyan-500/20 text-primary'
                                          : entry.config_type === 'vlan'
                                          ? 'bg-blue-500/20 text-blue-400'
                                          : 'bg-muted text-muted-foreground'
                                      }`}>
                                        {entry.config_type}
                                      </span>
                                      <span className="text-sm font-medium text-foreground">
                                        {entry.config_type === 'port'
                                          ? `Port ${entry.config_data?.port} → ${
                                              entry.config_data?.enabled ? 'enabled' : 'disabled'
                                            }`
                                          : entry.config_type === 'vlan'
                                          ? `VLAN ${entry.config_data?.vlan_id} (${entry.config_data?.name})`
                                          : JSON.stringify(entry.config_data || {}).slice(0, 40)
                                        }
                                      </span>
                                    </div>
                                    {entry.notes && (
                                      <p className="mt-1 text-xs text-muted-foreground">{entry.notes}</p>
                                    )}
                                  </div>
                                  <span className="text-xs text-muted-foreground shrink-0 ml-4">
                                    {formatDate(entry.applied_at)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}