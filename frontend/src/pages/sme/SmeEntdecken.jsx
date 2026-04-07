import React from 'react'
import { useRole } from '../../hooks/RoleContext.jsx'
import { useApi } from '../../hooks/useApi.js'
import { smeApi } from '../../api/sme.js'
import { MOCK_MATCHING_HINTS } from '../../mock/fullDataset.js'
import { formatEur } from '../../utils/format.js'
import { t } from '../../i18n/index.js'
import { useLang } from '../../hooks/useLang.js'

function SimilarityBar({ score }) {
  const color = score >= 80 ? 'var(--color-primary)' : score >= 60 ? 'var(--color-accent)' : 'var(--color-info)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
      <div style={{ flex: 1, height: 6, background: 'var(--color-border)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${score}%`, background: color, borderRadius: 99, transition: 'width 0.5s' }} />
      </div>
      <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color, minWidth: 30 }}>{score} %</span>
    </div>
  )
}

function MatchCard({ match }) {
  const { lang } = useLang()
  const typeLabels = {
    bilateral:      'Bilateral',
    multilateral:   'Multilateral',
    new_connection: 'Neue Verbindung',
  }
  const typeBadge = {
    bilateral:      'badge-green',
    multilateral:   'badge-blue',
    new_connection: 'badge-amber',
  }

  return (
    <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 'var(--font-size-md)', color: 'var(--color-text)' }}>
            {match.partner.name}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>
            {match.partner.sector}
            {match.partner.gls_member && (
              <span className="badge badge-green" style={{ marginLeft: 6 }}>{t('sme.glsMember')}</span>
            )}
          </div>
        </div>
        <span className={`badge ${typeBadge[match.match_type] || 'badge-gray'}`}>
          {typeLabels[match.match_type] || match.match_type}
        </span>
      </div>

      <div style={{ marginBottom: 'var(--space-3)' }}>
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 4 }}>
          {t('sme.similarity')}
        </div>
        <SimilarityBar score={match.similarity_score} />
      </div>

      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)', lineHeight: 1.5 }}>
        {match.reason}
      </p>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>{t('sme.estimatedMonthly')}&nbsp;</span>
          <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{formatEur(match.estimated_monthly_volume_cents)}</span>
          {match.shared_customers > 0 && (
            <span style={{ marginLeft: 8, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              · {match.shared_customers} {t('sme.sharedCustomers')}
            </span>
          )}
        </div>
        <button className="btn btn-secondary" style={{ fontSize: 'var(--font-size-xs)', padding: '6px 14px' }}>
          {t('sme.contactUs')}
        </button>
      </div>
    </div>
  )
}

function OpportunityCard({ opp }) {
  const { lang } = useLang()
  return (
    <div className="card" style={{ marginBottom: 'var(--space-4)', borderLeft: '3px solid var(--color-accent)' }}>
      <div style={{ fontWeight: 700, marginBottom: 'var(--space-2)' }}>{opp.title}</div>
      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)', lineHeight: 1.5 }}>
        {opp.description}
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {opp.opportunity_cents > 0 && (
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            {t('sme.potential')} <strong style={{ color: 'var(--color-text)' }}>{formatEur(opp.opportunity_cents)}</strong>
          </div>
        )}
        <button className="btn btn-accent" style={{ fontSize: 'var(--font-size-xs)', padding: '6px 14px', marginLeft: 'auto' }}>
          {opp.action}
        </button>
      </div>
    </div>
  )
}

export default function SmeEntdecken() {
  const { lang } = useLang()
  const { companyId } = useRole()
  const effectiveId = companyId || 'c4'

  const mockHints = MOCK_MATCHING_HINTS[effectiveId] || MOCK_MATCHING_HINTS.default
  const { data: hints, loading } = useApi(
    () => smeApi.matchingHints(effectiveId),
    mockHints,
    [effectiveId]
  )

  const h = hints || mockHints

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{t('sme.discoverTitle')}</h1>
        <p className="page-subtitle">{t('sme.discoverSubtitle')}</p>
      </div>

      {loading ? (
        <div className="state-loading"><div className="loading-spinner" /><p>{t('sme.loading')}</p></div>
      ) : (
        <div className="content-grid">
          {/* Section A: Supplier matches */}
          <div>
            <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, marginBottom: 'var(--space-5)', color: 'var(--color-text)' }}>
              {t('sme.supplierMatches')}
            </h2>
            {h.supplier_matches?.length === 0 ? (
              <div className="card" style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: 'var(--space-10)' }}>
                {t('sme.noMatches')}
              </div>
            ) : (
              h.supplier_matches?.map(m => <MatchCard key={m.id} match={m} />)
            )}
          </div>

          {/* Section B: Business opportunities */}
          <div>
            <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, marginBottom: 'var(--space-5)', color: 'var(--color-text)' }}>
              {t('sme.bizOpportunities')}
            </h2>
            {h.business_opportunities?.length === 0 ? (
              <div className="card" style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: 'var(--space-10)' }}>
                {t('sme.noOpportunities')}
              </div>
            ) : (
              h.business_opportunities?.map(o => <OpportunityCard key={o.id} opp={o} />)
            )}
          </div>
        </div>
      )}
    </div>
  )
}
