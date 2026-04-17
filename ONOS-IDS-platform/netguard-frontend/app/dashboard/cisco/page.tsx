'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, Cpu, HardDrive, Wifi, Database, RefreshCw, Settings } from 'lucide-react';
import type {
  CiscoDevice, CiscoCpu, CiscoMemoryPool, CiscoInterface, CiscoRoute,
} from '@/lib/cisco-types';

interface CiscoMetrics {
  cpu: CiscoCpu | null;
  memory: CiscoMemoryPool[] | null;
  interfaces: CiscoInterface[] | null;
  routes: CiscoRoute[] | null;
}

export default function CiscoDevicesPage() {
  const [devices, setDevices] = useState<CiscoDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<CiscoMetrics>({
    cpu: null,
    memory: null,
    interfaces: null,
    routes: null,
  });
  const [error, setError] = useState<string | null>(null);

  function withDevice(path: string) {
    if (!selectedDevice) return path;
    const separator = path.includes('?') ? '&' : '?';
    return `${path}${separator}device=${encodeURIComponent(selectedDevice)}`;
  }

  // Fetch devices
  useEffect(() => {
    fetchDevices();
  }, []);

  // Fetch metrics when device selected
  useEffect(() => {
    if (selectedDevice) {
      fetchMetrics();
    }
  }, [selectedDevice]);

  async function fetchDevices() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/cisco/devices');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to fetch devices (${response.status})`);
      }
      const data = await response.json();
      // Handle both array and object responses
      const devicesList = Array.isArray(data) ? data : (data.devices || []);
      setDevices(devicesList);
      // Try to select first device
      if (Array.isArray(devicesList) && devicesList.length > 0) {
        setSelectedDevice(devicesList[0].device_id || devicesList[0].id || '');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('Error fetching devices:', message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchMetrics() {
    try {
      setLoading(true);
      const [cpu, memory, interfaces, routes] = await Promise.all([
        fetch(withDevice('/api/cisco/cpu')).then(r => r.ok ? r.json() : {}),
        fetch(withDevice('/api/cisco/memory')).then(r => r.ok ? r.json() : []),
        fetch(withDevice('/api/cisco/interfaces/oper')).then(r => r.ok ? r.json() : []),
        fetch(withDevice('/api/cisco/routes')).then(r => r.ok ? r.json() : []),
      ]);
      setMetrics({ cpu, memory, interfaces, routes });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error fetching metrics';
      console.error('Error fetching metrics:', message);
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const cpuUsage = metrics.cpu?.five_seconds || 0;
  const memUsage = metrics.memory?.[0]?.usage_percent || 0;
  const interfaceCount = Array.isArray(metrics.interfaces) ? metrics.interfaces.length : 0;
  const routeCount = Array.isArray(metrics.routes) ? metrics.routes.length : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Cisco Devices</h1>
          <p className="text-gray-600 mt-1">Manage Cisco CSR1000V via CsrManager</p>
        </div>
        <button
          onClick={fetchDevices}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          disabled={loading}
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
            value={selectedDevice || ''}
            onChange={(e) => setSelectedDevice(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Choose a device...</option>
            {devices.map((device) => (
              <option key={device.device_id} value={device.device_id}>
                {device.ip}:{device.port} ({device.hwVersion})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Metrics Cards */}
      {selectedDevice && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* CPU Card */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600">CPU Usage</h3>
              <Cpu className="text-blue-600" size={24} />
            </div>
            <div className="mb-2">
              <div className="text-3xl font-bold text-gray-900">{cpuUsage}%</div>
              <p className="text-xs text-gray-500">Last 5 seconds</p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(cpuUsage, 100)}%` }}
              />
            </div>
          </div>

          {/* Memory Card */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600">Memory Usage</h3>
              <HardDrive className="text-green-600" size={24} />
            </div>
            <div className="mb-2">
              <div className="text-3xl font-bold text-gray-900">{memUsage.toFixed(1)}%</div>
              <p className="text-xs text-gray-500">Total</p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-600 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(memUsage, 100)}%` }}
              />
            </div>
          </div>

          {/* Interfaces Card */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600">Interfaces</h3>
              <Wifi className="text-purple-600" size={24} />
            </div>
            <div className="mb-2">
              <div className="text-3xl font-bold text-gray-900">{interfaceCount}</div>
              <p className="text-xs text-gray-500">Active interfaces</p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-purple-600 h-2 rounded-full" style={{ width: '100%' }} />
            </div>
          </div>

          {/* Routes Card */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600">Routes</h3>
              <Database className="text-orange-600" size={24} />
            </div>
            <div className="mb-2">
              <div className="text-3xl font-bold text-gray-900">{routeCount}</div>
              <p className="text-xs text-gray-500">Routing entries</p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-orange-600 h-2 rounded-full" style={{ width: '100%' }} />
            </div>
          </div>
        </div>
      )}

      {/* Detailed Sections */}
      {selectedDevice && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Interfaces */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Network Interfaces</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {Array.isArray(metrics.interfaces) && metrics.interfaces.length > 0 ? (
                metrics.interfaces.map((iface) => (
                  <div key={iface.name} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div>
                      <p className="font-medium text-gray-900">{iface.name}</p>
                      <p className="text-xs text-gray-500">{iface.oper_status}</p>
                    </div>
                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                      {iface.speed} Mbps
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-sm">No interfaces found</p>
              )}
            </div>
          </div>

          {/* Routes */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Routing Table (Top 10)</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {Array.isArray(metrics.routes) && metrics.routes.slice(0, 10).length > 0 ? (
                metrics.routes.slice(0, 10).map((route) => (
                  <div key={`${route.destination}-${route.next_hop}`} className="text-sm p-2 bg-gray-50 rounded">
                    <p className="text-gray-900">
                      <span className="font-medium">{route.destination}</span>
                      <span className="text-gray-600"> via {route.next_hop}</span>
                    </p>
                    <p className="text-xs text-gray-500">
                      {route.protocol} - Metric: {route.metric}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-sm">No routes found</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      {selectedDevice && (
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Settings size={18} />
            Configure Device
          </button>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            <Database size={18} />
            View Full Data
          </button>
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
