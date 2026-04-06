import React, { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { useApi } from '../hooks/useApi.js'
import { clearingApi } from '../api/clearing.js'
import { MOCK_CLEARING_HISTORY } from '../mock/fullDataset.js'
import { formatEur, formatPct } from '../utils/format.js'

function linearTrend(cycles) {
  const n = cycles.length
  if (n < 2) return []
  const xMean = (n - 1) / 2
  const yMean = d3.mean(cycles, d => d.savings_pct)
  let num = 0, den = 0
  cycles.forEach((d, i) => {
    num += (i - xMean) * (d.savings_pct - yMean)
    den += (i - xMean) ** 2
  })
  const slope = den ? num / den : 0
  const intercept = yMean - slope * xMean
  return cycles.map((_, i) => ({ x: i, y: slope * i + intercept }))
}

export default function ClearingVerlauf() {
  const svgRef = useRef(null)
  const [selected, setSelected] = useState(null)

  const { data: raw } = useApi(
    () => clearingApi.history(),
    MOCK_CLEARING_HISTORY
  )

  // API returns most-recent first; reverse to oldest-first for the timeline
  const cycles = raw?.cycles ? [...raw.cycles].reverse() : []

  useEffect(() => {
    if (!cycles.length || !svgRef.current) return

    const el = svgRef.current
    const W = el.clientWidth || 600
    const H = 220
    const M = { top: 24, right: 24, bottom: 44, left: 52 }
    const iW = W - M.left - M.right
    const iH = H - M.top - M.bottom

    d3.select(el).selectAll('*').remove()

    const svg = d3.select(el)
      .attr('viewBox', `0 0 ${W} ${H}`)
      .attr('width', '100%')
      .attr('height', H)

    const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`)

    const x = d3.scaleBand()
      .domain(cycles.map((_, i) => i))
      .range([0, iW])
      .padding(0.28)

    const allPct = cycles.map(d => d.savings_pct)
    const yMin = Math.max(0, d3.min(allPct) - 8)
    const yMax = Math.min(100, d3.max(allPct) + 8)
    const y = d3.scaleLinear().domain([yMin, yMax]).range([iH, 0]).nice()

    // Gridlines
    g.append('g')
      .selectAll('line.grid')
      .data(y.ticks(4))
      .join('line')
      .attr('x1', 0).attr('x2', iW)
      .attr('y1', d => y(d)).attr('y2', d => y(d))
      .attr('stroke', '#e8e0d4')
      .attr('stroke-dasharray', '3,3')

    // X axis
    g.append('g')
      .attr('transform', `translate(0,${iH})`)
      .call(
        d3.axisBottom(x).tickFormat(i => {
          const d = new Date(cycles[i].completed_at)
          return d.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' })
        })
      )
      .call(ax => ax.select('.domain').remove())
      .call(ax => ax.selectAll('text')
        .attr('font-size', 11)
        .attr('fill', '#7a6e64')
        .attr('font-family', 'DM Sans, sans-serif'))
      .call(ax => ax.selectAll('.tick line').remove())

    // Y axis
    g.append('g')
      .call(d3.axisLeft(y).ticks(4).tickFormat(d => d + ' %'))
      .call(ax => ax.select('.domain').remove())
      .call(ax => ax.selectAll('text')
        .attr('font-size', 11)
        .attr('fill', '#7a6e64')
        .attr('font-family', 'DM Sans, sans-serif'))
      .call(ax => ax.selectAll('.tick line').remove())

    // Bars
    g.selectAll('rect.bar')
      .data(cycles)
      .join('rect')
      .attr('class', 'bar')
      .attr('x', (_, i) => x(i))
      .attr('y', d => y(d.savings_pct))
      .attr('width', x.bandwidth())
      .attr('height', d => iH - y(d.savings_pct))
      .attr('rx', 4)
      .attr('fill', d => selected?.id === d.id ? '#3a6147' : '#4a7c59')
      .attr('opacity', d => (selected && selected.id !== d.id) ? 0.5 : 1)
      .style('cursor', 'pointer')
      .on('click', (_, d) => setSelected(prev => prev?.id === d.id ? null : d))

    // Value labels above bars
    g.selectAll('text.bar-label')
      .data(cycles)
      .join('text')
      .attr('class', 'bar-label')
      .attr('x', (_, i) => x(i) + x.bandwidth() / 2)
      .attr('y', d => y(d.savings_pct) - 5)
      .attr('text-anchor', 'middle')
      .attr('font-size', 10)
      .attr('font-family', 'DM Sans, sans-serif')
      .attr('fill', '#2d2520')
      .attr('font-weight', 600)
      .text(d => d.savings_pct.toFixed(1).replace('.', ',') + '%')

    // Trend line
    const trend = linearTrend(cycles)
    const lineGen = d3.line()
      .x(d => x(d.x) + x.bandwidth() / 2)
      .y(d => y(d.y))

    g.append('path')
      .datum(trend)
      .attr('fill', 'none')
      .attr('stroke', '#c97a2f')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '5,3')
      .attr('d', lineGen)

  }, [cycles, selected])

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{
        padding: 'var(--space-4) var(--space-6) var(--space-3)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
            Clearing-Verlauf
          </span>
          <span style={{ marginLeft: 'var(--space-3)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-light)' }}>
            Liquiditätsentlastung % je Zyklus · Balken anklicken für Details
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-light)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span style={{ width: 12, height: 12, borderRadius: 2, background: '#4a7c59', display: 'inline-block' }} />
            Einsparung
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span style={{ width: 18, borderTop: '2px dashed #c97a2f', display: 'inline-block' }} />
            Trend
          </span>
        </div>
      </div>

      {/* Chart */}
      <div style={{ padding: 'var(--space-2) var(--space-4) var(--space-2)' }}>
        <svg ref={svgRef} style={{ display: 'block', width: '100%' }} />
      </div>

      {/* Cycle detail panel (shown on bar click) */}
      {selected && (
        <div style={{
          margin: '0 var(--space-6) var(--space-4)',
          padding: 'var(--space-4) var(--space-5)',
          background: 'var(--color-primary-lt)',
          border: '1px solid #c8dfd0',
          borderRadius: 'var(--radius-md)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
          gap: 'var(--space-4)',
        }}>
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Datum</div>
            <div style={{ fontWeight: 700, color: 'var(--color-primary-dk)' }}>
              {new Date(selected.completed_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Einsparung</div>
            <div style={{ fontWeight: 700, color: 'var(--color-primary-dk)', fontSize: 'var(--font-size-lg)' }}>
              {formatPct(selected.savings_pct)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Brutto</div>
            <div style={{ fontWeight: 600 }}>{formatEur(selected.gross_cents)}</div>
          </div>
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Netto</div>
            <div style={{ fontWeight: 600, color: 'var(--color-accent)' }}>{formatEur(selected.net_cents)}</div>
          </div>
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Rechnungen</div>
            <div style={{ fontWeight: 600 }}>{selected.invoice_count}</div>
          </div>
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Unternehmen</div>
            <div style={{ fontWeight: 600 }}>{selected.company_count}</div>
          </div>
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Methode</div>
            <div>
              <span className="badge badge-gray" style={{ textTransform: 'capitalize' }}>
                {selected.netting_type}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Footer pitch line */}
      <div style={{
        padding: 'var(--space-3) var(--space-6)',
        borderTop: '1px solid var(--color-border)',
        fontSize: 'var(--font-size-xs)',
        color: 'var(--color-text-light)',
        fontStyle: 'italic',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>„Monat für Monat spart das Netzwerk Liquidität"</span>
        {cycles.length > 0 && (
          <span>{cycles.length} Zyklen dokumentiert</span>
        )}
      </div>
    </div>
  )
}
