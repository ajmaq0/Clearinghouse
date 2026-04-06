/**
 * NettingVergleich — Before/After Netting Visualization
 *
 * Three-stage step view: Gross → Bilateral → Multilateral
 * - EUR amounts and % reduction at each stage (German locale)
 * - Animated progress bar for each stage
 * - Consumes POST /clearing/multilateral API
 * - Mock fallback for demo mode
 * - Large text/numbers readable from 3 meters on projector
 */
import React, { useEffect, useState } from 'react'
import { clearingApi } from '../api/clearing.js'
import { formatEur, formatPct } from '../utils/format.js'

// ── Mock fallback ──────────────────────────────────────────────────────────────
const MOCK_RESULT = {
  gross_cents:        12_540_000_00,
  bilateral_cents:     7_320_000_00,
  multilateral_cents:  4_180_000_00,
  savings_eur_cents:   3_140_000_00,
  savings_vs_gross_bps: 6666,
}

// ── Stage config ───────────────────────────────────────────────────────────────
function buildStages(data) {
  const gross = data.gross_cents
  return [
    {
      key:        'gross',
      label:      'Brutto',
      sub:        'Alle offenen Rechnungen im Netzwerk',
      amount:     gross,
      pct:        100,
      reduction:  null,
      color:      '#c97a2f',
      colorLight: '#fdf3e7',
      icon:       '≡',
    },
    {
      key:        'bilateral',
      label:      'Nach bilateralem Netting',
      sub:        'Gegenseitige Rechnungen werden verrechnet',
      amount:     data.bilateral_cents,
      pct:        gross > 0 ? Math.round(data.bilateral_cents * 1000 / gross) / 10 : 0,
      reduction:  gross > 0 ? Math.round((gross - data.bilateral_cents) * 10000 / gross) / 100 : 0,
      color:      '#2c6e8a',
      colorLight: '#e8f2f7',
      icon:       '⇄',
    },
    {
      key:        'multilateral',
      label:      'Nach multilateralem Netting',
      sub:        'Zyklen im Handelsgraphen reduziert (Johnson-Algorithmus)',
      amount:     data.multilateral_cents,
      pct:        gross > 0 ? Math.round(data.multilateral_cents * 1000 / gross) / 10 : 0,
      reduction:  gross > 0 ? Math.round((gross - data.multilateral_cents) * 10000 / gross) / 100 : 0,
      color:      '#4a7c59',
      colorLight: '#eef5f1',
      icon:       '⬡',
    },
  ]
}

// ── Animated bar ───────────────────────────────────────────────────────────────
function StageBar({ pct, color, animated }) {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), 60)
    return () => clearTimeout(t)
  }, [pct, animated])

  return (
    <div style={{
      height: 12,
      background: '#e8e0d4',
      borderRadius: 99,
      overflow: 'hidden',
      margin: 'var(--space-3) 0',
    }}>
      <div style={{
        height: '100%',
        width: `${width}%`,
        background: color,
        borderRadius: 99,
        transition: animated ? 'width 0.8s cubic-bezier(0.34,1.56,0.64,1)' : 'none',
      }} />
    </div>
  )
}

// ── Stage card ─────────────────────────────────────────────────────────────────
function StageCard({ stage, isActive, onClick, animated }) {
  return (
    <div
      onClick={onClick}
      style={{
        border: `2px solid ${isActive ? stage.color : 'var(--color-border)'}`,
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-5) var(--space-6)',
        cursor: 'pointer',
        background: isActive ? stage.colorLight : 'var(--color-surface)',
        transition: 'all 0.2s',
        flex: '1 1 220px',
      }}
    >
      {/* Icon + Label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
        <span style={{
          fontSize: '1.4em', width: 36, height: 36, borderRadius: '50%',
          background: stage.color, color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {stage.icon}
        </span>
        <span style={{ fontWeight: 700, fontSize: 'var(--font-size-md)', color: 'var(--color-text)' }}>
          {stage.label}
        </span>
      </div>

      {/* Amount — big number for projector readability */}
      <div style={{
        fontSize: 'clamp(1.4rem, 3vw, 2.2rem)',
        fontWeight: 800,
        color: stage.color,
        lineHeight: 1.1,
        marginBottom: 'var(--space-2)',
        letterSpacing: '-0.02em',
      }}>
        {formatEur(stage.amount)}
      </div>

      {/* Bar */}
      <StageBar pct={stage.pct} color={stage.color} animated={animated} />

      {/* Pct of gross + reduction badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
          {stage.pct} % des Brutto
        </span>
        {stage.reduction != null && (
          <span style={{
            background: stage.colorLight,
            color: stage.color,
            border: `1px solid ${stage.color}44`,
            borderRadius: 99,
            padding: '2px 10px',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 700,
          }}>
            −{stage.reduction} %
          </span>
        )}
      </div>

      {/* Sub */}
      <p style={{
        marginTop: 'var(--space-3)',
        fontSize: 'var(--font-size-xs)',
        color: 'var(--color-text-muted)',
        lineHeight: 1.5,
      }}>
        {stage.sub}
      </p>
    </div>
  )
}

// ── Arrow connector ────────────────────────────────────────────────────────────
function Arrow({ saving }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 4, padding: '0 var(--space-2)',
      color: 'var(--color-text-muted)', flexShrink: 0, minWidth: 64,
    }}>
      <span style={{ fontSize: '1.6rem', lineHeight: 1 }}>→</span>
      <span style={{
        fontSize: 'var(--font-size-xs)', fontWeight: 700,
        color: '#4a7c59', whiteSpace: 'nowrap',
      }}>
        −{formatEur(saving)}
      </span>
    </div>
  )
}

// ── Detail panel ───────────────────────────────────────────────────────────────
function DetailPanel({ stage, data }) {
  if (!stage) return null
  const gross = data.gross_cents

  const savedFromGross = gross - stage.amount
  const savedBps = gross > 0 ? Math.round((gross - stage.amount) * 10000 / gross) : 0

  return (
    <div className="card" style={{
      borderTop: `3px solid ${stage.color}`,
      marginTop: 'var(--space-6)',
      animation: 'slideIn 0.2s ease',
    }}>
      <div style={{ display: 'flex', gap: 'var(--space-8)', flexWrap: 'wrap' }}>
        <div>
          <div className="kpi-label">Verbleibende Verpflichtungen</div>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: stage.color }}>
            {formatEur(stage.amount)}
          </div>
        </div>
        <div>
          <div className="kpi-label">Einsparung vs. Brutto</div>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: '#4a7c59' }}>
            {formatEur(savedFromGross)}
          </div>
        </div>
        <div>
          <div className="kpi-label">Reduktionsquote</div>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: '#4a7c59' }}>
            {(savedBps / 100).toFixed(1).replace('.', ',')} %
          </div>
        </div>
      </div>
      <p style={{ marginTop: 'var(--space-4)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
        {stage.sub}
      </p>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function NettingVergleich() {
  const [data,      setData]      = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [usingMock, setUsingMock] = useState(false)
  const [activeKey, setActiveKey] = useState('multilateral')
  const [animated,  setAnimated]  = useState(false)

  useEffect(() => {
    clearingApi.multilateral()
      .then(res => {
        setData(res)
        setUsingMock(false)
      })
      .catch(() => {
        setData(MOCK_RESULT)
        setUsingMock(true)
      })
      .finally(() => {
        setLoading(false)
        // Trigger bar animation after render
        setTimeout(() => setAnimated(true), 100)
      })
  }, [])

  const stages      = data ? buildStages(data) : []
  const activeStage = stages.find(s => s.key === activeKey) || null

  const bilateralSaving    = data ? data.gross_cents - data.bilateral_cents    : 0
  const multilateralSaving = data ? data.bilateral_cents - data.multilateral_cents : 0
  const totalSavingBps     = data && data.gross_cents > 0
    ? Math.round((data.gross_cents - data.multilateral_cents) * 10000 / data.gross_cents)
    : 0

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Netting-Vergleich</h1>
        <p className="page-subtitle">
          Brutto → Bilateral → Multilateral · Liquiditätseinsparung durch ClearFlow
          {usingMock && (
            <span style={{ color: 'var(--color-warning)', marginLeft: 8 }}>· Demo-Daten</span>
          )}
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--color-text-muted)' }}>
          Berechne Netting…
        </div>
      ) : (
        <>
          {/* Total savings banner */}
          <div className="card" style={{
            background: 'linear-gradient(135deg, #4a7c59 0%, #2c6e8a 100%)',
            color: 'white',
            marginBottom: 'var(--space-6)',
            display: 'flex', gap: 'var(--space-8)', flexWrap: 'wrap', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Gesamteinsparung (multilateral)
              </div>
              <div style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 800, lineHeight: 1.1 }}>
                {formatEur(data.gross_cents - data.multilateral_cents)}
              </div>
            </div>
            <div style={{ width: 1, height: 60, background: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Reduktionsquote
              </div>
              <div style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 800, lineHeight: 1.1 }}>
                {(totalSavingBps / 100).toFixed(1).replace('.', ',')} %
              </div>
            </div>
            <div style={{ width: 1, height: 60, background: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Methode
              </div>
              <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, lineHeight: 1.3 }}>
                Johnson-Algorithmus<br />
                <span style={{ fontWeight: 400, fontSize: 'var(--font-size-sm)', opacity: 0.8 }}>Zyklenreduktion im Handelsgraph</span>
              </div>
            </div>
          </div>

          {/* Three stage cards with arrows */}
          <div style={{
            display: 'flex', alignItems: 'stretch', gap: 'var(--space-2)',
            flexWrap: 'wrap', marginBottom: 'var(--space-4)',
          }}>
            {stages.map((stage, i) => (
              <React.Fragment key={stage.key}>
                <StageCard
                  stage={stage}
                  isActive={activeKey === stage.key}
                  onClick={() => setActiveKey(stage.key)}
                  animated={animated}
                />
                {i === 0 && <Arrow saving={bilateralSaving} />}
                {i === 1 && <Arrow saving={multilateralSaving} />}
              </React.Fragment>
            ))}
          </div>

          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
            Auf eine Stufe klicken für Details
          </p>

          {/* Detail panel for active stage */}
          <DetailPanel stage={activeStage} data={data} />
        </>
      )}
    </div>
  )
}
