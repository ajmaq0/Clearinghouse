/**
 * Entdecken — GLS Admin "Discover" Insights View
 *
 * Shows two key business-development insights for GLS Bank:
 *  1. Potenzielle Neue Verbindungen — top 5 company pairs not yet trading
 *     but operating in the same sector cluster; ranked by estimated netting value.
 *  2. Finanzierungslücken — invoices with large outstanding amounts where GLS
 *     could offer factoring / supply-chain finance.
 *
 * Design: GLS warm earth-tone palette, projector-readable, mobile-responsive.
 * Handoff: all layout uses CSS custom properties from global.css; no inline magic numbers.
 */
import React, { useState, useEffect } from 'react'
import { networkApi } from '../api/network.js'
import { MOCK_POTENTIAL_CONNECTIONS, MOCK_FUNDING_GAPS } from '../mock/fullDataset.js'
import { formatEur } from '../utils/format.js'
import { t } from '../i18n/index.js'
import { useLang } from '../hooks/useLang.js'

// ── Mock fallback for cascade data ────────────────────────────────────────────

const MOCK_CASCADE_SUMMARY = {
  companies_with_timing_mismatch: 8,
  total_blocked_cents: 12_480_000,
  worst_cascade_chain: ['Alstermühle Bäckerei GmbH', 'Biokontor Hamburg eG', 'Elbe Spedition KG'],
  avg_days_blocked: 14.0,
}

// ── ZahlungskaskadeCard ───────────────────────────────────────────────────────

const CASCADE_KEYFRAMES = `
@keyframes cascade-push-0 {
  0%   { transform: rotate(0deg) translateY(0); }
  50%  { transform: rotate(-5deg) translateY(3px); }
  100% { transform: rotate(-3deg) translateY(1px); }
}
@keyframes cascade-push-1 {
  0%   { transform: rotate(0deg) translateY(0); }
  50%  { transform: rotate(-3.5deg) translateY(2px); }
  100% { transform: rotate(-2deg) translateY(1px); }
}
@keyframes cascade-push-2 {
  0%   { transform: rotate(0deg) translateY(0); }
  50%  { transform: rotate(-2.5deg) translateY(1px); }
  100% { transform: rotate(-1deg) translateY(0); }
}
`

function CascadeChainNode({ name, role, amount_cents, isLast, index = 0, resolved = false }) {
  const { lang } = useLang()
  const tiltDeg = [-3, -2, -1][index] ?? -2
  const arrowColor = resolved ? '#4a7c59' : '#c9bfaf'
  const cardAnimStyle = resolved
    ? {
        transform: 'rotate(0deg) translateY(0)',
        transition: 'transform 0.5s ease, box-shadow 0.5s ease',
        boxShadow: '0 0 10px 3px rgba(74, 124, 89, 0.18)',
      }
    : {
        animation: `cascade-push-${index} 0.45s ease-out ${index * 0.18}s both`,
        transition: 'transform 0.5s ease, box-shadow 0.5s ease',
      }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{
        background: role === 'blocked' ? '#fdeaea' : role === 'waiting' ? '#fdf3e7' : '#e8f3ec',
        border: `2px solid ${role === 'blocked' ? '#f5a5a5' : role === 'waiting' ? '#f0c880' : '#c8dfd0'}`,
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-3) var(--space-5)',
        textAlign: 'center',
        minWidth: 160,
        ...cardAnimStyle,
      }}>
        <div style={{
          fontSize: 'var(--font-size-xs)', fontWeight: 700,
          color: role === 'blocked' ? '#b94040' : role === 'waiting' ? '#c97a2f' : '#4a7c59',
          textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4,
        }}>
          {role === 'blocked' ? t('cascade.blockedLabel') : role === 'waiting' ? t('cascade.waitingLabel') : t('cascade.resolvedLabel')}
        </div>
        <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-text)', lineHeight: 1.3 }}>
          {name}
        </div>
        {amount_cents != null && (
          <div style={{
            fontSize: 'var(--font-size-xs)', marginTop: 4,
            color: role === 'blocked' ? '#b94040' : role === 'waiting' ? '#c97a2f' : '#4a7c59',
            fontWeight: 600,
          }}>
            {role === 'blocked' ? t('cascade.cantPay') : role === 'waiting' ? t('cascade.waiting') : t('cascade.balanced')}
            {' '}{formatEur(amount_cents)}
          </div>
        )}
      </div>
      {!isLast && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '4px 0', transition: 'color 0.5s ease' }}>
          <div style={{ width: 2, height: 12, background: arrowColor, transition: 'background 0.5s ease' }} />
          <div style={{ fontSize: 10, color: arrowColor, transition: 'color 0.5s ease' }}>▼</div>
        </div>
      )}
    </div>
  )
}

function ZahlungskaskadeCard({ summary }) {
  const { lang } = useLang()
  const [resolved, setResolved] = useState(false)

  const chain = summary?.worst_cascade_chain ?? []
  const mismatchCount = summary?.companies_with_timing_mismatch ?? 0
  const totalBlocked = summary?.total_blocked_cents ?? 0

  if (mismatchCount === 0) return null

  // Build concrete example from worst_cascade_chain
  const exampleCompanies = chain.slice(0, 3)
  // Synthetic amounts for illustration based on totalBlocked
  const exampleAmounts = [
    Math.round(totalBlocked * 0.18),
    Math.round(totalBlocked * 0.25),
  ]

  return (
    <div style={{ marginBottom: 'var(--space-10)' }}>
      <div style={{ marginBottom: 'var(--space-5)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-3)' }}>
          <span style={{ fontSize: '1.3em' }}>⛓</span>
          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text)' }}>
            {t('cascade.title')}
          </h2>
        </div>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-1)', paddingLeft: 'var(--space-8)' }}>
          {t('cascade.subtitle')}
        </p>
      </div>

      <div className="card" style={{ borderLeft: '4px solid #c97a2f' }}>
        {/* Headline stat */}
        <div style={{
          background: '#fdf3e7', border: '1px solid #f0c880',
          borderRadius: 'var(--radius-sm)', padding: 'var(--space-4) var(--space-5)',
          marginBottom: 'var(--space-5)',
          fontSize: 'var(--font-size-md)', color: '#7a4010', fontWeight: 600, lineHeight: 1.5,
        }}>
          <span style={{ fontSize: '1.2em' }}>⚠ </span>
          <strong>{mismatchCount} Unternehmen</strong> können nicht rechtzeitig zahlen,
          weil sie selbst auf Zahlungen warten —{' '}
          <strong>{formatEur(totalBlocked)}</strong> blockiert
        </div>

        {/* Concrete example */}
        {exampleCompanies.length >= 2 && (
          <div style={{ marginBottom: 'var(--space-5)' }}>
            <div style={{
              fontSize: 'var(--font-size-xs)', fontWeight: 700, letterSpacing: '0.07em',
              color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 'var(--space-3)',
            }}>
              {t('cascade.concreteExample')}
            </div>
            <div style={{
              background: 'var(--color-surface-alt)', borderRadius: 'var(--radius-sm)',
              padding: 'var(--space-4)', fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text)', lineHeight: 1.7,
              fontStyle: 'italic',
            }}>
              {exampleCompanies.length >= 3 ? (
                <>
                  <strong>{exampleCompanies[0]}</strong> {t('cascade.waitingFor')}{' '}
                  <strong style={{ color: '#c97a2f' }}>{formatEur(exampleAmounts[0])}</strong>{' '}
                  {t('cascade.waitingForFrom')} <strong>{exampleCompanies[1]}</strong> —
                  {t('cascade.cantPay2')} <strong style={{ color: '#b94040' }}>{formatEur(exampleAmounts[1])}</strong>{' '}
                  {t('cascade.cantSendTo')} <strong>{exampleCompanies[2]}</strong> {t('cascade.cantTransfer')}
                </>
              ) : (
                <>
                  <strong>{exampleCompanies[0]}</strong> {t('cascade.waitingFor')}{' '}
                  <strong style={{ color: '#c97a2f' }}>{formatEur(exampleAmounts[0])}</strong>{' '}
                  {t('cascade.cantSend')} <strong style={{ color: '#b94040' }}>{formatEur(exampleAmounts[1])}</strong>{' '}
                  {t('cascade.cantSendTo')} <strong>{exampleCompanies[1]}</strong> {t('cascade.cantTransfer')}
                </>
              )}
            </div>
          </div>
        )}

        {/* Cascade keyframes injection */}
        <style>{CASCADE_KEYFRAMES}</style>

        {/* Before/after cascade animation */}
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <div style={{
            display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-4)',
            flexWrap: 'wrap', alignItems: 'center',
          }}>
            <div style={{
              fontSize: 'var(--font-size-xs)', fontWeight: 700, letterSpacing: '0.07em',
              color: 'var(--color-text-muted)', textTransform: 'uppercase',
            }}>
              {resolved ? t('cascade.afterClearing') : t('cascade.beforeClearing')}
            </div>
            <button
              onClick={() => setResolved(v => !v)}
              style={{
                background: resolved ? 'var(--color-primary)' : '#c97a2f',
                color: 'var(--header-text)', border: 'none', borderRadius: 'var(--radius-sm)',
                padding: 'var(--space-1) var(--space-4)',
                fontSize: 'var(--font-size-xs)', fontWeight: 600, cursor: 'pointer',
                transition: 'background 0.3s',
              }}
            >
              {resolved ? t('cascade.showBefore') : t('cascade.simulate')}
            </button>
          </div>

          {/* Chain visualization */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0 }}>
            {exampleCompanies.length >= 3 ? (
              <>
                <CascadeChainNode
                  name={exampleCompanies[0]}
                  role={resolved ? 'resolved' : 'blocked'}
                  amount_cents={resolved ? null : exampleAmounts[1]}
                  isLast={false}
                  index={0}
                  resolved={resolved}
                />
                <CascadeChainNode
                  name={exampleCompanies[1]}
                  role={resolved ? 'resolved' : 'waiting'}
                  amount_cents={resolved ? null : exampleAmounts[0]}
                  isLast={false}
                  index={1}
                  resolved={resolved}
                />
                <CascadeChainNode
                  name={exampleCompanies[2]}
                  role="resolved"
                  amount_cents={null}
                  isLast={true}
                  index={2}
                  resolved={resolved}
                />
              </>
            ) : exampleCompanies.length === 2 ? (
              <>
                <CascadeChainNode
                  name={exampleCompanies[0]}
                  role={resolved ? 'resolved' : 'blocked'}
                  amount_cents={resolved ? null : exampleAmounts[1]}
                  isLast={false}
                  index={0}
                  resolved={resolved}
                />
                <CascadeChainNode
                  name={exampleCompanies[1]}
                  role="resolved"
                  amount_cents={null}
                  isLast={true}
                  index={1}
                  resolved={resolved}
                />
              </>
            ) : null}
          </div>
        </div>

        {/* Resolution callout */}
        {resolved && (
          <div style={{
            background: 'var(--color-primary-lt)', border: '1px solid #c8dfd0',
            borderRadius: 'var(--radius-sm)', padding: 'var(--space-4) var(--space-5)',
            color: 'var(--color-primary-dk)', fontWeight: 600, fontSize: 'var(--font-size-sm)',
          }}>
            ✓ {t('cascade.afterResolved')} {exampleCompanies.length} {t('cascade.companies')} {t('cascade.areBalanced')}{' '}
            {formatEur(totalBlocked)} {t('cascade.liquidityFreed')}
          </div>
        )}

        {/* Stats row */}
        <div style={{
          display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap',
          marginTop: 'var(--space-5)',
          paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border)',
          fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)',
        }}>
          {chain.length > 0 && (
            <span>
              {t('cascade.longestChain')}{' '}
              <strong style={{ color: 'var(--color-text)' }}>{chain.length} {t('cascade.links')}</strong>
            </span>
          )}
          <span>
            {t('cascade.avgBlocked')}{' '}
            <strong style={{ color: 'var(--color-text)' }}>{(summary?.avg_days_blocked ?? 0).toFixed(0)} {t('cascade.days')}</strong>
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Network topology stats section ────────────────────────────────────────────

function TopologieStats({ topo }) {
  const { lang } = useLang()
  if (!topo) return null

  const nodeCount    = topo.nodes?.length ?? 0
  const edgeCount    = topo.edges?.length ?? 0

  // Cluster breakdown: count nodes per cluster
  const clusterMap = {}
  for (const node of (topo.nodes ?? [])) {
    clusterMap[node.cluster] = (clusterMap[node.cluster] ?? 0) + 1
  }

  // Top 5 companies by invoice volume
  const topCompanies = [...(topo.nodes ?? [])]
    .sort((a, b) => b.total_invoice_volume_cents - a.total_invoice_volume_cents)
    .slice(0, 5)

  const clusterColors = {
    'Port & Logistik':       { bg: '#eef5f1', border: '#c8dfd0', color: '#4a7c59' },
    'Handwerk & Bau':        { bg: '#fdf3e7', border: '#f0c880', color: '#c97a2f' },
    'Gastronomie & Handel':  { bg: '#e8f2f7', border: '#a8cfe0', color: '#2c6e8a' },
  }

  return (
    <div style={{ marginBottom: 'var(--space-10)' }}>
      <div style={{ marginBottom: 'var(--space-5)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-3)' }}>
          <span style={{ fontSize: '1.3em' }}>⬡</span>
          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text)' }}>
            {t('discover.networkStats')}
          </h2>
        </div>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-1)', paddingLeft: 'var(--space-8)' }}>
          {t('discover.networkStatsSub')}
        </p>
      </div>

      {/* KPI row */}
      <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', marginBottom: 'var(--space-6)' }}>
        {[
          { label: t('discover.companies'), value: nodeCount, icon: '◉', color: 'var(--color-primary)', bg: 'var(--color-primary-lt)', border: '#c8dfd0' },
          { label: t('discover.tradeConnections'), value: edgeCount, icon: '⇄', color: '#2c6e8a', bg: '#e8f2f7', border: '#a8cfe0' },
          { label: t('discover.clusters'), value: Object.keys(clusterMap).length, icon: '⬢', color: '#c97a2f', bg: '#fdf3e7', border: '#f0c880' },
        ].map(stat => (
          <div key={stat.label} className="card" style={{
            flex: '1 1 160px', minWidth: 140,
            background: stat.bg, border: `1px solid ${stat.border}`,
          }}>
            <div style={{ fontSize: '1.4em', marginBottom: 'var(--space-2)' }}>{stat.icon}</div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: stat.color, lineHeight: 1.1 }}>
              {stat.value}
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: stat.color, opacity: 0.8, marginTop: 'var(--space-1)', fontWeight: 600 }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Cluster breakdown + top companies */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
        {/* Cluster breakdown */}
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-4)', color: 'var(--color-text)' }}>
            {t('discover.sectorCluster')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {Object.entries(clusterMap).map(([cluster, count]) => {
              const pct = nodeCount > 0 ? Math.round((count / nodeCount) * 100) : 0
              const style = clusterColors[cluster] ?? { bg: '#f5f1eb', border: '#c9bfaf', color: '#7a6e64' }
              return (
                <div key={cluster}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{
                      background: style.bg, color: style.color,
                      border: `1px solid ${style.border}33`,
                      borderRadius: '99px', padding: '2px 10px',
                      fontSize: 'var(--font-size-xs)', fontWeight: 600,
                    }}>{cluster}</span>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                      {count} ({pct} %)
                    </span>
                  </div>
                  <div style={{ height: 6, background: '#e8e0d4', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: style.color, borderRadius: 99, transition: 'width 0.8s ease' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Top connected companies */}
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-4)', color: 'var(--color-text)' }}>
            {t('discover.mostActive')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {topCompanies.map((company, i) => {
              const maxVol = topCompanies[0]?.total_invoice_volume_cents ?? 1
              const pct = Math.round((company.total_invoice_volume_cents / maxVol) * 100)
              const style = clusterColors[company.cluster] ?? { color: '#7a6e64', bg: '#f5f1eb', border: '#c9bfaf' }
              return (
                <div key={company.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 4 }}>
                    <span style={{
                      width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                      background: i === 0 ? 'var(--color-primary)' : 'var(--color-surface-alt)',
                      color: i === 0 ? 'white' : 'var(--color-text-muted)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.65em', fontWeight: 700,
                    }}>{i + 1}</span>
                    <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {company.name}
                    </span>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {formatEur(company.total_invoice_volume_cents)}
                    </span>
                  </div>
                  <div style={{ height: 4, background: '#e8e0d4', borderRadius: 99, overflow: 'hidden', marginLeft: 28 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: style.color, borderRadius: 99 }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Colour helpers ─────────────────────────────────────────────────────────────

const SECTOR_COLOR = {
  'Port/Logistik': '#4a7c59',
  'Lebensmittel':  '#c97a2f',
  'Erneuerbare':   '#2c6e8a',
}

const SECTOR_BG = {
  'Port/Logistik': '#eef5f1',
  'Lebensmittel':  '#fdf3e7',
  'Erneuerbare':   '#e8f2f7',
}

function sectorPill(sector) {
  return (
    <span style={{
      background: SECTOR_BG[sector] ?? '#f5f1eb',
      color:      SECTOR_COLOR[sector] ?? '#7a6e64',
      border:     `1px solid ${SECTOR_COLOR[sector] ?? '#c9bfaf'}33`,
      borderRadius: '99px',
      padding:    '2px 10px',
      fontSize:   'var(--font-size-xs)',
      fontWeight: 600,
      letterSpacing: '0.03em',
    }}>
      {sector}
    </span>
  )
}

// ── Score ring (SVG sparkline) ─────────────────────────────────────────────────

function ScoreRing({ score, size = 48 }) {
  const r   = (size - 6) / 2
  const circ = 2 * Math.PI * r
  const fill = circ * (score / 100)
  const color = score >= 85 ? '#4a7c59' : score >= 70 ? '#c97a2f' : '#a89f94'
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e8e0d4" strokeWidth={5} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={`${fill} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="middle"
        fontSize={size * 0.27} fontWeight={700} fill={color} fontFamily="DM Sans, sans-serif">
        {score}
      </text>
    </svg>
  )
}

// ── Section header ─────────────────────────────────────────────────────────────

function SectionHeader({ icon, title, sub, count }) {
  return (
    <div style={{ marginBottom: 'var(--space-5)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-3)' }}>
        <span style={{ fontSize: '1.3em' }}>{icon}</span>
        <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text)' }}>
          {title}
        </h2>
        {count != null && (
          <span style={{
            background: 'var(--color-primary-lt)', color: 'var(--color-primary-dk)',
            borderRadius: '99px', padding: '1px 10px',
            fontSize: 'var(--font-size-xs)', fontWeight: 700,
          }}>
            {count}
          </span>
        )}
      </div>
      {sub && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-1)', paddingLeft: 'var(--space-8)' }}>
          {sub}
        </p>
      )}
    </div>
  )
}

// ── Connection card ───────────────────────────────────────────────────────────

function ConnectionCard({ conn, index }) {
  const { lang } = useLang()
  const [expanded, setExpanded] = useState(false)
  const hasNonMember = conn.non_member !== null

  return (
    <div className="card" style={{
      display: 'flex', flexDirection: 'column',
      gap: 'var(--space-3)',
      borderLeft: `4px solid ${SECTOR_COLOR[conn.sector] ?? '#c9bfaf'}`,
      transition: 'box-shadow 0.15s',
    }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)' }}>
        {/* Rank */}
        <div style={{
          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
          background: index === 0 ? 'var(--color-primary)' : 'var(--color-surface-alt)',
          color:      index === 0 ? 'white' : 'var(--color-text-muted)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 'var(--font-size-sm)', fontWeight: 700,
        }}>
          {index + 1}
        </div>

        {/* Company pair */}
        <div style={{ flex: 1 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
            flexWrap: 'wrap', marginBottom: 'var(--space-2)',
          }}>
            <span style={{ fontWeight: 700, fontSize: 'var(--font-size-md)', color: 'var(--color-text)' }}>
              {conn.company_a.name}
            </span>
            {!conn.company_a.gls_member && (
              <span style={{
                background: '#fdf3e7', color: '#c97a2f', border: '1px solid #f0c88033',
                borderRadius: '4px', padding: '1px 7px', fontSize: 'var(--font-size-xs)', fontWeight: 600,
              }}>
                {t('discover.notMember')}
              </span>
            )}
            <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', fontWeight: 400 }}>↔</span>
            <span style={{ fontWeight: 700, fontSize: 'var(--font-size-md)', color: 'var(--color-text)' }}>
              {conn.company_b.name}
            </span>
            {!conn.company_b.gls_member && (
              <span style={{
                background: '#fdf3e7', color: '#c97a2f', border: '1px solid #f0c88033',
                borderRadius: '4px', padding: '1px 7px', fontSize: 'var(--font-size-xs)', fontWeight: 600,
              }}>
                {t('discover.notMember')}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
            {sectorPill(conn.sector)}
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
              {t('discover.estimatedVolume')}&nbsp;
              <strong style={{ color: 'var(--color-text)' }}>{formatEur(conn.estimated_annual_volume_cents)}</strong>
            </span>
          </div>
        </div>

        {/* Score ring */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <ScoreRing score={conn.similarity_score} />
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
            {t('discover.similarity')}
          </span>
        </div>
      </div>

      {/* Reason (expandable) */}
      <div style={{
        paddingLeft: 'calc(32px + var(--space-4))',
        display: 'flex', flexDirection: 'column', gap: 'var(--space-3)',
      }}>
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            background: 'none', border: 'none', padding: 0,
            textAlign: 'left', cursor: 'pointer',
            color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)',
            display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
          }}
        >
          <span style={{ fontSize: '0.7em', transition: 'transform 0.15s', display: 'inline-block', transform: expanded ? 'rotate(90deg)' : 'none' }}>
            ▶
          </span>
          {expanded ? t('discover.hideDetails') : t('discover.showDetails')}
        </button>

        {expanded && (
          <div style={{
            background: 'var(--color-surface-alt)',
            borderRadius: 'var(--radius-sm)',
            padding: 'var(--space-3) var(--space-4)',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-muted)',
            lineHeight: 1.6,
          }}>
            {conn.reason}
          </div>
        )}

        {/* Action row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          {hasNonMember && (
            <div style={{
              fontSize: 'var(--font-size-xs)', color: '#c97a2f',
              display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
            }}>
              <span>⚠</span>
              <span>{t('discover.onboardingRequired')} <strong>{conn.non_member}</strong></span>
            </div>
          )}
          <button style={{
            marginLeft: 'auto',
            background: 'var(--color-primary)', color: 'var(--header-text)',
            border: 'none', borderRadius: 'var(--radius-sm)',
            padding: 'var(--space-2) var(--space-5)',
            fontSize: 'var(--font-size-sm)', fontWeight: 600,
            cursor: 'pointer', whiteSpace: 'nowrap',
          }}>
            {conn.action}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Funding gap card ──────────────────────────────────────────────────────────

const GAP_TYPE_COLOR = {
  'Factoring':                '#2c6e8a',
  'Lieferantenfinanzierung':  '#4a7c59',
  'Onboarding + Factoring':   '#c97a2f',
}

function UrgencyBar({ daysUntilDue }) {
  const urgent  = daysUntilDue <= 14
  const warning = daysUntilDue <= 30
  const color   = urgent ? '#b94040' : warning ? '#c97a2f' : '#4a7c59'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
      <div style={{
        width: 8, height: 8, borderRadius: '50%',
        background: color, flexShrink: 0,
      }} />
      <span style={{ fontSize: 'var(--font-size-xs)', color, fontWeight: 600 }}>
        Fällig in {daysUntilDue} Tagen
      </span>
    </div>
  )
}

function FundingGapCard({ gap }) {
  const { lang } = useLang()
  const typeColor = GAP_TYPE_COLOR[gap.gap_type] ?? '#7a6e64'
  const marginEur = Math.round(gap.opportunity_cents * gap.margin_bps / 10000)

  return (
    <div className="card" style={{
      borderLeft: `4px solid ${typeColor}`,
      display: 'flex', flexDirection: 'column', gap: 'var(--space-4)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)' }}>
        <div style={{ flex: 1 }}>
          {/* Gap type badge */}
          <div style={{ marginBottom: 'var(--space-2)' }}>
            <span style={{
              background: `${typeColor}15`,
              color: typeColor,
              border: `1px solid ${typeColor}33`,
              borderRadius: '4px',
              padding: '2px 10px',
              fontSize: 'var(--font-size-xs)', fontWeight: 700, letterSpacing: '0.03em',
            }}>
              {gap.gap_type}
            </span>
          </div>

          {/* Flow */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
            flexWrap: 'wrap', marginBottom: 'var(--space-2)',
          }}>
            <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
              {gap.creditor.name}
            </span>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
              ← Rechnung ←
            </span>
            <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
              {gap.debtor.name}
            </span>
            {!gap.debtor.gls_member && (
              <span style={{
                background: '#fdf3e7', color: '#c97a2f', border: '1px solid #f0c88033',
                borderRadius: '4px', padding: '1px 7px', fontSize: 'var(--font-size-xs)', fontWeight: 600,
              }}>
                {t('discover.notMember')}
              </span>
            )}
          </div>

          <UrgencyBar daysUntilDue={gap.days_until_due} />
        </div>

        {/* Amount */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.1 }}>
            {formatEur(gap.opportunity_cents)}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>
            Rechnungswert
          </div>
        </div>
      </div>

      {/* Description */}
      <div style={{
        background: 'var(--color-surface-alt)', borderRadius: 'var(--radius-sm)',
        padding: 'var(--space-3) var(--space-4)',
        fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', lineHeight: 1.6,
      }}>
        {gap.description}
      </div>

      {/* Margin opportunity + action */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 'var(--space-4)',
      }}>
        <div style={{
          background: 'var(--color-primary-lt)', border: '1px solid #c8dfd0',
          borderRadius: 'var(--radius-sm)', padding: 'var(--space-2) var(--space-4)',
          display: 'flex', gap: 'var(--space-6)', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary-dk)', fontWeight: 600 }}>
              GLS-Zinsmarge
            </div>
            <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-primary-dk)' }}>
              {gap.margin_bps / 100} % p.a.
            </div>
          </div>
          <div style={{ width: 1, height: 32, background: '#c8dfd0' }} />
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary-dk)', fontWeight: 600 }}>
              Ertragspotenzial / Monat
            </div>
            <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-primary)' }}>
              {formatEur(Math.round(marginEur / 12))}
            </div>
          </div>
        </div>

        <button style={{
          background: typeColor, color: 'var(--header-text)',
          border: 'none', borderRadius: 'var(--radius-sm)',
          padding: 'var(--space-2) var(--space-5)',
          fontSize: 'var(--font-size-sm)', fontWeight: 600,
          cursor: 'pointer', whiteSpace: 'nowrap',
        }}>
          Angebot erstellen
        </button>
      </div>
    </div>
  )
}

// ── Summary bar ───────────────────────────────────────────────────────────────

function InsightSummaryBar({ connections, gaps }) {
  const totalConnectionVolume = connections.reduce((s, c) => s + c.estimated_annual_volume_cents, 0)
  const totalFundingVolume    = gaps.reduce((s, g) => s + g.opportunity_cents, 0)
  const nonMemberCount        = new Set(
    connections.filter(c => c.non_member).map(c => c.non_member)
  ).size

  return (
    <div style={{
      display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap',
      marginBottom: 'var(--space-8)',
    }}>
      {[
        {
          label: 'Potenzielle Verbindungen',
          value: connections.length,
          sub: `${formatEur(totalConnectionVolume)} Jahresvolumen`,
          color: 'var(--color-primary)',
          bg:    'var(--color-primary-lt)',
          border: '#c8dfd0',
        },
        {
          label: 'Onboarding-Kandidaten',
          value: nonMemberCount,
          sub: 'Noch kein GLS-Mitglied',
          color: '#c97a2f',
          bg:    '#fdf3e7',
          border: '#f0c880',
        },
        {
          label: 'Finanzierungslücken',
          value: gaps.length,
          sub: `${formatEur(totalFundingVolume)} offen`,
          color: '#2c6e8a',
          bg:    '#e8f2f7',
          border: '#a8cfe0',
        },
      ].map(stat => (
        <div key={stat.label} className="card" style={{
          flex: '1 1 200px', minWidth: 180,
          background: stat.bg, border: `1px solid ${stat.border}`,
        }}>
          <div style={{
            fontSize: 'var(--font-size-xs)', fontWeight: 700, letterSpacing: '0.06em',
            color: stat.color, textTransform: 'uppercase', marginBottom: 'var(--space-2)',
          }}>
            {stat.label}
          </div>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: stat.color, lineHeight: 1.1 }}>
            {stat.value}
          </div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: stat.color, opacity: 0.8, marginTop: 'var(--space-1)' }}>
            {stat.sub}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Entdecken() {
  const { lang } = useLang()
  const connections = MOCK_POTENTIAL_CONNECTIONS
  const gaps        = MOCK_FUNDING_GAPS

  const [topo, setTopo]               = useState(null)
  const [topoLoading, setTopoLoading] = useState(true)
  const [cascade, setCascade]         = useState(null)

  useEffect(() => {
    networkApi.topology()
      .then(data => setTopo(data))
      .catch(() => setTopo(null))
      .finally(() => setTopoLoading(false))
  }, [])

  useEffect(() => {
    networkApi.cascadeSummary()
      .then(data => setCascade(data))
      .catch(() => setCascade(MOCK_CASCADE_SUMMARY))
  }, [])

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, marginBottom: 'var(--space-1)' }}>
          {t('discover.title')}
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
          {t('discover.subtitle')}
        </p>
        <div style={{
          marginTop: 'var(--space-3)', fontSize: 'var(--font-size-xs)',
          color: 'var(--color-accent)', fontStyle: 'italic',
        }}>
          KI-basierte Analyse des Handelsnetzwerks · Verbindungsdaten live
        </div>
      </div>

      {/* Summary KPI bar */}
      <InsightSummaryBar connections={connections} gaps={gaps} />

      {/* Live topology stats */}
      {topoLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
          Lade Netzwerk-Statistiken…
        </div>
      ) : (
        <TopologieStats topo={topo} />
      )}

      {/* Zahlungskaskade section */}
      <ZahlungskaskadeCard summary={cascade ?? MOCK_CASCADE_SUMMARY} />

      {/* Section 1: Potenzielle neue Verbindungen */}
      <div style={{ marginBottom: 'var(--space-10)' }}>
        <SectionHeader
          icon="⊛"
          title={t('discover.potentialConnections')}
          sub="Unternehmenspaare im selben Sektor — noch kein direkter Rechnungsaustausch. Sortiert nach geschätztem Netting-Potenzial."
          count={connections.length}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {connections.map((conn, i) => (
            <ConnectionCard key={conn.id} conn={conn} index={i} />
          ))}
        </div>
      </div>

      {/* Section 2: Finanzierungslücken */}
      <div>
        <SectionHeader
          icon="⬡"
          title={t('discover.fundingGaps')}
          sub="Rechnungen mit hohem Volumen — Factoring oder Lieferantenfinanzierung durch GLS Bank möglich."
          count={gaps.length}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {gaps.map(gap => (
            <FundingGapCard key={gap.id} gap={gap} />
          ))}
        </div>
      </div>
    </div>
  )
}
