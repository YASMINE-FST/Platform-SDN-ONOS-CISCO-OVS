'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, RefreshCw, Check, X } from 'lucide-react';
import type { CiscoDevice, CiscoInterface, CiscoRoute } from '@/lib/cisco-types';

type EditableInterface = CiscoInterface & { enabled?: boolean };

export default function CiscoConfigPage() {
  const [selectedDevice, setSelectedDevice] = useState('');
  const [devices, setDevices] = useState<CiscoDevice[]>([]);
  const [activeTab, setActiveTab] = useState('hostname');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form states
  const [hostname, setHostname] = useState('');
  const [interfaces, setInterfaces] = useState<CiscoInterface[]>([]);
  const [staticRoutes, setStaticRoutes] = useState<CiscoRoute[]>([]);
  const [ntpConfig, setNtpConfig] = useState({ servers: [] as string[] });

  // Edit states
  const [editingInterface, setEditingInterface] = useState<EditableInterface | null>(null);
  const [addingRoute, setAddingRoute] = useState(false);
  const [newRoute, setNewRoute] = useState({ prefix: '', mask: '255.255.255.0', next_hop: '', distance: 1 });
  const [addingNtpServer, setAddingNtpServer] = useState('');

  function withDevice(path: string) {
    if (!selectedDevice) return path;
    const separator = path.includes('?') ? '&' : '?';
    return `${path}${separator}device=${encodeURIComponent(selectedDevice)}`;
  }

  // Fetch devices on mount
  useEffect(() => {
    fetchDevices();
  }, []);

  // Fetch config when device selected
  useEffect(() => {
    if (selectedDevice) {
      fetchConfiguration();
    }
  }, [selectedDevice]);

  async function fetchDevices() {
    try {
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
    }
  }

  async function fetchConfiguration() {
    try {
      setLoading(true);
      setError(null);

      // Fetch all config data in parallel
      const [hostResp, ifaceResp, routeResp, ntpResp] = await Promise.all([
        fetch(withDevice('/api/cisco/version')).then((r) => (r.ok ? r.json() : {})),
        fetch(withDevice('/api/cisco/interfaces/oper')).then((r) => (r.ok ? r.json() : [])),
        fetch(withDevice('/api/cisco/routes/static')).then((r) => (r.ok ? r.json() : [])),
        fetch(withDevice('/api/cisco/ntp')).then((r) => (r.ok ? r.json() : { peers: [] })),
      ]);

      // Extract hostname from version response
      const host = hostResp as { hostname?: string };
      if (host.hostname) {
        setHostname(host.hostname);
      }

      setInterfaces(Array.isArray(ifaceResp) ? ifaceResp : []);
      setStaticRoutes(Array.isArray(routeResp) ? routeResp : []);

      const servers = Array.isArray(ntpResp?.servers)
        ? ntpResp.servers
        : Array.isArray(ntpResp?.peers)
          ? ntpResp.peers
              .map((peer: { address?: string }) => peer.address)
              .filter((address: string | undefined): address is string => Boolean(address))
          : [];
      setNtpConfig({ servers });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching configuration');
    } finally {
      setLoading(false);
    }
  }

  const handleSaveHostname = async () => {
    if (!hostname.trim()) {
      setError('Hostname cannot be empty');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(withDevice('/api/cisco/config/hostname'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostname }),
      });
      if (!response.ok) throw new Error('Failed to update hostname');
      setSuccess('Hostname updated successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error updating hostname');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveInterface = async () => {
    if (!editingInterface) return;

    try {
      setLoading(true);
      const response = await fetch(withDevice('/api/cisco/config/interface'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingInterface.name,
          description: editingInterface.description,
          enabled: editingInterface.enabled,
        }),
      });
      if (!response.ok) throw new Error('Failed to save interface configuration');
      setSuccess(`Interface ${editingInterface.name} configured`);
      setEditingInterface(null);
      setTimeout(() => setSuccess(null), 3000);
      await fetchConfiguration();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error saving interface');
    } finally {
      setLoading(false);
    }
  };

  const handleAddRoute = async () => {
    if (!newRoute.prefix || !newRoute.next_hop) {
      setError('Please fill all required fields');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(withDevice('/api/cisco/config/routes/static'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRoute),
      });
      if (!response.ok) throw new Error('Failed to add route');
      setSuccess('Static route added successfully');
      setNewRoute({ prefix: '', mask: '255.255.255.0', next_hop: '', distance: 1 });
      setAddingRoute(false);
      setTimeout(() => setSuccess(null), 3000);
      await fetchConfiguration();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error adding route');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRoute = async (prefix: string, mask: string, nextHop: string) => {
    if (!confirm(`Delete route ${prefix}/${mask}?`)) return;

    try {
      setLoading(true);
      const response = await fetch(withDevice('/api/cisco/config/routes/static'), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefix, mask, next_hop: nextHop }),
      });
      if (!response.ok) throw new Error('Failed to delete route');
      setSuccess('Route deleted successfully');
      setTimeout(() => setSuccess(null), 3000);
      await fetchConfiguration();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting route');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNtp = async () => {
    if (!ntpConfig.servers.length) {
      setError('Please add an NTP server first');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(withDevice('/api/cisco/config/ntp'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server: ntpConfig.servers[0] }),
      });
      if (!response.ok) throw new Error('Failed to save NTP configuration');
      setSuccess('NTP configuration saved');
      setTimeout(() => setSuccess(null), 3000);
      await fetchConfiguration();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error saving NTP config');
    } finally {
      setLoading(false);
    }
  };

  const handleAddNtpServer = () => {
    if (!addingNtpServer.trim()) {
      setError('Please enter an NTP server address');
      return;
    }
    if (ntpConfig.servers.includes(addingNtpServer)) {
      setError('Server already configured');
      return;
    }
    setNtpConfig({
      ...ntpConfig,
      servers: [...ntpConfig.servers, addingNtpServer],
    });
    setAddingNtpServer('');
  };

  const handleRemoveNtpServer = (server: string) => {
    setNtpConfig({
      ...ntpConfig,
      servers: ntpConfig.servers.filter((s) => s !== server),
    });
  };

  const tabs = [
    { id: 'hostname', label: 'Hostname', icon: '🏠' },
    { id: 'interfaces', label: 'Interfaces', icon: '🔌' },
    { id: 'routes', label: 'Static Routes', icon: '🛣️' },
    { id: 'ntp', label: 'NTP', icon: '⏰' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Cisco Configuration</h1>
          <p className="text-gray-600 mt-1">Configure Cisco CSR1000V settings</p>
        </div>
        <button
          onClick={fetchConfiguration}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="font-semibold text-red-900">Error</h3>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <Check className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="font-semibold text-green-900">Success</h3>
            <p className="text-green-700 text-sm">{success}</p>
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

          <div className="p-6 space-y-6">
            {/* Hostname Tab */}
            {activeTab === 'hostname' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Device Hostname</h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <input
                    type="text"
                    value={hostname}
                    onChange={(e) => setHostname(e.target.value)}
                    placeholder="Enter hostname (e.g., csr1000v-01)"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                  <p className="text-xs text-gray-600 mt-2">
                    Current hostname will be updated on the device
                  </p>
                </div>
                <button
                  onClick={handleSaveHostname}
                  disabled={loading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 font-medium"
                >
                  {loading ? 'Saving...' : 'Save Hostname'}
                </button>
              </div>
            )}

            {/* Interfaces Tab */}
            {activeTab === 'interfaces' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Interface Configuration</h3>
                <div className="space-y-3">
                  {interfaces.length > 0 ? (
                    interfaces.map((iface, idx) => (
                      <div
                        key={idx}
                        className="bg-gray-50 p-4 rounded-lg border border-gray-200 flex justify-between items-start"
                      >
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">{iface.name}</p>
                          <p className="text-sm text-gray-600">
                            Status: <span className={iface.oper_status === 'up' ? 'text-green-600' : 'text-red-600'}>
                              {iface.oper_status}
                            </span>
                          </p>
                          {iface.description && (
                            <p className="text-sm text-gray-500 mt-1">{iface.description}</p>
                          )}
                        </div>
                        <button
                          onClick={() => setEditingInterface({
                            ...iface,
                            enabled: iface.enabled ?? iface.oper_status === 'up',
                          })}
                          className="px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                        >
                          Edit
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500">No interfaces found</p>
                  )}
                </div>
              </div>
            )}

            {/* Routes Tab */}
            {activeTab === 'routes' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900">Static Routes</h3>
                  {!addingRoute && (
                    <button
                      onClick={() => setAddingRoute(true)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      + Add Route
                    </button>
                  )}
                </div>

                {addingRoute && (
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 space-y-3">
                    <input
                      type="text"
                      value={newRoute.prefix}
                      onChange={(e) => setNewRoute({ ...newRoute, prefix: e.target.value })}
                      placeholder="Prefix (e.g., 10.0.0.0)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                    <input
                      type="text"
                      value={newRoute.mask}
                      onChange={(e) => setNewRoute({ ...newRoute, mask: e.target.value })}
                      placeholder="Mask (e.g., 255.255.255.0)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                    <input
                      type="text"
                      value={newRoute.next_hop}
                      onChange={(e) => setNewRoute({ ...newRoute, next_hop: e.target.value })}
                      placeholder="Next Hop IP"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                    <input
                      type="number"
                      value={newRoute.distance}
                      onChange={(e) => setNewRoute({ ...newRoute, distance: parseInt(e.target.value) })}
                      min="1"
                      max="255"
                      placeholder="Distance"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddRoute}
                        disabled={loading}
                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-green-400"
                      >
                        {loading ? 'Adding...' : 'Add'}
                      </button>
                      <button
                        onClick={() => setAddingRoute(false)}
                        className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {staticRoutes.length > 0 ? (
                    staticRoutes.map((route, idx) => (
                      <div key={idx} className="bg-gray-50 p-3 rounded border border-gray-200 flex justify-between items-center">
                        <div className="font-mono text-sm">
                          <p>{route.prefix}/{route.mask} → {route.next_hop}</p>
                        </div>
                        <button
                          onClick={() => handleDeleteRoute(route.prefix, route.mask, route.next_hop)}
                          className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                        >
                          Delete
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500">No static routes configured</p>
                  )}
                </div>
              </div>
            )}

            {/* NTP Tab */}
            {activeTab === 'ntp' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">NTP Configuration</h3>

                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={addingNtpServer}
                      onChange={(e) => setAddingNtpServer(e.target.value)}
                      placeholder="Enter NTP server (IP or hostname)"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={handleAddNtpServer}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {ntpConfig.servers.length > 0 ? (
                    <>
                      {ntpConfig.servers.map((server, idx) => (
                        <div key={idx} className="bg-gray-50 p-3 rounded border border-gray-200 flex justify-between items-center">
                          <p className="font-mono">{server}</p>
                          <button
                            onClick={() => handleRemoveNtpServer(server)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={handleSaveNtp}
                        disabled={loading}
                        className="w-full mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
                      >
                        {loading ? 'Saving...' : 'Save NTP Configuration'}
                      </button>
                    </>
                  ) : (
                    <p className="text-gray-500">No NTP servers configured</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Interface Edit Modal */}
      {editingInterface && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Edit Interface</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Interface
                </label>
                <input
                  type="text"
                  disabled
                  value={editingInterface.name}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={editingInterface.description || ''}
                  onChange={(e) =>
                    setEditingInterface({
                      ...editingInterface,
                      description: e.target.value,
                    })
                  }
                  placeholder="Interface description"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={Boolean(editingInterface.enabled)}
                  onChange={(e) =>
                    setEditingInterface({
                      ...editingInterface,
                      enabled: e.target.checked,
                    })
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
                onClick={() => setEditingInterface(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveInterface}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 font-medium"
              >
                {loading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Processing...</span>
        </div>
      )}
    </div>
  );
}
