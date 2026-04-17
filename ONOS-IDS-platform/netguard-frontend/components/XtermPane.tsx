'use client';

import { useEffect, useRef } from 'react';
import type { Terminal as XTerm } from '@xterm/xterm';

interface XtermPaneProps {
  wsUrl: string;          // full ws:// URL (token must be already appended)
  active: boolean;        // only the active pane auto-focuses
  onStatusChange?: (s: 'connecting' | 'open' | 'closed' | 'error') => void;
}

export function XtermPane({ wsUrl, active, onStatusChange }: XtermPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    let ro: ResizeObserver | null = null;

    async function init() {
      const [{ Terminal }, { FitAddon }, { WebLinksAddon }] = await Promise.all([
        import('@xterm/xterm'),
        import('@xterm/addon-fit'),
        import('@xterm/addon-web-links'),
      ]);
      await import('@xterm/xterm/css/xterm.css');

      if (cancelled || !containerRef.current) return;

      const term = new Terminal({
        fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
        fontSize: 13,
        theme: {
          background: '#0b1120',
          foreground: '#e2e8f0',
          cursor: '#22d3ee',
          selectionBackground: '#334155',
          black: '#0f172a', red: '#f87171', green: '#4ade80', yellow: '#facc15',
          blue: '#60a5fa', magenta: '#c084fc', cyan: '#22d3ee', white: '#e2e8f0',
        },
        cursorBlink: true,
        scrollback: 5000,
      });
      const fit = new FitAddon();
      const links = new WebLinksAddon();
      term.loadAddon(fit);
      term.loadAddon(links);
      term.open(containerRef.current);
      fit.fit();
      termRef.current = term;
      fitRef.current = fit;

      onStatusChange?.('connecting');

      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        onStatusChange?.('open');
        const { cols, rows } = term;
        ws.send(JSON.stringify({ type: 'resize', cols, rows }));
      };
      ws.onmessage = (evt) => {
        if (typeof evt.data === 'string') {
          term.write(evt.data);
        } else {
          const data = new Uint8Array(evt.data as ArrayBuffer);
          term.write(data);
        }
      };
      ws.onclose = () => {
        onStatusChange?.('closed');
        term.write('\r\n\x1b[33m[connection closed]\x1b[0m\r\n');
      };
      ws.onerror = () => {
        onStatusChange?.('error');
        term.write('\r\n\x1b[31m[connection error]\x1b[0m\r\n');
      };

      term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(data);
      });

      term.onResize(({ cols, rows }) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'resize', cols, rows }));
        }
      });

      ro = new ResizeObserver(() => {
        try { fit.fit(); } catch {}
      });
      ro.observe(containerRef.current);
    }

    void init();

    return () => {
      cancelled = true;
      if (ro) ro.disconnect();
      try { wsRef.current?.close(); } catch {}
      try { termRef.current?.dispose(); } catch {}
      wsRef.current = null; termRef.current = null; fitRef.current = null;
    };
  }, [wsUrl, onStatusChange]);

  useEffect(() => {
    if (active) {
      setTimeout(() => {
        try { fitRef.current?.fit(); } catch {}
        termRef.current?.focus();
      }, 50);
    }
  }, [active]);

  return <div ref={containerRef} className="h-full w-full" />;
}
