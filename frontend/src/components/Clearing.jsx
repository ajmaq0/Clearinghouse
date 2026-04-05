import React, { useState, useRef, useEffect, useMemo } from 'react'
import * as d3 from 'd3'
import { useApi } from '../hooks/useApi.js'
import { clearingApi } from '../api/clearing.js'
import { companiesApi } from '../api/companies.js'
import { MOCK_CLEARING_RESULT, MOCK_COMPANIES } from '../mock/data.js'
import { formatEur, formatPct } from '../utils/format.js'

/**
 * Normalize the real API ClearingCycleDetailOut into the shape that
 * the display components expect (same shape as MOCK_CLEARING_RESULT).
 *
 * Real API shape:
 *   { total_gross_cents, total_net_cents, savings_bps,
 *     results: [{ from_company_id, to_company_id, gross_amount_cents, net_amount_cents }],
 *     net_positions: [...] }
 *
 * Expected shape:
 *   { gross_cents, net_cents, savings_cents, savings_pct,
 *     pairs: [{ company_a, company_b, gross_a_to_b_cents, gross_b_to_a_cents, net_cents, savings_pct }] }
 */
function normalizeDetail(detail, companyMap) {
  if (!detail) return null

  // Already in mock shape (has gross_cents field)
  if (detail.gross_cents != null) return detail

  const grossCents   = detail.total_gross_cents ?? 0
  const netCents     = detail.total_net_cents   ?? 0
  const savingsCents = grossCents - netCents
  const savingsPct   = grossCents > 0 ? (savingsCents / grossCents) * 100 : 0

  const pairs = (detail.results ?? []).map(r => {
    const gross = r.gross_amount_cents ?? 0
    const net   = r.net_amount_cents   ?? 0
    // Reconstruct directional flows: payer (from) owed more than payee (to)
    // gross = A_to_B + B_to_A; net = A_to_B - B_to_A → A_to_B = (gross+net)/2
    const grossAtoB = Math.round((gross + net) / 2)
    const grossBtoA = gross - grossAtoB
    const pairSavingsPct = gross > 0 ? ((gross - net) / gross) * 100 : 0

    return {
      company_a:          companyMap[r.from_company_id] ?? { id: r.from_company_id, name: r.from_company_id },
      company_b:          companyMap[r.to_company_id]   ?? { id: r.to_company_id,   name: r.to_company_id   },
      gross_a_to_b_cents: grossAtoB,
      gross_b_to_a_cents: grossBtoA,
      net_cents:          net,
      savings_cents:      gross - net,
      savings_pct:        pairSavingsPct,
    }
  })

  return { gross_cents: grossCents, net_cents: netCents, savings_cents: savingsCents, savings_pct: savingsPct, pairs }
}

/** Horizontal bar chart: Before vs After */
function NettingBarChart({ grossCents, netCents, savingsCents, savingsPct }) {
  const maxVal = grossCents || 1
  const grossPct = 100
  const netBarPct = (netCents / maxVal) * 100

  return (
    <div style={{ padding: 'var(--space-6) 0' }}>
      {/* Gross bar */}
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)', fontSize: 'var(--font-size-sm)' }}>
          <span style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>Brutto (bilateral)</span>
          <span style={{ fontWeight: 700 }}>{formatEur(grossCents)}</span>
        </div>
        <div style={{ height: 40, borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: 'var(--color-surface-alt)', position: 'relative' }}>
          <div style={{
            width: `${grossPct}%`, height: '100%',
            background: 'linear-gradient(90deg, #c9bfaf, #a89f94)',
            display: 'flex', alignItems: 'center', paddingLeft: 'var(--space-4)',
            fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'white',
          }}>
            100 %
          </div>
        </div>
      </div>

      {/* Arrow */}
      <div style={{ textAlign: 'center', fontSize: 'var(--font-size-xl)', color: 'var(--color-primary)', marginBottom: 'var(--space-4)' }}>
        ↓ bilaterales Netting
      </div>

      {/* Net bar */}
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)', fontSize: 'var(--font-size-sm)' }}>
          <span style={{ fontWeight: 600, color: 'var(--color-primary-dk)' }}>Netto (nach Clearing)</span>
          <span style={{ fontWeight: 700, color: 'var(--color-primary-dk)' }}>{formatEur(netCents)}</span>
        </div>
        <div style={{ height: 40, borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: 'var(--color-surface-alt)', position: 'relative' }}>
          <div style={{
            width: `${netBarPct}%`, height: '100%',
            background: 'linear-gradient(90deg, var(--color-primary), #3a6147)',
            display: 'flex', alignItems: 'center', paddingLeft: 'var(--space-4)',
            fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'white',
            transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
          }}>
            {formatPct(100 - savingsPct)}
          </div>
        </div>
      </div>

      {/* Savings callout */}
      <div style={{
        background: 'var(--color-primary-lt)', border: '1px solid #c8dfd0',
        borderRadius: 'var(--radius-md)', padding: 'var(--space-4) var(--space-6)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary-dk)', fontWeight: 600, marginBottom: 2 }}>
            Freigesetztes Kapital
          </div>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-primary-dk)' }}>
            {formatEur(savingsCents)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary-dk)', fontWeight: 600, marginBottom: 2 }}>
            Einsparquote
          </div>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-primary)' }}>
            {formatPct(savingsPct)}
          </div>
        </div>
      </div>
    </div>
  )
}

/** D3 flow diagram for a bilateral pair */
function PairFlowDiagram({ pair }) {
  const svgRef = useRef(null)
  const W = 420, H = 120

  useEffect(() => {
    if (!svgRef.current || !pair) return
    d3.select(svgRef.current).selectAll('*').remove()

    const svg = d3.select(svgRef.current)
      .attr('viewBox', `0 0 ${W} ${H}`)
      .attr('width', '100%')
      .attr('height', H)

    const aName  = pair.company_a?.name || 'A'
    const bName  = pair.company_b?.name || 'B'
    const aToB   = pair.gross_a_to_b_cents
    const bToA   = pair.gross_b_to_a_cents
    const net    = pair.net_cents
    const winner = aToB > bToA ? 'B' : (bToA > aToB ? 'A' : null)

    // Node boxes
    const nodeW = 100, nodeH = 40, pad = 20
    const aX = pad, bX = W - pad - nodeW

    function nodeBox(x, name, color) {
      const g = svg.append('g').attr('transform', `translate(${x}, ${(H - nodeH) / 2})`)
      g.append('rect').attr('width', nodeW).attr('height', nodeH)
        .attr('rx', 8).attr('fill', color).attr('opacity', 0.15)
      g.append('rect').attr('width', nodeW).attr('height', nodeH)
        .attr('rx', 8).attr('fill', 'none').attr('stroke', color).attr('stroke-width', 2)
      g.append('text').attr('x', nodeW / 2).attr('y', nodeH / 2).attr('dy', '0.35em')
        .attr('text-anchor', 'middle').attr('font-size', 9).attr('font-family', 'DM Sans, sans-serif')
        .attr('fill', color).attr('font-weight', 700)
        .text(name.split(' ')[0].slice(0, 8))
    }

    nodeBox(aX, aName, '#4a7c59')
    nodeBox(bX, bName, '#c97a2f')

    const midX = W / 2
    const centerY = H / 2

    // Draw gross flows (gray, thinner, dashed)
    function drawArrow(fromX, toX, y, label, color, dashed = false) {
      const startX = fromX < toX ? fromX + nodeW : fromX
      const endX   = fromX < toX ? toX : toX + nodeW
      const path = `M${startX},${y} L${endX},${y}`
      svg.append('path').attr('d', path)
        .attr('stroke', color).attr('stroke-width', dashed ? 1.5 : 2.5)
        .attr('fill', 'none')
        .attr('stroke-dasharray', dashed ? '5,4' : null)
        .attr('marker-end', `url(#arr-${color.replace('#', '')})`)
      svg.append('text').attr('x', midX).attr('y', y - 5)
        .attr('text-anchor', 'middle').attr('font-size', 9)
        .attr('fill', color).attr('font-family', 'DM Sans, sans-serif')
        .text(label)
    }

    // Arrow markers
    ['#a89f94', '#4a7c59'].forEach(color => {
      svg.append('defs').append('marker')
        .attr('id', `arr-${color.replace('#', '')}`)
        .attr('viewBox', '0 -3 6 6').attr('refX', 6).attr('refY', 0)
        .attr('markerWidth', 5).attr('markerHeight', 5).attr('orient', 'auto')
        .append('path').attr('d', 'M0,-3L6,0L0,3').attr('fill', color)
    })

    if (aToB > 0) drawArrow(aX, bX, centerY - 14, formatEur(aToB), '#a89f94', true)
    if (bToA > 0) drawArrow(bX, aX, centerY + 14, formatEur(bToA), '#a89f94', true)

    // Net arrow
    if (net > 0) {
      const netFrom = winner === 'B' ? aX : bX
      const netTo   = winner === 'B' ? bX : aX
      drawArrow(netFrom, netTo, centerY, `Netto: ${formatEur(net)}`, '#4a7c59')
    } else {
      svg.append('text').attr('x', midX).attr('y', centerY + 4)
        .attr('text-anchor', 'middle').attr('font-size', 10)
        .attr('fill', '#4a7c59').attr('font-weight', 700)
        .attr('font-family', 'DM Sans, sans-serif')
        .text('Vollständig verrechnet ✓')
    }
  }, [pair])

  return <svg ref={svgRef} style={{ width: '100%' }} />
}

function PairRow({ pair }) {
  const [open, setOpen] = useState(false)
  const aName = pair.company_a?.name || 'A'
  const bName = pair.company_b?.name || 'B'
  const savings = pair.savings_pct

  return (
    <div style={{ borderBottom: '1px solid var(--color-border)' }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
          padding: 'var(--space-4) var(--space-5)', cursor: 'pointer',
          transition: 'background 0.1s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface-alt)'}
        onMouseLeave={e => e.currentTarget.style.background = ''}
      >
        <div style={{ flex: 1, fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>
          {aName} ⇄ {bName}
        </div>
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
          {formatEur(pair.gross_a_to_b_cents + pair.gross_b_to_a_cents)} brutto
        </div>
        <div style={{ minWidth: 80, textAlign: 'right' }}>
          <span className={`badge ${savings > 0 ? 'badge-green' : 'badge-gray'}`}>
            {savings > 0 ? `${formatPct(savings)} gespart` : 'kein Netting'}
          </span>
        </div>
        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85em' }}>{open ? '▲' : '▼'}</div>
      </div>
      {open && (
        <div style={{ padding: '0 var(--space-5) var(--space-5)', background: 'var(--color-surface-alt)' }}>
          <PairFlowDiagram pair={pair} />
        </div>
      )}
    </div>
  )
}

export default function Clearing() {
  const [running, setRunning] = useState(false)
  const [runMsg, setRunMsg]   = useState(null)

  const { data: companiesRaw } = useApi(() => companiesApi.list(), MOCK_COMPANIES)

  const companyMap = useMemo(() => {
    const map = {}
    const list = Array.isArray(companiesRaw) ? companiesRaw : []
    list.forEach(c => { map[c.id] = c })
    return map
  }, [companiesRaw])

  const { data: cycles, loading: cyclesLoading, reload: reloadCycles } = useApi(
    () => clearingApi.listCycles(),
    []
  )

  // Load results for latest cycle
  const latestCycleId = Array.isArray(cycles) && cycles.length > 0 ? cycles[0]?.id : null

  const { data: rawResult, loading: resultLoading, useMock } = useApi(
    () => latestCycleId ? clearingApi.getResults(latestCycleId) : Promise.resolve(null),
    MOCK_CLEARING_RESULT,
    [latestCycleId]
  )

  const loading = cyclesLoading || resultLoading

  const result = useMemo(
    () => normalizeDetail(rawResult, companyMap) || MOCK_CLEARING_RESULT,
    [rawResult, companyMap]
  )

  async function handleRunClearing() {
    setRunning(true)
    setRunMsg(null)
    try {
      await clearingApi.run()
      setRunMsg('Clearing erfolgreich gestartet!')
      reloadCycles()
    } catch (e) {
      setRunMsg(`Fehler beim Clearing: ${e.message}`)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-8)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, marginBottom: 'var(--space-1)' }}>
            Clearing
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
            Bilaterales Netting — Brutto vs. Netto Verpflichtungen
          </p>
          {useMock && (
            <div style={{ marginTop: 'var(--space-3)', fontSize: 'var(--font-size-xs)', color: 'var(--color-accent)', fontStyle: 'italic' }}>
              Demo-Ergebnis — Backend noch nicht verbunden
            </div>
          )}
        </div>
        <button
          className="btn btn-primary"
          onClick={handleRunClearing}
          disabled={running}
          style={{ minWidth: 180 }}
        >
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

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-16)' }}>
          <span className="loading-spinner" />
        </div>
      ) : result ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
          {/* Before/After bar chart */}
          <div className="card">
            <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
              Brutto → Netto
            </h2>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
              Letztes bilaterales Clearing
            </div>
            <NettingBarChart
              grossCents={result.gross_cents}
              netCents={result.net_cents}
              savingsCents={result.savings_cents}
              savingsPct={result.savings_pct}
            />
          </div>

          {/* Summary stats */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="card" style={{ background: 'var(--color-primary-lt)', border: '1px solid #c8dfd0' }}>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary-dk)', fontWeight: 600, marginBottom: 'var(--space-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Brutto-Verpflichtungen
              </div>
              <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-text)' }}>
                {formatEur(result.gross_cents)}
              </div>
            </div>
            <div className="card" style={{ background: 'var(--color-accent-lt)', border: '1px solid #f2d5b0' }}>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-accent)', fontWeight: 600, marginBottom: 'var(--space-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Netto nach Clearing
              </div>
              <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-text)' }}>
                {formatEur(result.net_cents)}
              </div>
            </div>
            <div className="card" style={{ background: '#eef5f1', border: '2px solid var(--color-primary)' }}>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary-dk)', fontWeight: 600, marginBottom: 'var(--space-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Freigesetztes Kapital
              </div>
              <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, color: 'var(--color-primary-dk)' }}>
                {formatEur(result.savings_cents)}
              </div>
              <div style={{ fontSize: 'var(--font-size-lg)', color: 'var(--color-primary)', fontWeight: 600, marginTop: 'var(--space-1)' }}>
                {formatPct(result.savings_pct)} Einsparung
              </div>
            </div>
          </div>

          {/* Pair breakdown — full width */}
          <div className="card" style={{ gridColumn: '1 / -1', padding: 0, overflow: 'hidden' }}>
            <div style={{
              padding: 'var(--space-4) var(--space-5)',
              borderBottom: '2px solid var(--color-border)',
              fontWeight: 700, fontSize: 'var(--font-size-md)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>Unternehmenspaar-Analyse</span>
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', fontWeight: 400 }}>
                {result.pairs?.length || 0} Paare analysiert
              </span>
            </div>
            {(result.pairs || []).map((pair, i) => (
              <PairRow key={i} pair={pair} />
            ))}
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 'var(--space-16)', color: 'var(--color-text-muted)' }}>
          Noch kein Clearing durchgeführt. Klicken Sie auf „Clearing starten".
        </div>
      )}
    </div>
  )
}
