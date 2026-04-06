/**
 * GlsDashboard — GLS Bank admin view
 *
 * Shows the full clearing network:
 * - KPI cards: Unternehmen, Rechnungen, Brutto, Netto, Einsparungen
 * - D3 force-directed trade network graph
 *   • nodes = companies, size ∝ total throughput
 *   • edges = net obligations (orange), thickness ∝ amount
 * - Company Nettopositionen table
 * - Clearing starten button
 */
import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import * as d3 from 'd3'
import { useApi } from '../hooks/useApi.js'
import { networkApi } from '../api/network.js'
import { clearingApi } from '../api/clearing.js'
import { companiesApi } from '../api/companies.js'
import { invoicesApi } from '../api/invoices.js'
import { MOCK_COMPANIES, MOCK_INVOICES, MOCK_CLEARING_RESULT } from '../mock/data.js'
import { formatEur, formatPct } from '../utils/format.js'

// ── Mock fallback for admin dashboard ────────────────────────────────────────

const MOCK_ADMIN_DASHBOARD = {
  latest_cycle: null,
  total_gross_cents: 84_230_000,
  total_net_cents:   54_749_500,
  savings_bps:       3500,
  savings_percent:   35.0,
  company_positions: [
    { company_id: 'c1', company_name: 'Hamburger Hafen GmbH',       receivable_cents: 1_240_000, payable_cents:   870_000, net_cents:   370_000 },
    { company_id: 'c2', company_name: 'Elbe Spedition KG',           receivable_cents:         0, payable_cents: 1_240_000, net_cents: -1_240_000 },
    { company_id: 'c4', company_name: 'Alstermühle Bäckerei GmbH',  receivable_cents:         0, payable_cents:   150_000, net_cents:  -150_000 },
    { company_id: 'c5', company_name: 'Biokontor Hamburg eG',        receivable_cents:   150_000, payable_cents:         0, net_cents:   150_000 },
    { company_id: 'c7', company_name: 'Lagerhaus Veddel GmbH',       receivable_cents:   870_000, payable_cents:         0, net_cents:   870_000 },
  ],
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color }) {
  return (
    <div className="card" style={{ flex: '1 1 180px', minWidth: 160, textAlign: 'center' }}>
      <div style={{
        fontSize: 'var(--font-size-xs)', fontWeight: 700, letterSpacing: '0.07em',
        color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 'var(--space-2)',
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 'var(--font-size-2xl)', fontWeight: 800, lineHeight: 1.1,
        color: color ?? 'var(--color-text)',
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>
          {sub}
        </div>
      )}
    </div>
  )
}

// ── Trade Network Graph ───────────────────────────────────────────────────────

/**
 * D3 force graph.
 * nodes: [{ id, name, throughput_cents, net_cents, gls_member?, district?, subtype? }]
 * edges: [{ source, target, net_cents, gross }]  (gross=true means dashed/gross flow)
 */
function TradeNetworkGraph({ nodes, edges, height = 480, highlightGls = false }) {
  const svgRef    = useRef(null)
  const [tooltip, setTooltip] = useState(null)   // { x, y, node }

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return

    const el = svgRef.current
    const W  = el.clientWidth || 900
    const H  = height

    d3.select(el).selectAll('*').remove()

    const svg = d3.select(el)
      .attr('viewBox', `0 0 ${W} ${H}`)
      .attr('width', '100%')
      .attr('height', H)

    // Zoom layer
    const g = svg.append('g')
    svg.call(
      d3.zoom()
        .scaleExtent([0.3, 3])
        .on('zoom', e => g.attr('transform', e.transform))
    )

    // Scales
    const maxThroughput = d3.max(nodes, d => d.throughput_cents) || 1
    const rScale = d => Math.max(14, Math.min(42, Math.sqrt(d.throughput_cents / maxThroughput) * 36 + 14))

    const maxEdge = d3.max(edges, d => d.net_cents) || 1
    const wScale  = d => Math.max(1.5, Math.min(9, (d.net_cents / maxEdge) * 7 + 1.5))

    // Arrow markers
    svg.append('defs').call(defs => {
      [['net-arrow', '#c97a2f'], ['gross-arrow', '#c9bfaf']].forEach(([id, col]) => {
        defs.append('marker')
          .attr('id', id)
          .attr('viewBox', '0 -4 8 8').attr('refX', 8).attr('refY', 0)
          .attr('markerWidth', 5).attr('markerHeight', 5).attr('orient', 'auto')
          .append('path').attr('d', 'M0,-4L8,0L0,4').attr('fill', col)
      })
    })

    // Simulation
    const simNodes = nodes.map(d => ({ ...d }))
    const simEdges = edges.map(d => ({ ...d }))

    const sim = d3.forceSimulation(simNodes)
      .force('link', d3.forceLink(simEdges).id(d => d.id).distance(d => 130 + rScale(d.source) + rScale(d.target)).strength(0.5))
      .force('charge', d3.forceManyBody().strength(-250))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide(d => rScale(d) + (highlightGls && d.gls_member ? 14 : 10)))

    // Links
    const link = g.append('g').selectAll('line')
      .data(simEdges).join('line')
      .attr('stroke', d => d.gross ? '#c9bfaf' : '#c97a2f')
      .attr('stroke-width', d => d.gross ? Math.max(1, wScale(d) * 0.6) : wScale(d))
      .attr('stroke-dasharray', d => d.gross ? '6,4' : null)
      .attr('stroke-opacity', d => d.gross ? 0.55 : 0.85)
      .attr('marker-end', d => d.gross ? 'url(#gross-arrow)' : 'url(#net-arrow)')

    // Nodes
    const nodeG = g.append('g').selectAll('g')
      .data(simNodes).join('g')
      .style('cursor', 'pointer')
      .call(d3.drag()
        .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
        .on('drag',  (e, d) => { d.fx = e.x; d.fy = e.y })
        .on('end',   (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null }))

    // GLS member outer ring (rendered below the main circle)
    nodeG.append('circle')
      .attr('r', d => highlightGls && d.gls_member ? rScale(d) + 6 : 0)
      .attr('fill', 'none')
      .attr('stroke', '#e6b800')
      .attr('stroke-width', 3)
      .attr('stroke-opacity', d => highlightGls && d.gls_member ? 0.9 : 0)

    // Main node circle
    nodeG.append('circle')
      .attr('r', rScale)
      .attr('fill', d => {
        if (highlightGls && !d.gls_member) return '#7a6e64'
        return d.net_cents > 0 ? '#4a7c59' : d.net_cents < 0 ? '#c97a2f' : '#7a6e64'
      })
      .attr('fill-opacity', d => highlightGls && !d.gls_member ? 0.35 : 0.85)
      .attr('stroke', 'white')
      .attr('stroke-width', 2.5)

    // Short label inside node
    nodeG.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', d => Math.min(11, rScale(d) * 0.5))
      .attr('font-family', 'DM Sans, sans-serif')
      .attr('fill', 'white')
      .attr('font-weight', 700)
      .attr('pointer-events', 'none')
      .attr('opacity', d => highlightGls && !d.gls_member ? 0.5 : 1)
      .text(d => d.name.split(' ')[0].slice(0, 6))

    // Full name label below node
    nodeG.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', d => rScale(d) + (highlightGls && d.gls_member ? 20 : 14))
      .attr('font-size', 10)
      .attr('font-family', 'DM Sans, sans-serif')
      .attr('fill', 'var(--color-text-muted)')
      .attr('pointer-events', 'none')
      .attr('opacity', d => highlightGls && !d.gls_member ? 0.4 : 1)
      .text(d => d.name.length > 22 ? d.name.slice(0, 20) + '…' : d.name)

    // Tooltip on hover
    nodeG
      .on('mouseenter', (e, d) => {
        const rect = svgRef.current.getBoundingClientRect()
        setTooltip({ x: e.clientX - rect.left + 12, y: e.clientY - rect.top - 10, node: d })
      })
      .on('mousemove', (e, d) => {
        const rect = svgRef.current.getBoundingClientRect()
        setTooltip({ x: e.clientX - rect.left + 12, y: e.clientY - rect.top - 10, node: d })
      })
      .on('mouseleave', () => setTooltip(null))

    // Tick
    sim.on('tick', () => {
      link
        .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x).attr('y2', d => d.target.y)
      nodeG.attr('transform', d => `translate(${d.x},${d.y})`)
    })

    return () => sim.stop()
  }, [nodes, edges, height, highlightGls])

  return (
    <div style={{ position: 'relative' }}>
      <svg ref={svgRef} style={{ display: 'block', width: '100%', background: 'var(--color-surface)' }} />
      {tooltip && (
        <div style={{
          position: 'absolute', left: tooltip.x, top: tooltip.y,
          background: 'white', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)',
          boxShadow: 'var(--shadow-md)', pointerEvents: 'none', zIndex: 10,
          fontSize: 'var(--font-size-sm)', lineHeight: 1.6, minWidth: 200,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            {tooltip.node.name}
            {tooltip.node.gls_member && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '1px 6px',
                background: '#fef3c7', color: '#92400e',
                borderRadius: 10, border: '1px solid #e6b800',
              }}>GLS-Kunde</span>
            )}
          </div>
          {tooltip.node.sector && (
            <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
              Sektor: {tooltip.node.sector}
            </div>
          )}
          {tooltip.node.subtype && (
            <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
              Typ: {tooltip.node.subtype}
            </div>
          )}
          {tooltip.node.district && (
            <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
              Stadtteil: {tooltip.node.district}
            </div>
          )}
          <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', marginTop: 4, borderTop: '1px solid var(--color-border)', paddingTop: 4 }}>
            Netto: <strong style={{ color: tooltip.node.net_cents >= 0 ? 'var(--color-primary)' : 'var(--color-danger)' }}>
              {tooltip.node.net_cents >= 0 ? '+' : ''}{formatEur(tooltip.node.net_cents)}
            </strong>
          </div>
          <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
            Durchsatz: {formatEur(tooltip.node.throughput_cents)}
          </div>
        </div>
      )}
    </div>
  )
}

// ── GlsDashboard ─────────────────────────────────────────────────────────────

export default function GlsDashboard() {
  const [running,      setRunning]      = useState(false)
  const [runMsg,       setRunMsg]       = useState(null)
  const [refreshKey,   setRefreshKey]   = useState(0)
  const [highlightGls, setHighlightGls] = useState(false)

  const { data: dashboard, loading: dashLoading, useMock: dashMock, reload: reloadDash } = useApi(
    () => networkApi.dashboard(),
    MOCK_ADMIN_DASHBOARD,
    [refreshKey]
  )

  const { data: companiesRaw } = useApi(() => companiesApi.list(), MOCK_COMPANIES)
  const { data: invoicesRaw   } = useApi(() => invoicesApi.list(), MOCK_INVOICES)
  const { data: cycles, reload: reloadCycles } = useApi(
    () => clearingApi.listCycles(),
    [],
    [refreshKey]
  )

  const { data: topologyRaw } = useApi(() => networkApi.topology(), { nodes: [], edges: [], gaps: [], clusters: [] })

  // Build GLS info lookup: company_id → { gls_member, district, subtype, sector }
  // Prefers topology API data; falls back to companies list (which includes mock gls_member)
  const glsMap = useMemo(() => {
    const map = {}
    // Seed from companies list (mock-compatible)
    const cos = Array.isArray(companiesRaw) ? companiesRaw : []
    cos.forEach(c => {
      map[c.id] = {
        gls_member: c.gls_member ?? false,
        district:   c.district   ?? null,
        subtype:    c.subtype    ?? null,
        sector:     c.sector     ?? null,
      }
    })
    // Override with richer topology data when available
    const tNodes = topologyRaw?.nodes ?? []
    tNodes.forEach(n => {
      map[n.id] = {
        gls_member: n.gls_member ?? map[n.id]?.gls_member ?? false,
        district:   n.district   ?? map[n.id]?.district   ?? null,
        subtype:    n.subtype    ?? map[n.id]?.subtype    ?? null,
        sector:     n.sector     ?? map[n.id]?.sector     ?? null,
      }
    })
    return map
  }, [topologyRaw, companiesRaw])

  const latestCycleId = Array.isArray(cycles) && cycles.length > 0 ? cycles[0]?.id : null

  const { data: cycleDetail } = useApi(
    () => latestCycleId ? clearingApi.getCycle(latestCycleId) : Promise.resolve(null),
    MOCK_CLEARING_RESULT,
    [latestCycleId]
  )

  const companies = useMemo(
    () => Array.isArray(companiesRaw) ? companiesRaw : [],
    [companiesRaw]
  )

  const companyMap = useMemo(() => {
    const map = {}
    companies.forEach(c => { map[c.id] = c })
    return map
  }, [companies])

  // Build graph nodes from dashboard positions
  const graphNodes = useMemo(() => {
    const positions = dashboard?.company_positions ?? []
    // Start with companies that have positions
    const nodeMap = {}
    positions.forEach(pos => {
      const gls = glsMap[pos.company_id] ?? {}
      nodeMap[pos.company_id] = {
        id:               pos.company_id,
        name:             pos.company_name,
        throughput_cents: pos.receivable_cents + pos.payable_cents,
        net_cents:        pos.net_cents,
        gls_member:       gls.gls_member ?? false,
        district:         gls.district   ?? null,
        subtype:          gls.subtype    ?? null,
        sector:           gls.sector     ?? null,
      }
    })
    // Add remaining companies from invoice flows (with zero positions)
    const invoices = Array.isArray(invoicesRaw) ? invoicesRaw : []
    invoices.forEach(inv => {
      const fromId = inv.from_company_id ?? inv.from_company?.id
      const toId   = inv.to_company_id   ?? inv.to_company?.id
      const fromCo = companyMap[fromId] ?? inv.from_company
      const toCo   = companyMap[toId]   ?? inv.to_company
      const amt    = inv.amount_cents    ?? inv.total_amount_cents ?? 0
      if (fromId && !nodeMap[fromId]) {
        const gls = glsMap[fromId] ?? {}
        nodeMap[fromId] = { id: fromId, name: typeof fromCo === 'object' ? fromCo.name : fromId, throughput_cents: amt, net_cents: 0, gls_member: gls.gls_member ?? false, district: gls.district ?? null, subtype: gls.subtype ?? null, sector: gls.sector ?? null }
      } else if (fromId) {
        nodeMap[fromId].throughput_cents += amt
      }
      if (toId && !nodeMap[toId]) {
        const gls = glsMap[toId] ?? {}
        nodeMap[toId] = { id: toId, name: typeof toCo === 'object' ? toCo.name : toId, throughput_cents: amt, net_cents: 0, gls_member: gls.gls_member ?? false, district: gls.district ?? null, subtype: gls.subtype ?? null, sector: gls.sector ?? null }
      } else if (toId) {
        nodeMap[toId].throughput_cents += amt
      }
    })
    return Object.values(nodeMap)
  }, [dashboard, invoicesRaw, companyMap, glsMap])

  // Build graph edges — prefer net flows from latest clearing, fall back to gross invoice flows
  const graphEdges = useMemo(() => {
    const nodeIds = new Set(graphNodes.map(n => n.id))

    // From clearing cycle results (real API shape)
    if (cycleDetail && cycleDetail.results && cycleDetail.results.length > 0) {
      return cycleDetail.results
        .filter(r => nodeIds.has(r.from_company_id) && nodeIds.has(r.to_company_id) && r.net_amount_cents > 0)
        .map(r => ({ source: r.from_company_id, target: r.to_company_id, net_cents: r.net_amount_cents, gross: false }))
    }

    // From mock clearing pairs (mock shape)
    if (cycleDetail && cycleDetail.pairs && cycleDetail.pairs.length > 0) {
      return cycleDetail.pairs
        .filter(p => {
          const aId = p.company_a?.id
          const bId = p.company_b?.id
          return nodeIds.has(aId) && nodeIds.has(bId) && p.net_cents > 0
        })
        .map(p => ({
          source:    p.company_a?.id,
          target:    p.company_b?.id,
          net_cents: p.net_cents,
          gross:     false,
        }))
    }

    // Fall back to gross invoice flows
    const invoices = Array.isArray(invoicesRaw) ? invoicesRaw : []
    return invoices
      .filter(inv => {
        const fromId = inv.from_company_id ?? inv.from_company?.id
        const toId   = inv.to_company_id   ?? inv.to_company?.id
        return nodeIds.has(fromId) && nodeIds.has(toId)
      })
      .map(inv => ({
        source:    inv.from_company_id ?? inv.from_company?.id,
        target:    inv.to_company_id   ?? inv.to_company?.id,
        net_cents: inv.amount_cents ?? inv.total_amount_cents ?? 0,
        gross:     true,
      }))
  }, [cycleDetail, invoicesRaw, graphNodes])

  // KPI values
  const totalGross    = dashboard?.total_gross_cents ?? 0
  const totalNet      = dashboard?.total_net_cents   ?? 0
  const savingsCents  = totalGross - totalNet
  const savingsPct    = dashboard?.savings_percent   ?? (dashboard?.savings_bps != null ? dashboard.savings_bps / 100 : 0)
  const companyCount  = dashboard?.company_positions?.length ?? companies.length
  const invoiceCount  = Array.isArray(invoicesRaw)
    ? invoicesRaw.length
    : (invoicesRaw?.items?.length ?? 0)

  async function handleRunClearing() {
    setRunning(true)
    setRunMsg(null)
    try {
      await clearingApi.run()
      setRunMsg('Clearing erfolgreich durchgeführt.')
      setRefreshKey(k => k + 1)
      reloadCycles()
      reloadDash()
    } catch (e) {
      setRunMsg(`Fehler beim Clearing: ${e.message}`)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-8)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, marginBottom: 'var(--space-1)' }}>
            GLS Netzwerk-Dashboard
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
            Aggregierte Netzwerkübersicht · Administratoren-Ansicht
          </p>
          {dashMock && (
            <div style={{ marginTop: 'var(--space-3)', fontSize: 'var(--font-size-xs)', color: 'var(--color-accent)', fontStyle: 'italic' }}>
              Demo-Daten — Backend noch nicht verbunden
            </div>
          )}
        </div>
        <button className="btn btn-primary" onClick={handleRunClearing} disabled={running} style={{ minWidth: 200 }}>
          {running
            ? <><span className="loading-spinner" style={{ width: 16, height: 16 }} /> Clearing läuft…</>
            : '⇄ Clearing starten'}
        </button>
      </div>

      {runMsg && (
        <div className="card" style={{
          background: runMsg.startsWith('Fehler') ? '#fdeaea' : 'var(--color-primary-lt)',
          border: `1px solid ${runMsg.startsWith('Fehler') ? '#f5c2c2' : '#c8dfd0'}`,
          color: runMsg.startsWith('Fehler') ? 'var(--color-danger)' : 'var(--color-primary-dk)',
          marginBottom: 'var(--space-4)',
        }}>
          {runMsg}
        </div>
      )}

      {/* KPI Row — large, projector-readable */}
      <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', marginBottom: 'var(--space-6)' }}>
        <KpiCard label="Unternehmen" value={companyCount} sub="im Netzwerk" />
        <KpiCard label="Rechnungen" value={invoiceCount} sub="erfasst" />
        <KpiCard label="Brutto-Verpflichtungen" value={formatEur(totalGross)} sub="ausstehend (bilateral)" />
        <KpiCard label="Netto nach Clearing"   value={formatEur(totalNet)} sub={`nach bilateralem Netting`} color="var(--color-primary)" />
        <KpiCard
          label="Einsparungen"
          value={formatEur(savingsCents)}
          sub={`${formatPct(savingsPct)} des Bruttovolumens`}
          color="var(--color-primary-dk)"
        />
      </div>

      {/* Savings highlight banner */}
      {savingsPct > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, var(--color-primary-lt), #dff0e6)',
          border: '1px solid #c8dfd0', borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-8)', marginBottom: 'var(--space-6)',
          display: 'flex', alignItems: 'center', gap: 'var(--space-10)', flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-primary-dk)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
              Kapital freigesetzt durch bilaterales Netting
            </div>
            <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: 'var(--color-primary-dk)', lineHeight: 1 }}>
              {formatPct(savingsPct)}
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-primary)', marginTop: 'var(--space-2)' }}>
              {formatEur(savingsCents)} Einsparung
            </div>
          </div>
          <div style={{ width: 1, height: 60, background: '#c8dfd0' }} />
          <div style={{ maxWidth: 300 }}>
            <div style={{ fontSize: 'var(--font-size-md)', color: 'var(--color-primary-dk)', lineHeight: 1.5, fontStyle: 'italic' }}>
              „{formatPct(savingsPct)} weniger Liquidität nötig — ohne dass eine Zahlung ausbleibt."
            </div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary-dk)', fontWeight: 600, marginBottom: 4 }}>NETTO</div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text)' }}>{formatEur(totalNet)}</div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>von {formatEur(totalGross)} brutto</div>
          </div>
        </div>
      )}

      {/* Trade network graph + company positions */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-6)', marginBottom: 'var(--space-6)', alignItems: 'start' }}>
        {/* Network graph */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{
            padding: 'var(--space-4) var(--space-6)',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)',
          }}>
            <div>
              <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>Handelsnetzwerk Hamburg</span>
              <span style={{ marginLeft: 'var(--space-3)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                {latestCycleId ? 'Netto-Verpflichtungen nach Clearing' : 'Brutto-Handelsflüsse (vor Clearing)'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* GLS-Kunden hervorheben toggle */}
              <button
                onClick={() => setHighlightGls(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '4px 12px', borderRadius: 20, cursor: 'pointer',
                  fontSize: 'var(--font-size-xs)', fontWeight: 600,
                  border: highlightGls ? '2px solid #e6b800' : '2px solid var(--color-border)',
                  background: highlightGls ? '#fef9e7' : 'transparent',
                  color: highlightGls ? '#92400e' : 'var(--color-text-muted)',
                  transition: 'all 0.15s',
                }}
              >
                <span style={{
                  width: 12, height: 12, borderRadius: '50%',
                  border: '2.5px solid #e6b800',
                  display: 'inline-block', background: highlightGls ? '#fef3c7' : 'transparent',
                }} />
                GLS-Kunden hervorheben
              </button>
              {/* Legend */}
              <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#4a7c59', display: 'inline-block' }} />
                  Forderungen
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#c97a2f', display: 'inline-block' }} />
                  Verbindlichkeiten
                </span>
                {highlightGls && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{
                      width: 12, height: 12, borderRadius: '50%',
                      border: '2.5px solid #e6b800', display: 'inline-block',
                    }} />
                    GLS-Kunde
                  </span>
                )}
              </div>
            </div>
          </div>
          {dashLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-16)' }}>
              <span className="loading-spinner" />
            </div>
          ) : (
            <TradeNetworkGraph nodes={graphNodes} edges={graphEdges} height={460} highlightGls={highlightGls} />
          )}
          <div style={{
            padding: 'var(--space-3) var(--space-6)',
            borderTop: '1px solid var(--color-border)',
            fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)',
            display: 'flex', gap: 'var(--space-6)',
          }}>
            <span>Knotengröße = Handelsdurchsatz</span>
            <span>Pfeildicke = Nettoobligation</span>
            <span>Drag zum Verschieben · Scroll zum Zoomen</span>
          </div>
        </div>

        {/* Company Nettopositionen table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{
            padding: 'var(--space-4) var(--space-5)',
            borderBottom: '2px solid var(--color-border)',
            fontWeight: 700, fontSize: 'var(--font-size-sm)',
          }}>
            Nettopositionen
          </div>
          {(dashboard?.company_positions ?? []).length === 0 ? (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
              Noch kein Clearing — keine Positionen.
            </div>
          ) : (
            [...(dashboard?.company_positions ?? [])]
              .sort((a, b) => b.net_cents - a.net_cents)
              .map((pos, i) => {
                const net = pos.net_cents
                return (
                  <div key={pos.company_id} style={{
                    padding: 'var(--space-4) var(--space-5)',
                    borderBottom: i < (dashboard.company_positions.length - 1) ? '1px solid var(--color-border)' : 'none',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)',
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', lineHeight: 1.3 }}>
                        {pos.company_name}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>
                        ↑ {formatEur(pos.receivable_cents)} · ↓ {formatEur(pos.payable_cents)}
                      </div>
                    </div>
                    <div style={{
                      fontWeight: 700, fontSize: 'var(--font-size-md)', whiteSpace: 'nowrap',
                      color: net > 0 ? 'var(--color-primary)' : net < 0 ? 'var(--color-danger)' : 'var(--color-text-muted)',
                    }}>
                      {net > 0 ? '+' : ''}{formatEur(net)}
                    </div>
                  </div>
                )
              })
          )}
        </div>
      </div>

      {/* Legend / explainer */}
      <div className="card" style={{ background: 'var(--color-surface-alt)', display: 'flex', gap: 'var(--space-8)', flexWrap: 'wrap', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
        <div>
          <strong style={{ color: 'var(--color-text)' }}>Bilaterales Netting</strong>{' '}
          — gegenseitige Forderungen werden aufgerechnet. Nur der Nettobetrag muss transferiert werden.
        </div>
        <div>
          <strong style={{ color: 'var(--color-primary)' }}>●</strong> Grün = Nettoempfänger (Forderungen überwiegen)
          &nbsp;&nbsp;
          <strong style={{ color: 'var(--color-accent)' }}>●</strong> Orange = Nettozahler (Verbindlichkeiten überwiegen)
        </div>
        <div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2.5px solid #e6b800', display: 'inline-block' }} />
            <strong style={{ color: 'var(--color-text)' }}>Goldener Ring</strong>
          </span>{' '}
          = GLS-Kunde (sichtbar bei „GLS-Kunden hervorheben")
        </div>
      </div>
    </div>
  )
}
