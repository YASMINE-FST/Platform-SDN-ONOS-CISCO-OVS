'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Boxes,
  Cable,
  Copy,
  GitMerge,
  Layers,
  Plus,
  RefreshCw,
  Rows,
  ScrollText,
  Split,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { apiClient } from '@/lib/api';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type TabKey = 'bridges' | 'ports' | 'mirrors' | 'flows' | 'history';

interface BridgePort {
  name: string;
  vlan_tag: string | null;
  type: string | null;
}

interface Bridge {
  name: string;
  ports: string[];
  controller: string | null;
  datapath_id: string | null;
}

interface BridgeDetail {
  name: string;
  ports: BridgePort[];
  controller: string | null;
  datapath_id: string | null;
  fail_mode: string | null;
  protocols: string | null;
}

interface HistoryEntry {
  id: string;
  bridge: string;
  action: string;
  data: Record<string, unknown>;
  applied_by: string | null;
  applied_at: string | null;
  notes: string | null;
}

export default function OVSConfigPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const canEdit = user?.role === 'admin' || user?.role === 'manager';

  const [tab, setTab] = useState<TabKey>('bridges');
  const [bridges, setBridges] = useState<Bridge[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<BridgeDetail | null>(null);
  const [flows, setFlows] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // forms
  const [brName, setBrName] = useState('');
  const [brCtrl, setBrCtrl] = useState('tcp:127.0.0.1:6653');
  const [brDpid, setBrDpid] = useState('');
  const [brProto, setBrProto] = useState('OpenFlow13');

  const [portName, setPortName] = useState('');
  const [portType, setPortType] = useState<'' | 'internal' | 'vxlan' | 'gre' | 'patch'>('');
  const [portVlan, setPortVlan] = useState<string>('');
  const [portRemote, setPortRemote] = useState('');
  const [portPeer, setPortPeer] = useState('');

  const [mirrorName, setMirrorName] = useState('');
  const [mirrorSrc, setMirrorSrc] = useState('');
  const [mirrorDst, setMirrorDst] = useState('');

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [user, isLoading, router]);

  const showBanner = (kind: 'ok' | 'err', text: string) => {
    setBanner({ kind, text });
    setTimeout(() => setBanner(null), 3500);
  };

  const loadBridges = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient('/ovs/bridges');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setBridges(data.bridges || []);
      if (!selected && data.bridges?.length) setSelected(data.bridges[0].name);
    } catch (e) {
      showBanner('err', `Load bridges failed: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [selected]);

  const loadDetail = useCallback(async (br: string) => {
    try {
      const res = await apiClient(`/ovs/bridges/${encodeURIComponent(br)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDetail(await res.json());
    } catch (e) {
      showBanner('err', `Load detail failed: ${(e as Error).message}`);
      setDetail(null);
    }
  }, []);

  const loadFlows = useCallback(async (br: string) => {
    try {
      const res = await apiClient(`/ovs/bridges/${encodeURIComponent(br)}/flows`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setFlows(data.flows || []);
    } catch (e) {
      showBanner('err', `Load flows failed: ${(e as Error).message}`);
      setFlows([]);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const res = await apiClient('/ovs/history');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setHistory(data.history || []);
    } catch (e) {
      showBanner('err', `Load history failed: ${(e as Error).message}`);
    }
  }, []);

  useEffect(() => {
    if (user) loadBridges();
  }, [user, loadBridges]);

  useEffect(() => {
    if (selected) {
      loadDetail(selected);
      if (tab === 'flows') loadFlows(selected);
    }
  }, [selected, tab, loadDetail, loadFlows]);

  useEffect(() => {
    if (tab === 'history') loadHistory();
  }, [tab, loadHistory]);

  // ── actions ──────────────────────────────────────────────────────────
  const createBridge = async () => {
    if (!brName) return showBanner('err', 'Bridge name required');
    const res = await apiClient('/ovs/bridges', {
      method: 'POST',
      body: JSON.stringify({
        name: brName,
        controller: brCtrl || null,
        datapath_id: brDpid || null,
        protocols: brProto || null,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return showBanner('err', err.detail || `HTTP ${res.status}`);
    }
    showBanner('ok', `Bridge ${brName} created`);
    setBrName('');
    setBrDpid('');
    setSelected(brName);
    loadBridges();
  };

  const deleteBridge = async (br: string) => {
    if (!confirm(`Delete bridge ${br}? All ports/flows will be removed.`)) return;
    const res = await apiClient(`/ovs/bridges/${encodeURIComponent(br)}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return showBanner('err', err.detail || `HTTP ${res.status}`);
    }
    showBanner('ok', `Bridge ${br} deleted`);
    if (selected === br) setSelected(null);
    loadBridges();
  };

  const addPort = async () => {
    if (!selected || !portName) return showBanner('err', 'Select bridge and name');
    const res = await apiClient(`/ovs/bridges/${encodeURIComponent(selected)}/ports`, {
      method: 'POST',
      body: JSON.stringify({
        name: portName,
        type: portType || null,
        vlan_tag: portVlan ? Number(portVlan) : null,
        remote_ip: portRemote || null,
        peer: portPeer || null,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return showBanner('err', err.detail || `HTTP ${res.status}`);
    }
    showBanner('ok', `Port ${portName} added`);
    setPortName('');
    setPortVlan('');
    setPortRemote('');
    setPortPeer('');
    loadDetail(selected);
  };

  const removePort = async (port: string) => {
    if (!selected) return;
    if (!confirm(`Remove port ${port} from ${selected}?`)) return;
    const res = await apiClient(
      `/ovs/bridges/${encodeURIComponent(selected)}/ports/${encodeURIComponent(port)}`,
      { method: 'DELETE' }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return showBanner('err', err.detail || `HTTP ${res.status}`);
    }
    showBanner('ok', `Port ${port} removed`);
    loadDetail(selected);
  };

  const setVlan = async (port: string, vlan: number | null) => {
    if (!selected) return;
    const res = await apiClient(
      `/ovs/bridges/${encodeURIComponent(selected)}/ports/${encodeURIComponent(port)}/vlan`,
      { method: 'POST', body: JSON.stringify({ vlan_tag: vlan }) }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return showBanner('err', err.detail || `HTTP ${res.status}`);
    }
    showBanner('ok', vlan == null ? `VLAN cleared on ${port}` : `VLAN ${vlan} on ${port}`);
    loadDetail(selected);
  };

  const addMirror = async () => {
    if (!selected || !mirrorName || !mirrorSrc || !mirrorDst) {
      return showBanner('err', 'All mirror fields required');
    }
    const res = await apiClient(`/ovs/bridges/${encodeURIComponent(selected)}/mirror`, {
      method: 'POST',
      body: JSON.stringify({
        name: mirrorName,
        select_src_port: mirrorSrc,
        output_port: mirrorDst,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return showBanner('err', err.detail || `HTTP ${res.status}`);
    }
    showBanner('ok', `Mirror ${mirrorName} created`);
    setMirrorName('');
    setMirrorSrc('');
    setMirrorDst('');
  };

  const deleteMirror = async (mir: string) => {
    if (!selected) return;
    if (!confirm(`Delete mirror ${mir}?`)) return;
    const res = await apiClient(
      `/ovs/bridges/${encodeURIComponent(selected)}/mirror/${encodeURIComponent(mir)}`,
      { method: 'DELETE' }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return showBanner('err', err.detail || `HTTP ${res.status}`);
    }
    showBanner('ok', `Mirror ${mir} deleted`);
  };

  const attachController = async (controller: string) => {
    if (!selected) return;
    const res = await apiClient(
      `/ovs/bridges/${encodeURIComponent(selected)}/controller`,
      { method: 'POST', body: JSON.stringify({ controller }) }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return showBanner('err', err.detail || `HTTP ${res.status}`);
    }
    showBanner('ok', `Controller ${controller} attached to ${selected}`);
    loadDetail(selected);
    loadBridges();
  };

  const tabs: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'bridges', label: 'Bridges', icon: Boxes },
    { key: 'ports', label: 'Ports & VLAN', icon: Rows },
    { key: 'mirrors', label: 'Port Mirror', icon: Split },
    { key: 'flows', label: 'OpenFlow Dump', icon: Cable },
    { key: 'history', label: 'History', icon: ScrollText },
  ];

  const currentPorts = useMemo(() => detail?.ports || [], [detail]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="OVS Configuration"
        description="Gérez les bridges, ports, VLAN et mirrors Open vSwitch — persisté en base."
        actions={
          <Button variant="outline" size="sm" onClick={loadBridges} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      {banner && (
        <div
          className={`rounded-md border px-4 py-2 text-sm ${
            banner.kind === 'ok'
              ? 'border-green-500/40 bg-green-500/10 text-green-400'
              : 'border-red-500/40 bg-red-500/10 text-red-400'
          }`}
        >
          {banner.text}
        </div>
      )}

      {/* tabs */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition ${
              tab === key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* bridge picker (shared across tabs that need one) */}
      {tab !== 'history' && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Bridge:</span>
          {bridges.length === 0 && (
            <span className="text-sm italic text-muted-foreground">(aucun bridge)</span>
          )}
          {bridges.map((b) => (
            <button
              key={b.name}
              onClick={() => setSelected(b.name)}
              className={`rounded-md border px-3 py-1 text-sm ${
                selected === b.name
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:bg-muted'
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}

      {tab === 'bridges' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Layers className="h-4 w-4" /> Bridges ({bridges.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {bridges.map((b) => (
                <div
                  key={b.name}
                  className="flex items-start justify-between rounded-md border border-border p-3"
                >
                  <div>
                    <div className="font-medium">{b.name}</div>
                    <div className="text-xs text-muted-foreground">
                      ports: {b.ports.length || 0} · ctrl:{' '}
                      {b.controller || <span className="italic">none</span>}
                    </div>
                    {b.datapath_id && (
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-mono">dpid: {b.datapath_id}</span>
                        <button
                          onClick={() =>
                            navigator.clipboard.writeText(b.datapath_id || '')
                          }
                          title="copy"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteBridge(b.name)}
                      className="text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              {bridges.length === 0 && (
                <div className="text-sm italic text-muted-foreground">
                  Aucun bridge — crée-en un à droite.
                </div>
              )}
            </CardContent>
          </Card>

          {canEdit && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Plus className="h-4 w-4" /> Create bridge
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label htmlFor="br-name">Name</Label>
                  <Input
                    id="br-name"
                    value={brName}
                    onChange={(e) => setBrName(e.target.value)}
                    placeholder="br0"
                  />
                </div>
                <div>
                  <Label htmlFor="br-ctrl">Controller (OpenFlow)</Label>
                  <Input
                    id="br-ctrl"
                    value={brCtrl}
                    onChange={(e) => setBrCtrl(e.target.value)}
                    placeholder="tcp:127.0.0.1:6653"
                  />
                </div>
                <div>
                  <Label htmlFor="br-dpid">Datapath ID (16 hex, optional)</Label>
                  <Input
                    id="br-dpid"
                    value={brDpid}
                    onChange={(e) => setBrDpid(e.target.value)}
                    placeholder="0000000000000001"
                    maxLength={16}
                  />
                </div>
                <div>
                  <Label htmlFor="br-proto">Protocols</Label>
                  <Input
                    id="br-proto"
                    value={brProto}
                    onChange={(e) => setBrProto(e.target.value)}
                  />
                </div>
                <Button onClick={createBridge} className="w-full">
                  <Plus className="mr-2 h-4 w-4" /> Create
                </Button>
              </CardContent>
            </Card>
          )}

          {selected && detail && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <GitMerge className="h-4 w-4" />
                  {detail.name} — controller &amp; datapath
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  Controller:{' '}
                  <span className="font-mono">{detail.controller || '—'}</span>
                </div>
                <div>
                  Datapath ID:{' '}
                  <span className="font-mono">{detail.datapath_id || '—'}</span>
                </div>
                <div>
                  Fail-mode: <Badge variant="outline">{detail.fail_mode || '—'}</Badge>
                </div>
                <div>
                  Protocols: <Badge variant="outline">{detail.protocols || '—'}</Badge>
                </div>
                {canEdit && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => attachController('tcp:127.0.0.1:6653')}
                    >
                      Attach ONOS (localhost:6653)
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => attachController(`tcp:${window.location.hostname}:6653`)}
                    >
                      Attach ONOS (this host)
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {tab === 'ports' && selected && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Rows className="h-4 w-4" /> Ports on {selected}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {currentPorts.length === 0 && (
                <div className="text-sm italic text-muted-foreground">Aucun port.</div>
              )}
              {currentPorts.map((p) => (
                <div
                  key={p.name}
                  className="flex items-center justify-between rounded-md border border-border p-2"
                >
                  <div>
                    <div className="font-mono text-sm">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      type: {p.type || 'system'} · vlan: {p.vlan_tag || '—'}
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex gap-1">
                      <Input
                        type="number"
                        min={1}
                        max={4094}
                        defaultValue={p.vlan_tag ?? ''}
                        placeholder="VLAN"
                        className="h-8 w-20"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const v = (e.target as HTMLInputElement).value;
                            setVlan(p.name, v ? Number(v) : null);
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setVlan(p.name, null)}
                        title="clear vlan"
                      >
                        clear
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removePort(p.name)}
                        className="text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {canEdit && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Plus className="h-4 w-4" /> Add port to {selected}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label htmlFor="p-name">Port name</Label>
                  <Input
                    id="p-name"
                    value={portName}
                    onChange={(e) => setPortName(e.target.value)}
                    placeholder="eth1 / vxlan0 / patch0"
                  />
                </div>
                <div>
                  <Label htmlFor="p-type">Type</Label>
                  <select
                    id="p-type"
                    value={portType}
                    onChange={(e) =>
                      setPortType(e.target.value as typeof portType)
                    }
                    className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                  >
                    <option value="">system (physical)</option>
                    <option value="internal">internal</option>
                    <option value="vxlan">vxlan</option>
                    <option value="gre">gre</option>
                    <option value="patch">patch</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="p-vlan">VLAN tag (1-4094)</Label>
                  <Input
                    id="p-vlan"
                    type="number"
                    min={1}
                    max={4094}
                    value={portVlan}
                    onChange={(e) => setPortVlan(e.target.value)}
                  />
                </div>
                {(portType === 'vxlan' || portType === 'gre') && (
                  <div>
                    <Label htmlFor="p-remote">Remote IP</Label>
                    <Input
                      id="p-remote"
                      value={portRemote}
                      onChange={(e) => setPortRemote(e.target.value)}
                      placeholder="10.0.0.2"
                    />
                  </div>
                )}
                {portType === 'patch' && (
                  <div>
                    <Label htmlFor="p-peer">Patch peer</Label>
                    <Input
                      id="p-peer"
                      value={portPeer}
                      onChange={(e) => setPortPeer(e.target.value)}
                      placeholder="patch1"
                    />
                  </div>
                )}
                <Button onClick={addPort} className="w-full">
                  <Plus className="mr-2 h-4 w-4" /> Add port
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {tab === 'mirrors' && selected && canEdit && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Split className="h-4 w-4" /> Port Mirror (SPAN) on {selected}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="m-name">Mirror name</Label>
              <Input
                id="m-name"
                value={mirrorName}
                onChange={(e) => setMirrorName(e.target.value)}
                placeholder="mirror0"
              />
            </div>
            <div className="md:col-span-2 text-xs text-muted-foreground">
              Le trafic du <em>source</em> (entrée + sortie) est copié vers le <em>output</em>.
            </div>
            <div>
              <Label htmlFor="m-src">Source port</Label>
              <select
                id="m-src"
                value={mirrorSrc}
                onChange={(e) => setMirrorSrc(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
              >
                <option value="">— select —</option>
                {currentPorts.map((p) => (
                  <option key={p.name} value={p.name}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="m-dst">Output port</Label>
              <select
                id="m-dst"
                value={mirrorDst}
                onChange={(e) => setMirrorDst(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
              >
                <option value="">— select —</option>
                {currentPorts.map((p) => (
                  <option key={p.name} value={p.name}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 flex gap-2">
              <Button onClick={addMirror}>
                <Plus className="mr-2 h-4 w-4" /> Create mirror
              </Button>
              {mirrorName && (
                <Button variant="outline" onClick={() => deleteMirror(mirrorName)}>
                  <Trash2 className="mr-2 h-4 w-4" /> Delete "{mirrorName}"
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 'flows' && selected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <Cable className="h-4 w-4" /> OpenFlow dump — {selected}
              </span>
              <Button variant="outline" size="sm" onClick={() => loadFlows(selected)}>
                <RefreshCw className="mr-2 h-4 w-4" /> Refresh
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {flows.length === 0 ? (
              <div className="text-sm italic text-muted-foreground">Aucun flow.</div>
            ) : (
              <pre className="max-h-[60vh] overflow-auto rounded-md bg-muted/40 p-3 font-mono text-xs">
                {flows.join('\n')}
              </pre>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'history' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <ScrollText className="h-4 w-4" /> OVS change history
              </span>
              <Button variant="outline" size="sm" onClick={loadHistory}>
                <RefreshCw className="mr-2 h-4 w-4" /> Refresh
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <div className="text-sm italic text-muted-foreground">Aucune action enregistrée.</div>
            ) : (
              <div className="space-y-2">
                {history.map((h) => (
                  <div
                    key={h.id}
                    className="rounded-md border border-border p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="font-mono">{h.action}</Badge>
                      <span className="font-medium">{h.bridge}</span>
                      <span className="text-xs text-muted-foreground">
                        {h.applied_at ? new Date(h.applied_at).toLocaleString() : '—'}
                      </span>
                    </div>
                    <pre className="mt-2 overflow-auto rounded bg-muted/40 p-2 font-mono text-xs">
                      {JSON.stringify(h.data, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
