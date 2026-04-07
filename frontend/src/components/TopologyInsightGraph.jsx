/**
 * TopologyInsightGraph — 9-node static clearing network topology
 *
 * Positioned in NettingVergleich between waterfall cards and company table.
 * - Fixed coordinates, NO force simulation, static on load
 * - 3 cluster zones: Port & Logistik / Lebensmittel & Gastronomie / Erneuerbare Energien
 * - Hover cycle edge → all cycle edges highlight gold + tooltip
 * - Ghost edges as dashed lines with "+" icon at midpoint
 * - Node hover → connected edges brighten, tooltip shows name/volume
 * - Node click → onDrillIn(companyId)
 * - DE + EN via t()
 */
import React, { useCallback, useRef, useState } from 'react'
import { networkApi } from '../api/network.js'
import { useApi } from '../hooks/useApi.js'
import { formatEur } from '../utils/format.js'
import { t } from '../i18n/index.js'
import { useLang } from '../hooks/useLang.js'

// ── Cluster config ─────────────────────────────────────────────────────────
const CLUSTER_ZONES = {
  'Port & Logistik': {
    color:    '#2c6e8a',
    bgColor:  'rgba(44,110,138,0.07)',
    x1: 18, x2: 282, y1: 8, y2: 258,
    labelX: 150,
    nodePositions: [
      { x: 150, y: 82 },
      { x: 80,  y: 210 },
      { x: 220, y: 210 },
    ],
  },
  'Lebensmittel & Gastronomie': {
    color:    '#4a7c59',
    bgColor:  'rgba(74,124,89,0.07)',
    x1: 318, x2: 582, y1: 8, y2: 258,
    labelX: 450,
    nodePositions: [
      { x: 450, y: 82 },
      { x: 380, y: 210 },
      { x: 520, y: 210 },
    ],
  },
  'Erneuerbare Energien': {
    color:    '#c97a2f',
    bgColor:  'rgba(201,122,47,0.07)',
    x1: 618, x2: 882, y1: 8, y2: 258,
    labelX: 750,
    nodePositions: [
      { x: 750, y: 82 },
      { x: 680, y: 210 },
      { x: 820, y: 210 },
    ],
  },
}
const CLUSTER_ORDER = [
  'Port & Logistik',
  'Lebensmittel & Gastronomie',
  'Erneuerbare Energien',
]

const NODE_R    = 18
const GOLD      = '#c97a2f'
const GHOST_COL = '#b0a89e'

// ── Mock fallback ──────────────────────────────────────────────────────────
const MOCK_CLEARING_PATHS = {
  subgraph_nodes: ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3'],
  subgraph_edges: [
    { from: 'A1', to: 'A2', gross_cents: 320000, residual_cents: 180000, clearing_type: 'cycle'     },
    { from: 'A2', to: 'A3', gross_cents: 210000, residual_cents:  90000, clearing_type: 'cycle'     },
    { from: 'A3', to: 'A1', gross_cents: 180000, residual_cents:      0, clearing_type: 'cycle'     },
    { from: 'B1', to: 'B2', gross_cents: 270000, residual_cents: 130000, clearing_type: 'bilateral' },
    { from: 'B2', to: 'B3', gross_cents: 155000, residual_cents:  80000, clearing_type: 'bilateral' },
    { from: 'C1', to: 'C2', gross_cents: 300000, residual_cents: 150000, clearing_type: 'cycle'     },
    { from: 'C2', to: 'C3', gross_cents: 190000, residual_cents:  80000, clearing_type: 'cycle'     },
    { from: 'C3', to: 'C1', gross_cents: 110000, residual_cents:      0, clearing_type: 'cycle'     },
    { from: 'A2', to: 'C1', gross_cents:  95000, residual_cents:  95000, clearing_type: 'bilateral' },
  ],
  cycles: [
    { path: ['A1', 'A2', 'A3'], cleared_cents: 540000 },
    { path: ['C1', 'C2', 'C3'], cleared_cents: 330000 },
  ],
  ghost_edges: [
    {
      from: 'B2', to: 'C3',
      potential_cents: 420000,
      description_de: 'Potenzielle Verbindung durch Kandidat GmbH',
      description_en: 'Potential connection via Candidate GmbH',
    },
  ],
  nodeById: {
    A1: { id: 'A1', name: 'HafenLogistik GmbH',    cluster: 'Port & Logistik',            total_invoice_volume_cents: 980000, gls_member: true  },
    A2: { id: 'A2', name: 'Nordsee Shipping AG',   cluster: 'Port & Logistik',            total_invoice_volume_cents: 720000, gls_member: false },
    A3: { id: 'A3', name: 'Elbe Import Export',    cluster: 'Port & Logistik',            total_invoice_volume_cents: 540000, gls_member: false },
    B1: { id: 'B1', name: 'Frischmarkt Hamburg',   cluster: 'Lebensmittel & Gastronomie', total_invoice_volume_cents: 620000, gls_member: true  },
    B2: { id: 'B2', name: 'Nordkost Vertriebs AG', cluster: 'Lebensmittel & Gastronomie', total_invoice_volume_cents: 430000, gls_member: false },
    B3: { id: 'B3', name: 'Alstercafe Gruppe',     cluster: 'Lebensmittel & Gastronomie', total_invoice_volume_cents: 380000, gls_member: false },
    C1: { id: 'C1', name: 'WindKraft Hamburg',     cluster: 'Erneuerbare Energien',       total_invoice_volume_cents: 810000, gls_member: true  },
    C2: { id: 'C2', name: 'SolarDach GmbH',        cluster: 'Erneuerbare Energien',       total_invoice_volume_cents: 490000, gls_member: false },
    C3: { id: 'C3', name: 'Biogas Nord KG',        cluster: 'Erneuerbare Energien',       total_invoice_volume_cents: 350000, gls_member: false },
  },
}

// ── Helpers ────────────────────────────────────────────────────────────────
function buildPositions(subgraphNodes, nodeById) {
  const clusterGroups = {}
  for (const id of subgraphNodes) {
    const node = nodeById?.[id] || { id, cluster: 'Port & Logistik' }
    const cl = node.cluster || 'Port & Logistik'
    if (!clusterGroups[cl]) clusterGroups[cl] = []
    clusterGroups[cl].push(id)
  }
  const pos = {}
  for (const [cl, ids] of Object.entries(clusterGroups)) {
    const zone = CLUSTER_ZONES[cl]
    if (!zone) continue
    ids.forEach((id, i) => {
      pos[id] = zone.nodePositions[Math.min(i, zone.nodePositions.length - 1)]
    })
  }
  return pos
}

// Returns Map<"from→to", cycleIndex[]> for fast cycle membership lookup
function buildCycleEdgeMap(cycles) {
  const map = new Map()
  cycles.forEach((cycle, ci) => {
    const path = cycle.path
    for (let i = 0; i < path.length; i++) {
      const key = `${path[i]}→${path[(i + 1) % path.length]}`
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(ci)
    }
  })
  return map
}

// ── Tooltip overlay ────────────────────────────────────────────────────────
function Tooltip({ tooltip }) {
  if (!tooltip) return null
  return (
    <div style={{
      position:       'absolute',
      left:           tooltip.x + 12,
      top:            Math.max(4, tooltip.y - 14),
      background:     'rgba(28,24,20,0.92)',
      color:          '#f5f0eb',
      fontSize:       12,
      lineHeight:     1.45,
      borderRadius:   6,
      padding:        '6px 10px',
      pointerEvents:  'none',
      maxWidth:       260,
      zIndex:         10,
      boxShadow:      '0 2px 8px rgba(0,0,0,0.3)',
    }}>
      {tooltip.lines.map((l, i) => <div key={i}>{l}</div>)}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export default function TopologyInsightGraph({ onDrillIn }) {
  const { lang } = useLang()
  const containerRef = useRef(null)

  const { data, loading } = useApi(networkApi.clearingPaths, MOCK_CLEARING_PATHS)

  const [hoveredCycleIdx, setHoveredCycleIdx] = useState(null)
  const [hoveredGhostIdx, setHoveredGhostIdx] = useState(null)
  const [hoveredNodeId,   setHoveredNodeId]   = useState(null)
  const [tooltip,         setTooltip]         = useState(null)

  const showTooltip = useCallback((e, lines) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, lines })
  }, [])

  const hideTooltip = useCallback(() => {
    setTooltip(null)
    setHoveredCycleIdx(null)
    setHoveredGhostIdx(null)
    setHoveredNodeId(null)
  }, [])

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)', fontSize: 14 }}>
        {t('common.loading')}
      </div>
    )
  }
  if (!data) return null

  const { subgraph_nodes, subgraph_edges, cycles, ghost_edges, nodeById } = data
  const positions    = buildPositions(subgraph_nodes, nodeById)
  const cycleEdgeMap = buildCycleEdgeMap(cycles)

  // Node IDs connected to the hovered node (for dimming unrelated nodes/edges)
  const connectedToHovered = new Set()
  if (hoveredNodeId) {
    connectedToHovered.add(hoveredNodeId)
    for (const e of subgraph_edges) {
      if (e.from === hoveredNodeId || e.to === hoveredNodeId) {
        connectedToHovered.add(e.from)
        connectedToHovered.add(e.to)
      }
    }
  }

  // Edge keys belonging to the hovered cycle
  const hoveredCycleKeys = hoveredCycleIdx != null && cycles[hoveredCycleIdx]
    ? (() => {
        const s = new Set()
        const path = cycles[hoveredCycleIdx].path
        for (let i = 0; i < path.length; i++) {
          s.add(`${path[i]}→${path[(i + 1) % path.length]}`)
        }
        return s
      })()
    : null

  function edgeColor(edge) {
    const key   = `${edge.from}→${edge.to}`
    const inCycle = hoveredCycleKeys?.has(key)
    if (inCycle) return GOLD
    if (hoveredCycleIdx != null) return 'rgba(160,148,136,0.25)'
    if (hoveredNodeId && !connectedToHovered.has(edge.from) && !connectedToHovered.has(edge.to)) {
      return 'rgba(160,148,136,0.25)'
    }
    const zone = nodeById?.[edge.from] ? CLUSTER_ZONES[nodeById[edge.from].cluster] : null
    return zone?.color || '#9a8e86'
  }

  function edgeWidth(edge) {
    const key = `${edge.from}→${edge.to}`
    return hoveredCycleKeys?.has(key) ? 3.5 : 2
  }

  return (
    <div style={{ marginTop: 'var(--space-6)', marginBottom: 'var(--space-2)' }}>
      {/* Section header */}
      <h2 style={{
        fontSize:     'var(--font-size-md)',
        fontWeight:   700,
        color:        'var(--color-text)',
        marginBottom: 'var(--space-3)',
      }}>
        {t('topology.title')}
      </h2>

      {/* SVG container */}
      <div
        ref={containerRef}
        style={{
          position:     'relative',
          background:   'var(--color-surface)',
          border:       '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          overflow:     'hidden',
        }}
      >
        <svg
          viewBox="0 0 900 268"
          style={{ display: 'block', width: '100%', height: 280 }}
          onMouseLeave={hideTooltip}
        >
          <style>{`
            @keyframes _tig_pulse {
              0%   { opacity: 1; }
              40%  { opacity: 0.35; }
              100% { opacity: 1; }
            }
            ._tig_pulse { animation: _tig_pulse 0.6s ease-in-out; }
          `}</style>

          {/* Cluster background zones */}
          {CLUSTER_ORDER.map(cl => {
            const z = CLUSTER_ZONES[cl]
            return (
              <g key={cl}>
                <rect
                  x={z.x1} y={z.y1}
                  width={z.x2 - z.x1} height={z.y2 - z.y1}
                  fill={z.bgColor}
                  stroke={z.color} strokeWidth={1} strokeOpacity={0.25}
                  rx={6}
                />
                <text
                  x={z.labelX} y={z.y1 + 18}
                  textAnchor="middle"
                  fontSize={10} fontWeight={600}
                  fill={z.color} opacity={0.75}
                >
                  {cl}
                </text>
              </g>
            )
          })}

          {/* Ghost edges (drawn before regular edges so they sit underneath) */}
          {ghost_edges.map((ge, gi) => {
            const fp = positions[ge.from]
            const tp = positions[ge.to]
            if (!fp || !tp) return null
            const mx = (fp.x + tp.x) / 2
            const my = (fp.y + tp.y) / 2
            const hov = hoveredGhostIdx === gi
            return (
              <g key={`ghost-${gi}`}>
                <line
                  x1={fp.x} y1={fp.y} x2={tp.x} y2={tp.y}
                  stroke={hov ? '#7a6a5a' : GHOST_COL}
                  strokeWidth={hov ? 2 : 1.5}
                  strokeDasharray="5,4"
                  opacity={hov ? 1 : 0.65}
                  style={{ cursor: 'pointer', transition: 'stroke 0.15s, opacity 0.15s' }}
                  onMouseEnter={e => {
                    setHoveredGhostIdx(gi)
                    const desc = lang === 'en' ? ge.description_en : ge.description_de
                    showTooltip(e, [
                      `${formatEur(ge.potential_cents)} — ${t('topology.tooltip.ghostWould')}`,
                      desc,
                    ])
                  }}
                  onMouseLeave={hideTooltip}
                />
                {/* "+" icon at midpoint */}
                <circle cx={mx} cy={my} r={9} fill="var(--color-surface, white)" stroke={GHOST_COL} strokeWidth={1.5} />
                <text x={mx} y={my + 4} textAnchor="middle" fontSize={12} fontWeight={700} fill={GHOST_COL} style={{ pointerEvents: 'none' }}>+</text>
              </g>
            )
          })}

          {/* Regular edges */}
          {subgraph_edges.map((edge, ei) => {
            const fp = positions[edge.from]
            const tp = positions[edge.to]
            if (!fp || !tp) return null
            const cycleIdxs = cycleEdgeMap.get(`${edge.from}→${edge.to}`) || []
            const isCycle   = cycleIdxs.length > 0
            const key       = `${edge.from}→${edge.to}`
            const inActive  = hoveredCycleKeys?.has(key)
            return (
              <line
                key={`edge-${ei}`}
                x1={fp.x} y1={fp.y} x2={tp.x} y2={tp.y}
                stroke={edgeColor(edge)}
                strokeWidth={edgeWidth(edge)}
                className={inActive ? '_tig_pulse' : undefined}
                style={{
                  cursor:     isCycle ? 'pointer' : 'default',
                  transition: 'stroke 0.15s, stroke-width 0.15s, opacity 0.15s',
                }}
                onMouseEnter={isCycle ? e => {
                  const ci      = cycleIdxs[0]
                  const cleared = cycles[ci]?.cleared_cents ?? 0
                  setHoveredCycleIdx(ci)
                  showTooltip(e, [
                    lang === 'en'
                      ? `This cycle enables ${formatEur(cleared)} in multilateral clearing.`
                      : `Dieser Zyklus ermöglicht ${formatEur(cleared)} multilaterale Verrechnung.`,
                  ])
                } : undefined}
                onMouseLeave={isCycle ? hideTooltip : undefined}
              />
            )
          })}

          {/* Nodes */}
          {subgraph_nodes.map(id => {
            const node = nodeById?.[id]
            if (!node) return null
            const pos  = positions[id]
            if (!pos)  return null
            const zone    = CLUSTER_ZONES[node.cluster]
            const color   = zone?.color || '#6e6460'
            const isHov   = hoveredNodeId === id
            const isDim   = hoveredNodeId != null && !connectedToHovered.has(id)
            const isGls   = node.gls_member
            // Abbreviate company name to fit inside small circle
            const shortName = node.name.replace(/\s+(GmbH|AG|KG|e\.V\.|gGmbH)$/, '').split(' ')[0].slice(0, 6)
            return (
              <g
                key={id}
                style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
                opacity={isDim ? 0.2 : 1}
                onMouseEnter={e => {
                  setHoveredNodeId(id)
                  showTooltip(e, [
                    node.name,
                    node.cluster,
                    `${t('topology.tooltip.clearingVolume')}: ${formatEur(node.total_invoice_volume_cents)}`,
                    ...(isGls ? [`★ ${t('topology.glsMember')}`] : []),
                  ])
                }}
                onMouseLeave={hideTooltip}
                onClick={() => onDrillIn?.(id)}
              >
                {/* GLS member dashed ring */}
                {isGls && (
                  <circle
                    cx={pos.x} cy={pos.y} r={NODE_R + 5}
                    fill="none"
                    stroke={color} strokeWidth={1.5}
                    strokeDasharray="3,2.5"
                    opacity={0.55}
                  />
                )}
                <circle
                  cx={pos.x} cy={pos.y} r={NODE_R}
                  fill={color}
                  stroke={isHov ? 'white' : 'none'}
                  strokeWidth={isHov ? 2 : 0}
                  opacity={0.88}
                />
                <text
                  x={pos.x} y={pos.y + 4}
                  textAnchor="middle"
                  fontSize={9} fontWeight={600}
                  fill="rgba(255,255,255,0.92)"
                  style={{ pointerEvents: 'none' }}
                >
                  {shortName}
                </text>
              </g>
            )
          })}
        </svg>

        <Tooltip tooltip={tooltip} />
      </div>

      {/* Legend */}
      <div style={{
        display:    'flex',
        flexWrap:   'wrap',
        gap:        'var(--space-3) var(--space-5)',
        marginTop:  'var(--space-3)',
        fontSize:   'var(--font-size-xs)',
        color:      'var(--color-text-muted)',
        padding:    '0 var(--space-1)',
      }}>
        {CLUSTER_ORDER.map(cl => {
          const z = CLUSTER_ZONES[cl]
          return (
            <span key={cl} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ color: z.color, fontSize: '1.1em', lineHeight: 1 }}>⬡</span>
              <span>{cl}</span>
            </span>
          )
        })}
        <span style={{ flexBasis: '100%', height: 0 }} />
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width={22} height={5} style={{ flexShrink: 0 }}>
            <line x1={0} y1={2.5} x2={22} y2={2.5} stroke="#888" strokeWidth={2} />
          </svg>
          {t('topology.legend.obligation')}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width={22} height={5} style={{ flexShrink: 0 }}>
            <line x1={0} y1={2.5} x2={22} y2={2.5} stroke={GOLD} strokeWidth={2.5} />
          </svg>
          {t('topology.legend.cycle')}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width={22} height={5} style={{ flexShrink: 0 }}>
            <line x1={0} y1={2.5} x2={22} y2={2.5} stroke={GHOST_COL} strokeWidth={1.5} strokeDasharray="4,3" />
          </svg>
          {t('topology.legend.missing')}
        </span>
      </div>
    </div>
  )
}
