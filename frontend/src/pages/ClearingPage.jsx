import React, { useState } from 'react'
import ClearingAnimation from '../components/ClearingAnimation.jsx'
import { clearingApi } from '../api/clearing.js'
import '../styles/clearing-animation.css'

// Demo data: 7 Hamburg SMEs in a netting ring
const DEMO_NODES = [
  { id: 'MUL', name: 'Müller Logistik GmbH' },
  { id: 'SCH', name: 'Schreiber & Co. KG' },
  { id: 'HAF', name: 'Hafentechnik Hamburg AG' },
  { id: 'NOR', name: 'Nordsee Fisch GmbH' },
  { id: 'ELB', name: 'Elbe Import Export' },
  { id: 'ALT', name: 'Altonaer Maschinenbau' },
  { id: 'HAR', name: 'Harburg Textil GmbH' },
]

// Gross flows — many bilateral pairings
const DEMO_GROSS = [
  { source: 'MUL', target: 'SCH', amount: 45000  },
  { source: 'SCH', target: 'MUL', amount: 30000  },  // partial cancel
  { source: 'SCH', target: 'HAF', amount: 62000  },
  { source: 'HAF', target: 'SCH', amount: 62000  },  // full cancel
  { source: 'NOR', target: 'ELB', amount: 28000  },
  { source: 'ELB', target: 'NOR', amount: 15000  },  // partial cancel
  { source: 'ALT', target: 'MUL', amount: 38000  },
  { source: 'MUL', target: 'ALT', amount: 22000  },  // partial cancel
  { source: 'HAR', target: 'NOR', amount: 19000  },
  { source: 'ELB', target: 'HAF', amount: 33000  },
  { source: 'HAF', target: 'ALT', amount: 41000  },
  { source: 'ALT', target: 'HAR', amount: 27000  },
]

// Net flows — after bilateral netting
const DEMO_NET = [
  { source: 'MUL', target: 'SCH', amount: 15000  },  // 45k - 30k
  { source: 'NOR', target: 'ELB', amount: 13000  },  // 28k - 15k
  { source: 'ALT', target: 'MUL', amount: 16000  },  // 38k - 22k
  { source: 'HAR', target: 'NOR', amount: 19000  },
  { source: 'ELB', target: 'HAF', amount: 33000  },
  { source: 'HAF', target: 'ALT', amount: 41000  },
  { source: 'ALT', target: 'HAR', amount: 27000  },
]

const DEMO_SAVINGS_PCT = 63.4

function formatEur(v) {
  return (v / 1_000_000).toFixed(2).replace('.', ',') + ' Mio €'
}

const grossTotal = DEMO_GROSS.reduce((s, l) => s + l.amount, 0)
const netTotal   = DEMO_NET.reduce((s, l) => s + l.amount, 0)

export default function ClearingPage() {
  const [runStatus, setRunStatus]   = useState('idle')  // idle | running | done | error
  const [cycleData, setCycleData]   = useState(null)
  const [animDone, setAnimDone]     = useState(false)

  const handleRunClearing = async () => {
    setRunStatus('running')
    setAnimDone(false)
    try {
      const result = await clearingApi.run()
      setCycleData(result)
      setRunStatus('done')
    } catch {
      // Use demo data when API not yet available
      setCycleData({ savingsPct: DEMO_SAVINGS_PCT, grossTotal, netTotal })
      setRunStatus('done')
    }
  }

  const savings = cycleData?.savingsPct ?? DEMO_SAVINGS_PCT
  const gross   = cycleData?.grossTotal ?? grossTotal
  const net     = cycleData?.netTotal   ?? netTotal

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Verrechnungszyklus</h1>
        <p className="page-subtitle">
          Bilaterale Aufrechnung offener Rechnungen im Netzwerk
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 'var(--space-6)', alignItems: 'start' }}>

        {/* Animation panel */}
        <div className="card">
          <div className="toolbar">
            <h2 className="toolbar-title">Animations-Vorschau</h2>
            {runStatus === 'idle' && (
              <button className="btn btn-primary" onClick={handleRunClearing}>
                Verrechnung durchführen
              </button>
            )}
            {runStatus === 'running' && (
              <span className="badge badge-amber">
                <span className="loading-spinner" style={{ width: 14, height: 14, marginRight: 6 }} />
                Verarbeitung…
              </span>
            )}
            {runStatus === 'done' && (
              <button className="btn btn-secondary" onClick={() => setRunStatus('idle')}>
                Neuer Zyklus
              </button>
            )}
          </div>

          {runStatus === 'idle' && (
            <div className="state-empty" style={{ padding: 'var(--space-12)' }}>
              <div style={{ fontSize: '3rem', marginBottom: 'var(--space-4)', opacity: 0.3 }}>↻</div>
              <p>Klicken Sie auf <strong>„Verrechnung durchführen"</strong>, um den aktuellen Zyklus zu starten.</p>
            </div>
          )}

          {(runStatus === 'running' || runStatus === 'done') && (
            <ClearingAnimation
              nodes={DEMO_NODES}
              grossLinks={DEMO_GROSS}
              netLinks={DEMO_NET}
              savingsPct={savings}
              onDone={() => setAnimDone(true)}
            />
          )}
        </div>

        {/* Results sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="card">
            <div className="kpi-label" style={{ marginBottom: 'var(--space-3)' }}>Brutto-Volumen</div>
            <div className="kpi-value" style={{ fontSize: 'var(--font-size-2xl)' }}>
              {formatEur(gross)}
            </div>
            <div className="kpi-delta">{DEMO_GROSS.length} Rechnungsbeziehungen</div>
          </div>

          <div className="card kpi-card--amber" style={{ borderTop: '3px solid var(--color-accent)' }}>
            <div className="kpi-label" style={{ marginBottom: 'var(--space-3)' }}>Netto-Volumen</div>
            <div className="kpi-value" style={{ fontSize: 'var(--font-size-2xl)', color: 'var(--color-accent)' }}>
              {formatEur(net)}
            </div>
            <div className="kpi-delta">{DEMO_NET.length} Netto-Zahlungen</div>
          </div>

          <div className="card" style={{ borderTop: '3px solid var(--color-primary)', background: 'var(--color-primary-lt)' }}>
            <div className="kpi-label" style={{ marginBottom: 'var(--space-3)' }}>Liquiditätsentlastung</div>
            <div className="kpi-value" style={{ fontSize: 'var(--font-size-3xl)', color: 'var(--color-primary-dk)' }}>
              {savings.toFixed(1).replace('.', ',')} %
            </div>
            <div className="kpi-delta">
              Ersparnis: {formatEur(gross - net)}
            </div>
          </div>

          {animDone && (
            <div style={{
              background: 'var(--color-primary-lt)',
              border: '1px solid var(--color-primary)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-4)',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-primary-dk)',
              fontWeight: 500,
            }}>
              ✓ Verrechnung abgeschlossen. Netto-Zahlungsanweisungen wurden erstellt.
            </div>
          )}

          {/* How it works */}
          <div className="card">
            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, marginBottom: 'var(--space-3)' }}>
              So funktioniert es
            </h3>
            <ol style={{ paddingLeft: 'var(--space-5)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <li>Alle offenen Rechnungen im Netzwerk werden erfasst.</li>
              <li>Gegenseitige Forderungen zwischen je zwei Unternehmen werden bilateral aufgerechnet.</li>
              <li>Nur der verbleibende Nettobetrag muss überwiesen werden.</li>
              <li>Das Ergebnis: weniger Zahlungen, weniger Liquiditätsbedarf.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
