/** Format EUR cents → "€1.234,56" (German locale) */
export function formatEur(cents) {
  if (cents == null) return '—'
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(cents) / 100)
}

/** Format a date string to German short date */
export function formatDate(iso) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  }).format(new Date(iso))
}

/** Format a percentage */
export function formatPct(value, decimals = 1) {
  if (value == null) return '—'
  return `${Number(value).toFixed(decimals).replace('.', ',')} %`
}

/** Format hours → "4 Std. 30 Min." */
export function formatHours(hours) {
  if (hours == null) return '—'
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (h === 0) return `${m} Min.`
  if (m === 0) return `${h} Std.`
  return `${h} Std. ${m} Min.`
}
