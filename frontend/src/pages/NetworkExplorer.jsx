/**
 * NetworkExplorer — Network topology view for GLS Hamburg SME network
 *
 * Features:
 * - D3.js force-directed graph consuming /network/topology API
 * - Nodes colored by industry cluster (3 clusters)
 * - Connected components shown with convex hull backgrounds
 * - Inter-cluster gaps highlighted with dashed arc annotations
 * - Click/hover: company name, cluster, total invoice volume
 * - Large text/nodes for projector readability
 */
import React, { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { networkApi } from '../api/network.js'
import '../styles/network-explorer.css'

// ── Cluster color palette ──────────────────────────────────────────────────
const CLUSTER_COLORS = {
  'Port & Logistik':       '#2c6e8a',
  'Handwerk & Bau':        '#7a5c2c',
  'Gastronomie & Handel':  '#4a7c59',
}
const CLUSTER_COLORS_LIGHT = {
  'Port & Logistik':       'rgba(44,110,138,0.12)',
  'Handwerk & Bau':        'rgba(122,92,44,0.12)',
  'Gastronomie & Handel':  'rgba(74,124,89,0.12)',
}
const DEFAULT_COLOR = '#6e6460'

function clusterColor(cluster)      { return CLUSTER_COLORS[cluster]      || DEFAULT_COLOR }
function clusterColorLight(cluster) { return CLUSTER_COLORS_LIGHT[cluster] || 'rgba(110,100,96,0.1)' }

// ── Mock fallback data (used when API unavailable) ─────────────────────────
const MOCK_NODES = [
  { id: 'A1', name: 'HafenLogistik GmbH',    sector: 'port_logistics', cluster: 'Port & Logistik',      total_invoice_volume_cents: 980000, net_position_cents:  142000, component_id: 0 },
  { id: 'A2', name: 'Nordsee Shipping AG',   sector: 'port_logistics', cluster: 'Port & Logistik',      total_invoice_volume_cents: 720000, net_position_cents:  -67200, component_id: 0 },
  { id: 'A3', name: 'Elbe Import Export',    sector: 'port_logistics', cluster: 'Port & Logistik',      total_invoice_volume_cents: 540000, net_position_cents:   55000, component_id: 0 },
  { id: 'B1', name: 'Handwerk Hamburg GmbH', sector: 'handwerk',       cluster: 'Handwerk & Bau',       total_invoice_volume_cents: 620000, net_position_cents:   88000, component_id: 1 },
  { id: 'B2', name: 'Altonaer Bau KG',      sector: 'handwerk',       cluster: 'Handwerk & Bau',       total_invoice_volume_cents: 430000, net_position_cents:  -44800, component_id: 1 },
  { id: 'B3', name: 'Wandsbek Technik GmbH', sector: 'handwerk',       cluster: 'Handwerk & Bau',       total_invoice_volume_cents: 380000, net_position_cents:   31000, component_id: 2 },
  { id: 'C1', name: 'Bergedorfer Gastro AG', sector: 'gastronomie',    cluster: 'Gastronomie & Handel', total_invoice_volume_cents: 810000, net_position_cents:   98500, component_id: 3 },
  { id: 'C2', name: 'Eimsbüttel Catering',   sector: 'gastronomie',    cluster: 'Gastronomie & Handel', total_invoice_volume_cents: 490000, net_position_cents:  -28000, component_id: 3 },
  { id: 'C3', name: 'Rahlstedt Frische KG',  sector: 'gastronomie',    cluster: 'Gastronomie & Handel', total_invoice_volume_cents: 350000, net_position_cents:   19500, component_id: 3 },
]
const MOCK_EDGES = [
  { source: 'A1', target: 'A2', total_amount_cents: 320000 },
  { source: 'A2', target: 'A3', total_amount_cents: 210000 },
  { source: 'A3', target: 'A1', total_amount_cents: 180000 },
  { source: 'B1', target: 'B2', total_amount_cents: 270000 },
  { source: 'B2', target: 'B1', total_amount_cents: 140000 },
  { source: 'C1', target: 'C2', total_amount_cents: 300000 },
  { source: 'C2', target: 'C3', total_amount_cents: 190000 },
  { source: 'C3', target: 'C1', total_amount_cents: 110000 },
]
const MOCK_GAPS = [
  { cluster_a: 'Port & Logistik', cluster_b: 'Handwerk & Bau' },
  { cluster_a: 'Handwerk & Bau',  cluster_b: 'Gastronomie & Handel' },
]
const MOCK_CLUSTERS = ['Port & Logistik', 'Handwerk & Bau', 'Gastronomie & Handel']

// ── Helpers ────────────────────────────────────────────────────────────────
function formatEur(cents) {
  const v = cents / 100
  if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1).replace('.', ',') + ' Mio €'
  if (Math.abs(v) >= 1_000)     return Math.round(v / 1_000) + ' Tsd €'
  return v.toLocaleString('de-DE') + ' €'
}

// Compute convex hull of node positions for one component/cluster group
function hullPoints(nodes) {
  if (nodes.length === 0) return null
  if (nodes.length === 1) {
    const { x, y } = nodes[0]
    const r = 48
    return [[x - r, y - r], [x + r, y - r], [x + r, y + r], [x - r, y + r]]
  }
  if (nodes.length === 2) {
    const dx = nodes[1].x - nodes[0].x, dy = nodes[1].y - nodes[0].y
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    const nx = -dy / len * 40, ny = dx / len * 40
    return [
      [nodes[0].x + nx, nodes[0].y + ny],
      [nodes[1].x + nx, nodes[1].y + ny],
      [nodes[1].x - nx, nodes[1].y - ny],
      [nodes[0].x - nx, nodes[0].y - ny],
    ]
  }
  return d3.polygonHull(nodes.map(n => [n.x, n.y]))
}

const NODE_R_BASE = 24
const VOL_SCALE   = d3.scaleSqrt().domain([0, 2_000_000_00]).range([NODE_R_BASE, 42]).clamp(true)
const LINK_SCALE  = d3.scaleLinear().domain([50_000_00, 5_000_000_00]).range([2, 7]).clamp(true)

// ── Component ──────────────────────────────────────────────────────────────
export default function NetworkExplorer() {
  const svgRef    = useRef(null)
  const simRef    = useRef(null)
  const nodesRef  = useRef([])
  const [selected, setSelected] = useState(null)
  const [hovered,  setHovered]  = useState(null)
  const [topology, setTopology] = useState(null)
  const [usingMock, setUsingMock] = useState(false)

  // Load topology from API
  useEffect(() => {
    networkApi.topology()
      .then(data => {
        if (data?.nodes?.length) {
          setTopology(data)
        } else {
          setTopology({ nodes: MOCK_NODES, edges: MOCK_EDGES, gaps: MOCK_GAPS, clusters: MOCK_CLUSTERS })
          setUsingMock(true)
        }
      })
      .catch(() => {
        setTopology({ nodes: MOCK_NODES, edges: MOCK_EDGES, gaps: MOCK_GAPS, clusters: MOCK_CLUSTERS })
        setUsingMock(true)
      })
  }, [])

  // Build D3 simulation when topology loads
  useEffect(() => {
    if (!topology || !svgRef.current) return

    const { nodes: rawNodes, edges: rawEdges, gaps, clusters } = topology

    const svg    = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const width  = svgRef.current.clientWidth  || 900
    const height = svgRef.current.clientHeight || 580

    // Deep-copy so D3 can mutate
    const nodes = rawNodes.map(n => ({ ...n }))
    const links = rawEdges.map(l => ({ ...l }))
    nodesRef.current = nodes

    // Defs: drop-shadow filter for hull
    const defs = svg.append('defs')
    defs.append('filter').attr('id', 'hull-shadow')
      .append('feDropShadow')
        .attr('dx', 0).attr('dy', 2).attr('stdDeviation', 6)
        .attr('flood-color', '#000').attr('flood-opacity', 0.08)

    // Root group (zoom target)
    const root = svg.append('g').attr('class', 'zoom-root')

    // Zoom
    const zoom = d3.zoom()
      .scaleExtent([0.2, 3])
      .on('zoom', e => root.attr('transform', e.transform))
    svg.call(zoom)
    svg.call(zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(0.9))

    // ── Force simulation ──────────────────────────────────────────────────
    // Cluster-aware: add a weak positioning force that pulls clusters apart
    const clusterList = clusters.length ? clusters : MOCK_CLUSTERS
    const clusterAngle = {}
    clusterList.forEach((c, i) => {
      clusterAngle[c] = (2 * Math.PI * i) / clusterList.length
    })
    const CLUSTER_RADIUS = Math.min(width, height) * 0.28

    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(120).strength(0.3))
      .force('charge', d3.forceManyBody().strength(-350))
      .force('center', d3.forceCenter(0, 0))
      .force('collision', d3.forceCollide(d => VOL_SCALE(d.total_invoice_volume_cents) + 14))
      .force('cluster-x', d3.forceX(d => CLUSTER_RADIUS * Math.cos(clusterAngle[d.cluster] || 0)).strength(0.12))
      .force('cluster-y', d3.forceY(d => CLUSTER_RADIUS * Math.sin(clusterAngle[d.cluster] || 0)).strength(0.12))
    simRef.current = sim

    // ── Gap annotations (dashed arcs between cluster centroids) ──────────
    const gapLayer = root.append('g').attr('class', 'gap-layer')
    const hullLayer = root.append('g').attr('class', 'hull-layer')
    const linkLayer = root.append('g').attr('class', 'link-layer')
    const nodeLayer = root.append('g').attr('class', 'node-layer')

    // We'll draw gap lines after simulation warms up, updated on tick
    const gapLines = gapLayer.selectAll('g.gap')
      .data(gaps)
      .join('g').attr('class', 'gap')

    gapLines.append('line')
      .attr('stroke', '#e05a3a')
      .attr('stroke-width', 2.5)
      .attr('stroke-dasharray', '8,6')
      .attr('stroke-opacity', 0.7)

    gapLines.append('text')
      .attr('text-anchor', 'middle')
      .attr('fill', '#e05a3a')
      .attr('font-size', '11')
      .attr('font-weight', '700')
      .attr('pointer-events', 'none')
      .text('GAP')

    // ── Convex hull backgrounds per connected component ───────────────────
    // Group nodes by component_id
    const componentGroups = d3.group(nodes, d => d.component_id)
    const hullPaths = hullLayer.selectAll('path.hull')
      .data([...componentGroups.entries()])
      .join('path')
        .attr('class', 'hull')
        .attr('fill', ([, members]) => clusterColorLight(members[0]?.cluster || ''))
        .attr('stroke', ([, members]) => clusterColor(members[0]?.cluster || ''))
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4,3')
        .attr('stroke-opacity', 0.5)
        .attr('filter', 'url(#hull-shadow)')

    // ── Links ─────────────────────────────────────────────────────────────
    const linkSel = linkLayer.selectAll('line')
      .data(links)
      .join('line')
        .attr('stroke', d => {
          const srcNode = nodes.find(n => n.id === (d.source?.id || d.source))
          return clusterColor(srcNode?.cluster || '')
        })
        .attr('stroke-width', d => LINK_SCALE(d.total_amount_cents))
        .attr('stroke-opacity', 0.45)

    // ── Nodes ─────────────────────────────────────────────────────────────
    const nodeSel = nodeLayer.selectAll('g.node-group')
      .data(nodes)
      .join('g')
        .attr('class', 'node-group')
        .style('cursor', 'pointer')
        .call(
          d3.drag()
            .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
            .on('drag',  (e, d) => { d.fx = e.x; d.fy = e.y })
            .on('end',   (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null })
        )
        .on('click', (e, d) => {
          e.stopPropagation()
          setSelected(prev => prev === d.id ? null : d.id)
        })
        .on('mouseenter', (e, d) => setHovered(d.id))
        .on('mouseleave', ()      => setHovered(null))

    nodeSel.append('circle')
      .attr('r', d => VOL_SCALE(d.total_invoice_volume_cents))
      .attr('fill', d => clusterColor(d.cluster))
      .attr('fill-opacity', 0.18)
      .attr('stroke', d => clusterColor(d.cluster))
      .attr('stroke-width', 3)

    // Short company name label (first word, max 8 chars) — large for projector
    nodeSel.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '11')
      .attr('font-weight', '800')
      .attr('fill', d => clusterColor(d.cluster))
      .attr('pointer-events', 'none')
      .text(d => (d.name || d.id).split(' ')[0].slice(0, 8))

    // Deselect on canvas click
    svg.on('click', () => { setSelected(null); setHovered(null) })

    // ── Cluster centroid helpers ──────────────────────────────────────────
    function clusterCentroid(clusterName) {
      const members = nodes.filter(n => n.cluster === clusterName)
      if (!members.length) return { x: 0, y: 0 }
      const x = members.reduce((s, n) => s + (n.x || 0), 0) / members.length
      const y = members.reduce((s, n) => s + (n.y || 0), 0) / members.length
      return { x, y }
    }

    sim.on('tick', () => {
      // Links
      linkSel
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y)

      // Nodes
      nodeSel.attr('transform', d => `translate(${d.x},${d.y})`)

      // Convex hulls per connected component
      hullPaths.attr('d', ([, members]) => {
        const pts = hullPoints(members.filter(n => n.x != null))
        if (!pts) return ''
        if (pts.length < 3) return ''
        // expand hull outward by 36px
        const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length
        const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length
        const expanded = pts.map(([px, py]) => {
          const dx = px - cx, dy = py - cy
          const len = Math.sqrt(dx * dx + dy * dy) || 1
          return [px + (dx / len) * 36, py + (dy / len) * 36]
        })
        return 'M' + expanded.join('L') + 'Z'
      })

      // Gap annotations between cluster centroids
      gapLines.select('line').each(function(gap) {
        const ca = clusterCentroid(gap.cluster_a)
        const cb = clusterCentroid(gap.cluster_b)
        d3.select(this)
          .attr('x1', ca.x).attr('y1', ca.y)
          .attr('x2', cb.x).attr('y2', cb.y)
      })
      gapLines.select('text').each(function(gap) {
        const ca = clusterCentroid(gap.cluster_a)
        const cb = clusterCentroid(gap.cluster_b)
        d3.select(this)
          .attr('x', (ca.x + cb.x) / 2)
          .attr('y', (ca.y + cb.y) / 2 - 8)
      })
    })

    return () => { sim.stop(); svg.on('click', null) }
  }, [topology])

  // Highlight on select/hover
  useEffect(() => {
    const svg = d3.select(svgRef.current)
    const active = selected || hovered
    if (!active) {
      svg.selectAll('.node-group circle').attr('fill-opacity', 0.18).attr('stroke-width', 3)
      svg.selectAll('.link-layer line').attr('stroke-opacity', 0.45)
      return
    }
    svg.selectAll('.node-group').each(function(d) {
      const isActive = d.id === active
      d3.select(this).select('circle')
        .attr('fill-opacity', isActive ? 0.40 : 0.10)
        .attr('stroke-width',  isActive ? 5    : 2)
    })
    svg.selectAll('.link-layer line').attr('stroke-opacity', d => {
      const sid = d.source?.id || d.source
      const tid = d.target?.id || d.target
      return (sid === active || tid === active) ? 0.85 : 0.08
    })
  }, [selected, hovered])

  const nodes   = topology?.nodes   || []
  const edges   = topology?.edges   || []
  const gaps    = topology?.gaps    || []
  const clusters = topology?.clusters || []

  const activeId   = selected || hovered
  const activeNode = activeId ? nodes.find(n => n.id === activeId) : null
  const activeLinks = activeId
    ? edges.filter(l => {
        const s = l.source?.id || l.source
        const t = l.target?.id || l.target
        return s === activeId || t === activeId
      })
    : []

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Netzwerk-Topologie</h1>
        <p className="page-subtitle">
          {nodes.length} Hamburger KMUs · {clusters.length} Branchencluster · {gaps.length} fehlende Verbindungen (Gaps)
          {usingMock && <span style={{ color: 'var(--color-warning)', marginLeft: 8 }}>· Demo-Daten</span>}
        </p>
      </div>

      <div className="network-layout">
        {/* Graph */}
        <div className="card network-card">
          <div className="network-hint">
            Scrollen zum Zoomen · Ziehen zum Verschieben · Knoten anklicken
          </div>
          <svg ref={svgRef} className="network-svg" width="100%" height="580" />
        </div>

        {/* Sidebar */}
        <div className="network-sidebar">
          {/* Cluster legend */}
          <div className="card">
            <h3 className="toolbar-title" style={{ marginBottom: 'var(--space-4)' }}>Branchencluster</h3>
            {clusters.map(c => (
              <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                <span style={{
                  width: 14, height: 14, borderRadius: '50%',
                  background: clusterColor(c), flexShrink: 0,
                }} />
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text)', fontWeight: 600 }}>{c}</span>
              </div>
            ))}

            {gaps.length > 0 && (
              <>
                <div style={{ borderTop: '1px solid var(--color-border)', margin: 'var(--space-4) 0' }} />
                <h3 className="toolbar-title" style={{ marginBottom: 'var(--space-3)', color: '#e05a3a' }}>
                  Strukturelle Gaps
                </h3>
                {gaps.map((g, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                    marginBottom: 'var(--space-2)',
                    padding: 'var(--space-2) var(--space-3)',
                    background: 'rgba(224,90,58,0.07)',
                    borderRadius: 'var(--radius-sm)',
                    borderLeft: '3px solid #e05a3a',
                  }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                      {g.cluster_a} ↔ {g.cluster_b}
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Selected/hovered node detail */}
          {activeNode ? (
            <div className="card network-detail-card">
              <h3 style={{
                fontSize: 'var(--font-size-md)', fontWeight: 700,
                marginBottom: 'var(--space-2)',
                color: clusterColor(activeNode.cluster),
              }}>
                {activeNode.name}
              </h3>
              <div style={{ marginBottom: 'var(--space-3)', display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                <span className="badge badge-gray">{activeNode.cluster}</span>
                <span className="badge badge-gray">{activeNode.sector}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                <div>
                  <div className="kpi-label">Rechnungsvolumen</div>
                  <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--color-text)' }}>
                    {formatEur(activeNode.total_invoice_volume_cents)}
                  </div>
                </div>
                <div>
                  <div className="kpi-label">Netto-Position</div>
                  <div style={{
                    fontSize: 'var(--font-size-lg)', fontWeight: 800,
                    color: activeNode.net_position_cents >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
                  }}>
                    {activeNode.net_position_cents >= 0 ? '+' : ''}{formatEur(activeNode.net_position_cents)}
                  </div>
                </div>
              </div>

              <div className="kpi-label" style={{ marginBottom: 'var(--space-2)' }}>
                Rechnungsbeziehungen ({activeLinks.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {activeLinks.slice(0, 8).map((l, i) => {
                  const src = l.source?.id || l.source
                  const tgt = l.target?.id || l.target
                  const isOut = src === activeId
                  const otherId = isOut ? tgt : src
                  const other = nodes.find(n => n.id === otherId)
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                      padding: 'var(--space-2) var(--space-3)',
                      background: 'var(--color-surface-alt)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 'var(--font-size-xs)',
                    }}>
                      <span style={{ color: isOut ? 'var(--color-danger)' : 'var(--color-success)', fontWeight: 700, fontSize: 14 }}>
                        {isOut ? '→' : '←'}
                      </span>
                      <span style={{ flex: 1, color: 'var(--color-text)' }}>{other?.name || otherId}</span>
                      <span style={{ fontWeight: 700, color: 'var(--color-text-muted)' }}>
                        {formatEur(l.total_amount_cents)}
                      </span>
                    </div>
                  )
                })}
                {activeLinks.length > 8 && (
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                    + {activeLinks.length - 8} weitere
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)' }}>
              <div style={{ fontSize: '2rem', marginBottom: 'var(--space-3)', opacity: 0.3 }}>⬡</div>
              <p style={{ fontSize: 'var(--font-size-sm)' }}>
                Klicken oder hovern Sie auf ein Unternehmen, um Details anzuzeigen.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
