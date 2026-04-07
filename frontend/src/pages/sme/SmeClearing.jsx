import React, { useState } from 'react'
import { useRole } from '../../hooks/RoleContext.jsx'
import { useApi } from '../../hooks/useApi.js'
import { smeApi } from '../../api/sme.js'
import { MOCK_COMPANY_POSITIONS } from '../../mock/fullDataset.js'
import { formatEur, formatPct } from '../../utils/format.js'
import { t } from '../../i18n/index.js'
import { useLang } from '../../hooks/useLang.js'

function SummaryCard({ label, value, sub, color }) {
  const palette = {
    red:   { border: 'var(--color-danger)',  bg: '#fdeaea', text: 'var(--color-danger)' },
    green: { border: 'var(--color-primary)', bg: 'var(--color-primary-lt)', text: 'var(--color-primary-dk)' },
    amber: { border: 'var(--color-accent)',  bg: 'var(--color-accent-lt)', text: 'var(--color-accent)' },
  }
  const p = palette[color] || palette.green
  return (
    <div style={{
      flex: '1 1 200px', minWidth: 180,
      background: p.bg, border: `2px solid ${p.border}`,
      borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)',
    }}>
      <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: p.text, marginBottom: 'var(--space-2)' }}>
        {label}
      </div>
      <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.15 }}>{value}</div>
      {sub && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>{sub}</div>}
    </div>
  )
}

function CounterpartyBar({ counterparties }) {
  const { lang } = useLang()
  if (!counterparties?.length) return <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>{t('sme.noCounterpositions')}</div>
  const maxAbs = Math.max(...counterparties.map(c => Math.abs(c.net_cents)), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {counterparties.map(c => {
        const pct = Math.abs(c.net_cents) / maxAbs * 100
        const positive = c.net_cents > 0
        return (
          <div key={c.company_id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', marginBottom: 4 }}>
              <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{c.name}</span>
              <span style={{ fontWeight: 700, color: positive ? 'var(--color-primary)' : 'var(--color-danger)' }}>
                {positive ? '+' : ''}{formatEur(c.net_cents)}
              </span>
            </div>
            <div style={{ height: 10, background: 'var(--color-border)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${pct}%`,
                background: positive ? 'var(--color-primary)' : 'var(--color-danger)',
                borderRadius: 99,
                marginLeft: positive ? 0 : 'auto',
                transition: 'width 0.5s',
              }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function NettingExplainer() {
  const { lang } = useLang()
  const steps = [
    { icon: '≡', title: t('sme.step1Title'), text: t('sme.step1Desc') },
    { icon: '⇄', title: t('sme.step2Title'), text: t('sme.step2Desc') },
    { icon: '✓', title: t('sme.step3Title'), text: t('sme.step3Desc') },
  ]
  return (
    <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
      {steps.map((s, i) => (
        <div key={i} style={{ flex: '1 1 180px', minWidth: 160, background: 'var(--color-surface-alt)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: 'var(--space-2)' }}>{s.icon}</div>
          <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)', color: 'var(--color-text)' }}>{s.title}</div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{s.text}</div>
        </div>
      ))}
    </div>
  )
}

export default function SmeClearing() {
  const { lang } = useLang()
  const { companyId } = useRole()
  const effectiveId = companyId || 'c4'
  const [simRunning, setSimRunning] = useState(false)
  const [simDone, setSimDone] = useState(false)
  const [simProgress, setSimProgress] = useState(0)

  const mockPos = MOCK_COMPANY_POSITIONS[effectiveId] || MOCK_COMPANY_POSITIONS.default
  const { data: position } = useApi(
    () => smeApi.companyPosition(effectiveId),
    mockPos,
    [effectiveId]
  )
  const pos = position || mockPos

  function runSim() {
    if (simRunning || simDone) return
    setSimRunning(true)
    setSimProgress(0)
    let p = 0
    const iv = setInterval(() => {
      p += Math.random() * 20 + 8
      if (p >= 100) { p = 100; clearInterval(iv); setSimRunning(false); setSimDone(true) }
      setSimProgress(Math.min(p, 100))
    }, 200)
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{t('sme.clearingTitle')}</h1>
        <p className="page-subtitle">{t('sme.clearingSubtitle')}</p>
      </div>

      {/* 3 summary cards */}
      <div style={{ display: 'flex', gap: 'var(--space-5)', flexWrap: 'wrap', marginBottom: 'var(--space-8)' }}>
        <SummaryCard
          label={t('sme.grossLiabilitiesFull')}
          value={formatEur(pos.gross_payable_cents)}
          sub={t('sme.beforeClearing')}
          color="red"
        />
        <SummaryCard
          label={t('sme.netAfterClearing')}
          value={formatEur(pos.net_after_clearing_cents)}
          sub={t('sme.optimizedPayment')}
          color="green"
        />
        <SummaryCard
          label={t('sme.yourSavings')}
          value={formatEur(pos.savings_cents)}
          sub={`${formatPct(pos.savings_pct, 1)} ${t('sme.reduction')}`}
          color="amber"
        />
      </div>

      {/* Counterparty bar chart */}
      <div className="card" style={{ marginBottom: 'var(--space-8)' }}>
        <div style={{ fontWeight: 700, fontSize: 'var(--font-size-md)', marginBottom: 'var(--space-5)' }}>
          {t('sme.netPositionsByCounterparty')}
        </div>
        <CounterpartyBar counterparties={pos.counterparties} />
        <div style={{ marginTop: 'var(--space-4)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
          <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>+</span> {t('sme.receivable')} &nbsp;·&nbsp;
          <span style={{ color: 'var(--color-danger)', fontWeight: 700 }}>−</span> {t('sme.payable')}
        </div>
      </div>

      {/* Explainer */}
      <div className="card" style={{ marginBottom: 'var(--space-8)' }}>
        <div style={{ fontWeight: 700, fontSize: 'var(--font-size-md)', marginBottom: 'var(--space-5)' }}>
          {t('sme.howItWorks')}
        </div>
        <NettingExplainer />
      </div>

      {/* Clearing preview */}
      <div className="card">
        <div style={{ fontWeight: 700, fontSize: 'var(--font-size-md)', marginBottom: 'var(--space-3)' }}>
          {t('sme.clearingPreview')}
        </div>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-5)' }}>
          {t('sme.simulateDesc')}
        </p>

        {!simRunning && !simDone && (
          <button className="btn btn-primary" onClick={runSim}>
            {t('sme.startPreview')}
          </button>
        )}

        {simRunning && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 6 }}>
              <span>{t('sme.optimizingRunning')}</span><span>{Math.round(simProgress)} %</span>
            </div>
            <div style={{ height: 10, background: 'var(--color-border)', borderRadius: 99 }}>
              <div style={{ height: '100%', width: `${simProgress}%`, background: 'var(--color-primary)', borderRadius: 99, transition: 'width 0.2s' }} />
            </div>
          </div>
        )}

        {simDone && (
          <div style={{
            background: 'var(--color-primary-lt)', border: '1px solid var(--color-primary)',
            borderRadius: 'var(--radius-md)', padding: 'var(--space-5)',
            display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
          }}>
            <span style={{ fontSize: '1.5rem' }}>✓</span>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--color-primary-dk)' }}>{t('sme.previewDone')}</div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                {t('sme.expectedSavings')} <strong>{formatEur(pos.savings_cents)}</strong> ({formatPct(pos.savings_pct, 1)})
              </div>
            </div>
            <button className="btn btn-secondary" style={{ marginLeft: 'auto' }} onClick={() => { setSimDone(false); setSimProgress(0) }}>
              {t('sme.reset')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
