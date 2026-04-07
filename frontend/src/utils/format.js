import { getLang } from '../i18n/index.js'

function locale() {
  return getLang() === 'en' ? 'en-US' : 'de-DE'
}

/** Format EUR cents → locale-aware currency string */
export function formatEur(cents) {
  if (cents == null) return '—'
  return new Intl.NumberFormat(locale(), {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(cents) / 100)
}

/** Format a date string to locale short date */
export function formatDate(iso) {
  if (!iso) return '—'
  if (getLang() === 'en') {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    }).format(new Date(iso))
  }
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  }).format(new Date(iso))
}

/** Format a percentage */
export function formatPct(value, decimals = 1) {
  if (value == null) return '—'
  const num = Number(value).toFixed(decimals)
  return getLang() === 'en' ? `${num} %` : `${num.replace('.', ',')} %`
}

/** Format hours → locale-aware "4h 30m" / "4 Std. 30 Min." */
export function formatHours(hours) {
  if (hours == null) return '—'
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (getLang() === 'en') {
    if (h === 0) return `${m}m`
    if (m === 0) return `${h}h`
    return `${h}h ${m}m`
  }
  if (h === 0) return `${m} Min.`
  if (m === 0) return `${h} Std.`
  return `${h} Std. ${m} Min.`
}
