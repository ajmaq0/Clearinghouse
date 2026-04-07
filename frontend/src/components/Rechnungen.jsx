import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { useApi } from '../hooks/useApi.js'
import { invoicesApi } from '../api/invoices.js'
import { companiesApi } from '../api/companies.js'
import { MOCK_INVOICES, MOCK_COMPANIES } from '../mock/data.js'
import { formatEur, formatDate } from '../utils/format.js'

const STATUS_LABELS = {
  confirmed: { label: 'Bestätigt',  badge: 'badge-green' },
  pending:   { label: 'Ausstehend', badge: 'badge-amber' },
  cancelled: { label: 'Storniert',  badge: 'badge-red'   },
  cleared:   { label: 'Verrechnet', badge: 'badge-blue'  },
}

/**
 * Parse a EUR amount string entered by the user into integer cents.
 * Accepts both "1.234,56" (German) and "1234.56" (English) styles.
 */
function parseEurInput(str) {
  if (!str) return null
  // Remove everything that isn't a digit, comma, or period
  let clean = str.replace(/[^\d.,]/g, '')
  // If both separators present, the last one is the decimal
  if (clean.includes(',') && clean.includes('.')) {
    // Remove thousands separator (whichever comes first)
    const lastComma  = clean.lastIndexOf(',')
    const lastPeriod = clean.lastIndexOf('.')
    if (lastComma > lastPeriod) {
      clean = clean.replace(/\./g, '').replace(',', '.')
    } else {
      clean = clean.replace(/,/g, '')
    }
  } else {
    clean = clean.replace(',', '.')
  }
  const eur = parseFloat(clean)
  if (isNaN(eur) || eur <= 0) return null
  return Math.round(eur * 100)
}

/**
 * Normalise a raw invoice from either the real API or mock data into a
 * consistent shape. Real API uses `from_company_id`/`amount_cents`; mock
 * uses nested `from_company` objects and `total_amount_cents`.
 */
function normalizeInvoice(inv, companyMap) {
  let fromCo = inv.from_company
  let toCo   = inv.to_company

  if (!fromCo && inv.from_company_id) {
    fromCo = companyMap[inv.from_company_id] ?? { id: inv.from_company_id, name: inv.from_company_id }
  }
  if (!toCo && inv.to_company_id) {
    toCo = companyMap[inv.to_company_id] ?? { id: inv.to_company_id, name: inv.to_company_id }
  }
  if (typeof fromCo === 'string') fromCo = { id: fromCo, name: fromCo }
  if (typeof toCo   === 'string') toCo   = { id: toCo,   name: toCo   }

  return {
    ...inv,
    from_company:       fromCo,
    to_company:         toCo,
    total_amount_cents: inv.total_amount_cents ?? inv.amount_cents ?? 0,
  }
}

// ── StatusBadge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const s = STATUS_LABELS[status] ?? { label: status, badge: 'badge-gray' }
  return <span className={`badge ${s.badge}`}>{s.label}</span>
}

// ── NetPositionWidget ────────────────────────────────────────────────────────

function NetPositionWidget({ companyId, refreshKey }) {
  const [pos, setPos]       = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!companyId) { setPos(null); return }
    setLoading(true)
    companiesApi.getPos(companyId)
      .then(setPos)
      .catch(() => setPos(null))
      .finally(() => setLoading(false))
  }, [companyId, refreshKey])

  if (!companyId) return null

  const netColor = pos && pos.net_cents > 0
    ? 'var(--color-primary-dk)'
    : pos && pos.net_cents < 0
      ? 'var(--color-danger)'
      : 'var(--color-text-muted)'

  return (
    <div className="card" style={{
      background: 'var(--color-primary-lt)', border: '1px solid #c8dfd0',
      marginBottom: 'var(--space-6)',
      display: 'flex', gap: 'var(--space-8)', alignItems: 'center', flexWrap: 'wrap',
    }}>
      <div>
        <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-primary-dk)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-1)' }}>
          Netto-Position nach Clearing
        </div>
        {loading ? (
          <span className="loading-spinner" style={{ width: 18, height: 18 }} />
        ) : pos ? (
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: netColor }}>
            {pos.net_cents >= 0 ? '+' : ''}{formatEur(pos.net_cents)}
          </div>
        ) : (
          <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>Kein Clearing-Ergebnis</div>
        )}
      </div>
      {pos && (
        <>
          <div style={{ width: 1, height: 40, background: '#c8dfd0' }} />
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary-dk)', fontWeight: 600, marginBottom: 2 }}>Forderungen</div>
            <div style={{ fontWeight: 600 }}>{formatEur(pos.receivable_cents)}</div>
          </div>
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary-dk)', fontWeight: 600, marginBottom: 2 }}>Verbindlichkeiten</div>
            <div style={{ fontWeight: 600 }}>{formatEur(pos.payable_cents)}</div>
          </div>
        </>
      )}
    </div>
  )
}

// ── InvoiceDetail ────────────────────────────────────────────────────────────

function InvoiceDetail({ invoice, onClose, onConfirm, confirming, canConfirm }) {
  if (!invoice) return null
  const lineItems = invoice.line_items ?? []
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-8)',
    }} onClick={onClose}>
      <div className="card" style={{ width: '100%', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-6)' }}>
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 4 }}>
              Rechnung #{invoice.id?.slice(0, 8)}
            </div>
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>
              {invoice.from_company?.name ?? invoice.from_company}
            </h2>
            <div style={{ color: 'var(--color-text-muted)', marginTop: 2 }}>
              → {invoice.to_company?.name ?? invoice.to_company}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: '1.5em', color: 'var(--color-text-muted)',
            cursor: 'pointer', lineHeight: 1, padding: 4,
          }}>×</button>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 2 }}>Fällig</div>
            <div style={{ fontWeight: 600 }}>{formatDate(invoice.due_date)}</div>
          </div>
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 2 }}>Status</div>
            <StatusBadge status={invoice.status} />
          </div>
          {invoice.sector && (
            <div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 2 }}>Branche</div>
              <div style={{ fontWeight: 500 }}>{invoice.sector}</div>
            </div>
          )}
        </div>

        {/* Description */}
        {invoice.description && (
          <div style={{ marginBottom: 'var(--space-4)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
            {invoice.description}
          </div>
        )}

        {/* Line items */}
        {lineItems.length > 0 && (
          <div style={{
            background: 'var(--color-surface-alt)', borderRadius: 'var(--radius-md)',
            overflow: 'hidden', marginBottom: 'var(--space-6)',
          }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr auto',
              padding: 'var(--space-3) var(--space-4)',
              borderBottom: '1px solid var(--color-border)',
              fontSize: 'var(--font-size-xs)', fontWeight: 600,
              color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>
              <span>Posten</span><span>Betrag</span>
            </div>
            {lineItems.map((li, i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '1fr auto',
                padding: 'var(--space-3) var(--space-4)',
                borderBottom: i < lineItems.length - 1 ? '1px solid var(--color-border)' : 'none',
                fontSize: 'var(--font-size-sm)',
              }}>
                <span>{li.description}</span>
                <span style={{ fontWeight: 600 }}>{formatEur(li.amount_cents)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Total */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderTop: '2px solid var(--color-border)', paddingTop: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
        }}>
          <span style={{ fontWeight: 700, fontSize: 'var(--font-size-md)' }}>Gesamtbetrag</span>
          <span style={{ fontWeight: 700, fontSize: 'var(--font-size-xl)', color: 'var(--color-primary)' }}>
            {formatEur(invoice.total_amount_cents)}
          </span>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Schließen</button>
          {invoice.status === 'pending' && canConfirm && (
            <button className="btn btn-primary" onClick={() => onConfirm(invoice.id)} disabled={confirming}>
              {confirming
                ? <><span className="loading-spinner" style={{ width: 16, height: 16 }} /> Bestätigen…</>
                : 'Rechnung bestätigen'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── InvoiceForm ──────────────────────────────────────────────────────────────

const EMPTY_LINE_ITEM = () => ({ description: '', amount_eur: '' })

function InvoiceForm({ companies, myCompanyId, onClose, onSubmitted }) {
  const [fromId,    setFromId]    = useState(myCompanyId || '')
  const [toId,      setToId]      = useState('')
  const [dueDate,   setDueDate]   = useState('')
  const [desc,      setDesc]      = useState('')
  const [lineItems, setLineItems] = useState([EMPTY_LINE_ITEM()])
  const [submitting, setSubmitting] = useState(false)
  const [error,     setError]     = useState(null)

  const totalCents = useMemo(() => {
    return lineItems.reduce((sum, li) => {
      const c = parseEurInput(li.amount_eur)
      return sum + (c ?? 0)
    }, 0)
  }, [lineItems])

  function updateLineItem(i, field, val) {
    setLineItems(prev => prev.map((li, idx) => idx === i ? { ...li, [field]: val } : li))
  }
  function addLineItem()    { setLineItems(prev => [...prev, EMPTY_LINE_ITEM()]) }
  function removeLineItem(i) { setLineItems(prev => prev.filter((_, idx) => idx !== i)) }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!fromId || !toId) { setError('Bitte Absender und Empfänger auswählen.'); return }
    if (fromId === toId)   { setError('Absender und Empfänger müssen unterschiedlich sein.'); return }
    if (totalCents <= 0)   { setError('Mindestens eine Rechnungsposition mit gültigem Betrag erforderlich.'); return }

    const parsedItems = lineItems
      .filter(li => li.description.trim() && parseEurInput(li.amount_eur))
      .map(li => ({ description: li.description.trim(), amount_cents: parseEurInput(li.amount_eur), quantity: 1 }))

    if (parsedItems.length === 0) { setError('Mindestens eine gültige Rechnungsposition erforderlich.'); return }

    setSubmitting(true)
    try {
      await invoicesApi.create({
        from_company_id: fromId,
        to_company_id:   toId,
        amount_cents:    totalCents,
        description:     desc.trim() || null,
        due_date:        dueDate || null,
        line_items:      parsedItems,
      })
      onSubmitted()
    } catch (err) {
      setError(`Fehler: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle = {
    width: '100%', padding: 'var(--space-3) var(--space-4)',
    border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
    fontSize: 'var(--font-size-sm)', background: 'var(--color-surface-alt)',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 300,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-8)',
    }} onClick={onClose}>
      <div className="card" style={{ width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>Neue Rechnung erfassen</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5em', color: 'var(--color-text-muted)', cursor: 'pointer', lineHeight: 1, padding: 4 }}>×</button>
        </div>

        {error && (
          <div className="error-banner" style={{ marginBottom: 'var(--space-4)' }}>{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          {/* From / To */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-2)' }}>Von (Absender)</label>
              <select value={fromId} onChange={e => setFromId(e.target.value)} style={inputStyle} required>
                <option value="">Unternehmen wählen…</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-2)' }}>An (Empfänger)</label>
              <select value={toId} onChange={e => setToId(e.target.value)} style={inputStyle} required>
                <option value="">Unternehmen wählen…</option>
                {companies.filter(c => c.id !== fromId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          {/* Due date & description */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-2)' }}>Fälligkeitsdatum</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-2)' }}>Beschreibung (optional)</label>
              <input type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="z. B. Lieferung Mai 2026" style={inputStyle} />
            </div>
          </div>

          {/* Line items */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-3)' }}>
              Rechnungspositionen
            </div>
            {lineItems.map((li, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 130px auto', gap: 'var(--space-3)', marginBottom: 'var(--space-3)', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Beschreibung"
                  value={li.description}
                  onChange={e => updateLineItem(i, 'description', e.target.value)}
                  style={inputStyle}
                  required
                />
                <input
                  type="text"
                  placeholder="0,00"
                  value={li.amount_eur}
                  onChange={e => updateLineItem(i, 'amount_eur', e.target.value)}
                  style={{ ...inputStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                  required
                />
                {lineItems.length > 1 && (
                  <button type="button" onClick={() => removeLineItem(i)} style={{
                    background: 'none', border: 'none', color: 'var(--color-danger)',
                    cursor: 'pointer', fontSize: '1.2em', lineHeight: 1, padding: 4,
                  }}>×</button>
                )}
              </div>
            ))}
            <button type="button" onClick={addLineItem} className="btn btn-secondary" style={{ fontSize: 'var(--font-size-xs)', padding: 'var(--space-2) var(--space-4)' }}>
              + Position hinzufügen
            </button>
          </div>

          {/* Total */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            borderTop: '2px solid var(--color-border)', paddingTop: 'var(--space-4)',
            marginBottom: 'var(--space-6)',
          }}>
            <span style={{ fontWeight: 700, fontSize: 'var(--font-size-md)' }}>Gesamtbetrag</span>
            <span style={{ fontWeight: 700, fontSize: 'var(--font-size-xl)', color: 'var(--color-primary)' }}>
              {formatEur(totalCents)}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Abbrechen</button>
            <button type="submit" className="btn btn-primary" disabled={submitting || totalCents === 0}>
              {submitting
                ? <><span className="loading-spinner" style={{ width: 16, height: 16 }} /> Einreichen…</>
                : 'Rechnung einreichen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Rechnungen (main page) ───────────────────────────────────────────────────

export default function Rechnungen() {
  const [selectedId,     setSelectedId]     = useState(null)
  const [filterCompany,  setFilterCompany]  = useState('')
  const [filterSector,   setFilterSector]   = useState('')
  const [filterStatus,   setFilterStatus]   = useState('')
  const [myCompanyId,    setMyCompanyId]    = useState('')
  const [confirming,     setConfirming]     = useState(false)
  const [confirmMsg,     setConfirmMsg]     = useState(null)
  const [showForm,       setShowForm]       = useState(false)
  const [posRefreshKey,  setPosRefreshKey]  = useState(0)

  const { data: invoicesRaw, loading, useMock, reload } = useApi(
    () => invoicesApi.list(),
    MOCK_INVOICES
  )
  const { data: companiesRaw } = useApi(
    () => companiesApi.list(),
    MOCK_COMPANIES
  )

  const companies = useMemo(
    () => Array.isArray(companiesRaw) ? companiesRaw : [],
    [companiesRaw]
  )

  const companyMap = useMemo(() => {
    const map = {}
    companies.forEach(c => { map[c.id] = c })
    return map
  }, [companies])

  const invoices = useMemo(() => {
    const rawList = Array.isArray(invoicesRaw) ? invoicesRaw : (invoicesRaw?.items ?? [])
    return rawList
      .map(inv => normalizeInvoice(inv, companyMap))
      .filter(inv => {
        // If a "my company" is selected, only show invoices involving that company
        if (myCompanyId) {
          const fromId = inv.from_company?.id ?? inv.from_company_id
          const toId   = inv.to_company?.id   ?? inv.to_company_id
          if (fromId !== myCompanyId && toId !== myCompanyId) return false
        }
        const fromName = inv.from_company?.name ?? ''
        const toName   = inv.to_company?.name   ?? ''
        if (filterCompany && !fromName.toLowerCase().includes(filterCompany.toLowerCase())
            && !toName.toLowerCase().includes(filterCompany.toLowerCase())) return false
        if (filterSector && inv.sector !== filterSector) return false
        if (filterStatus && inv.status !== filterStatus) return false
        return true
      })
  }, [invoicesRaw, companyMap, myCompanyId, filterCompany, filterSector, filterStatus])

  const sectors = useMemo(() => {
    const all = Array.isArray(invoicesRaw) ? invoicesRaw : (invoicesRaw?.items ?? [])
    return [...new Set(all.map(i => i.sector).filter(Boolean))]
  }, [invoicesRaw])

  const selected = useMemo(
    () => invoices.find(i => i.id === selectedId) ?? null,
    [invoices, selectedId]
  )

  // Confirm button is visible only for incoming pending invoices
  const canConfirm = useMemo(() => {
    if (!selected || selected.status !== 'pending') return false
    if (!myCompanyId) return true  // no company selected: allow all (backward compat)
    const toId = selected.to_company?.id ?? selected.to_company_id
    return toId === myCompanyId
  }, [selected, myCompanyId])

  async function handleConfirm(id) {
    setConfirming(true)
    try {
      await invoicesApi.confirm(id)
      setConfirmMsg('Rechnung erfolgreich bestätigt.')
      setSelectedId(null)
      reload()
    } catch (e) {
      setConfirmMsg(`Fehler: ${e.message}`)
    } finally {
      setConfirming(false)
    }
  }

  function handleFormSubmitted() {
    setShowForm(false)
    setConfirmMsg('Rechnung erfolgreich eingereicht.')
    reload()
  }

  const selectStyle = {
    padding: 'var(--space-3) var(--space-4)',
    border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
    fontSize: 'var(--font-size-sm)', background: 'var(--color-surface-alt)',
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, marginBottom: 'var(--space-1)' }}>
            Rechnungen
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
            Rechnungen anzeigen, einreichen und bestätigen
          </p>
          {useMock && (
            <div style={{ marginTop: 'var(--space-3)', fontSize: 'var(--font-size-xs)', color: 'var(--color-accent)', fontStyle: 'italic' }}>
              Demo-Daten — Backend noch nicht verbunden
            </div>
          )}
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + Neue Rechnung
        </button>
      </div>

      {/* Company selector ("Ich bin:") */}
      <div className="card" style={{ marginBottom: 'var(--space-4)', display: 'flex', gap: 'var(--space-4)', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', whiteSpace: 'nowrap' }}>Ich bin:</span>
        <select
          value={myCompanyId}
          onChange={e => setMyCompanyId(e.target.value)}
          style={{ ...selectStyle, minWidth: 220, color: myCompanyId ? 'var(--color-text)' : 'var(--color-text-muted)' }}
        >
          <option value="">Unternehmen wählen (Alle anzeigen)</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {myCompanyId && (
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
            Bestätigen-Schaltfläche erscheint nur für eingehende ausstehende Rechnungen
          </span>
        )}
      </div>

      {/* Net position widget — shown when a company is selected */}
      {myCompanyId && (
        <NetPositionWidget companyId={myCompanyId} refreshKey={posRefreshKey} />
      )}

      {/* Success / error banner */}
      {confirmMsg && (
        <div className="card" style={{
          background: confirmMsg.startsWith('Fehler') ? '#fdeaea' : 'var(--color-primary-lt)',
          border: `1px solid ${confirmMsg.startsWith('Fehler') ? '#f5c2c2' : '#c8dfd0'}`,
          color: confirmMsg.startsWith('Fehler') ? 'var(--color-danger)' : 'var(--color-primary-dk)',
          marginBottom: 'var(--space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          {confirmMsg}
          <button onClick={() => setConfirmMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2em' }}>×</button>
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ marginBottom: 'var(--space-6)', display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: '1 1 220px' }}>
          <input
            placeholder="Unternehmen suchen…"
            value={filterCompany}
            onChange={e => setFilterCompany(e.target.value)}
            style={{
              width: '100%', padding: 'var(--space-3) var(--space-4)',
              border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-sm)', background: 'var(--color-surface-alt)',
            }}
          />
        </div>
        {sectors.length > 0 && (
          <select
            value={filterSector}
            onChange={e => setFilterSector(e.target.value)}
            style={{ ...selectStyle, color: filterSector ? 'var(--color-text)' : 'var(--color-text-muted)' }}
          >
            <option value="">Alle Branchen</option>
            {sectors.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          style={{ ...selectStyle, color: filterStatus ? 'var(--color-text)' : 'var(--color-text-muted)' }}
        >
          <option value="">Alle Status</option>
          <option value="pending">Ausstehend</option>
          <option value="confirmed">Bestätigt</option>
          <option value="cleared">Verrechnet</option>
          <option value="cancelled">Storniert</option>
        </select>
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
          {invoices.length} Rechnungen
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-16)' }}>
          <span className="loading-spinner" />
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)', minWidth: 520 }}>
            <thead>
              <tr style={{ background: 'var(--color-surface-alt)', borderBottom: '2px solid var(--color-border)' }}>
                {['Von', 'An', 'Betrag', 'Fällig', 'Status', ''].map((h, i) => (
                  <th key={i} style={{
                    padding: 'var(--space-3) var(--space-5)', textAlign: i === 2 ? 'right' : 'left',
                    fontWeight: 600, color: 'var(--color-text-muted)',
                    fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.04em',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 'var(--space-10)', color: 'var(--color-text-muted)' }}>
                    Keine Rechnungen gefunden.
                  </td>
                </tr>
              ) : invoices.map((inv, i) => {
                const isIncoming = myCompanyId && (inv.to_company?.id ?? inv.to_company_id) === myCompanyId
                return (
                  <tr
                    key={inv.id}
                    onClick={() => setSelectedId(inv.id)}
                    style={{
                      borderBottom: i < invoices.length - 1 ? '1px solid var(--color-border)' : 'none',
                      cursor: 'pointer',
                      transition: 'background 0.1s',
                      background: isIncoming && inv.status === 'pending' ? 'rgba(44,110,138,0.04)' : '',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface-alt)'}
                    onMouseLeave={e => e.currentTarget.style.background = isIncoming && inv.status === 'pending' ? 'rgba(44,110,138,0.04)' : ''}
                  >
                    <td style={{ padding: 'var(--space-4) var(--space-5)', fontWeight: 500 }}>
                      {inv.from_company?.name ?? inv.from_company}
                    </td>
                    <td style={{ padding: 'var(--space-4) var(--space-5)', color: 'var(--color-text-muted)' }}>
                      {inv.to_company?.name ?? inv.to_company}
                    </td>
                    <td style={{ padding: 'var(--space-4) var(--space-5)', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {formatEur(inv.total_amount_cents)}
                    </td>
                    <td style={{ padding: 'var(--space-4) var(--space-5)', color: 'var(--color-text-muted)' }}>
                      {formatDate(inv.due_date)}
                    </td>
                    <td style={{ padding: 'var(--space-4) var(--space-5)' }}>
                      <StatusBadge status={inv.status} />
                    </td>
                    <td style={{ padding: 'var(--space-4) var(--space-5)', textAlign: 'right' }}>
                      <span style={{ color: 'var(--color-primary)', fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>
                        Details →
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {selected && (
        <InvoiceDetail
          invoice={selected}
          onClose={() => setSelectedId(null)}
          onConfirm={handleConfirm}
          confirming={confirming}
          canConfirm={canConfirm}
        />
      )}

      {showForm && (
        <InvoiceForm
          companies={companies}
          myCompanyId={myCompanyId}
          onClose={() => setShowForm(false)}
          onSubmitted={handleFormSubmitted}
        />
      )}
    </div>
  )
}
