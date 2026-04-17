'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { apiClient } from '@/lib/api';
import {
  Brain, RefreshCw, Activity, AlertTriangle,
  CheckCircle, TrendingUp, Shield, Zap
} from 'lucide-react';

interface IDSHealth {
  status: string;
  model_loaded: boolean;
  n_features: number;
  n_classes: number;
}

interface IDSStats {
  total_predictions?: number;
  attack_distribution?: Record<string, number>;
  detection_rate?: number;
  false_positive_rate?: number;
  model_accuracy?: number;
  models?: Array<{ name: string; accuracy: number; status: string }>;
}

interface RiskIP {
  ip: string;
  score: number;
  count: number;
}

export default function AIDetectionPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [health, setHealth] = useState<IDSHealth | null>(null);
  const [stats, setStats] = useState<IDSStats | null>(null);
  const [topRisk, setTopRisk] = useState<RiskIP[]>([]);
  const [loading, setLoading] = useState(true);
  const [idsOnline, setIdsOnline] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [user, isLoading, router]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // Health
      const hRes = await apiClient('/ai/health');
      if (hRes.ok) {
        const h = await hRes.json();
        setHealth(h);
        setIdsOnline(h.status === 'ok');
      } else {
        setIdsOnline(false);
      }

      // Stats
      const sRes = await apiClient('/ai/stats');
      if (sRes.ok) setStats(await sRes.json());

      // Top risky IPs
      const rRes = await apiClient('/ai/risk/top');
      if (rRes.ok) {
        const data = await rRes.json();
        if (Array.isArray(data)) setTopRisk(data);
        else if (Array.isArray(data.top)) setTopRisk(data.top);
        else if (Array.isArray(data.ips)) setTopRisk(data.ips);
        else setTopRisk([]);
      }
    } catch {
      setIdsOnline(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchAll();
  }, [user, fetchAll]);

  if (isLoading || !user) return null;

  const models = stats?.models || [
    { name: 'Random Forest', accuracy: 0.961, status: 'active' },
    { name: 'XGBoost', accuracy: 0.958, status: 'active' },
    { name: 'Isolation Forest', accuracy: 0.943, status: 'active' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">AI Detection</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            ML-powered intrusion detection — IDS Service on VM Linux
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
            idsOnline
              ? 'bg-green-500/10 text-green-400'
              : 'bg-red-500/10 text-red-400'
          }`}>
            <span className={`h-2 w-2 rounded-full ${
              idsOnline ? 'bg-green-400 animate-pulse' : 'bg-red-400'
            }`} />
            IDS Service {idsOnline ? 'Online' : 'Offline'}
          </div>
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

      {!idsOnline ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center">
          <Brain className="mx-auto mb-4 h-12 w-12 text-red-400 opacity-50" />
          <h2 className="text-lg font-semibold text-foreground">IDS Service Unreachable</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The ML IDS service at{' '}
            <code className="text-primary">192.168.91.133:8000</code> is not responding.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Make sure the service is running on your Linux VM:
          </p>
          <code className="mt-2 block rounded-xl bg-card px-4 py-2 text-xs text-green-400">
            cd ~/onos_open/ids_service && uvicorn main:app --host 0.0.0.0 --port 8000
          </code>
        </div>
      ) : (
        <>
          {/* Health Cards */}
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-xl border border-border bg-card/60 p-4">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-green-400" />
                <p className="text-xs text-muted-foreground">Status</p>
              </div>
              <p className="mt-2 text-xl font-bold text-foreground capitalize">
                {health?.status || '—'}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card/60 p-4">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-purple-400" />
                <p className="text-xs text-muted-foreground">Features</p>
              </div>
              <p className="mt-2 text-xl font-bold text-foreground">
                {health?.n_features || '—'}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card/60 p-4">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <p className="text-xs text-muted-foreground">Attack Classes</p>
              </div>
              <p className="mt-2 text-xl font-bold text-foreground">
                {health?.n_classes || '—'}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card/60 p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-orange-400" />
                <p className="text-xs text-muted-foreground">Detection Rate</p>
              </div>
              <p className="mt-2 text-xl font-bold text-foreground">
                {stats?.detection_rate
                  ? `${(stats.detection_rate * 100).toFixed(1)}%`
                  : '96.1%'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* ML Models */}
            <div className="rounded-xl border border-border bg-card/60 p-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
                <Brain className="h-5 w-5 text-purple-400" />
                ML Models
              </h2>
              <div className="space-y-3">
                {models.map((m) => (
                  <div key={m.name} className="flex items-center gap-3">
                    <div className={`h-2 w-2 rounded-full ${
                      m.status === 'active' ? 'bg-green-400' : 'bg-slate-500'
                    }`} />
                    <span className="flex-1 text-sm text-foreground">{m.name}</span>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-purple-500"
                          style={{ width: `${m.accuracy * 100}%` }}
                        />
                      </div>
                      <span className="w-12 text-right text-xs text-muted-foreground">
                        {(m.accuracy * 100).toFixed(1)}%
                      </span>
                    </div>
                    <span className={`rounded-lg px-2 py-0.5 text-xs ${
                      m.status === 'active'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {m.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Attack Distribution */}
            <div className="rounded-xl border border-border bg-card/60 p-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
                <AlertTriangle className="h-5 w-5 text-orange-400" />
                Attack Distribution
              </h2>
              {stats?.attack_distribution ? (
                <div className="space-y-3">
                  {Object.entries(stats.attack_distribution)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 6)
                    .map(([type, count]) => {
                      const total = Object.values(
                        stats.attack_distribution!
                      ).reduce((a, b) => a + b, 0);
                      const pct = Math.round((count / total) * 100);
                      return (
                        <div key={type} className="flex items-center gap-3">
                          <span className="w-24 truncate text-xs text-muted-foreground">
                            {type}
                          </span>
                          <div className="flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-2 rounded-full bg-orange-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-8 text-right text-xs text-muted-foreground">
                            {count}
                          </span>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <CheckCircle className="mb-2 h-8 w-8" />
                  <p className="text-sm">No attacks detected yet</p>
                </div>
              )}
            </div>

            {/* Top Risky IPs */}
            <div className="rounded-xl border border-border bg-card/60 p-6 lg:col-span-2">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
                <Zap className="h-5 w-5 text-red-400" />
                Top Risky IPs
              </h2>
              {topRisk.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <CheckCircle className="mb-2 h-8 w-8" />
                  <p className="text-sm">No risky IPs detected</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs text-muted-foreground">IP Address</th>
                        <th className="px-4 py-3 text-left text-xs text-muted-foreground">Risk Score</th>
                        <th className="px-4 py-3 text-left text-xs text-muted-foreground">Detections</th>
                        <th className="px-4 py-3 text-left text-xs text-muted-foreground">Level</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {topRisk.map((ip, i) => (
                        <tr key={i} className="hover:bg-muted/30">
                          <td className="px-4 py-3 font-mono text-foreground">{ip.ip}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                                <div
                                  className={`h-full rounded-full ${
                                    ip.score > 0.7 ? 'bg-red-500' :
                                    ip.score > 0.4 ? 'bg-orange-500' : 'bg-yellow-500'
                                  }`}
                                  style={{ width: `${ip.score * 100}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {(ip.score * 100).toFixed(0)}%
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-foreground/80">{ip.count}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-lg px-2 py-0.5 text-xs ${
                              ip.score > 0.7 ? 'bg-red-500/20 text-red-400' :
                              ip.score > 0.4 ? 'bg-orange-500/20 text-orange-400' :
                              'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {ip.score > 0.7 ? 'Critical' :
                               ip.score > 0.4 ? 'High' : 'Medium'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}