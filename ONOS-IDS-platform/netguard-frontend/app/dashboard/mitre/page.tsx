'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { apiClient } from '@/lib/api';
import { Shield, RefreshCw, Target, Activity, Clock } from 'lucide-react';

interface Technique {
  id: string;
  name: string;
  full: string;
  hits: number;
  detected: boolean;
}

interface TacticData {
  tactic: string;
  techniques: Technique[];
  total_hits: number;
}

interface MatrixData {
  matrix: TacticData[];
  period_days: number;
  total_detected_techniques: number;
  total_tactics_active: number;
}

interface TimelineEvent {
  id: string;
  title: string;
  severity: string;
  tactic: string;
  technique: string;
  source_ip?: string;
  timestamp: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-500',
  info: 'bg-slate-500',
};

function getHeatColor(hits: number, max: number): string {
  if (hits === 0) return 'bg-muted/50 border-border/50 text-muted-foreground';
  const intensity = hits / Math.max(max, 1);
  if (intensity >= 0.75) return 'bg-red-500/80 border-red-400 text-foreground font-bold';
  if (intensity >= 0.5) return 'bg-orange-500/70 border-orange-400 text-foreground';
  if (intensity >= 0.25) return 'bg-yellow-500/60 border-yellow-400 text-foreground';
  return 'bg-green-500/40 border-green-400 text-foreground';
}

export default function MITREPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [matrix, setMatrix] = useState<MatrixData | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [activeTab, setActiveTab] = useState<'matrix' | 'timeline'>('matrix');
  const [tooltip, setTooltip] = useState<{ tech: Technique; tactic: string } | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [user, isLoading, router]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [matRes, tlRes] = await Promise.all([
        apiClient(`/mitre/matrix?days=${days}`),
        apiClient(`/mitre/timeline?days=${days}`),
      ]);
      if (matRes.ok) setMatrix(await matRes.json());
      if (tlRes.ok) {
        const data = await tlRes.json();
        setTimeline(data.timeline || []);
      }
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    if (user) fetchAll();
  }, [user, fetchAll]);

  const maxHits = matrix
    ? Math.max(...matrix.matrix.flatMap(t => t.techniques.map(tech => tech.hits)), 1)
    : 1;

  const formatDate = (d: string) =>
    new Date(d).toLocaleString('en-GB', {
      day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit',
    });

  if (isLoading || !user) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">MITRE ATT&CK Navigator</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Detected techniques mapped to the ATT&CK framework
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            className="rounded-xl border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:border-cyan-500"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
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
      {matrix && (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-xl border border-border bg-card/60 p-4">
            <p className="text-xs text-muted-foreground">Active Tactics</p>
            <p className="mt-1 text-3xl font-bold text-foreground">{matrix.total_tactics_active}</p>
            <p className="text-xs text-muted-foreground">of {matrix.matrix.length} total</p>
          </div>
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
            <p className="text-xs text-red-400">Detected Techniques</p>
            <p className="mt-1 text-3xl font-bold text-foreground">{matrix.total_detected_techniques}</p>
          </div>
          <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-4">
            <p className="text-xs text-orange-400">Timeline Events</p>
            <p className="mt-1 text-3xl font-bold text-foreground">{timeline.length}</p>
          </div>
          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
            <p className="text-xs text-primary">Period</p>
            <p className="mt-1 text-3xl font-bold text-foreground">{days}d</p>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mb-4 flex items-center gap-4">
        <span className="text-xs text-muted-foreground">Intensity:</span>
        <div className="flex items-center gap-2">
          <span className="h-4 w-8 rounded bg-muted/50 border border-border/50" />
          <span className="text-xs text-muted-foreground">Not detected</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-4 w-8 rounded bg-green-500/40 border border-green-400" />
          <span className="text-xs text-muted-foreground">Low</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-4 w-8 rounded bg-yellow-500/60 border border-yellow-400" />
          <span className="text-xs text-muted-foreground">Medium</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-4 w-8 rounded bg-orange-500/70 border border-orange-400" />
          <span className="text-xs text-muted-foreground">High</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-4 w-8 rounded bg-red-500/80 border border-red-400" />
          <span className="text-xs text-muted-foreground">Critical</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setActiveTab('matrix')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm transition-colors ${
            activeTab === 'matrix'
              ? 'bg-primary text-foreground'
              : 'bg-muted text-muted-foreground hover:text-foreground'
          }`}
        >
          <Target className="h-4 w-4" />
          ATT&CK Matrix
        </button>
        <button
          onClick={() => setActiveTab('timeline')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm transition-colors ${
            activeTab === 'timeline'
              ? 'bg-primary text-foreground'
              : 'bg-muted text-muted-foreground hover:text-foreground'
          }`}
        >
          <Clock className="h-4 w-4" />
          Attack Timeline
          {timeline.length > 0 && (
            <span className="rounded-full bg-red-500/20 px-1.5 py-0.5 text-xs text-red-400">
              {timeline.length}
            </span>
          )}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : activeTab === 'matrix' ? (
        /* ── ATT&CK Matrix ── */
        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            {/* Tactic headers */}
            <div
              className="grid gap-1 mb-1"
              style={{ gridTemplateColumns: `repeat(${matrix?.matrix.length || 14}, minmax(0, 1fr))` }}
            >
              {matrix?.matrix.map(tactic => (
                <div
                  key={tactic.tactic}
                  className={`rounded-t-lg px-1 py-2 text-center text-[10px] font-bold ${
                    tactic.total_hits > 0
                      ? 'bg-red-900/50 text-red-300 border border-red-700/50'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <div className="truncate">{tactic.tactic}</div>
                  {tactic.total_hits > 0 && (
                    <div className="text-[9px] text-red-400 mt-0.5">{tactic.total_hits} hits</div>
                  )}
                </div>
              ))}
            </div>

            {/* Techniques grid */}
            <div
              className="grid gap-1"
              style={{ gridTemplateColumns: `repeat(${matrix?.matrix.length || 14}, minmax(0, 1fr))` }}
            >
              {matrix?.matrix.map(tactic => (
                <div key={tactic.tactic} className="flex flex-col gap-1">
                  {tactic.techniques.map(tech => (
                    <div
                      key={tech.id}
                      className={`relative rounded border px-1 py-1.5 text-center text-[9px] cursor-pointer transition-all hover:scale-105 hover:z-10 ${getHeatColor(tech.hits, maxHits)}`}
                      onMouseEnter={() => setTooltip({ tech, tactic: tactic.tactic })}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      <div className="font-mono font-bold">{tech.id}</div>
                      <div className="truncate mt-0.5 leading-tight">{tech.name}</div>
                      {tech.hits > 0 && (
                        <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 text-[8px] flex items-center justify-center text-foreground font-bold">
                          {tech.hits}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Tooltip */}
          {tooltip && (
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 rounded-xl border border-border bg-card p-3 shadow-xl min-w-[200px]">
              <p className="text-xs text-muted-foreground">{tooltip.tactic}</p>
              <p className="font-bold text-foreground">{tooltip.tech.full}</p>
              {tooltip.tech.hits > 0 ? (
                <p className="mt-1 text-xs text-red-400">⚠ {tooltip.tech.hits} detection(s)</p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">Not detected</p>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ── Timeline ── */
        <div className="space-y-3">
          {timeline.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Activity className="mb-3 h-12 w-12" />
              <p>No attack timeline data</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-muted" />
              {timeline.map((event, i) => (
                <div key={event.id} className="relative flex gap-4 pb-4">
                  <div className={`relative z-10 mt-1.5 h-3 w-3 shrink-0 rounded-full border-2 border-border ${SEVERITY_COLORS[event.severity] || 'bg-slate-500'}`} />
                  <div className="flex-1 rounded-xl border border-border bg-card/60 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="rounded-lg bg-purple-500/20 px-2 py-0.5 text-xs text-purple-400">
                            {event.tactic}
                          </span>
                          <span className={`rounded-lg px-2 py-0.5 text-xs text-foreground ${SEVERITY_COLORS[event.severity] || 'bg-slate-500'}`}>
                            {event.severity}
                          </span>
                        </div>
                        <p className="mt-1.5 font-medium text-foreground text-sm">{event.title}</p>
                        <p className="text-xs text-primary font-mono mt-0.5">{event.technique}</p>
                        {event.source_ip && (
                          <p className="text-xs text-muted-foreground mt-1">src: {event.source_ip}</p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 ml-3">
                        {formatDate(event.timestamp)}
                      </span>
                    </div>
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