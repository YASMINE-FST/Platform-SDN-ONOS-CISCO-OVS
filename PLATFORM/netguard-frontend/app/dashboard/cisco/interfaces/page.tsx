'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, Wifi, RefreshCw, Power, Settings } from 'lucide-react';
import { parseCiscoResponse } from '@/lib/cisco-api';
import type { CiscoDevice, CiscoInterface } from '@/lib/cisco-types';

interface InterfaceConfigModal {
  name: string;
  description: string;
  enabled: boolean;
}

export default function CiscoInterfacesPage() {
  const [selectedDevice, setSelectedDevice] = useState('');
  const [devices, setDevices] = useState<CiscoDevice[]>([]);
  const [interfaces, setInterfaces] = useState<CiscoInterface[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('all'); // all, up, down
  const [searchTerm, setSearchTerm] = useState('');
  const [configuring, setConfiguring] = useState(false);
  const [configModal, setConfigModal] = useState<InterfaceConfigModal | null>(null);

  function withDevice(path: string) {
    if (!selectedDevice) return path;
    const separator = path.includes('?') ? '&' : '?';
    return `${path}${separator}device=${encodeURIComponent(selectedDevice)}`;
  }

  function normalizeInterface(iface: CiscoInterface): CiscoInterface {
    const inErrors = iface.stats?.in_errors ?? 0;
    const outErrors = iface.stats?.out_errors ?? 0;
    return {
      ...iface,
      in_octets: iface.in_octets ?? iface.stats?.in_octets ?? 0,
      out_octets: iface.out_octets ?? iface.stats?.out_octets ?? 0,
      in_pkts: iface.in_pkts ?? iface.stats?.in_packets ?? 0,
      out_pkts: iface.out_pkts ?? iface.stats?.out_packets ?? 0,
      errors: iface.errors ?? inErrors + outErrors,
    };
  }

  // Fetch devices on mount
  useEffect(() => {
    fetchDevices();
  }, []);

  // Fetch interfaces when device selected
  useEffect(() => {
    if (selectedDevice) {
      fetchInterfaces();
    }
  }, [selectedDevice]);

  async function fetchDevices() {
    try {
      setLoading(true);
      const response = await fetch('/api/cisco/devices');
      if (!response.ok) throw new Error('Failed to fetch devices');
      const data = await response.json();
      const devicesList = Array.isArray(data) ? data : (data.devices || []);
      setDevices(devicesList);
      if (devicesList.length > 0) {
        setSelectedDevice(devicesList[0].device_id || devicesList[0].id || '');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching devices');
    } finally {
      setLoading(false);
    }
  }

  async function fetchInterfaces() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(withDevice('/api/cisco/interfaces/oper'));
      if (!response.ok) throw new Error('Failed to fetch interfaces');
      const data = await response.json();
      setInterfaces(Array.isArray(data) ? data.map((iface) => normalizeInterface(iface)) : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching interfaces');
      setInterfaces([]);
    } finally {
      setLoading(false);
    }
  }

  const handleEnableInterface = async (interfaceName: string) => {
    try {
      setConfiguring(true);
      const response = await fetch(withDevice('/api/cisco/config/interface'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: interfaceName, enabled: true }),
      });
      await parseCiscoResponse(response, 'Failed to enable interface');
      await fetchInterfaces();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error enabling interface');
    } finally {
      setConfiguring(false);
    }
  };

  const handleDisableInterface = async (interfaceName: string) => {
    try {
      setConfiguring(true);
      const response = await fetch(withDevice('/api/cisco/config/interface'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: interfaceName, enabled: false }),
      });
      await parseCiscoResponse(response, 'Failed to disable interface');
      await fetchInterfaces();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error disabling interface');
    } finally {
      setConfiguring(false);
    }
  };

  const handleConfigInterface = (iface: CiscoInterface) => {
    setConfigModal({
      name: iface.name,
      description: iface.description || '',
      enabled: iface.oper_status === 'up',
    });
  };

  const handleSaveConfig = async () => {
    if (!configModal) return;
    try {
      setConfiguring(true);
      const response = await fetch(withDevice('/api/cisco/config/interface'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: configModal.name,
          description: configModal.description,
          enabled: configModal.enabled,
        }),
      });
      await parseCiscoResponse(response, 'Failed to save configuration');
      setConfigModal(null);
      await fetchInterfaces();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error saving configuration');
    } finally {
      setConfiguring(false);
    }
  };

  // Filter interfaces
  const filteredInterfaces = interfaces.filter((iface) => {
    const statusMatch = filterStatus === 'all' || iface.oper_status === filterStatus;
    const nameMatch = iface.name.toLowerCase().includes(searchTerm.toLowerCase());
    return statusMatch && nameMatch;
  });

  const upCount = interfaces.filter((i) => i.oper_status === 'up').length;
  const downCount = interfaces.filter((i) => i.oper_status === 'down').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Cisco Interfaces</h1>
          <p className="text-gray-600 mt-1">Manage network interfaces on Cisco CSR1000V</p>
        </div>
        <button
          onClick={fetchInterfaces}
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

      {/* Stats */}
      {selectedDevice && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-2xl font-bold text-gray-900">{interfaces.length}</p>
              </div>
              <Wifi className="text-blue-600" size={32} />
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Up</p>
                <p className="text-2xl font-bold text-green-600">{upCount}</p>
              </div>
              <Power className="text-green-600" size={32} />
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Down</p>
                <p className="text-2xl font-bold text-red-600">{downCount}</p>
              </div>
              <Power className="text-red-600" size={32} />
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search */}
      {selectedDevice && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 flex gap-4 flex-wrap">
          <div className="flex-1 min-w-48">
            <input
              type="text"
              placeholder="Search interface name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filterStatus === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterStatus('up')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filterStatus === 'up'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Up ({upCount})
            </button>
            <button
              onClick={() => setFilterStatus('down')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filterStatus === 'down'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Down ({downCount})
            </button>
          </div>
        </div>
      )}

      {/* Interfaces Table */}
      {selectedDevice && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Interface
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Speed
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    In Octets
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Out Octets
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Errors
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredInterfaces.length > 0 ? (
                  filteredInterfaces.map((iface) => (
                    <tr key={iface.name} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {iface.name}
                        {iface.description && (
                          <p className="text-xs text-gray-500">{iface.description}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full font-medium ${
                            iface.oper_status === 'up'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          <div
                            className={`w-2 h-2 rounded-full ${
                              iface.oper_status === 'up' ? 'bg-green-600' : 'bg-red-600'
                            }`}
                          />
                          {iface.oper_status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {iface.speed || 'N/A'} Mbps
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {iface.in_octets || 0}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {iface.out_octets || 0}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {iface.errors || 0}
                      </td>
                      <td className="px-6 py-4 text-sm flex gap-2">
                        {iface.oper_status === 'up' ? (
                          <button
                            onClick={() => handleDisableInterface(iface.name)}
                            disabled={configuring}
                            className="p-2 bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
                            title="Disable interface"
                          >
                            <Power size={16} />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleEnableInterface(iface.name)}
                            disabled={configuring}
                            className="p-2 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50"
                            title="Enable interface"
                          >
                            <Power size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => handleConfigInterface(iface)}
                          disabled={configuring}
                          className="p-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
                          title="Configure interface"
                        >
                          <Settings size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      No interfaces found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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

      {/* Config Modal */}
      {configModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Configure Interface</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Interface Name
                </label>
                <input
                  type="text"
                  disabled
                  value={configModal.name}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={configModal.description}
                  onChange={(e) =>
                    setConfigModal({ ...configModal, description: e.target.value })
                  }
                  placeholder="Interface description"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={configModal.enabled}
                  onChange={(e) =>
                    setConfigModal({ ...configModal, enabled: e.target.checked })
                  }
                  className="w-4 h-4"
                />
                <label htmlFor="enabled" className="text-sm font-medium text-gray-700">
                  Enable Interface
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setConfigModal(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveConfig}
                disabled={configuring}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 font-medium"
              >
                {configuring ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
