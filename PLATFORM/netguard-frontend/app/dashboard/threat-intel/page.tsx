'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { apiClient } from '@/lib/api';
import {
  Shield, RefreshCw, AlertTriangle, Globe,
  Search, CheckCircle, XCircle, Wifi, Eye,
  TrendingUp, Lock, Radio
} from 'lucide-react';

interface TIResult {
  ip: string;
  abuse_score: number;
  total_reports: number;
  country_code?: string;
  isp?: string;
  domain?: string;
  usage_type?: string;
  is_whitelisted: boolean;
  is_tor: boolean;
  is_vpn: boolean;
  is_malicious: boolean;
  categories: string[];
  last_reported?: string;
  sources: string[];
  cached?: boolean;
}

interface TIStats {
  total_ips_analyzed: number;
  malicious_ips: number;
  tor_nodes: number;
  high_risk_ips: number;
  top_countries: Array<{ country: string; count: number }>;
}

interface MaliciousIP {
  ip: string;
  abuse_score: number;
  country_code?: string;
  isp?: string;
  is_tor: boolean;
  categories: string[];
  enriched_at: string;
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 75 ? 'text-red-400 bg-red-500/20 border-red-500/30'
    : score >= 25 ? 'text-orange-400 bg-orange-500/20 border-orange-500/30'
    : score > 0 ? 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30'
    : 'text-green-400 bg-green-500/20 border-green-500/30';

  return (
    <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs font-bold ${color}`}>
      {score}%
    </span>
  );
}

export default function ThreatIntelPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<TIStats | null>(null);
  const [maliciousIPs, setMaliciousIPs] = useState<MaliciousIP[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchIP, setSearchIP] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<TIResult | null>(null);
  const [searchError, setSearchError] = useState('');

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [user, isLoading, router]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, malRes] = await Promise.all([
        apiClient('/ti/stats'),
        apiClient('/ti/malicious?limit=20'),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (malRes.ok) setMaliciousIPs(await malRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchAll();
  }, [user, fetchAll]);

  const searchTI = async () => {
    if (!searchIP.trim()) return;
    setSearching(true);
    setSearchResult(null);
    setSearchError('');
    try {
      const res = await apiClient(`/ti/ip/${searchIP.trim()}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResult(data);
        await fetchAll();
      } else {
        setSearchError('Failed to analyze IP');
      }
    } catch {
      setSearchError('Network error');
    } finally {
      setSearching(false);
    }
  };

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
          <h1 className="text-2xl font-bold text-foreground">Threat Intelligence</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AbuseIPDB · GreyNoise · Public Blocklists
          </p>
        </div>
        <button
          onClick={fetchAll}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm text-foreground/80 hover:bg-muted"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-xl border border-border bg-card/60 p-4">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              <p className="text-xs text-muted-foreground">IPs Analyzed</p>
            </div>
            <p className="mt-2 text-2xl font-bold text-foreground">{stats.total_ips_analyzed}</p>
          </div>
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-400" />
              <p className="text-xs text-red-400">Malicious</p>
            </div>
            <p className="mt-2 text-2xl font-bold text-foreground">{stats.malicious_ips}</p>
          </div>
          <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-4">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-purple-400" />
              <p className="text-xs text-purple-400">Tor Nodes</p>
            </div>
            <p className="mt-2 text-2xl font-bold text-foreground">{stats.tor_nodes}</p>
          </div>
          <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-orange-400" />
              <p className="text-xs text-orange-400">High Risk</p>
            </div>
            <p className="mt-2 text-2xl font-bold text-foreground">{stats.high_risk_ips}</p>
          </div>
        </div>
      )}

      {/* IP Search */}
      <div className="mb-6 rounded-xl border border-border bg-card/60 p-5">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
          <Search className="h-5 w-5 text-primary" />
          IP Reputation Lookup
        </h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={searchIP}
            onChange={e => setSearchIP(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchTI()}
            placeholder="Enter IP address (e.g. 185.220.101.1)"
            className="flex-1 rounded-xl border border-border bg-muted px-4 py-2.5 text-sm text-foreground placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
          />
          <button
            onClick={searchTI}
            disabled={searching || !searchIP.trim()}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm text-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {searching
              ? <RefreshCw className="h-4 w-4 animate-spin" />
              : <Search className="h-4 w-4" />
            }
            Analyze
          </button>
        </div>

        {searchError && (
          <p className="mt-3 text-sm text-red-400">{searchError}</p>
        )}

        {/* Search Result */}
        {searchResult && (
          <div className="mt-4 rounded-xl border border-border bg-muted/50 p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-lg font-bold text-foreground">
                    {searchResult.ip}
                  </span>
                  <ScoreBadge score={searchResult.abuse_score} />
                  {searchResult.is_malicious && (
                    <span className="rounded-lg bg-red-500/20 px-2 py-0.5 text-xs text-red-400">
                      ⚠ MALICIOUS
                    </span>
                  )}
                  {searchResult.is_tor && (
                    <span className="rounded-lg bg-purple-500/20 px-2 py-0.5 text-xs text-purple-400">
                      TOR NODE
                    </span>
                  )}
                  {searchResult.cached && (
                    <span className="rounded-lg bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      cached
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                  {searchResult.country_code && (
                    <span className="flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      {searchResult.country_code}
                    </span>
                  )}
                  {searchResult.isp && (
                    <span className="flex items-center gap-1">
                      <Wifi className="h-3 w-3" />
                      {searchResult.isp}
                    </span>
                  )}
                  {searchResult.usage_type && (
                    <span className="flex items-center gap-1">
                      <Radio className="h-3 w-3" />
                      {searchResult.usage_type}
                    </span>
                  )}
                  <span>
                    {searchResult.total_reports} reports
                  </span>
                </div>
              </div>

              <div className="text-right">
                {searchResult.is_malicious
                  ? <XCircle className="h-8 w-8 text-red-400" />
                  : <CheckCircle className="h-8 w-8 text-green-400" />
                }
              </div>
            </div>

            {(searchResult.categories || []).length > 0 && (
  <div className="mt-3 flex flex-wrap gap-2">
    {(searchResult.categories || []).map(cat => (
      <span key={cat} className="rounded-lg bg-red-500/10 px-2 py-0.5 text-xs text-red-400">
        {cat}
      </span>
    ))}
  </div>
)}

{(searchResult.sources || []).length > 0 && (
  <div className="mt-2 flex items-center gap-2">
    <span className="text-xs text-muted-foreground">Sources:</span>
    {(searchResult.sources || []).map(s => (
      <span key={s} className="rounded-lg bg-muted px-2 py-0.5 text-xs text-foreground/80">
        {s}
      </span>
    ))}
  </div>
)}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Malicious IPs */}
        <div className="rounded-xl border border-border bg-card/60 p-5">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            Known Malicious IPs
          </h2>
          {maliciousIPs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <CheckCircle className="mb-2 h-8 w-8" />
              <p className="text-sm">No malicious IPs detected yet</p>
              <p className="text-xs mt-1">Analyze IPs to populate this list</p>
            </div>
          ) : (
            <div className="space-y-2">
              {maliciousIPs.map(ip => (
                <div
                  key={ip.ip}
                  className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2.5"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-foreground">{ip.ip}</span>
                      {ip.is_tor && (
                        <span className="rounded-md bg-purple-500/20 px-1.5 py-0.5 text-[10px] text-purple-400">
                          TOR
                        </span>
                      )}
                      {ip.country_code && (
                        <span className="text-xs text-muted-foreground">{ip.country_code}</span>
                      )}
                    </div>
                    {ip.isp && (
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">{ip.isp}</p>
                    )}
                    {ip.categories.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {ip.categories.slice(0, 2).map(c => (
                          <span key={c} className="rounded-md bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-400">
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <ScoreBadge score={ip.abuse_score} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Countries */}
        <div className="rounded-xl border border-border bg-card/60 p-5">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
            <Globe className="h-5 w-5 text-blue-400" />
            Top Threat Countries
          </h2>
          {!stats || stats.top_countries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Globe className="mb-2 h-8 w-8" />
              <p className="text-sm">No country data yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.top_countries.map((item, i) => {
                const max = stats.top_countries[0]?.count || 1;
                const pct = Math.round((item.count / max) * 100);
                return (
                  <div key={item.country} className="flex items-center gap-3">
                    <span className="w-4 text-xs text-muted-foreground">{i + 1}</span>
                    <span className="w-8 text-xs font-bold text-foreground">{item.country}</span>
                    <div className="flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-blue-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-6 text-right text-xs text-muted-foreground">{item.count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}