import React, { useState } from 'react'
import { useRole } from '../../hooks/RoleContext.jsx'
import { useApi } from '../../hooks/useApi.js'
import { smeApi } from '../../api/sme.js'
import { MOCK_INVOICES } from '../../mock/fullDataset.js'
import { formatEur, formatDate } from '../../utils/format.js'
import { t } from '../../i18n/index.js'
import { useLang } from '../../hooks/useLang.js'

function statusLabel(s) {
  const map = { confirmed: 'status.confirmed', pending: 'status.open', draft: 'status.draft', cleared: 'status.cleared' }
  return t(map[s] || s)
}

const STATUS_CSS = { confirmed: 'badge-green', pending: 'badge-amber', draft: 'badge-gray', cleared: 'badge-blue' }

function NewInvoiceModal({ onClose }) {
  const { lang } = useLang()
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500,
    }} onClick={onClose}>
      <div className="card" style={{ minWidth: 360, maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 'var(--font-size-lg)', marginBottom: 'var(--space-4)' }}>
          {t('sme.newInvoiceTitle')}
        </div>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-6)' }}>
          Die vollständige Rechnungserfassung ist in der nächsten Version verfügbar.
          Sie können Rechnungen derzeit über Ihre GLS-Beraterin einreichen.
        </p>
        <button className="btn btn-primary" onClick={onClose}>{t('sme.close')}</button>
      </div>
    </div>
  )
}

function InvoiceRow({ inv, myId }) {
  const { lang } = useLang()
  const [open, setOpen] = useState(false)
  const isOut = inv.from_company?.id === myId
  const partner = isOut ? inv.to_company : inv.from_company

  return (
    <>
      <tr
        style={{ cursor: 'pointer' }}
        onClick={() => setOpen(o => !o)}
      >
        <td>
          <span style={{
            display: 'inline-block', width: 24, textAlign: 'center',
            color: isOut ? 'var(--color-danger)' : 'var(--color-primary)',
            fontWeight: 700, fontSize: '1.1em', marginRight: 4,
          }}>
            {isOut ? '→' : '←'}
          </span>
          {partner?.name || '—'}
        </td>
        <td style={{ fontWeight: 700 }}>{formatEur(inv.total_amount_cents)}</td>
        <td style={{ color: 'var(--color-text-muted)' }}>{formatDate(inv.due_date)}</td>
        <td><span className={`badge ${STATUS_CSS[inv.status] || 'badge-gray'}`}>{statusLabel(inv.status)}</span></td>
        <td style={{ color: 'var(--color-text-muted)', textAlign: 'right' }}>{open ? '▲' : '▼'}</td>
      </tr>
      {open && inv.line_items?.length > 0 && (
        <tr>
          <td colSpan={5} style={{ background: 'var(--color-surface-alt)', padding: 0 }}>
            <table style={{ width: '100%', fontSize: 'var(--font-size-xs)', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ padding: '6px 16px 6px 32px', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 600 }}>{t('sme.item')}</th>
                  <th style={{ padding: '6px 16px', textAlign: 'right', color: 'var(--color-text-muted)', fontWeight: 600 }}>{t('invoices.amount')}</th>
                </tr>
              </thead>
              <tbody>
                {inv.line_items.map((li, i) => (
                  <tr key={i}>
                    <td style={{ padding: '5px 16px 5px 32px', color: 'var(--color-text)' }}>{li.description}</td>
                    <td style={{ padding: '5px 16px', textAlign: 'right', fontWeight: 600 }}>{formatEur(li.amount_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  )
}

export default function SmeRechnungen() {
  const { lang } = useLang()
  const { companyId } = useRole()
  const effectiveId = companyId || 'c4'
  const [showModal, setShowModal] = useState(false)

  const mockInv = MOCK_INVOICES.filter(inv =>
    inv.from_company?.id === effectiveId || inv.to_company?.id === effectiveId
  )
  const { data: invoices, loading } = useApi(
    () => smeApi.companyInvoices(effectiveId),
    mockInv,
    [effectiveId]
  )

  const invList = (Array.isArray(invoices) ? invoices : (invoices?.items || mockInv))
    .filter(inv => inv.from_company?.id === effectiveId || inv.to_company?.id === effectiveId)

  return (
    <div>
      {showModal && <NewInvoiceModal onClose={() => setShowModal(false)} />}

      <div className="toolbar">
        <span className="toolbar-title">{t('sme.myInvoices')}</span>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          {t('sme.newInvoice')}
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="state-loading"><div className="loading-spinner" /><p>{t('sme.loading')}</p></div>
        ) : invList.length === 0 ? (
          <div className="state-empty">{t('sme.noInvoicesForCo')}</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('invoices.partner')}</th>
                <th>{t('invoices.amount')}</th>
                <th>{t('invoices.due')}</th>
                <th>{t('invoices.status')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invList.map(inv => (
                <InvoiceRow key={inv.id} inv={inv} myId={effectiveId} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
