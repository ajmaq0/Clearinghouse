import React, { useState, useEffect, useRef } from 'react'
import { useApi } from '../hooks/useApi.js'
import { clearingApi } from '../api/clearing.js'
import { MOCK_COMPANY_COMPARISON } from '../mock/data.js'
import { formatEur, formatPct } from '../utils/format.js'
import { t } from '../i18n/index.js'
import { useLang } from '../hooks/useLang.js'

// ── Animated EUR count-up ──────────────────────────────────────────────────────

function AnimatedEur({ targetCents, duration = 1200, enabled = true }) {
  const [displayCents, setDisplayCents] = useState(enabled ? 0 : targetCents)
  const rafRef = useRef(null)
  const startRef = useRef(null)

  useEffect(() => {
    if (!enabled) {
      setDisplayCents(targetCents)
      return
    }
    setDisplayCents(0)
    startRef.current = null

    const animate = (ts) => {
      if (!startRef.current) startRef.current = ts
      const elapsed = ts - startRef.current
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
      setDisplayCents(Math.round(targetCents * eased))
      if (progress < 1) rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [targetCents, duration, enabled])

  return <>{formatEur(displayCents)}</>
}

// ── Color helpers for savings column ──────────────────────────────────────────

function savingsTextColor(pct) {
  if (!pct || pct <= 0) return 'var(--color-text-muted)'
  if (pct >= 40) return '#1d5c36'
  if (pct >= 25) return '#2d6b45'
  if (pct >= 10) return '#4a7c59'
  return '#6a9e7a'
}

function savingsBgColor(pct) {
  if (!pct || pct <= 0) return 'transparent'
  const intensity = Math.min(pct / 50, 1)
  return `rgba(74, 124, 89, ${0.05 + intensity * 0.18})`
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function UnternehmensVergleich() {
  const { lang } = useLang()
  const [animated, setAnimated] = useState(false)

  const { data, loading, error, useMock } = useApi(
    () => clearingApi.companyComparison(),
    MOCK_COMPANY_COMPARISON
  )

  // Trigger count-up animation shortly after data arrives
  useEffect(() => {
    if (!data) return
    const timer = setTimeout(() => setAnimated(true), 80)
    return () => clearTimeout(timer)
  }, [data])

  if (loading) {
    return (
      <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
        <span className="loading-spinner" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="card" style={{ padding: 'var(--space-5)', color: 'var(--color-danger)', fontSize: 'var(--font-size-sm)' }}>
        {t('comparison.loadError')} {error}
      </div>
    )
  }

  const rows = data?.rows ?? []
  const totalCompanies = data?.total_companies ?? rows.length
  const lpStatus = data?.lp_status

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 'var(--space-6)' }}>

      {/* ── Header ── */}
      <div style={{
        padding: 'var(--space-4) var(--space-5)',
        borderBottom: '2px solid var(--color-border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: 'var(--space-3)',
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 'var(--font-size-md)' }}>
            {t('comparison.title')}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>
            Bilateral vs. Optimal-Netting · {totalCompanies} {t('comparison.firms')} · {t('comparison.subtitle')}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          {useMock && (
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-accent)', fontStyle: 'italic' }}>
              {t('comparison.demoData')}
            </span>
          )}
          {lpStatus && (
            <span style={{
              fontSize: 'var(--font-size-xs)', fontWeight: 600,
              background: lpStatus === 'optimal' ? '#eef5f1' : '#fdf3e7',
              color: lpStatus === 'optimal' ? 'var(--color-primary-dk)' : 'var(--color-accent)',
              border: `1px solid ${lpStatus === 'optimal' ? '#c8dfd0' : '#f2d5b0'}`,
              borderRadius: 'var(--radius-sm)', padding: '2px 8px',
            }}>
              LP: {lpStatus}
            </span>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'clamp(0.88rem, 1.8vw, 1.1rem)' }}>
          <thead>
            <tr style={{ background: 'var(--color-surface-alt)', borderBottom: '2px solid var(--color-border)' }}>
              <th style={{ ...thSt, width: 40 }}>#</th>
              <th style={{ ...thSt, textAlign: 'left', paddingLeft: 'var(--space-4)' }}>{t('comparison.company')}</th>
              <th style={thSt}>{t('comparison.grossTotal')}</th>
              <th style={thSt}>{t('comparison.bilateralNet')}</th>
              <th style={thSt}>{t('comparison.optimalNet')}</th>
              <th style={{ ...thSt, background: '#eef5f1', color: 'var(--color-primary-dk)' }}>{t('comparison.savings')}</th>
              <th style={{ ...thSt, background: '#eef5f1', color: 'var(--color-primary-dk)' }}>{t('comparison.quote')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const isTop5   = i < 5
              const pct      = row.savings_vs_bilateral_pct  ?? 0
              const cents    = row.savings_vs_bilateral_cents ?? 0
              const gross    = Math.abs(row.gross_payable ?? 0) + Math.abs(row.gross_receivable ?? 0)
              const rowBase  = i === 0 ? '#ecf6ef' : i < 3 ? '#f4faf6' : 'transparent'

              return (
                <tr
                  key={row.company_id}
                  style={{ borderBottom: '1px solid var(--color-border)', background: rowBase }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface-alt)'}
                  onMouseLeave={e => e.currentTarget.style.background = rowBase}
                >
                  {/* Rank badge */}
                  <td style={{ ...tdSt, textAlign: 'center', width: 40 }}>
                    {isTop5 ? (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 28, height: 28, borderRadius: '50%',
                        background: i === 0 ? 'var(--color-primary)' : i < 3 ? '#c8dfd0' : '#e8f2ee',
                        color: i === 0 ? 'white' : 'var(--color-primary-dk)',
                        fontWeight: 700, fontSize: '0.8em', flexShrink: 0,
                      }}>
                        {i + 1}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '0.9em' }}>{i + 1}</span>
                    )}
                  </td>

                  {/* Company name */}
                  <td style={{ ...tdSt, textAlign: 'left', paddingLeft: 'var(--space-4)', fontWeight: isTop5 ? 600 : 400 }}>
                    {row.company_name}
                    {i === 0 && (
                      <span style={{
                        marginLeft: 8, fontSize: '0.68em', fontWeight: 700,
                        background: 'var(--color-primary)', color: 'var(--header-text)',
                        borderRadius: 'var(--radius-sm)', padding: '1px 6px',
                        verticalAlign: 'middle',
                      }}>
                        {t('comparison.topSaver')}
                      </span>
                    )}
                  </td>

                  {/* Brutto */}
                  <td style={tdSt}>{formatEur(gross)}</td>

                  {/* Bilateral-Netto */}
                  <td style={tdSt}>{formatEur(row.bilateral_net)}</td>

                  {/* Optimal-Netto */}
                  <td style={tdSt}>{formatEur(row.optimal_net)}</td>

                  {/* Savings EUR — animated */}
                  <td style={{
                    ...tdSt,
                    background: savingsBgColor(pct),
                    color: savingsTextColor(pct),
                    fontWeight: 700,
                    fontSize: 'clamp(0.95rem, 2vw, 1.25rem)',
                  }}>
                    {cents > 0
                      ? <><span style={{ opacity: 0.7 }}>−</span><AnimatedEur targetCents={cents} enabled={animated} /></>
                      : '—'}
                  </td>

                  {/* Quote % */}
                  <td style={{
                    ...tdSt,
                    background: savingsBgColor(pct),
                    color: savingsTextColor(pct),
                    fontWeight: 700,
                    fontSize: 'clamp(0.95rem, 2vw, 1.25rem)',
                  }}>
                    {pct > 0 ? formatPct(pct) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {rows.length === 0 && (
          <div style={{ padding: 'var(--space-10)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            {t('comparison.noData')}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Shared style objects ───────────────────────────────────────────────────────

const thSt = {
  padding: 'var(--space-3) var(--space-4)',
  fontWeight: 700,
  fontSize: 'var(--font-size-xs)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--color-text-muted)',
  textAlign: 'right',
  whiteSpace: 'nowrap',
}

const tdSt = {
  padding: 'var(--space-4)',
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
}
