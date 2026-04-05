import React, { useEffect, useState } from 'react'
import { networkApi } from '../api/network.js'
import { clearingApi } from '../api/clearing.js'
import { companiesApi } from '../api/companies.js'

const MOCK_STATS = {
  totalCompanies: 50,
  totalInvoices: 312,
  totalGrossVolume: 4820000,
  lastCycleSavings: 63.4,
  activeSector: 'Handel',
}

const MOCK_TOP_POSITIONS = [
  { name: 'Müller Logistik GmbH',    sector: 'Logistik',  netPosition:  142000 },
  { name: 'Schreiber & Co. KG',      sector: 'Handel',    netPosition:  98500  },
  { name: 'Hafentechnik Hamburg AG', sector: 'Technik',   netPosition: -67200  },
  { name: 'Nordsee Fisch GmbH',      sector: 'Lebensmit.',netPosition:  55000  },
  { name: 'Elbe Import Export',      sector: 'Handel',    netPosition: -44800  },
]

const MOCK_RECENT_CYCLES = [
  { id: 'ZYK-001', date: '05.04.2026', companies: 47, gross: '4.8 Mio €', net: '1.7 Mio €', savings: 63.4 },
  { id: 'ZYK-000', date: '29.03.2026', companies: 43, gross: '3.9 Mio €', net: '1.5 Mio €', savings: 61.2 },
]

function formatEur(amount) {
  if (Math.abs(amount) >= 1_000_000)
    return (amount / 1_000_000).toFixed(1).replace('.', ',') + ' Mio €'
  if (Math.abs(amount) >= 1_000)
    return (amount / 1_000).toFixed(0) + ' Tsd €'
  return amount.toLocaleString('de-DE') + ' €'
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    networkApi.stats()
      .then(data => setStats(data))
      .catch(() => setStats(MOCK_STATS))
      .finally(() => setLoading(false))
  }, [])

  const s = stats || MOCK_STATS

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Netzwerk-Übersicht</h1>
        <p className="page-subtitle">
          Hamburger KMU-Verrechnungsnetzwerk · {new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* KPI Row */}
      <div className="kpi-grid">
        <div className="kpi-card kpi-card--green">
          <div className="kpi-label">Teilnehmer</div>
          <div className="kpi-value">{loading ? '—' : s.totalCompanies}</div>
          <div className="kpi-delta">Hamburger KMUs</div>
        </div>

        <div className="kpi-card kpi-card--blue">
          <div className="kpi-label">Offene Rechnungen</div>
          <div className="kpi-value">{loading ? '—' : s.totalInvoices}</div>
          <div className="kpi-delta">im aktuellen Zyklus</div>
        </div>

        <div className="kpi-card kpi-card--amber">
          <div className="kpi-label">Brutto-Volumen</div>
          <div className="kpi-value">
            {loading ? '—' : formatEur(s.totalGrossVolume)}
          </div>
          <div className="kpi-delta">ausstehende Forderungen</div>
        </div>

        <div className="kpi-card kpi-card--green">
          <div className="kpi-label">Letzte Einsparungen</div>
          <div className="kpi-value">
            {loading ? '—' : `${s.lastCycleSavings?.toFixed(1).replace('.', ',')} %`}
          </div>
          <div className="kpi-delta">Liquiditätsentlastung</div>
        </div>
      </div>

      <div className="content-grid">
        {/* Net Positions */}
        <div className="card">
          <div className="toolbar">
            <h2 className="toolbar-title">Netto-Positionen (Top 5)</h2>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Unternehmen</th>
                <th>Sektor</th>
                <th style={{ textAlign: 'right' }}>Netto-Position</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_TOP_POSITIONS.map((c, i) => (
                <tr key={i}>
                  <td>{c.name}</td>
                  <td><span className="badge badge-gray">{c.sector}</span></td>
                  <td style={{ textAlign: 'right', fontWeight: 700,
                    color: c.netPosition >= 0 ? 'var(--color-success)' : 'var(--color-danger)'
                  }}>
                    {c.netPosition >= 0 ? '+' : ''}{formatEur(c.netPosition)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Recent Clearing Cycles */}
        <div className="card">
          <div className="toolbar">
            <h2 className="toolbar-title">Letzte Verrechnungszyklen</h2>
          </div>
          {MOCK_RECENT_CYCLES.length === 0 ? (
            <div className="state-empty">Noch keine Zyklen durchgeführt.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Brutto</th>
                  <th>Netto</th>
                  <th>Einsparung</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_RECENT_CYCLES.map(c => (
                  <tr key={c.id}>
                    <td>
                      <span className="status-dot status-dot--green" />
                      {c.date}
                    </td>
                    <td>{c.gross}</td>
                    <td style={{ color: 'var(--color-accent)', fontWeight: 600 }}>{c.net}</td>
                    <td>
                      <span className="badge badge-green">
                        {c.savings.toFixed(1).replace('.', ',')} %
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Info banner */}
      <div style={{
        marginTop: 'var(--space-8)',
        background: 'var(--color-primary-lt)',
        border: '1px solid var(--color-primary)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-6)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-4)',
      }}>
        <span style={{ fontSize: '1.5rem' }}>ℹ</span>
        <div>
          <strong style={{ color: 'var(--color-primary-dk)' }}>Wie funktioniert ClearFlow?</strong>
          <p style={{ color: 'var(--color-text-muted)', marginTop: 'var(--space-1)', fontSize: 'var(--font-size-sm)' }}>
            Rechnungen zwischen Netzwerkteilnehmern werden bilateral verrechnet. Statt mehrerer
            Einzelüberweisungen genügt eine einzige Netto-Zahlung — das spart Liquidität und
            Transaktionskosten.
          </p>
        </div>
      </div>
    </div>
  )
}
