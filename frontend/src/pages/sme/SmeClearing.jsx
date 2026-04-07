import React, { useState, useEffect } from 'react'
import { useRole } from '../../hooks/RoleContext.jsx'
import { useApi } from '../../hooks/useApi.js'
import { smeApi } from '../../api/sme.js'
import { MOCK_COMPANY_POSITIONS, MOCK_INVOICES } from '../../mock/fullDataset.js'
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

// ── SmeBeforeAfter ────────────────────────────────────────────────────────────

const AMBER = '#c97a2f'
const GREEN = '#4a7c59'
const W = 300
const H = 220
const CX = W / 2
const CY = H / 2
const RADIAL_R = 70
const CENTER_R = 18
const PARTNER_R = 10
const ARROW_INSET = 6 // space reserved for arrowhead past node edge

function radialPos(index, total) {
  const angle = (2 * Math.PI * index / total) - Math.PI / 2
  return { x: CX + RADIAL_R * Math.cos(angle), y: CY + RADIAL_R * Math.sin(angle) }
}

function edgeThickness(cents, maxCents) {
  return 2 + (Math.abs(cents) / Math.max(maxCents, 1)) * 4
}

function ArrowEdge({ x1, y1, r1, x2, y2, r2, color, thickness, markerId, animated, drawn }) {
  const dx = x2 - x1
  const dy = y2 - y1
  const dist = Math.sqrt(dx * dx + dy * dy) || 1
  const ux = dx / dist
  const uy = dy / dist

  const sx = x1 + ux * (r1 + 2)
  const sy = y1 + uy * (r1 + 2)
  const ex = x2 - ux * (r2 + ARROW_INSET)
  const ey = y2 - uy * (r2 + ARROW_INSET)

  const len = Math.sqrt((ex - sx) ** 2 + (ey - sy) ** 2)

  return (
    <line
      x1={sx} y1={sy} x2={ex} y2={ey}
      stroke={color}
      strokeWidth={thickness}
      markerEnd={`url(#${markerId})`}
      style={animated ? {
        strokeDasharray: len,
        strokeDashoffset: drawn ? 0 : len,
        transition: 'stroke-dashoffset 0.4s ease-out',
      } : undefined}
    />
  )
}

function EdgeLabel({ x1, y1, x2, y2, label, color }) {
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  return (
    <text
      x={mx} y={my - 6}
      fontSize={9} fill={color}
      textAnchor="middle" dominantBaseline="middle"
      style={{ pointerEvents: 'none', userSelect: 'none' }}
    >
      {label}
    </text>
  )
}

function NetworkGraph({ companyName, partners, positions, netByPartner, showGross, color, markerId, animated, drawn, hovered, onHover, bgTint, bottomLabel }) {
  return (
    <div style={{ flex: '1 1 0', minWidth: 0 }}>
      <div style={{ textAlign: 'center', fontSize: 'var(--font-size-xs)', fontWeight: 700, color, marginBottom: 4 }}>
        {showGross ? t('sme.beforeAfter.obligationsTitle') : t('sme.beforeAfter.afterClearingTitle')}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        style={{ display: 'block', background: bgTint, borderRadius: 8 }}
      >
        <defs>
          <marker
            id={markerId}
            markerWidth={8} markerHeight={8}
            refX={6} refY={3}
            orient="auto"
          >
            <path d="M0,0 L0,6 L8,3 z" fill={color} />
          </marker>
        </defs>

        {/* Edges */}
        {partners.map((p, i) => {
          const pos = positions[i]
          if (showGross) {
            const elems = []
            // outflow: center → partner (I owe them)
            if (p.outCents > 0) {
              const thickness = edgeThickness(p.outCents, Math.max(...partners.map(q => q.outCents + q.inCents)))
              elems.push(
                <g key={`out-${p.id}`}>
                  <ArrowEdge
                    x1={CX} y1={CY} r1={CENTER_R}
                    x2={pos.x} y2={pos.y} r2={PARTNER_R}
                    color={color} thickness={thickness} markerId={markerId}
                  />
                  <EdgeLabel x1={CX} y1={CY} x2={pos.x} y2={pos.y} label={formatEur(p.outCents)} color={color} />
                </g>
              )
            }
            // inflow: partner → center (they owe me)
            if (p.inCents > 0) {
              const thickness = edgeThickness(p.inCents, Math.max(...partners.map(q => q.outCents + q.inCents)))
              elems.push(
                <g key={`in-${p.id}`}>
                  <ArrowEdge
                    x1={pos.x} y1={pos.y} r1={PARTNER_R}
                    x2={CX} y2={CY} r2={CENTER_R}
                    color={color} thickness={thickness} markerId={markerId}
                  />
                </g>
              )
            }
            return elems
          } else {
            // After clearing: only net flows, cleared edges absent
            const net = netByPartner[p.id] ?? 0
            if (net === 0) return null
            const thickness = edgeThickness(net, Math.max(...partners.map(q => Math.abs(netByPartner[q.id] ?? 0))))
            const fromCenter = net < 0 // I owe them
            return (
              <g key={`net-${p.id}`}>
                <ArrowEdge
                  x1={fromCenter ? CX : pos.x}
                  y1={fromCenter ? CY : pos.y}
                  r1={fromCenter ? CENTER_R : PARTNER_R}
                  x2={fromCenter ? pos.x : CX}
                  y2={fromCenter ? pos.y : CY}
                  r2={fromCenter ? PARTNER_R : CENTER_R}
                  color={color} thickness={thickness} markerId={markerId}
                  animated={animated} drawn={drawn}
                />
                <EdgeLabel
                  x1={fromCenter ? CX : pos.x} y1={fromCenter ? CY : pos.y}
                  x2={fromCenter ? pos.x : CX} y2={fromCenter ? pos.y : CY}
                  label={formatEur(Math.abs(net))} color={color}
                />
              </g>
            )
          }
        })}

        {/* Partner nodes */}
        {partners.map((p, i) => {
          const pos = positions[i]
          const isHovered = hovered === p.id
          const net = netByPartner[p.id] ?? 0
          const cleared = !showGross && net === 0
          return (
            <g
              key={p.id}
              onMouseEnter={() => onHover(p.id)}
              onMouseLeave={() => onHover(null)}
              style={{ cursor: 'pointer' }}
            >
              <circle
                cx={pos.x} cy={pos.y} r={PARTNER_R}
                fill={isHovered ? color : (cleared ? GREEN : 'var(--color-surface)')}
                stroke={cleared ? GREEN : color}
                strokeWidth={isHovered ? 2.5 : 1.5}
                style={{
                  filter: cleared ? `drop-shadow(0 0 4px ${GREEN}88)` : undefined,
                  transition: 'all 0.15s',
                }}
              />
              <text
                x={pos.x}
                y={pos.y + PARTNER_R + 10}
                fontSize={8}
                fill={isHovered ? color : 'var(--color-text-muted)'}
                textAnchor="middle"
                dominantBaseline="middle"
                style={{ pointerEvents: 'none', userSelect: 'none', fontWeight: isHovered ? 700 : 400 }}
              >
                {p.name.length > 14 ? p.name.slice(0, 13) + '…' : p.name}
              </text>
            </g>
          )
        })}

        {/* Center node */}
        <circle
          cx={CX} cy={CY} r={CENTER_R}
          fill={color}
          stroke="none"
          style={{ opacity: 0.9 }}
        />
        <text
          x={CX} y={CY}
          fontSize={8} fill="#fff"
          textAnchor="middle" dominantBaseline="middle"
          fontWeight={700}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {companyName.length > 16 ? companyName.slice(0, 15) + '…' : companyName}
        </text>
      </svg>
      <div style={{ textAlign: 'center', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 4 }}>
        {bottomLabel}
      </div>
    </div>
  )
}

function SmeBeforeAfter({ pos, invoices }) {
  const { lang } = useLang()
  const [hovered, setHovered] = useState(null)
  const [drawn, setDrawn] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDrawn(true), 50)
    return () => clearTimeout(t)
  }, [])

  const companyId = pos.company_id

  // Derive gross flows from invoices
  const grossByPartner = {}
  for (const inv of (invoices || [])) {
    const isSender = inv.from_company?.id === companyId
    const isReceiver = inv.to_company?.id === companyId
    if (!isSender && !isReceiver) continue
    const partner = isSender ? inv.to_company : inv.from_company
    if (!partner?.id) continue
    if (!grossByPartner[partner.id]) grossByPartner[partner.id] = { name: partner.name, outCents: 0, inCents: 0 }
    if (isSender) grossByPartner[partner.id].outCents += inv.total_amount_cents
    else grossByPartner[partner.id].inCents += inv.total_amount_cents
  }

  // Fill in counterparties that have no invoice data
  for (const cp of (pos.counterparties || [])) {
    if (!grossByPartner[cp.company_id]) {
      const absNet = Math.abs(cp.net_cents)
      grossByPartner[cp.company_id] = {
        name: cp.name,
        outCents: cp.net_cents < 0 ? absNet : 0,
        inCents: cp.net_cents > 0 ? absNet : 0,
      }
    }
  }

  // Sort by total volume, max 5 partners
  const partners = Object.entries(grossByPartner)
    .map(([id, f]) => ({ id, ...f, totalCents: f.outCents + f.inCents }))
    .sort((a, b) => b.totalCents - a.totalCents)
    .slice(0, 5)

  const n = partners.length
  const positions = partners.map((_, i) => radialPos(i, n))

  // Net flows from pos.counterparties
  const netByPartner = {}
  for (const cp of (pos.counterparties || [])) {
    netByPartner[cp.company_id] = cp.net_cents
  }

  const grossTotal = partners.reduce((s, p) => s + p.outCents, 0)
  const netPayable = Math.max(pos.net_after_clearing_cents, 0)
  const savings = pos.savings_cents
  const savingsPct = pos.savings_pct
  const grossFlowCount = partners.filter(p => p.outCents > 0 || p.inCents > 0).length
  const netFlowCount = partners.filter(p => (netByPartner[p.id] ?? 0) !== 0).length
  const companyName = pos.company_name || 'You'

  if (!partners.length) return null

  return (
    <div className="card" style={{ marginBottom: 'var(--space-8)' }}>
      <div style={{ fontWeight: 700, fontSize: 'var(--font-size-md)', marginBottom: 'var(--space-5)' }}>
        {t('sme.beforeAfter.title')}
      </div>

      <div style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
        {/* Left graph: before clearing */}
        <NetworkGraph
          companyName={companyName}
          partners={partners}
          positions={positions}
          netByPartner={netByPartner}
          showGross
          color={AMBER}
          markerId="arrow-amber"
          bgTint="rgba(201,122,47,0.03)"
          hovered={hovered}
          onHover={setHovered}
          bottomLabel={`${grossFlowCount} ${t('sme.beforeAfter.payments')} · ${formatEur(grossTotal)}`}
        />

        {/* Delta badge */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '0 12px', flexShrink: 0,
        }}>
          <div style={{ fontSize: 9, color: 'var(--color-text-muted)', marginBottom: 4 }}>→</div>
          <div style={{
            background: 'rgba(74,124,89,0.1)',
            border: `1.5px solid ${GREEN}`,
            borderRadius: 8, padding: '6px 10px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: GREEN, lineHeight: 1.2 }}>
              −{formatEur(savings)}
            </div>
            <div style={{ fontSize: 10, fontWeight: 600, color: GREEN }}>
              ({formatPct(savingsPct, 0)})
            </div>
            <div style={{ fontSize: 8, color: 'var(--color-text-muted)', marginTop: 2 }}>
              {t('sme.beforeAfter.saved')}
            </div>
          </div>
          <div style={{ fontSize: 9, color: 'var(--color-text-muted)', marginTop: 4 }}>→</div>
        </div>

        {/* Right graph: after clearing */}
        <NetworkGraph
          companyName={companyName}
          partners={partners}
          positions={positions}
          netByPartner={netByPartner}
          showGross={false}
          color={GREEN}
          markerId="arrow-green"
          animated
          drawn={drawn}
          bgTint="rgba(74,124,89,0.03)"
          hovered={hovered}
          onHover={setHovered}
          bottomLabel={`${netFlowCount} ${t('sme.beforeAfter.payments')} · ${formatEur(netPayable)}`}
        />
      </div>
    </div>
  )
}

// ── HowItWorksAccordion ───────────────────────────────────────────────────────

const LS_KEY = 'clearflow_howitworks_open'

function HowItWorksAccordion() {
  const { lang } = useLang()
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(LS_KEY) === 'true' } catch (_) { return false }
  })

  function toggle() {
    const next = !open
    setOpen(next)
    try { localStorage.setItem(LS_KEY, String(next)) } catch (_) {}
  }

  return (
    <div className="card" style={{ marginBottom: 'var(--space-8)' }}>
      <button
        onClick={toggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          fontWeight: 700, fontSize: 'var(--font-size-md)', color: 'var(--color-text)',
          textAlign: 'left',
        }}
        aria-expanded={open}
      >
        <span>{t('sme.howItWorksToggle')}</span>
        <span style={{
          fontSize: '1rem', color: 'var(--color-text-muted)',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s',
          display: 'inline-block',
        }}>▾</span>
      </button>
      {open && (
        <div style={{ marginTop: 'var(--space-5)' }}>
          <NettingExplainer />
        </div>
      )}
    </div>
  )
}

// ── SmeClearing ───────────────────────────────────────────────────────────────

export default function SmeClearing() {
  const { lang } = useLang()
  const { companyId } = useRole()
  const effectiveId = companyId || 'c4'
  const [simRunning, setSimRunning] = useState(false)
  const [simDone, setSimDone] = useState(false)
  const [simProgress, setSimProgress] = useState(0)

  const mockPos = MOCK_COMPANY_POSITIONS[effectiveId] || MOCK_COMPANY_POSITIONS.default
  const mockInvoices = MOCK_INVOICES.filter(inv =>
    inv.from_company?.id === effectiveId || inv.to_company?.id === effectiveId
  )

  const { data: position } = useApi(
    () => smeApi.companyPosition(effectiveId),
    mockPos,
    [effectiveId]
  )
  const { data: invoices } = useApi(
    () => smeApi.companyInvoices(effectiveId),
    mockInvoices,
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

      {/* Before/after clearing graph */}
      <SmeBeforeAfter pos={pos} invoices={invoices || mockInvoices} />

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

      {/* How it works accordion */}
      <HowItWorksAccordion />

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
