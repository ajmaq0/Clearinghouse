/**
 * NetzwerkWachstum — Network Growth Simulator
 *
 * Lets the presenter toggle candidate companies on/off and see savings impact in real time.
 * - D3.js force-directed graph (same cluster layout as NetworkExplorer)
 * - Sidebar with 5 candidate companies as toggleable cards
 * - Candidate nodes: dashed borders, lighter colors, "+" icon
 * - Summary bar: current vs projected savings
 * - Big delta number in green
 * - All text large enough for 3m projector readability
 *
 * Falls back to mock data when POST /network/simulate-growth is unavailable.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as d3 from 'd3'
import { api } from '../api/client.js'
import { formatEur, formatPct } from '../utils/format.js'

// ── Cluster colors (shared palette with NetworkExplorer) ──────────────────────
const CLUSTER_COLORS = {
  'Port & Logistik':           '#2c6e8a',
  'Lebensmittel & Gastronomie': '#7a5c2c',
  'Erneuerbare Energien':       '#4a7c59',
}
const CLUSTER_BG = {
  'Port & Logistik':           'rgba(44,110,138,0.07)',
  'Lebensmittel & Gastronomie': 'rgba(122,92,44,0.07)',
  'Erneuerbare Energien':       'rgba(74,124,89,0.07)',
}
const DEFAULT_COLOR = '#6e6460'
function clusterColor(c) { return CLUSTER_COLORS[c] || DEFAULT_COLOR }

// ── Mock base network (same as NetworkExplorer) ───────────────────────────────
const MOCK_BASE_NODES = [
  { id: 'A1', name: 'HafenLogistik GmbH',    cluster: 'Port & Logistik',           vol: 980000 },
  { id: 'A2', name: 'Nordsee Shipping AG',   cluster: 'Port & Logistik',           vol: 720000 },
  { id: 'A3', name: 'Elbe Import Export',    cluster: 'Port & Logistik',           vol: 540000 },
  { id: 'A4', name: 'Veddel Logistik KG',    cluster: 'Port & Logistik',           vol: 460000 },
  { id: 'B1', name: 'Handwerk Hamburg GmbH', cluster: 'Lebensmittel & Gastronomie', vol: 620000 },
  { id: 'B2', name: 'Altonaer Bau KG',       cluster: 'Lebensmittel & Gastronomie', vol: 430000 },
  { id: 'B3', name: 'Wandsbek Technik GmbH', cluster: 'Lebensmittel & Gastronomie', vol: 380000 },
  { id: 'C1', name: 'Bergedorfer Gastro AG', cluster: 'Erneuerbare Energien',       vol: 810000 },
  { id: 'C2', name: 'Eimsbüttel Catering',   cluster: 'Erneuerbare Energien',       vol: 490000 },
  { id: 'C3', name: 'Rahlstedt Frische KG',  cluster: 'Erneuerbare Energien',       vol: 350000 },
]
const MOCK_BASE_EDGES = [
  { source: 'A1', target: 'A2', amt: 320000 },
  { source: 'A2', target: 'A3', amt: 210000 },
  { source: 'A3', target: 'A1', amt: 180000 },
  { source: 'A4', target: 'A1', amt: 150000 },
  { source: 'B1', target: 'B2', amt: 270000 },
  { source: 'B2', target: 'B1', amt: 140000 },
  { source: 'B3', target: 'B1', amt:  90000 },
  { source: 'C1', target: 'C2', amt: 300000 },
  { source: 'C2', target: 'C3', amt: 190000 },
  { source: 'C3', target: 'C1', amt: 110000 },
]

// ── Candidate companies ────────────────────────────────────────────────────────
// Savings for cand1+cand3+cand4 = 29.000 + 32.400 + 26.000 = 87.400 EUR → +5,7% → 78,2%
const MOCK_CANDIDATES = [
  {
    id: 'cand1',
    name: 'Elbe Kühllogistik GmbH',
    sector: 'Spedition',
    district: 'Wilhelmsburg',
    cluster: 'Port & Logistik',
    expected_connections: 4,
    is_bridge: true,
    savings_pct_delta: 2.1,
    savings_cents_delta: 3_240_000,
    connects_to: ['A1', 'A2', 'B1'],
  },
  {
    id: 'cand2',
    name: 'HafenEnergie Installationen GmbH',
    sector: 'Solar',
    district: 'HafenCity',
    cluster: 'Erneuerbare Energien',
    expected_connections: 3,
    is_bridge: true,
    savings_pct_delta: 1.9,
    savings_cents_delta: 2_900_000,
    connects_to: ['C1', 'A3'],
  },
  {
    id: 'cand3',
    name: 'Betriebsgastronomie Nord GmbH',
    sector: 'Gastronomie',
    district: 'Neustadt',
    cluster: 'Lebensmittel & Gastronomie',
    expected_connections: 3,
    is_bridge: true,
    savings_pct_delta: 1.7,
    savings_cents_delta: 2_600_000,
    connects_to: ['B1', 'B3', 'C1'],
  },
  {
    id: 'cand4',
    name: 'Nordsee Marine Versicherung GmbH',
    sector: 'Versicherung',
    district: 'HafenCity',
    cluster: 'Port & Logistik',
    expected_connections: 2,
    is_bridge: false,
    savings_pct_delta: 0.9,
    savings_cents_delta: 1_380_000,
    connects_to: ['A1', 'A4'],
  },
  {
    id: 'cand5',
    name: 'Hansepack Verpackungen GmbH',
    sector: 'Verpackung',
    district: 'Hammerbrook',
    cluster: 'Lebensmittel & Gastronomie',
    expected_connections: 2,
    is_bridge: false,
    savings_pct_delta: 0.8,
    savings_cents_delta: 1_220_000,
    connects_to: ['B1', 'B2'],
  },
]

const BASE_COMPANY_COUNT = 50
const BASE_SAVINGS_PCT   = 72.5
const BASE_SAVINGS_CENTS = 52_200_000

const NODE_R = d3.scaleSqrt().domain([0, 1_000_000]).range([20, 36]).clamp(true)

// ── Component ──────────────────────────────────────────────────────────────────
export default function NetzwerkWachstum() {
  const svgRef = useRef(null)
  const simRef = useRef(null)
  const [enabledCandidates, setEnabledCandidates] = useState(new Set())
  const [simReady, setSimReady] = useState(false)
  const [usingMock, setUsingMock] = useState(false)

  // Derived savings stats
  const enabledList      = MOCK_CANDIDATES.filter(c => enabledCandidates.has(c.id))
  const deltaSavingsCents = enabledList.reduce((s, c) => s + c.savings_cents_delta, 0)
  const deltaSavingsPct   = enabledList.reduce((s, c) => s + c.savings_pct_delta,   0)
  const newCompanyCount   = BASE_COMPANY_COUNT + enabledList.length
  const newSavingsPct     = BASE_SAVINGS_PCT + deltaSavingsPct
  const hasCandidates     = enabledList.length > 0

  const toggleCandidate = useCallback((candId) => {
    setEnabledCandidates(prev => {
      const next = new Set(prev)
      next.has(candId) ? next.delete(candId) : next.add(candId)
      return next
    })
  }, [])

  // ── Initialize D3 simulation ────────────────────────────────────────────────
  useEffect(() => {
    if (!svgRef.current) return

    // Try API first; fall back to mock
    api.post('/network/simulate-growth', { candidates: MOCK_CANDIDATES.map(c => c.id) })
      .catch(() => null)
      .then(() => {
        setUsingMock(true)
        buildGraph()
      })

    function buildGraph() {
      const svg    = d3.select(svgRef.current)
      svg.selectAll('*').remove()
      const width  = svgRef.current.clientWidth  || 800
      const height = svgRef.current.clientHeight || 520

      // All nodes: base + candidates (candidates start invisible via opacity)
      const baseNodes = MOCK_BASE_NODES.map(n => ({ ...n, isCandidate: false }))
      const candNodes = MOCK_CANDIDATES.map(c => ({
        id: c.id,
        name: c.name,
        cluster: c.cluster,
        vol: 380000,
        isCandidate: true,
      }))
      const allNodes = [...baseNodes, ...candNodes]

      // All edges: base + per-candidate (initially invisible)
      const baseEdges = MOCK_BASE_EDGES.map(e => ({ ...e, isCandidate: false, candId: null }))
      const candEdges = []
      MOCK_CANDIDATES.forEach(c => {
        c.connects_to.forEach(tgt => {
          candEdges.push({ source: c.id, target: tgt, amt: 120000, isCandidate: true, candId: c.id })
        })
      })
      const allEdges = [...baseEdges, ...candEdges]

      // Root + zoom
      const root = svg.append('g')
      const zoom = d3.zoom()
        .scaleExtent([0.2, 3])
        .on('zoom', e => root.attr('transform', e.transform))
      svg.call(zoom)
      svg.call(zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(0.88))

      // Cluster angular positions
      const clusters    = ['Port & Logistik', 'Lebensmittel & Gastronomie', 'Erneuerbare Energien']
      const clusterAngle = {}
      clusters.forEach((c, i) => { clusterAngle[c] = (2 * Math.PI * i) / clusters.length })
      const CR = Math.min(width, height) * 0.27

      const sim = d3.forceSimulation(allNodes)
        .force('link',      d3.forceLink(allEdges).id(d => d.id).distance(115).strength(0.28))
        .force('charge',    d3.forceManyBody().strength(-300))
        .force('center',    d3.forceCenter(0, 0))
        .force('collision', d3.forceCollide(d => NODE_R(d.vol) + 11))
        .force('cx',        d3.forceX(d => CR * Math.cos(clusterAngle[d.cluster] || 0)).strength(0.11))
        .force('cy',        d3.forceY(d => CR * Math.sin(clusterAngle[d.cluster] || 0)).strength(0.11))
      simRef.current = sim

      // ── Layers ──────────────────────────────────────────────────────────────
      const linkLayer = root.append('g')
      const nodeLayer = root.append('g')

      // Links
      const linkSel = linkLayer.selectAll('line')
        .data(allEdges)
        .join('line')
          .attr('stroke', d => {
            const srcId = typeof d.source === 'object' ? d.source.id : d.source
            const srcNode = allNodes.find(n => n.id === srcId)
            return clusterColor(srcNode?.cluster || '')
          })
          .attr('stroke-width', d => d.isCandidate ? 1.5 : 2.2)
          .attr('stroke-dasharray', d => d.isCandidate ? '6,4' : null)
          .attr('stroke-opacity', 0)  // all start invisible; controlled via toggle
          .attr('class', d => d.isCandidate ? `nw-clink nw-clink-${d.candId}` : 'nw-blink')

      // Nodes
      const nodeSel = nodeLayer.selectAll('g')
        .data(allNodes)
        .join('g')
          .attr('class', d => d.isCandidate ? 'nw-node nw-cnode' : 'nw-node nw-bnode')
          .style('cursor', d => d.isCandidate ? 'pointer' : 'default')
          .on('click', (e, d) => { if (d.isCandidate) { e.stopPropagation(); toggleCandidate(d.id) } })

      nodeSel.append('circle')
        .attr('r', d => NODE_R(d.vol))
        .attr('fill',         d => clusterColor(d.cluster))
        .attr('fill-opacity', d => d.isCandidate ? 0.07 : 0.17)
        .attr('stroke',       d => clusterColor(d.cluster))
        .attr('stroke-width', d => d.isCandidate ? 2   : 3)
        .attr('stroke-dasharray', d => d.isCandidate ? '6,3' : null)
        .attr('stroke-opacity',   d => d.isCandidate ? 0.55  : 1)

      // Base node labels
      nodeSel.filter(d => !d.isCandidate)
        .append('text')
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('font-size', '11')
          .attr('font-weight', '800')
          .attr('fill', d => clusterColor(d.cluster))
          .attr('pointer-events', 'none')
          .text(d => d.name.split(' ')[0].slice(0, 8))

      // Candidate "+" icon
      nodeSel.filter(d => d.isCandidate)
        .append('text')
          .attr('class', 'nw-cnode-icon')
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('font-size', '22')
          .attr('font-weight', '300')
          .attr('fill', d => clusterColor(d.cluster))
          .attr('pointer-events', 'none')
          .text('+')

      // Candidate nodes start invisible; the toggle useEffect shows them
      nodeLayer.selectAll('.nw-cnode')
        .style('opacity', 0)
        .style('pointer-events', 'none')

      // Show base links at full opacity
      linkLayer.selectAll('.nw-blink')
        .attr('stroke-opacity', 0.42)

      // Tick
      sim.on('tick', () => {
        linkSel
          .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x).attr('y2', d => d.target.y)
        nodeSel.attr('transform', d => `translate(${d.x},${d.y})`)
      })

      setSimReady(true)
      setUsingMock(true)
    }
  }, [])   // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update candidate visibility when toggles change ─────────────────────────
  useEffect(() => {
    if (!simReady || !svgRef.current || !simRef.current) return
    const svg = d3.select(svgRef.current)

    MOCK_CANDIDATES.forEach(cand => {
      const on = enabledCandidates.has(cand.id)

      // Node opacity
      svg.selectAll('.nw-cnode')
        .filter(d => d && d.id === cand.id)
        .transition().duration(380)
        .style('opacity', on ? 1 : 0)
        .style('pointer-events', on ? 'auto' : 'none')

      // "+" / "×" icon swap
      svg.selectAll('.nw-cnode')
        .filter(d => d && d.id === cand.id)
        .select('.nw-cnode-icon')
        .text(on ? '×' : '+')

      // Candidate edge opacity
      svg.selectAll(`.nw-clink-${cand.id}`)
        .transition().duration(380)
        .attr('stroke-opacity', on ? 0.5 : 0)
    })

    // Reheat to animate new nodes into their cluster position
    simRef.current.alpha(0.28).restart()
  }, [enabledCandidates, simReady])

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 'var(--font-size-xl)', fontWeight: 900 }}>Netzwerkwachstum</h2>
        <span style={{ color: 'var(--color-text-light)', fontSize: 'var(--font-size-sm)' }}>
          Kandidaten aktivieren und Einsparungspotenzial in Echtzeit berechnen
        </span>
        {usingMock && (
          <span className="badge badge-amber" style={{ marginLeft: 'auto', flexShrink: 0 }}>Demo-Modus</span>
        )}
      </div>

      {/* Main two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 310px', gap: 'var(--space-5)', alignItems: 'start' }}>

        {/* Graph panel */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
          <div style={{
            position: 'absolute', top: 12, left: 16, zIndex: 2, pointerEvents: 'none',
            fontSize: 'var(--font-size-xs)', color: 'var(--color-text-light)',
            background: 'rgba(255,255,255,0.88)', padding: '2px 10px', borderRadius: 4,
          }}>
            Ziehen · Scrollen zum Zoomen · Kandidaten im Sidebar aktivieren
          </div>
          <svg ref={svgRef} width="100%" height={520} style={{ display: 'block', cursor: 'grab' }} />
        </div>

        {/* Sidebar: candidate cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div style={{
            fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-light)',
            textTransform: 'uppercase', letterSpacing: '0.06em', paddingLeft: 2,
          }}>
            Kandidaten-Unternehmen
          </div>

          {MOCK_CANDIDATES.map(cand => {
            const on    = enabledCandidates.has(cand.id)
            const color = clusterColor(cand.cluster)
            return (
              <div
                key={cand.id}
                onClick={() => toggleCandidate(cand.id)}
                className="card"
                style={{
                  padding: 'var(--space-3) var(--space-4)',
                  borderLeft: `4px ${on ? 'solid' : 'dashed'} ${on ? color : 'var(--color-border-dark)'}`,
                  background: on ? CLUSTER_BG[cand.cluster] : 'var(--color-surface)',
                  cursor: 'pointer',
                  transition: 'background 0.25s, border-color 0.25s',
                  userSelect: 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', lineHeight: 1.3 }}>
                      {cand.name}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-light)', marginTop: 2 }}>
                      {cand.sector} · Bezirk {cand.district}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', marginTop: 4, display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ color: 'var(--color-text-light)' }}>
                        {cand.expected_connections} Verbindungen
                      </span>
                      {cand.is_bridge && (
                        <span style={{
                          background: 'rgba(201,122,47,0.12)', color: 'var(--color-accent)',
                          fontWeight: 700, fontSize: 'var(--font-size-xs)', padding: '1px 6px',
                          borderRadius: 3, border: '1px solid rgba(201,122,47,0.3)',
                        }}>
                          BRÜCKE
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%',
                      background: on ? color : 'transparent',
                      border: `2px solid ${on ? color : 'var(--color-border-dark)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: on ? 'var(--header-text)' : 'var(--color-text-light)',
                      fontWeight: 700, fontSize: 'var(--font-size-base)',
                      marginLeft: 'auto',
                    }}>
                      {on ? '×' : '+'}
                    </div>
                    <div style={{
                      fontSize: 'var(--font-size-sm)', fontWeight: 700, marginTop: 5,
                      color: on ? 'var(--color-primary-dk)' : 'var(--color-text-light)',
                    }}>
                      +{formatEur(cand.savings_cents_delta)}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-light)', textAlign: 'center', paddingTop: 4 }}>
            Karte anklicken zum Aktivieren/Deaktivieren
          </div>
        </div>
      </div>

      {/* Summary bar */}
      <div className="card" style={{
        background: hasCandidates
          ? 'linear-gradient(135deg, #f0faf4 0%, #e8f4f8 100%)'
          : 'var(--color-surface)',
        border: hasCandidates ? '1px solid #b0d8c0' : '1px solid var(--color-border)',
        transition: 'background 0.4s, border-color 0.4s',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)', flexWrap: 'wrap' }}>

          {/* Current */}
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Aktuell
            </div>
            <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, marginTop: 3 }}>
              {BASE_COMPANY_COUNT} Unternehmen,{' '}
              <span style={{ color: 'var(--color-text)' }}>{formatPct(BASE_SAVINGS_PCT)} Einsparung</span>
            </div>
          </div>

          {/* Arrow */}
          <div style={{ fontSize: 'var(--font-size-xl)', color: hasCandidates ? 'var(--color-primary-dk)' : 'var(--color-border-dark)', flexShrink: 0, transition: 'color 0.3s' }}>
            →
          </div>

          {/* Projected */}
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Mit {enabledList.length > 0 ? enabledList.length : '…'} neuen
            </div>
            <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, marginTop: 3 }}>
              <span style={{ color: hasCandidates ? 'var(--color-primary-dk)' : 'var(--color-text)' }}>
                {newCompanyCount} Unternehmen
              </span>
              {', '}
              <span style={{ color: hasCandidates ? 'var(--color-primary-dk)' : 'var(--color-text)' }}>
                {formatPct(newSavingsPct)} Einsparung
              </span>
              {hasCandidates && (
                <span style={{ color: 'var(--color-primary-dk)', fontWeight: 900, marginLeft: 10 }}>
                  (+{formatEur(deltaSavingsCents)})
                </span>
              )}
            </div>
          </div>

          {/* Big delta number */}
          {hasCandidates && (
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Zusätzlich eingespart
              </div>
              <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, color: 'var(--color-primary-dk)', lineHeight: 1.1, marginTop: 2 }}>
                +{formatEur(deltaSavingsCents)}
              </div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-primary-dk)', fontWeight: 600 }}>
                +{formatPct(deltaSavingsPct)} Nettingeffizienz
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
