'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { XtermPane } from '@/components/XtermPane';
import {
  Terminal as TerminalIcon, Server, Network, Plus, X,
} from 'lucide-react';

type TabType = 'ubuntu' | 'onos';
type Status = 'connecting' | 'open' | 'closed' | 'error';

interface Tab {
  key: string;
  type: TabType;
  title: string;
  wsUrl: string;
  status: Status;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function wsBase(): string {
  const u = new URL(API_URL);
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  return u.toString().replace(/\/$/, '');
}

function makeWsUrl(path: string, token: string, extra?: Record<string, string>): string {
  const params = new URLSearchParams({ token, ...(extra || {}) });
  return `${wsBase()}${path}?${params.toString()}`;
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('access_token');
}

export default function CLIPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeKey, setActiveKey] = useState<string>('');
  const [tokenReady, setTokenReady] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
    if (user) setTokenReady(true);
  }, [user, isLoading, router]);

  // Open Ubuntu + ONOS tabs by default
  useEffect(() => {
    if (!tokenReady || tabs.length > 0) return;
    const token = getToken();
    if (!token) return;

    const initial: Tab[] = [
      { key: 'ubuntu', type: 'ubuntu', title: 'Ubuntu VM', status: 'connecting',
        wsUrl: makeWsUrl('/cli/ws/ubuntu', token) },
      { key: 'onos', type: 'onos', title: 'ONOS Karaf', status: 'connecting',
        wsUrl: makeWsUrl('/cli/ws/onos', token) },
    ];
    setTabs(initial);
    setActiveKey(initial[0].key);
  }, [tokenReady, tabs.length]);

  const openAdditional = (type: 'ubuntu' | 'onos') => {
    const token = getToken();
    if (!token) return;
    const key = `${type}-${Date.now()}`;
    const tab: Tab = {
      key, type, status: 'connecting',
      title: type === 'ubuntu' ? `Ubuntu #${tabs.filter(t => t.type === 'ubuntu').length + 1}` : `ONOS #${tabs.filter(t => t.type === 'onos').length + 1}`,
      wsUrl: makeWsUrl(`/cli/ws/${type}`, token),
    };
    setTabs(t => [...t, tab]);
    setActiveKey(key);
  };

  const closeTab = (key: string) => {
    setTabs(prev => {
      const next = prev.filter(t => t.key !== key);
      if (activeKey === key && next.length > 0) setActiveKey(next[0].key);
      return next;
    });
  };

  const setTabStatus = useCallback((key: string, status: Status) => {
    setTabs(prev => prev.map(t => t.key === key ? { ...t, status } : t));
  }, []);

  if (isLoading || !user) return null;
  const canUse = ['admin', 'manager'].includes(user.role);

  if (!canUse) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <TerminalIcon className="mx-auto mb-4 h-12 w-12 text-slate-700" />
          <p className="text-muted-foreground">CLI access requires Admin or Manager role</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-3">
          <TerminalIcon className="h-5 w-5 text-green-400" />
          <h1 className="font-bold text-foreground">Multi-Terminal Console</h1>
          <span className="text-xs text-muted-foreground">
            {tabs.length} session{tabs.length !== 1 ? 's' : ''} · Ubuntu / ONOS Karaf
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => openAdditional('ubuntu')}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-muted px-2.5 py-1.5 text-xs hover:bg-muted/80"
          >
            <Server className="h-3.5 w-3.5 text-green-400" />
            <span>Ubuntu</span>
            <Plus className="h-3 w-3" />
          </button>
          <button
            onClick={() => openAdditional('onos')}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-muted px-2.5 py-1.5 text-xs hover:bg-muted/80"
          >
            <Network className="h-3.5 w-3.5 text-cyan-400" />
            <span>ONOS</span>
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Tabs bar */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-border bg-card/30 px-3 py-1.5">
        {tabs.length === 0 && (
          <span className="px-3 py-1 text-xs text-muted-foreground">
            No active sessions. Use the buttons above to open one.
          </span>
        )}
        {tabs.map(tab => (
          <TabButton
            key={tab.key}
            tab={tab}
            active={activeKey === tab.key}
            onClick={() => setActiveKey(tab.key)}
            onClose={() => closeTab(tab.key)}
          />
        ))}
      </div>

      {/* Panes: keep all mounted, just show the active one (preserves connections) */}
      <div className="relative flex-1 overflow-hidden bg-[#0b1120]">
        {tabs.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Open a terminal session to get started.
          </div>
        ) : (
          tabs.map(tab => (
            <div
              key={tab.key}
              className={`absolute inset-0 p-3 transition-opacity ${
                activeKey === tab.key ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
            >
              <XtermPane
                wsUrl={tab.wsUrl}
                active={activeKey === tab.key}
                onStatusChange={(s) => setTabStatus(tab.key, s)}
              />
            </div>
          ))
        )}
      </div>

      {/* Footer tip */}
      <div className="border-t border-border bg-card/50 px-6 py-1.5 text-[10px] text-muted-foreground">
        Tip: Ctrl+C / Ctrl+D work as expected · xterm-256color · full PTY (vim, top, nano supported)
      </div>
    </div>
  );
}

function TabButton({ tab, active, onClick, onClose }: {
  tab: Tab; active: boolean; onClick: () => void; onClose: () => void;
}) {
  const statusColor: Record<Status, string> = {
    connecting: 'text-amber-400', open: 'text-green-400',
    closed: 'text-slate-500', error: 'text-red-400',
  };
  const icon = tab.type === 'ubuntu'
    ? <Server className="h-3.5 w-3.5 text-green-400" />
    : <Network className="h-3.5 w-3.5 text-cyan-400" />;

  return (
    <div
      onClick={onClick}
      className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-t-lg border-b-2 px-3 py-1.5 text-xs transition-colors ${
        active
          ? 'border-primary bg-background text-foreground'
          : 'border-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground'
      }`}
    >
      {icon}
      <span className="font-medium">{tab.title}</span>
      <span className={`text-[8px] ${statusColor[tab.status]}`}>●</span>
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="ml-1 rounded p-0.5 text-muted-foreground hover:bg-red-500/20 hover:text-red-400"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
