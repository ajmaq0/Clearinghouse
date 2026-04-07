import { useState, useEffect } from 'react'
import { getLang, setLang as setLangFn, subscribe, unsubscribe } from '../i18n/index.js'

export function useLang() {
  const [lang, setLangState] = useState(getLang)

  useEffect(() => {
    const handler = newLang => setLangState(newLang)
    subscribe(handler)
    return () => unsubscribe(handler)
  }, [])

  return { lang, setLang: setLangFn }
}
