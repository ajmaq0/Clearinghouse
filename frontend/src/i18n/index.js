import de from './de.js'
import en from './en.js'

const LANGS = { de, en }
const listeners = new Set()

function initLang() {
  const params = new URLSearchParams(window.location.search)
  const paramLang = params.get('lang')
  if (paramLang && LANGS[paramLang]) return paramLang
  try {
    const stored = localStorage.getItem('clearflow_lang')
    if (stored && LANGS[stored]) return stored
  } catch (_) {}
  return 'de'
}

let current = initLang()

export function getLang() { return current }

export function setLang(code) {
  if (!LANGS[code] || code === current) return
  current = code
  try { localStorage.setItem('clearflow_lang', code) } catch (_) {}
  listeners.forEach(fn => fn(code))
}

export function subscribe(fn) { listeners.add(fn) }
export function unsubscribe(fn) { listeners.delete(fn) }

export function t(path) {
  const keys = path.split('.')
  let val = LANGS[current]
  for (const k of keys) { val = val?.[k] }
  return val ?? path
}
