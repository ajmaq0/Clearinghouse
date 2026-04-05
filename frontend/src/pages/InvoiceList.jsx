import React, { useEffect, useState } from 'react'
import { invoicesApi } from '../api/invoices.js'
import { companiesApi } from '../api/companies.js'

const MOCK_INVOICES = [
  { id: 'RE-001', debtor: 'Schreiber & Co. KG',      creditor: 'Müller Logistik GmbH',    amount: 45000, status: 'offen',      dueDate: '15.04.2026' },
  { id: 'RE-002', debtor: 'Müller Logistik GmbH',    creditor: 'Schreiber & Co. KG',      amount: 30000, status: 'offen',      dueDate: '18.04.2026' },
  { id: 'RE-003', debtor: 'Hafentechnik Hamburg AG', creditor: 'Schreiber & Co. KG',      amount: 62000, status: 'bestätigt',  dueDate: '20.04.2026' },
  { id: 'RE-004', debtor: 'Elbe Import Export',      creditor: 'Nordsee Fisch GmbH',      amount: 28000, status: 'offen',      dueDate: '22.04.2026' },
  { id: 'RE-005', debtor: 'Nordsee Fisch GmbH',      creditor: 'Elbe Import Export',      amount: 15000, status: 'bestätigt',  dueDate: '12.04.2026' },
  { id: 'RE-006', debtor: 'Müller Logistik GmbH',    creditor: 'Altonaer Maschinenbau',   amount: 22000, status: 'offen',      dueDate: '30.04.2026' },
  { id: 'RE-007', debtor: 'Altonaer Maschinenbau',   creditor: 'Müller Logistik GmbH',    amount: 38000, status: 'verrechnet', dueDate: '08.04.2026' },
  { id: 'RE-008', debtor: 'Harburg Textil GmbH',     creditor: 'Nordsee Fisch GmbH',      amount: 19000, status: 'verrechnet', dueDate: '10.04.2026' },
]

const STATUS_STYLE = {
  'offen':      { badgeClass: 'badge-amber', label: 'Offen'      },
  'bestätigt':  { badgeClass: 'badge-green', label: 'Bestätigt'  },
  'verrechnet': { badgeClass: 'badge-gray',  label: 'Verrechnet' },
}

function formatEur(v) {
  return v.toLocaleString('de-DE') + ' €'
}

export default function InvoiceList() {
  const [invoices, setInvoices] = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState('alle')

  useEffect(() => {
    invoicesApi.list()
      .then(data => setInvoices(Array.isArray(data) ? data : data.invoices || MOCK_INVOICES))
      .catch(() => setInvoices(MOCK_INVOICES))
      .finally(() => setLoading(false))
  }, [])

  const displayed = (invoices || MOCK_INVOICES).filter(inv =>
    filter === 'alle' || inv.status === filter
  )

  const total = displayed.reduce((s, inv) => s + (inv.amount || 0), 0)

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Rechnungen</h1>
        <p className="page-subtitle">
          Alle Rechnungen im aktuellen Verrechnungszyklus
        </p>
      </div>

      <div className="card">
        <div className="toolbar">
          <h2 className="toolbar-title">
            {displayed.length} Rechnungen · {formatEur(total)}
          </h2>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {['alle', 'offen', 'bestätigt', 'verrechnet'].map(f => (
              <button
                key={f}
                className={`btn ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: 'var(--space-2) var(--space-4)', fontSize: 'var(--font-size-xs)' }}
                onClick={() => setFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="state-loading">
            <div className="loading-spinner" />
            <p>Lade Rechnungen…</p>
          </div>
        ) : displayed.length === 0 ? (
          <div className="state-empty">Keine Rechnungen gefunden.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Nr.</th>
                <th>Schuldner</th>
                <th>Gläubiger</th>
                <th style={{ textAlign: 'right' }}>Betrag</th>
                <th>Fällig</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map(inv => {
                const s = STATUS_STYLE[inv.status] || STATUS_STYLE['offen']
                return (
                  <tr key={inv.id}>
                    <td style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>{inv.id}</td>
                    <td>{inv.debtor}</td>
                    <td>{inv.creditor}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatEur(inv.amount)}</td>
                    <td style={{ color: 'var(--color-text-muted)' }}>{inv.dueDate}</td>
                    <td>
                      <span className={`badge ${s.badgeClass}`}>{s.label}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Summary footer */}
      <div style={{
        marginTop: 'var(--space-6)',
        display: 'flex',
        gap: 'var(--space-4)',
        flexWrap: 'wrap',
      }}>
        {['offen', 'bestätigt', 'verrechnet'].map(status => {
          const items = (invoices || MOCK_INVOICES).filter(i => i.status === status)
          const vol   = items.reduce((s, i) => s + i.amount, 0)
          const s     = STATUS_STYLE[status]
          return (
            <div key={status} className="card" style={{ flex: '1 1 180px' }}>
              <div className="kpi-label">{s.label}</div>
              <div className="kpi-value" style={{ fontSize: 'var(--font-size-xl)' }}>
                {items.length}
              </div>
              <div className="kpi-delta">{formatEur(vol)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
