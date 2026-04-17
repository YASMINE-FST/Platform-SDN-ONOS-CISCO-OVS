'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Core as CytoscapeCore } from 'cytoscape';

type CytoscapeFactory = typeof import('cytoscape');
let cytoscape: CytoscapeFactory | null = null;

export type LayoutMode = 'cose' | 'breadthfirst' | 'circle' | 'grid' | 'concentric';
export type LoadState = 'hot' | 'warm' | 'nominal' | 'unknown';

export interface TopoNode {
  id: string;
  label: string;
  kind: 'switch' | 'router' | 'host';
  status: 'active' | 'inactive';
  subtitle?: string;
  flows?: number;
  utilization?: number;
}

export interface TopoEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  loadState?: LoadState;
  utilization?: number;
  enabled?: boolean;
  kind?: 'infrastructure' | 'access';
}

interface Props {
  nodes: TopoNode[];
  edges: TopoEdge[];
  layout?: LayoutMode;
  showEdgeLabels?: boolean;
  selectedNode?: string | null;
  selectedEdge?: string | null;
  highlightedNodeIds?: string[];
  highlightedEdgeIds?: string[];
  onNodeClick?: (id: string | null) => void;
  onEdgeClick?: (id: string | null) => void;
  onBackgroundClick?: () => void;
}

// ── SVG icons encoded as data URIs ──────────────────────────────────
function svgUri(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const SWITCH_ICON = svgUri(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none'
     stroke='white' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'>
    <rect x='1' y='7' width='22' height='10' rx='2'/>
    <path d='M5 7V5M8 7V5M12 7V5M16 7V5M19 7V5'/>
    <circle cx='5' cy='12' r='0.8' fill='white' stroke='none'/>
    <circle cx='9' cy='12' r='0.8' fill='white' stroke='none'/>
    <circle cx='13' cy='12' r='0.8' fill='white' stroke='none'/>
    <circle cx='17' cy='12' r='0.8' fill='white' stroke='none'/>
  </svg>`
);

const ROUTER_ICON = svgUri(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none'
     stroke='white' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'>
    <circle cx='12' cy='12' r='9'/>
    <path d='M8 10h8M8 14h8'/>
    <path d='M2 12h2M20 12h2M12 2v2M12 20v2'/>
  </svg>`
);

const HOST_ICON = svgUri(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none'
     stroke='white' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'>
    <rect x='2' y='4' width='20' height='13' rx='2'/>
    <path d='M8 21h8M12 17v4'/>
  </svg>`
);

function dedupEdges(edges: TopoEdge[]): TopoEdge[] {
  const seen = new Set<string>();
  return edges.filter((e) => {
    const a = `${e.source}||${e.target}`;
    const b = `${e.target}||${e.source}`;
    if (seen.has(a) || seen.has(b)) return false;
    seen.add(a);
    return true;
  });
}

function getLayout(layout: LayoutMode) {
  switch (layout) {
    case 'breadthfirst':
      return { name: 'breadthfirst', directed: false, padding: 40, spacingFactor: 1.25, animate: false };
    case 'circle':
      return { name: 'circle', padding: 50, spacingFactor: 1.2, animate: false };
    case 'grid':
      return { name: 'grid', padding: 40, animate: false };
    case 'concentric':
      return { name: 'concentric', padding: 40, animate: false, minNodeSpacing: 40 };
    case 'cose':
    default:
      return {
        name: 'cose', animate: false, padding: 40,
        nodeRepulsion: 8000, idealEdgeLength: 90, edgeElasticity: 100,
        gravity: 0.6, numIter: 1000, coolingFactor: 0.97, minTemp: 1.0,
      };
  }
}

export function TopologyMap({
  nodes, edges, layout = 'cose',
  showEdgeLabels = true,
  selectedNode, selectedEdge,
  highlightedNodeIds = [], highlightedEdgeIds = [],
  onNodeClick, onEdgeClick, onBackgroundClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<CytoscapeCore | null>(null);
  const [ready, setReady] = useState(Boolean(cytoscape));

  const hlNodes = useMemo(() => new Set(highlightedNodeIds), [highlightedNodeIds]);
  const hlEdges = useMemo(() => new Set(highlightedEdgeIds), [highlightedEdgeIds]);
  const uniqueEdges = useMemo(() => dedupEdges(edges), [edges]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (cytoscape) { setReady(true); return; }
      const m = await import('cytoscape');
      cytoscape = (m.default ?? m) as unknown as CytoscapeFactory;
      if (!cancelled) setReady(true);
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!containerRef.current || !ready || !cytoscape) return;
    if (cyRef.current) { cyRef.current.destroy(); cyRef.current = null; }

    const elements = [
      ...nodes.map((n) => ({
        data: {
          id: n.id, label: n.label, subtitle: n.subtitle || '',
          flows: n.flows ?? 0, util: n.utilization ?? 0,
        },
        classes: [
          n.kind, n.status,
          hlNodes.has(n.id) ? 'path-highlight' : '',
          selectedNode === n.id ? 'selected' : '',
        ].filter(Boolean).join(' '),
      })),
      ...uniqueEdges.map((e) => ({
        data: { id: e.id, source: e.source, target: e.target, label: showEdgeLabels ? e.label || '' : '' },
        classes: [
          e.kind || 'infrastructure',
          e.loadState || 'unknown',
          e.enabled === false ? 'disabled' : '',
          hlEdges.has(e.id) ? 'path-highlight' : '',
          selectedEdge === e.id ? 'edge-selected' : '',
        ].filter(Boolean).join(' '),
      })),
    ];

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      wheelSensitivity: 0.3,
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            'text-valign': 'bottom',
            'text-halign': 'center',
            'text-margin-y': 8,
            color: '#e2e8f0',
            'font-size': '11px',
            'font-weight': 600,
            'text-outline-color': '#0f172a',
            'text-outline-width': 2,
            'background-fit': 'contain',
            'background-image-opacity': 0.95,
            'border-width': 2,
            width: 48, height: 48,
          },
        },
        {
          selector: 'node.switch',
          style: {
            shape: 'round-rectangle',
            'background-color': '#0f766e',
            'border-color': '#5eead4',
            'background-image': SWITCH_ICON,
            width: 54, height: 40,
          },
        },
        {
          selector: 'node.router',
          style: {
            shape: 'ellipse',
            'background-color': '#0369a1',
            'border-color': '#7dd3fc',
            'background-image': ROUTER_ICON,
            width: 48, height: 48,
          },
        },
        {
          selector: 'node.host',
          style: {
            shape: 'ellipse',
            'background-color': '#155e75',
            'border-color': '#67e8f9',
            'background-image': HOST_ICON,
            width: 36, height: 36,
          },
        },
        {
          selector: 'node.inactive',
          style: { 'background-color': '#3f3f46', 'border-color': '#71717a', opacity: 0.65 },
        },
        {
          selector: 'node.path-highlight',
          style: { 'border-width': 4, 'border-color': '#facc15' },
        },
        {
          selector: 'node.selected',
          style: { 'border-width': 5, 'border-color': '#fde047' },
        },
        // Edges
        {
          selector: 'edge',
          style: {
            width: 2.4,
            'line-color': '#64748b',
            'curve-style': 'straight',
            label: 'data(label)',
            'font-size': '9px',
            'text-background-color': '#0b1120',
            'text-background-opacity': 0.9,
            'text-background-padding': '2px',
            color: '#cbd5e1',
          },
        },
        { selector: 'edge.access', style: { 'line-style': 'dotted', 'line-color': '#2dd4bf', width: 1.8 } },
        { selector: 'edge.nominal', style: { 'line-color': '#22c55e', width: 2.6 } },
        { selector: 'edge.warm', style: { 'line-color': '#f59e0b', width: 3.2 } },
        { selector: 'edge.hot', style: { 'line-color': '#ef4444', width: 4 } },
        { selector: 'edge.unknown', style: { 'line-color': '#64748b' } },
        { selector: 'edge.disabled', style: { 'line-style': 'dashed', opacity: 0.5, 'line-color': '#94a3b8' } },
        { selector: 'edge.path-highlight', style: { width: 4.5, 'line-color': '#facc15' } },
        { selector: 'edge.edge-selected', style: { width: 5, 'line-color': '#38bdf8' } },
      ],
      layout: getLayout(layout),
    } as never);

    cy.on('tap', 'node', (evt: { target: { id: () => string } }) => {
      onNodeClick?.(evt.target.id());
      onEdgeClick?.(null);
    });
    cy.on('tap', 'edge', (evt: { target: { id: () => string } }) => {
      onEdgeClick?.(evt.target.id());
      onNodeClick?.(null);
    });
    cy.on('tap', (evt: { target: unknown }) => {
      if (evt.target === cy) {
        onBackgroundClick?.();
        onNodeClick?.(null);
        onEdgeClick?.(null);
      }
    });

    cy.fit(undefined, 40);
    cyRef.current = cy;
    return () => { cy.destroy(); cyRef.current = null; };
  }, [
    ready, uniqueEdges, nodes, hlNodes, hlEdges, layout, showEdgeLabels,
    selectedNode, selectedEdge, onNodeClick, onEdgeClick, onBackgroundClick,
  ]);

  return (
    <div className="h-full w-full overflow-hidden rounded-xl border border-border bg-slate-950">
      <div ref={containerRef} className="h-full min-h-[520px] w-full" style={{ background: '#0a0f1a' }} />
    </div>
  );
}
