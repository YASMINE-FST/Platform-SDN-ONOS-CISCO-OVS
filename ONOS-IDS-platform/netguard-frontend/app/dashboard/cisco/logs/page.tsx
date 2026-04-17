'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, RefreshCw, Download, TrendingUp, Thermometer, Wind } from 'lucide-react';
import type { CiscoDevice } from '@/lib/cisco-types';

export default function CiscoLogsPage() {
  const [selectedDevice, setSelectedDevice] = useState('');
  const [devices, setDevices] = useState<CiscoDevice[]>([]);
  const [activeTab, setActiveTab] = useState('logs');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [logs, setLogs] = useState<any[]>([]);
  const [processes, setProcesses] = useState<any[]>([]);
  const [environment, setEnvironment] = useState<any>(null);
  const [cpuHistory, setCpuHistory] = useState<any[]>([]);
  const [memoryHistory, setMemoryHistory] = useState<any[]>([]);

  const [logFilter, setLogFilter] = useState('all');
  const [logSearch, setLogSearch] = useState('');
  const [processSort, setProcessSort] = useState('memory'); // memory or cpu

  // Fetch devices on mount
  useEffect(() => {
    fetchDevices();
  }, []);

  // Fetch data when device selected or tab changes
  useEffect(() => {
    if (selectedDevice) {
      fetchData();
    }
  }, [selectedDevice, activeTab]);

  async function fetchDevices() {
    try {
      const response = await fetch('/api/cisco/devices');
      if (!response.ok) throw new Error('Failed to fetch devices');
      const data = await response.json();
      const devicesList = Array.isArray(data) ? data : (data.devices || []);
      setDevices(devicesList);
      if (devicesList.length > 0) {
        setSelectedDevice(devicesList[0].id || '');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching devices');
    }
  }

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);

      // Fetch all data in parallel
      const [logsRes, procRes, envRes, cpuRes, memRes] = await Promise.all([
        fetch('/api/cisco/logs').then((r) => (r.ok ? r.json() : [])),
        fetch('/api/cisco/processes').then((r) => (r.ok ? r.json() : [])),
        fetch('/api/cisco/environment').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/cisco/cpu/history').then((r) => (r.ok ? r.json() : [])),
        fetch('/api/cisco/memory').then((r) => (r.ok ? r.json() : [])),
      ]);

      setLogs(Array.isArray(logsRes) ? logsRes.slice(0, 100) : []);
      setProcesses(Array.isArray(procRes) ? procRes : []);
      setEnvironment(envRes);
      setCpuHistory(Array.isArray(cpuRes) ? cpuRes : []);
      setMemoryHistory(Array.isArray(memRes) ? (Array.isArray(memRes) ? memRes : [memRes]) : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching data');
    } finally {
      setLoading(false);
    }
  }

  // Filter and search logs
  const filteredLogs = logs.filter((log) => {
    const levelMatch = logFilter === 'all' || log.level === logFilter;
    const searchMatch =
      log.message.toLowerCase().includes(logSearch.toLowerCase()) ||
      (log.level && log.level.toLowerCase().includes(logSearch.toLowerCase()));
    return levelMatch && searchMatch;
  });

  // Sort processes
  const sortedProcesses = [...processes].sort((a, b) => {
    if (processSort === 'memory') {
      return (b.memory_percent || 0) - (a.memory_percent || 0);
    } else {
      return (b.cpu_percent || 0) - (a.cpu_percent || 0);
    }
  });

  const handleExportLogs = () => {
    const csv = 'Timestamp,Level,Message\n' +
      filteredLogs
        .map((log) => `"${log.timestamp}","${log.level}","${log.message}"`)
        .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cisco-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tabs = [
    { id: 'logs', label: 'Syslog', icon: '📝' },
    { id: 'processes', label: 'Processes', icon: '⚙️' },
    { id: 'environment', label: 'Environment', icon: '🌡️' },
    { id: 'history', label: 'History', icon: '📊' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Cisco Logs & Monitoring</h1>
          <p className="text-gray-600 mt-1">System logs, processes, and performance metrics</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="font-semibold text-red-900">Error</h3>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Device Selector */}
      {devices.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Device
          </label>
          <select
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {devices.map((device) => (
              <option key={device.device_id} value={device.device_id}>
                {device.ip}:{device.port}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Tabs */}
      {selectedDevice && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-200 flex overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 font-medium text-sm whitespace-nowrap transition ${
                  activeTab === tab.id
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900 border-b-2 border-transparent'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* Syslog Tab */}
            {activeTab === 'logs' && (
              <div className="space-y-4">
                <div className="flex gap-4 flex-wrap items-end">
                  <div className="flex-1 min-w-48">
                    <input
                      type="text"
                      placeholder="Search logs..."
                      value={logSearch}
                      onChange={(e) => setLogSearch(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <select
                    value={logFilter}
                    onChange={(e) => setLogFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Levels</option>
                    <option value="ERROR">Errors</option>
                    <option value="WARNING">Warnings</option>
                    <option value="INFO">Information</option>
                    <option value="DEBUG">Debug</option>
                  </select>
                  <button
                    onClick={handleExportLogs}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <Download size={18} />
                    Export
                  </button>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredLogs.length > 0 ? (
                    filteredLogs.map((log, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded border text-sm font-mono ${
                          log.level === 'ERROR'
                            ? 'bg-red-50 border-red-200 text-red-900'
                            : log.level === 'WARNING'
                              ? 'bg-yellow-50 border-yellow-200 text-yellow-900'
                              : 'bg-gray-50 border-gray-200 text-gray-700'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1">
                            <p className="font-semibold">{log.level}</p>
                            <p className="text-xs opacity-75">{log.timestamp}</p>
                          </div>
                        </div>
                        <p className="mt-1 text-xs">{log.message}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-4">No logs found</p>
                  )}
                </div>
              </div>
            )}

            {/* Processes Tab */}
            {activeTab === 'processes' && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <button
                    onClick={() => setProcessSort('memory')}
                    className={`px-4 py-2 rounded-lg font-medium ${
                      processSort === 'memory'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Sort by Memory
                  </button>
                  <button
                    onClick={() => setProcessSort('cpu')}
                    className={`px-4 py-2 rounded-lg font-medium ${
                      processSort === 'cpu'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Sort by CPU
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-gray-700 font-medium">Name</th>
                        <th className="px-4 py-2 text-left text-gray-700 font-medium">PID</th>
                        <th className="px-4 py-2 text-left text-gray-700 font-medium">CPU %</th>
                        <th className="px-4 py-2 text-left text-gray-700 font-medium">Memory %</th>
                        <th className="px-4 py-2 text-left text-gray-700 font-medium">Memory (MB)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {sortedProcesses.length > 0 ? (
                        sortedProcesses.slice(0, 20).map((proc, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-2">{proc.name}</td>
                            <td className="px-4 py-2">{proc.pid}</td>
                            <td className="px-4 py-2">
                              <div className="w-16 bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-blue-600 h-2 rounded-full"
                                  style={{
                                    width: `${Math.min(proc.cpu_percent || 0, 100)}%`,
                                  }}
                                />
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              <div className="w-16 bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-orange-600 h-2 rounded-full"
                                  style={{
                                    width: `${Math.min(proc.memory_percent || 0, 100)}%`,
                                  }}
                                />
                              </div>
                            </td>
                            <td className="px-4 py-2 font-mono">{proc.memory_mb?.toFixed(2) || '0'}MB</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                            No processes found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Environment Tab */}
            {activeTab === 'environment' && (
              <div className="space-y-4">
                {environment ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Temperature */}
                    {environment.temperature && (
                      <div className="bg-gradient-to-br from-red-50 to-orange-50 p-6 rounded-lg border border-orange-200">
                        <div className="flex items-center gap-3 mb-4">
                          <Thermometer className="text-red-600" size={24} />
                          <h3 className="text-lg font-semibold text-gray-900">Temperature</h3>
                        </div>
                        <div className="space-y-2">
                          {Array.isArray(environment.temperature) ? (
                            environment.temperature.map((temp: any, idx: number) => (
                              <div key={idx} className="flex justify-between items-center">
                                <span className="text-gray-700">{temp.location}</span>
                                <span className="font-mono font-semibold">{temp.value}°C</span>
                              </div>
                            ))
                          ) : (
                            <div className="flex justify-between items-center">
                              <span className="text-gray-700">Chassis</span>
                              <span className="font-mono font-semibold">{environment.temperature}°C</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Fans */}
                    {environment.fans && (
                      <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-6 rounded-lg border border-blue-200">
                        <div className="flex items-center gap-3 mb-4">
                          <Wind className="text-blue-600" size={24} />
                          <h3 className="text-lg font-semibold text-gray-900">Fans</h3>
                        </div>
                        <div className="space-y-2">
                          {Array.isArray(environment.fans) ? (
                            environment.fans.map((fan: any, idx: number) => (
                              <div key={idx}>
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-gray-700">{fan.name}</span>
                                  <span className={`font-semibold ${
                                    fan.status === 'ok' ? 'text-green-600' : 'text-red-600'
                                  }`}>
                                    {fan.status}
                                  </span>
                                </div>
                                {fan.speed && (
                                  <p className="text-xs text-gray-600">Speed: {fan.speed} RPM</p>
                                )}
                              </div>
                            ))
                          ) : (
                            <p className="text-gray-700">{environment.fans}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Power Supply */}
                    {environment.power_supply && (
                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-lg border border-green-200">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Power Supply</h3>
                        <div className="space-y-2">
                          {Array.isArray(environment.power_supply) ? (
                            environment.power_supply.map((psu: any, idx: number) => (
                              <div key={idx} className="flex justify-between items-center">
                                <span className="text-gray-700">{psu.name}</span>
                                <span className={`font-semibold ${
                                  psu.status === 'ok' ? 'text-green-600' : 'text-yellow-600'
                                }`}>
                                  {psu.status}
                                </span>
                              </div>
                            ))
                          ) : (
                            <p className="text-gray-700">{environment.power_supply}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500">Environment data not available</p>
                )}
              </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <TrendingUp className="text-blue-600" size={20} />
                    CPU Usage History
                  </h3>
                  {cpuHistory.length > 0 ? (
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left px-3 py-2 text-gray-700 font-medium">Timestamp</th>
                            <th className="text-left px-3 py-2 text-gray-700 font-medium">Usage %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cpuHistory.slice(0, 10).map((entry, idx) => (
                            <tr key={idx} className="border-b border-gray-200 hover:bg-gray-100">
                              <td className="px-3 py-2">{entry.timestamp}</td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-24 bg-gray-300 rounded-full h-2">
                                    <div
                                      className="bg-blue-600 h-2 rounded-full"
                                      style={{ width: `${entry.cpu_usage}%` }}
                                    />
                                  </div>
                                  <span className="font-mono font-semibold">{entry.cpu_usage}%</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-gray-500">No CPU history available</p>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <TrendingUp className="text-orange-600" size={20} />
                    Memory Usage History
                  </h3>
                  {memoryHistory.length > 0 ? (
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left px-3 py-2 text-gray-700 font-medium">Timestamp</th>
                            <th className="text-left px-3 py-2 text-gray-700 font-medium">Usage %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(Array.isArray(memoryHistory) ? memoryHistory : [memoryHistory]).slice(0, 10).map((entry: any, idx: number) => (
                            <tr key={idx} className="border-b border-gray-200 hover:bg-gray-100">
                              <td className="px-3 py-2">{entry.timestamp || 'N/A'}</td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-24 bg-gray-300 rounded-full h-2">
                                    <div
                                      className="bg-orange-600 h-2 rounded-full"
                                      style={{ width: `${entry.memory_used_percent || entry.used_percent || 0}%` }}
                                    />
                                  </div>
                                  <span className="font-mono font-semibold">
                                    {entry.memory_used_percent || entry.used_percent || 0}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-gray-500">No memory history available</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading...</span>
        </div>
      )}
    </div>
  );
}
