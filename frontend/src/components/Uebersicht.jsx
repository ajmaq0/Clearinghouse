import React, { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { useApi } from '../hooks/useApi.js'
import { networkApi } from '../api/network.js'
import { companiesApi } from '../api/companies.js'
import { invoicesApi } from '../api/invoices.js'
import { MOCK_NETWORK_STATS, MOCK_COMPANIES, MOCK_INVOICES } from '../mock/data.js'
import { formatEur, formatPct, formatHours } from '../utils/format.js'

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="card" style={{ flex: '1 1 200px', minWidth: 180 }}>
      <div style={{
        fontSize: 'var(--font-size-xs)', fontWeight: 600, letterSpacing: '0.05em',
        color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 'var(--space-2)'
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 'var(--font-size-2xl)', fontWeight: 700,
        color: accent ? 'var(--color-primary)' : 'var(--color-text)',
        lineHeight: 1.15,
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
          {sub}
        </div>
      )}
    </div>
  )
}

function MiniNetworkGraph({ companies, invoices }) {
  const svgRef = useRef(null)

  useEffect(() => {
    if (!companies?.length || !invoices?.length || !svgRef.current) return

    const el = svgRef.current
    const W = el.clientWidth || 400
    const H = 300

    d3.select(el).selectAll('*').remove()
    const svg = d3.select(el)
      .attr('viewBox', `0 0 ${W} ${H}`)
      .attr('width', '100%')
      .attr('height', H)

    // Build node + link data
    const nodeMap = {}
    companies.forEach(c => { nodeMap[c.id] = { id: c.id, name: c.name, sector: c.sector, gls: c.gls_member } })

    const nodes = Object.values(nodeMap)
    const links = invoices.map(inv => ({
      source: inv.from_company?.id || inv.from_company,
      target: inv.to_company?.id   || inv.to_company,
      value:  inv.total_amount_cents,
    })).filter(l => nodeMap[l.source] && nodeMap[l.target])

    const sectorColor = {
      'Port/Logistik':  '#4a7c59',
      'Lebensmittel':   '#c97a2f',
      'Erneuerbare':    '#2c6e8a',
    }

    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(80).strength(0.6))
      .force('charge', d3.forceManyBody().strength(-120))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide(28))

    // Arrow marker
    svg.append('defs').append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -4 8 8')
      .attr('refX', 20).attr('refY', 0)
      .attr('markerWidth', 5).attr('markerHeight', 5)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-4L8,0L0,4')
      .attr('fill', '#c9bfaf')

    const link = svg.append('g').selectAll('line')
      .data(links).join('line')
      .attr('stroke', '#e8e0d4').attr('stroke-width', d => Math.max(1, Math.log(d.value / 100000) * 0.8))
      .attr('marker-end', 'url(#arrow)')

    const node = svg.append('g').selectAll('g')
      .data(nodes).join('g')
      .call(d3.drag()
        .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
        .on('drag',  (e, d) => { d.fx = e.x; d.fy = e.y })
        .on('end',   (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null }))

    node.append('circle')
      .attr('r', d => d.gls ? 16 : 12)
      .attr('fill', d => sectorColor[d.sector] || '#7a6e64')
      .attr('opacity', d => d.gls ? 1 : 0.55)
      .attr('stroke', 'white')
      .attr('stroke-width', 2)

    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', 9)
      .attr('font-family', 'DM Sans, sans-serif')
      .attr('fill', 'white')
      .attr('font-weight', 700)
      .text(d => d.name.split(' ')[0].slice(0, 4))

    node.append('title').text(d => `${d.name} (${d.sector})`)

    sim.on('tick', () => {
      link
        .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x).attr('y2', d => d.target.y)
      node.attr('transform', d => `translate(${d.x},${d.y})`)
    })

    return () => sim.stop()
  }, [companies, invoices])

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{
        padding: 'var(--space-4) var(--space-6) var(--space-3)',
        borderBottom: '1px solid var(--color-border)',
        fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)'
      }}>
        Handelsnetzwerk Hamburg
        <span style={{
          marginLeft: 'var(--space-3)', fontWeight: 400, fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-light)'
        }}>
          ◎ GLS-Mitglied &nbsp;○ Nicht-Mitglied
        </span>
      </div>
      <svg ref={svgRef} style={{ display: 'block', width: '100%' }} />
      <div style={{
        padding: 'var(--space-3) var(--space-6)',
        borderTop: '1px solid var(--color-border)',
        display: 'flex', gap: 'var(--space-6)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)'
      }}>
        {[
          { color: '#4a7c59', label: 'Port/Logistik' },
          { color: '#c97a2f', label: 'Lebensmittel' },
          { color: '#2c6e8a', label: 'Erneuerbare' },
        ].map(({ color, label }) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block' }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

function ClearingCountdown({ hoursLeft }) {
  if (hoursLeft == null) return null
  const h = Math.floor(hoursLeft)
  const m = Math.round((hoursLeft - h) * 60)
  return (
    <div className="card" style={{
      background: 'var(--color-primary-lt)',
      border: '1px solid #c8dfd0',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 'var(--space-6)', flex: '0 0 220px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, letterSpacing: '0.05em', color: 'var(--color-primary-dk)', textTransform: 'uppercase', marginBottom: 'var(--space-3)' }}>
        Nächstes Clearing in
      </div>
      <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, color: 'var(--color-primary-dk)', lineHeight: 1 }}>
        {h}<span style={{ fontSize: 'var(--font-size-lg)' }}>h</span>
        {m > 0 && <>{' '}{m}<span style={{ fontSize: 'var(--font-size-lg)' }}>m</span></>}
      </div>
      <div style={{ marginTop: 'var(--space-4)', fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)' }}>
        Bilaterales Netting
      </div>
    </div>
  )
}

export default function Uebersicht() {
  const { data: stats, loading: statsLoading, useMock: statsMock } = useApi(
    () => networkApi.stats(),
    MOCK_NETWORK_STATS
  )
  const { data: companies, loading: coLoading } = useApi(
    () => companiesApi.list(),
    MOCK_COMPANIES
  )
  const { data: invoicesRaw, loading: invLoading } = useApi(
    () => invoicesApi.list(),
    MOCK_INVOICES
  )

  const loading = statsLoading || coLoading || invLoading
  const invoices = Array.isArray(invoicesRaw)
    ? invoicesRaw
    : (invoicesRaw?.items || [])

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, marginBottom: 'var(--space-1)' }}>
          Übersicht
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
          Netzwerkgesundheit und Clearing-Status auf einen Blick
        </p>
        {statsMock && (
          <div style={{ marginTop: 'var(--space-3)', fontSize: 'var(--font-size-xs)', color: 'var(--color-accent)', fontStyle: 'italic' }}>
            Demo-Daten — Backend noch nicht verbunden
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-16)' }}>
          <span className="loading-spinner" />
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', marginBottom: 'var(--space-6)' }}>
            <ClearingCountdown hoursLeft={stats?.next_clearing_in_hours} />

            <StatCard
              label="Teilnehmende Unternehmen"
              value={stats?.company_count ?? '—'}
              sub={`${stats?.invoice_count ?? '—'} aktive Rechnungen`}
            />
            <StatCard
              label="Letztes Clearing — Einsparung"
              value={formatEur(stats?.last_clearing_savings_cents)}
              sub={`${formatPct(stats?.last_clearing_savings_pct)} von ${formatEur(stats?.gross_total_cents)} Brutto`}
              accent
            />
            <StatCard
              label="Bestätigte Rechnungen"
              value={stats?.confirmed_invoice_count ?? '—'}
              sub={`von ${stats?.invoice_count ?? '—'} gesamt`}
            />
          </div>

          {/* Savings highlight banner */}
          {stats?.last_clearing_savings_cents > 0 && (
            <div style={{
              background: 'linear-gradient(135deg, var(--color-primary-lt), #dff0e6)',
              border: '1px solid #c8dfd0',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-6) var(--space-8)',
              marginBottom: 'var(--space-6)',
              display: 'flex', alignItems: 'center', gap: 'var(--space-8)',
            }}>
              <div>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-primary-dk)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                  Letztes bilaterales Clearing
                </div>
                <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-primary-dk)' }}>
                  {formatEur(stats.last_clearing_savings_cents)} freigesetzt
                </div>
              </div>
              <div style={{ width: 1, height: 50, background: '#c8dfd0' }} />
              <div>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-primary-dk)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                  aus {formatEur(stats.gross_total_cents)} Brutto
                </div>
                <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-primary)' }}>
                  {formatPct(stats.last_clearing_savings_pct)} Einsparung
                </div>
              </div>
              <div style={{ marginLeft: 'auto', fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', fontStyle: 'italic', maxWidth: 200, textAlign: 'right' }}>
                „70 % der Unternehmen könnten pünktlich zahlen, wenn sie pünktlich bezahlt würden."
              </div>
            </div>
          )}

          {/* Network graph */}
          {companies?.length > 0 && invoices?.length > 0 && (
            <MiniNetworkGraph companies={companies} invoices={invoices} />
          )}
        </>
      )}
    </div>
  )
}
