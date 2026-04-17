'use client';

import { useState, useEffect, useRef } from 'react';
import { Terminal, Wifi, AlertCircle, RefreshCw, Copy, Power } from 'lucide-react';
import type { Terminal as XTerm } from '@xterm/xterm';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function wsBase(): string {
  const u = new URL(API_URL);
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  return u.toString().replace(/\/$/, '');
}

export default function CiscoTerminalPage() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitRef = useRef<{ fit: () => void } | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionInfo, setConnectionInfo] = useState({
    host: '192.168.1.1',
    port: '22',
    username: 'admin',
    password: 'cisco',
  });

  // Initialize xterm
  useEffect(() => {
    let cancelled = false;
    let handleResize: (() => void) | null = null;
    let term: XTerm | null = null;

    async function init() {
      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import('@xterm/xterm'),
        import('@xterm/addon-fit'),
      ]);
      await import('@xterm/xterm/css/xterm.css');

      if (cancelled || !terminalRef.current) return;

      term = new Terminal({
        rows: 30,
        cols: 100,
        theme: {
          background: '#1e1e1e',
          foreground: '#d4d4d4',
          cursor: '#aeafad',
          cursorAccent: '#ffffff',
        },
        fontSize: 14,
        fontFamily: '"Courier New", Courier, monospace',
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(terminalRef.current);
      fitAddon.fit();

      xtermRef.current = term;
      fitRef.current = fitAddon;

      handleResize = () => {
        try {
          fitAddon.fit();
          if (wsRef.current?.readyState === WebSocket.OPEN && term) {
            wsRef.current.send(
              JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows })
            );
          }
        } catch (e) {
          console.error('Resize error:', e);
        }
      };
      window.addEventListener('resize', handleResize);

      term.onData((data: string) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(data);
        }
      });
    }

    init().catch((err) => {
      setError(`Failed to initialize terminal: ${err}`);
      console.error('xterm initialization error:', err);
    });

    return () => {
      cancelled = true;
      if (handleResize) window.removeEventListener('resize', handleResize);
      try { term?.dispose(); } catch {}
      xtermRef.current = null;
      fitRef.current = null;
    };
  }, []);

  // Connect to WebSocket
  const handleConnect = async () => {
    if (connected) {
      handleDisconnect();
      return;
    }

    if (!connectionInfo.host) {
      setError('Please enter a host');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get auth token (from sessionStorage or localStorage)
      const token = sessionStorage.getItem('access_token') || localStorage.getItem('access_token') || '';

      // Build WebSocket URL
      const params = new URLSearchParams({
        token,
        host: connectionInfo.host,
        port: connectionInfo.port,
        username: connectionInfo.username,
        password: connectionInfo.password,
      });

      const wsUrl = `${wsBase()}/api/cisco/terminal?${params}`;
      console.log('Connecting to:', wsUrl);

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket connected');
        setConnected(true);
        setLoading(false);
        if (xtermRef.current) {
          xtermRef.current.write('\r\n[Connected to Cisco device]\r\n');
        }
      };

      ws.onmessage = (event) => {
        if (xtermRef.current) {
          try {
            const data = JSON.parse(event.data);
            if (data.error) {
              xtermRef.current.write(`\r\n[ERROR] ${data.error}\r\n`);
            } else if (data.type === 'closed') {
              xtermRef.current.write('\r\n[Connection closed]\r\n');
              setConnected(false);
              wsRef.current = null;
            }
          } catch {
            // Text data, print directly
            xtermRef.current.write(event.data);
          }
        }
      };

      ws.onerror = () => {
        const errorMsg = 'WebSocket error';
        setError(errorMsg);
        if (xtermRef.current) {
          xtermRef.current.write(`\r\n[ERROR] ${errorMsg}\r\n`);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket closed');
        setConnected(false);
        wsRef.current = null;
      };

      wsRef.current = ws;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      setError(msg);
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      setConnected(false);
    }
  };

  const handleClear = () => {
    if (xtermRef.current) {
      xtermRef.current.clear();
    }
  };

  const handleCopyOutput = () => {
    if (xtermRef.current) {
      const buffer = xtermRef.current.buffer.active;
      const lines = [];
      for (let i = 0; i < buffer.length; i++) {
        lines.push(buffer.getLine(i)?.translateToString() || '');
      }
      const text = lines.join('\n');
      navigator.clipboard.writeText(text).then(() => {
        alert('Terminal output copied to clipboard');
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Cisco Terminal</h1>
          <p className="text-gray-600 mt-1">Interactive SSH terminal to Cisco CSR1000V</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100">
            <Wifi size={16} className={connected ? 'text-green-600' : 'text-gray-400'} />
            <span className="text-sm font-medium">
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      {/* Connection Settings */}
      {!connected && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Connection Settings</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Host
              </label>
              <input
                type="text"
                value={connectionInfo.host}
                onChange={(e) =>
                  setConnectionInfo({ ...connectionInfo, host: e.target.value })
                }
                placeholder="192.168.1.1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Port
              </label>
              <input
                type="number"
                value={connectionInfo.port}
                onChange={(e) =>
                  setConnectionInfo({ ...connectionInfo, port: e.target.value })
                }
                placeholder="22"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                type="text"
                value={connectionInfo.username}
                onChange={(e) =>
                  setConnectionInfo({ ...connectionInfo, username: e.target.value })
                }
                placeholder="admin"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                value={connectionInfo.password}
                onChange={(e) =>
                  setConnectionInfo({ ...connectionInfo, password: e.target.value })
                }
                placeholder="••••••"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={18} />
              <div>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          <button
            onClick={handleConnect}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
          >
            {loading ? (
              <>
                <RefreshCw size={18} className="animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Wifi size={18} />
                Connect
              </>
            )}
          </button>
        </div>
      )}

      {/* Terminal */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="bg-gray-900 text-white p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal size={18} />
            <span className="font-medium">
              {connectionInfo.host}:{connectionInfo.port}
            </span>
          </div>
          <div className="flex gap-2">
            {connected && (
              <>
                <button
                  onClick={handleCopyOutput}
                  className="p-2 hover:bg-gray-700 rounded-lg transition"
                  title="Copy output"
                >
                  <Copy size={18} />
                </button>
                <button
                  onClick={handleClear}
                  className="p-2 hover:bg-gray-700 rounded-lg transition"
                  title="Clear terminal"
                >
                  <RefreshCw size={18} />
                </button>
                <button
                  onClick={handleDisconnect}
                  className="p-2 hover:bg-red-700 rounded-lg transition"
                  title="Disconnect"
                >
                  <Power size={18} />
                </button>
              </>
            )}
          </div>
        </div>

        <div
          ref={terminalRef}
          className="bg-black p-4"
          style={{ height: '500px', width: '100%' }}
        />
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">Tips</h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Type commands directly into the terminal</li>
          <li>Use Ctrl+C to interrupt commands</li>
          <li>Use 'exit' or 'quit' to logout</li>
          <li>Terminal supports standard Cisco IOS/IOS-XE commands</li>
        </ul>
      </div>
    </div>
  );
}
