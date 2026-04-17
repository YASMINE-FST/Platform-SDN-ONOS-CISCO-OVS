'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, RefreshCw, Plus, Trash2 } from 'lucide-react';
import type {
  CiscoDevice, CiscoRoute, CiscoArpEntry, CiscoOspfStatus,
  CiscoBgpRoute, CiscoCdpNeighbor, CiscoNtpStatus, CiscoDhcpPool,
} from '@/lib/cisco-types';

export default function CiscoRoutingPage() {
  const [selectedDevice, setSelectedDevice] = useState('');
  const [devices, setDevices] = useState<CiscoDevice[]>([]);
  const [activeTab, setActiveTab] = useState('rib');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [routes, setRoutes] = useState<CiscoRoute[]>([]);
  const [staticRoutes, setStaticRoutes] = useState<CiscoRoute[]>([]);
  const [arpTable, setArpTable] = useState<CiscoArpEntry[]>([]);
  const [ospfStatus, setOspfStatus] = useState<CiscoOspfStatus | null>(null);
  const [bgpRoutes, setBgpRoutes] = useState<CiscoBgpRoute[]>([]);
  const [cdpNeighbors, setCdpNeighbors] = useState<CiscoCdpNeighbor[]>([]);
  const [ntpStatus, setNtpStatus] = useState<CiscoNtpStatus | null>(null);
  const [dhcpPools, setDhcpPools] = useState<CiscoDhcpPool[]>([]);

  const [addRouteModal, setAddRouteModal] = useState(false);
  const [newRoute, setNewRoute] = useState({
    prefix: '',
    mask: '255.255.255.0',
    next_hop: '',
    distance: 1,
  });

  // Fetch devices on mount
  useEffect(() => {
    fetchDevices();
  }, []);

  // Fetch data when device selected or tab changes
  useEffect(() => {
    if (selectedDevice) {
      fetchRoutingData();
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

  async function fetchRoutingData() {
    try {
      setLoading(true);
      setError(null);

      // Fetch all routing data in parallel
      const [ribs, statics, arps, ospf, bgp, cdp, ntp, dhcp] = await Promise.all([
        fetch('/api/cisco/routes').then((r) => (r.ok ? r.json() : [])),
        fetch('/api/cisco/routes/static').then((r) => (r.ok ? r.json() : [])),
        fetch('/api/cisco/arp').then((r) => (r.ok ? r.json() : [])),
        fetch('/api/cisco/ospf').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/cisco/bgp').then((r) => (r.ok ? r.json() : [])),
        fetch('/api/cisco/cdp').then((r) => (r.ok ? r.json() : [])),
        fetch('/api/cisco/ntp').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/cisco/dhcp').then((r) => (r.ok ? r.json() : [])),
      ]);

      setRoutes(Array.isArray(ribs) ? ribs : []);
      setStaticRoutes(Array.isArray(statics) ? statics : []);
      setArpTable(Array.isArray(arps) ? arps : []);
      setOspfStatus(ospf);
      setBgpRoutes(Array.isArray(bgp) ? bgp : []);
      setCdpNeighbors(Array.isArray(cdp) ? cdp : []);
      setNtpStatus(ntp);
      setDhcpPools(Array.isArray(dhcp) ? dhcp : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching routing data');
    } finally {
      setLoading(false);
    }
  }

  const handleAddRoute = async () => {
    if (!newRoute.prefix || !newRoute.next_hop) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/cisco/config/routes/static', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRoute),
      });
      if (!response.ok) throw new Error('Failed to add route');
      setAddRouteModal(false);
      setNewRoute({ prefix: '', mask: '255.255.255.0', next_hop: '', distance: 1 });
      await fetchRoutingData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error adding route');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRoute = async (prefix: string, mask: string, nextHop: string) => {
    if (!confirm(`Delete route ${prefix}/${mask} via ${nextHop}?`)) return;

    try {
      setLoading(true);
      const response = await fetch('/api/cisco/config/routes/static', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefix, mask, next_hop: nextHop }),
      });
      if (!response.ok) throw new Error('Failed to delete route');
      await fetchRoutingData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting route');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'rib', label: 'RIB (All Routes)', icon: '📊' },
    { id: 'static', label: 'Static Routes', icon: '🔧' },
    { id: 'arp', label: 'ARP Table', icon: '🔗' },
    { id: 'ospf', label: 'OSPF', icon: '🌐' },
    { id: 'bgp', label: 'BGP', icon: '🔀' },
    { id: 'cdp', label: 'CDP Neighbors', icon: '👥' },
    { id: 'ntp', label: 'NTP', icon: '⏰' },
    { id: 'dhcp', label: 'DHCP Pools', icon: '💾' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Cisco Routing</h1>
          <p className="text-gray-600 mt-1">Manage routing and network protocols</p>
        </div>
        <button
          onClick={fetchRoutingData}
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
            {/* RIB Tab */}
            {activeTab === 'rib' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Routing Information Base</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-gray-700 font-medium">
                          Destination
                        </th>
                        <th className="px-4 py-2 text-left text-gray-700 font-medium">
                          Next Hop
                        </th>
                        <th className="px-4 py-2 text-left text-gray-700 font-medium">
                          Protocol
                        </th>
                        <th className="px-4 py-2 text-left text-gray-700 font-medium">
                          Metric
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {routes.length > 0 ? (
                        routes.map((route, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-2">{route.destination}</td>
                            <td className="px-4 py-2">{route.next_hop}</td>
                            <td className="px-4 py-2">{route.protocol}</td>
                            <td className="px-4 py-2">{route.metric}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                            No routes found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Static Routes Tab */}
            {activeTab === 'static' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900">Static Routes</h3>
                  <button
                    onClick={() => setAddRouteModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <Plus size={18} />
                    Add Route
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-gray-700 font-medium">
                          Prefix
                        </th>
                        <th className="px-4 py-2 text-left text-gray-700 font-medium">
                          Mask
                        </th>
                        <th className="px-4 py-2 text-left text-gray-700 font-medium">
                          Next Hop
                        </th>
                        <th className="px-4 py-2 text-left text-gray-700 font-medium">
                          Distance
                        </th>
                        <th className="px-4 py-2 text-left text-gray-700 font-medium">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {staticRoutes.length > 0 ? (
                        staticRoutes.map((route, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-2">{route.prefix}</td>
                            <td className="px-4 py-2">{route.mask}</td>
                            <td className="px-4 py-2">{route.next_hop}</td>
                            <td className="px-4 py-2">{route.distance || 1}</td>
                            <td className="px-4 py-2">
                              <button
                                onClick={() =>
                                  handleDeleteRoute(route.prefix || '', route.mask || '', route.next_hop || '')
                                }
                                className="p-2 text-red-600 hover:bg-red-50 rounded"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                            No static routes
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ARP Tab */}
            {activeTab === 'arp' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">ARP Table</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-gray-700 font-medium">
                          IP Address
                        </th>
                        <th className="px-4 py-2 text-left text-gray-700 font-medium">
                          MAC Address
                        </th>
                        <th className="px-4 py-2 text-left text-gray-700 font-medium">
                          Interface
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {arpTable.length > 0 ? (
                        arpTable.map((entry, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-2">{entry.ip}</td>
                            <td className="px-4 py-2 font-mono">{entry.mac}</td>
                            <td className="px-4 py-2">{entry.interface}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                            No ARP entries
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* OSPF Tab */}
            {activeTab === 'ospf' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">OSPF Status</h3>
                {ospfStatus ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 p-4 rounded">
                        <p className="text-sm text-gray-600">Router ID</p>
                        <p className="text-lg font-semibold">{ospfStatus.router_id || 'N/A'}</p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded">
                        <p className="text-sm text-gray-600">Status</p>
                        <p className="text-lg font-semibold">{ospfStatus.status || 'Down'}</p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded">
                        <p className="text-sm text-gray-600">Areas</p>
                        <p className="text-lg font-semibold">
                          {ospfStatus.areas?.length ?? 0}
                        </p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded">
                        <p className="text-sm text-gray-600">Neighbors</p>
                        <p className="text-lg font-semibold">
                          {ospfStatus.neighbors?.length ?? 0}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500">OSPF not configured or data unavailable</p>
                )}
              </div>
            )}

            {/* BGP Tab */}
            {activeTab === 'bgp' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">BGP Routes</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-gray-700 font-medium">
                          Prefix
                        </th>
                        <th className="px-4 py-2 text-left text-gray-700 font-medium">
                          AS Path
                        </th>
                        <th className="px-4 py-2 text-left text-gray-700 font-medium">
                          Next Hop
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {bgpRoutes.length > 0 ? (
                        bgpRoutes.map((route, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-2">{route.prefix}</td>
                            <td className="px-4 py-2">{route.as_path}</td>
                            <td className="px-4 py-2">{route.next_hop}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                            No BGP routes
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* CDP Neighbors Tab */}
            {activeTab === 'cdp' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">CDP Neighbors</h3>
                <div className="grid gap-4">
                  {cdpNeighbors.length > 0 ? (
                    cdpNeighbors.map((neighbor, idx) => (
                      <div key={idx} className="bg-gray-50 p-4 rounded border border-gray-200">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-gray-600">Device</p>
                            <p className="font-semibold">{neighbor.device_id}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600">IP Address</p>
                            <p className="font-mono">{neighbor.ip_address}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600">Local Interface</p>
                            <p>{neighbor.local_interface}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600">Remote Interface</p>
                            <p>{neighbor.remote_interface}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500">No CDP neighbors</p>
                  )}
                </div>
              </div>
            )}

            {/* NTP Tab */}
            {activeTab === 'ntp' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">NTP Status</h3>
                {ntpStatus ? (
                  <div className="space-y-4">
                    <div className="bg-gray-50 p-4 rounded">
                      <p className="text-sm text-gray-600">Clock Status</p>
                      <p className="text-lg font-semibold">{ntpStatus.status || 'N/A'}</p>
                    </div>
                    {ntpStatus.peers && (
                      <div>
                        <p className="text-sm text-gray-600 mb-2">Configured Peers</p>
                        <ul className="space-y-1">
                          {ntpStatus.peers.map((peer: any, idx: number) => (
                            <li key={idx} className="text-sm font-mono">
                              {peer}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500">NTP not configured</p>
                )}
              </div>
            )}

            {/* DHCP Pools Tab */}
            {activeTab === 'dhcp' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">DHCP Pools</h3>
                <div className="grid gap-4">
                  {dhcpPools.length > 0 ? (
                    dhcpPools.map((pool, idx) => (
                      <div key={idx} className="bg-gray-50 p-4 rounded border border-gray-200">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-gray-600">Pool Name</p>
                            <p className="font-semibold">{pool.name}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600">Network</p>
                            <p className="font-mono">{pool.network}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600">Utilization</p>
                            <p>{pool.utilization}%</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600">Leased Addresses</p>
                            <p>{pool.leased}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500">No DHCP pools configured</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Route Modal */}
      {addRouteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Add Static Route</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Network Prefix
                </label>
                <input
                  type="text"
                  value={newRoute.prefix}
                  onChange={(e) => setNewRoute({ ...newRoute, prefix: e.target.value })}
                  placeholder="10.0.0.0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subnet Mask
                </label>
                <input
                  type="text"
                  value={newRoute.mask}
                  onChange={(e) => setNewRoute({ ...newRoute, mask: e.target.value })}
                  placeholder="255.255.255.0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Next Hop
                </label>
                <input
                  type="text"
                  value={newRoute.next_hop}
                  onChange={(e) => setNewRoute({ ...newRoute, next_hop: e.target.value })}
                  placeholder="192.168.1.254"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Distance (AD)
                </label>
                <input
                  type="number"
                  value={newRoute.distance}
                  onChange={(e) =>
                    setNewRoute({ ...newRoute, distance: parseInt(e.target.value) })
                  }
                  min="1"
                  max="255"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setAddRouteModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleAddRoute}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 font-medium"
              >
                {loading ? 'Adding...' : 'Add'}
              </button>
            </div>
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
