'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/components/auth-provider';
import { apiClient } from '@/lib/api';
import {
  Server, RefreshCw, Wifi, WifiOff,
  MapPin, Cpu, HardDrive, RotateCcw, X,
  ToggleLeft, ToggleRight, Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Device {
  id: string;
  onos_id?: string;
  name: string;
  type?: string;
  ip_address?: string;
  status: 'active' | 'inactive' | 'unknown';
  manufacturer?: string;
  sw_version?: string;
  location?: string;
  last_seen?: string;
  updated_at: string;
}

interface DevicePort {
  port: string;
  isEnabled: boolean;
  type?: string | null;
  portSpeed?: number | null;
  name?: string | null;
}

function fmtSpeed(mbps?: number | null) {
  if (!mbps || mbps <= 0) return '';
  if (mbps >= 1000) return `${(mbps / 1000).toFixed(0)} Gbps`;
  return `${mbps} Mbps`;
}

const STATUS_BADGE: Record<Device['status'], 'success' | 'critical' | 'default'> = {
  active:   'success',
  inactive: 'critical',
  unknown:  'default',
};

const STATUS_ICON: Record<Device['status'], typeof Wifi> = {
  active:   Wifi,
  inactive: WifiOff,
  unknown:  Wifi,
};

function formatDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GB', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function DevicesPage() {
  const { user } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selected, setSelected] = useState<Device | null>(null);
  const [ports, setPorts] = useState<DevicePort[]>([]);
  const [loadingPorts, setLoadingPorts] = useState(false);
  const [portAction, setPortAction] = useState<string | null>(null);
  const [portError, setPortError] = useState<string | null>(null);

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient('/devices');
      if (res.ok) setDevices(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  const syncFromOnos = async () => {
    if (!['admin', 'manager'].includes(user?.role ?? '')) return;
    setSyncing(true);
    try {
      const res = await apiClient('/devices/sync', { method: 'POST' });
      if (res.ok) await fetchDevices();
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (user) fetchDevices();
  }, [user, fetchDevices]);

  // ── Load ports when a device is selected ──
  const loadPorts = useCallback(async (onosId: string) => {
    setLoadingPorts(true);
    setPortError(null);
    try {
      const res = await apiClient(`/devices/by-onos/${onosId}/ports`);
      if (res.ok) {
        const data = await res.json();
        setPorts(data.ports || []);
      } else {
        setPorts([]);
        setPortError(`HTTP ${res.status}`);
      }
    } catch (err) {
      setPorts([]);
      setPortError(err instanceof Error ? err.message : 'Failed to load ports');
    } finally {
      setLoadingPorts(false);
    }
  }, []);

  useEffect(() => {
    if (selected?.onos_id) {
      loadPorts(selected.onos_id);
    } else {
      setPorts([]);
    }
  }, [selected, loadPorts]);

  const togglePortState = async (port: DevicePort) => {
    if (!selected?.onos_id) return;
    if (!['admin', 'manager'].includes(user?.role ?? '')) return;
    setPortAction(port.port);
    setPortError(null);
    try {
      const res = await apiClient(
        `/devices/by-onos/${selected.onos_id}/ports/${port.port}/state`,
        { method: 'POST', body: JSON.stringify({ enabled: !port.isEnabled }) },
      );
      if (res.ok) {
        await loadPorts(selected.onos_id);
      } else {
        setPortError(`Failed to toggle port (HTTP ${res.status})`);
      }
    } catch (err) {
      setPortError(err instanceof Error ? err.message : 'Port toggle failed');
    } finally {
      setPortAction(null);
    }
  };

  const canSync = ['admin', 'manager'].includes(user?.role ?? '');
  const canManagePorts = canSync;
  const active  = devices.filter(d => d.status === 'active').length;
  const inactive = devices.filter(d => d.status === 'inactive').length;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-serif">Network Devices</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            SDN switches and endpoints managed by ONOS
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canSync && (
            <button
              onClick={syncFromOnos}
              disabled={syncing}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <RotateCcw className={cn('h-4 w-4', syncing && 'animate-spin')} />
              Sync from ONOS
            </button>
          )}
          <button
            onClick={fetchDevices}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{devices.length}</p>
        </div>
        <div className="rounded-xl border border-success/30 bg-success/5 p-4">
          <p className="text-sm text-success">Active</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{active}</p>
        </div>
        <div className="rounded-xl border border-critical/30 bg-critical/5 p-4">
          <p className="text-sm text-critical">Inactive</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{inactive}</p>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Device Grid */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-start justify-between">
                    <div className="h-12 w-12 animate-pulse rounded-xl bg-muted" />
                    <div className="h-6 w-16 animate-pulse rounded-full bg-muted" />
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : devices.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-20 text-muted-foreground">
              <Server className="mb-3 h-10 w-10 opacity-30" />
              <p className="font-medium">No devices found</p>
              <p className="mt-1 text-sm">Sync from ONOS to populate the device list</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {devices.map(device => {
                const StatusIcon = STATUS_ICON[device.status];
                const isSelected = selected?.id === device.id;
                return (
                  <div
                    key={device.id}
                    onClick={() => setSelected(isSelected ? null : device)}
                    className={cn(
                      'cursor-pointer rounded-xl border bg-card p-5 transition-all hover:shadow-md',
                      isSelected
                        ? 'border-primary/50 ring-1 ring-primary/30'
                        : 'border-border hover:border-border/80'
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className={cn(
                        'rounded-xl p-3',
                        device.status === 'active' ? 'bg-primary/10' : 'bg-muted'
                      )}>
                        <Server className={cn(
                          'h-5 w-5',
                          device.status === 'active' ? 'text-primary' : 'text-muted-foreground'
                        )} />
                      </div>
                      <Badge variant={STATUS_BADGE[device.status]}>
                        <StatusIcon className="mr-1 h-3 w-3" />
                        {device.status}
                      </Badge>
                    </div>

                    <div className="mt-4">
                      <p className="font-semibold text-foreground">{device.name}</p>
                      <p className="mt-0.5 font-mono text-xs text-muted-foreground truncate">{device.onos_id}</p>
                    </div>

                    <div className="mt-3 space-y-1.5">
                      {device.manufacturer && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Cpu className="h-3 w-3 shrink-0" />
                          {device.manufacturer}
                        </div>
                      )}
                      {device.sw_version && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <HardDrive className="h-3 w-3 shrink-0" />
                          v{device.sw_version}
                        </div>
                      )}
                      {device.location && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {device.location}
                        </div>
                      )}
                    </div>

                    <div className="mt-3 border-t border-border pt-3">
                      <p className="text-[10px] text-muted-foreground">
                        Updated {formatDate(device.updated_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selected && (
          <div className="w-72 shrink-0">
            <div className="sticky top-6 rounded-xl border border-border bg-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Device Detail</h3>
                <button
                  onClick={() => setSelected(null)}
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4 text-sm">
                {[
                  { label: 'Name',         value: selected.name },
                  { label: 'ONOS ID',      value: selected.onos_id,     mono: true, color: 'text-primary' },
                  { label: 'Type',         value: selected.type },
                  { label: 'IP Address',   value: selected.ip_address,  mono: true },
                  { label: 'Manufacturer', value: selected.manufacturer },
                  { label: 'SW Version',   value: selected.sw_version },
                  { label: 'Location',     value: selected.location },
                ].map(({ label, value, mono, color }) => (
                  <div key={label}>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className={cn(
                      'mt-0.5 break-all text-foreground',
                      mono && 'font-mono text-xs',
                      color
                    )}>
                      {value || '—'}
                    </p>
                  </div>
                ))}

                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <div className="mt-1">
                    <Badge variant={STATUS_BADGE[selected.status]}>
                      {selected.status}
                    </Badge>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Last Updated</p>
                  <p className="mt-0.5 text-xs text-foreground">{formatDate(selected.updated_at)}</p>
                </div>
              </div>

              {/* Ports section */}
              {selected.onos_id && (
                <div className="mt-5 border-t border-border pt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Zap className="h-3 w-3 text-primary" />
                      Ports ({ports.length})
                    </p>
                    <button
                      onClick={() => selected.onos_id && loadPorts(selected.onos_id)}
                      disabled={loadingPorts}
                      className="text-muted-foreground hover:text-foreground"
                      title="Refresh ports"
                    >
                      <RefreshCw className={cn('h-3 w-3', loadingPorts && 'animate-spin')} />
                    </button>
                  </div>

                  {portError && (
                    <p className="mb-2 text-[10px] text-red-400">{portError}</p>
                  )}

                  {loadingPorts ? (
                    <p className="py-4 text-center text-[11px] text-muted-foreground">Loading ports…</p>
                  ) : ports.length === 0 ? (
                    <p className="py-4 text-center text-[11px] text-muted-foreground">No ports</p>
                  ) : (
                    <div className="max-h-80 space-y-1 overflow-auto pr-1">
                      {ports.map(p => (
                        <div
                          key={p.port}
                          className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background/40 px-2 py-1.5"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-mono text-foreground">
                              :{p.port}
                              {p.name && <span className="ml-1 text-[10px] text-muted-foreground">{p.name}</span>}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {p.type ?? 'unknown'}{fmtSpeed(p.portSpeed) && ` · ${fmtSpeed(p.portSpeed)}`}
                            </p>
                          </div>
                          {canManagePorts ? (
                            <button
                              onClick={() => togglePortState(p)}
                              disabled={portAction === p.port}
                              title={p.isEnabled ? 'Disable port' : 'Enable port'}
                              className={cn(
                                'flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors disabled:opacity-50',
                                p.isEnabled
                                  ? 'bg-emerald-500/10 text-emerald-400 hover:bg-red-500/10 hover:text-red-400'
                                  : 'bg-muted text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-400'
                              )}
                            >
                              {portAction === p.port ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : p.isEnabled ? (
                                <ToggleRight className="h-3 w-3" />
                              ) : (
                                <ToggleLeft className="h-3 w-3" />
                              )}
                              {p.isEnabled ? 'UP' : 'DOWN'}
                            </button>
                          ) : (
                            <Badge variant={p.isEnabled ? 'success' : 'default'}>
                              {p.isEnabled ? 'UP' : 'DOWN'}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {canSync && (
                <div className="mt-5 border-t border-border pt-4">
                  <button
                    onClick={syncFromOnos}
                    disabled={syncing}
                    className="w-full rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                  >
                    {syncing ? 'Syncing…' : 'Sync from ONOS'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
