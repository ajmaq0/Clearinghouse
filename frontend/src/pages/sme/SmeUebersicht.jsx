import React, { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { useRole } from '../../hooks/RoleContext.jsx'
import { useApi } from '../../hooks/useApi.js'
import { smeApi } from '../../api/sme.js'
import { invoicesApi } from '../../api/invoices.js'
import { MOCK_COMPANY_POSITIONS, MOCK_INVOICES, MOCK_COMPANIES } from '../../mock/fullDataset.js'
import { formatEur, formatDate } from '../../utils/format.js'

const STATUS_LABELS = {
  confirmed: 'Bestätigt',
  pending:   'Offen',
  draft:     'Entwurf',
  cleared:   'Verrechnet',
}
const STATUS_COLORS = {
  confirmed: 'badge-green',
  pending:   'badge-amber',
  draft:     'badge-gray',
  cleared:   'badge-blue',
}

function KpiCard({ label, value, sub, color }) {
  const borderColors = {
    green: 'var(--color-primary)',
    red:   'var(--color-danger)',
    amber: 'var(--color-accent)',
    blue:  'var(--color-info)',
  }
  return (
    <div className="card" style={{ flex: '1 1 180px', minWidth: 160, borderTop: `3px solid ${borderColors[color] || borderColors.green}` }}>
      <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>
        {label}
      </div>
      <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.15 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>{sub}</div>}
    </div>
  )
}

function ClearingCountdown({ days, confirmed, open }) {
  const total = confirmed + open || 1
  const pct = Math.round((confirmed / total) * 100)
  return (
    <div className="card" style={{ flex: '0 0 220px' }}>
      <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
        Clearing-Countdown
      </div>
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-4)' }}>
        <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: 'var(--color-primary)', lineHeight: 1 }}>{days}</div>
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Tage bis Monatsende</div>
      </div>
      <div style={{ marginBottom: 'var(--space-2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 4 }}>
          <span>{confirmed} bestätigt</span>
          <span>{pct} %</span>
        </div>
        <div style={{ height: 8, background: 'var(--color-border)', borderRadius: 99 }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--color-primary)', borderRadius: 99, transition: 'width 0.5s' }} />
        </div>
      </div>
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
        {open} Rechnung{open !== 1 ? 'en' : ''} ausstehend
      </div>
    </div>
  )
}

function MiniTradeGraph({ companyId, companies, invoices }) {
  const svgRef = useRef(null)
  useEffect(() => {
    if (!companies?.length || !invoices?.length || !svgRef.current) return
    const el = svgRef.current
    const W = el.clientWidth || 360
    const H = 220

    // Filter edges involving this company
    const myInvoices = invoices.filter(inv =>
      inv.from_company?.id === companyId || inv.to_company?.id === companyId
    )
    const relatedIds = new Set([companyId])
    myInvoices.forEach(inv => {
      relatedIds.add(inv.from_company?.id)
      relatedIds.add(inv.to_company?.id)
    })

    const companyMap = {}
    companies.forEach(c => { companyMap[c.id] = c })

    const nodes = [...relatedIds].filter(id => companyMap[id]).map(id => ({
      id, name: companyMap[id].name, isMe: id === companyId,
    }))
    const links = myInvoices.map(inv => ({
      source: inv.from_company?.id, target: inv.to_company?.id,
      value: inv.total_amount_cents,
    })).filter(l => relatedIds.has(l.source) && relatedIds.has(l.target))

    d3.select(el).selectAll('*').remove()
    const svg = d3.select(el).attr('viewBox', `0 0 ${W} ${H}`).attr('width', '100%').attr('height', H)

    svg.append('defs').append('marker')
      .attr('id', 'sme-arrow').attr('viewBox', '0 -4 8 8')
      .attr('refX', 22).attr('refY', 0)
      .attr('markerWidth', 5).attr('markerHeight', 5)
      .attr('orient', 'auto')
      .append('path').attr('d', 'M0,-4L8,0L0,4').attr('fill', '#999')

    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(90).strength(0.5))
      .force('charge', d3.forceManyBody().strength(-140))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide(32))

    const link = svg.append('g').selectAll('line').data(links).join('line')
      .attr('stroke', '#d0cac3').attr('stroke-width', 2).attr('marker-end', 'url(#sme-arrow)')

    const node = svg.append('g').selectAll('g').data(nodes).join('g')
    node.append('circle')
      .attr('r', d => d.isMe ? 22 : 16)
      .attr('fill', d => d.isMe ? 'var(--color-primary)' : 'var(--color-surface-alt)')
      .attr('stroke', d => d.isMe ? 'var(--color-primary-dk)' : 'var(--color-border)')
      .attr('stroke-width', 2)
    node.append('text')
      .attr('text-anchor', 'middle').attr('dy', '0.35em')
      .attr('font-size', d => d.isMe ? 11 : 9)
      .attr('font-weight', 700)
      .attr('fill', d => d.isMe ? '#fff' : 'var(--color-text-muted)')
      .text(d => d.name.split(' ')[0].substring(0, 6))

    sim.on('tick', () => {
      link.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x).attr('y2', d => d.target.y)
      node.attr('transform', d => `translate(${d.x},${d.y})`)
    })

    return () => sim.stop()
  }, [companyId, companies, invoices])

  return <svg ref={svgRef} style={{ width: '100%', height: 220 }} />
}

export default function SmeUebersicht() {
  const { companyId } = useRole()
  const effectiveId = companyId || 'c4'

  const mockPos = MOCK_COMPANY_POSITIONS[effectiveId] || MOCK_COMPANY_POSITIONS.default
  const mockInv = MOCK_INVOICES.filter(inv =>
    inv.from_company?.id === effectiveId || inv.to_company?.id === effectiveId
  )

  const { data: position } = useApi(
    () => smeApi.companyPosition(effectiveId),
    mockPos,
    [effectiveId]
  )
  const { data: invoices } = useApi(
    () => smeApi.companyInvoices(effectiveId),
    mockInv,
    [effectiveId]
  )

  const pos = position || mockPos
  const invList = (Array.isArray(invoices) ? invoices : (invoices?.items || mockInv))
    .filter(inv => inv.from_company?.id === effectiveId || inv.to_company?.id === effectiveId)

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Übersicht</h1>
        <p className="page-subtitle">Ihre Finanzlage im GLS Clearing-Netzwerk</p>
      </div>

      {/* KPI row */}
      <div style={{ display: 'flex', gap: 'var(--space-5)', flexWrap: 'wrap', marginBottom: 'var(--space-8)' }}>
        <KpiCard label="Offene Rechnungen"   value={pos.open_invoice_count}     sub={`${pos.confirmed_invoice_count} bestätigt`} color="blue" />
        <KpiCard label="Brutto-Verbindl."    value={formatEur(pos.gross_payable_cents)}    sub="Zu zahlen" color="red" />
        <KpiCard label="Nach Clearing"       value={formatEur(pos.net_after_clearing_cents)} sub="Optimiertes Netto" color="green" />
        <KpiCard label="Meine Einsparung"    value={formatEur(pos.savings_cents)}  sub={`${Number(pos.savings_pct).toFixed(1).replace('.', ',')} % weniger`} color="amber" />
        <ClearingCountdown
          days={pos.days_until_clearing}
          confirmed={pos.confirmed_invoice_count}
          open={pos.open_invoice_count - pos.confirmed_invoice_count}
        />
      </div>

      {/* Trade graph + Recent invoices */}
      <div className="content-grid">
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 'var(--space-4)', color: 'var(--color-text)' }}>
            Direkte Handelspartner
          </div>
          <MiniTradeGraph
            companyId={effectiveId}
            companies={MOCK_COMPANIES}
            invoices={MOCK_INVOICES}
          />
        </div>

        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 'var(--space-4)', color: 'var(--color-text)' }}>
            Letzte Rechnungen
          </div>
          {invList.length === 0 ? (
            <div className="state-empty" style={{ padding: 'var(--space-8) 0' }}>Keine Rechnungen vorhanden.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>Partner</th><th>Betrag</th><th>Fällig</th><th>Status</th></tr>
              </thead>
              <tbody>
                {invList.slice(0, 5).map(inv => {
                  const isOut = inv.from_company?.id === effectiveId
                  const partner = isOut ? inv.to_company : inv.from_company
                  return (
                    <tr key={inv.id}>
                      <td>
                        <span style={{ marginRight: 6, color: isOut ? 'var(--color-danger)' : 'var(--color-primary)' }}>
                          {isOut ? '→' : '←'}
                        </span>
                        {partner?.name || '—'}
                      </td>
                      <td style={{ fontWeight: 600 }}>{formatEur(inv.total_amount_cents)}</td>
                      <td style={{ color: 'var(--color-text-muted)' }}>{formatDate(inv.due_date)}</td>
                      <td>
                        <span className={`badge ${STATUS_COLORS[inv.status] || 'badge-gray'}`}>
                          {STATUS_LABELS[inv.status] || inv.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
