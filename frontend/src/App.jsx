import React, { useState, useEffect } from 'react'
import { RoleProvider, useRole } from './hooks/RoleContext.jsx'
import { isDemoMode } from './hooks/useApi.js'
import { useCompanies, getDefaultSmeCompany } from './hooks/useCompanies.js'
import { useLang } from './hooks/useLang.js'
import { t } from './i18n/index.js'
import Uebersicht from './components/Uebersicht.jsx'
import NetworkExplorer from './pages/NetworkExplorer.jsx'
import NettingVergleich from './pages/NettingVergleich.jsx'
import GlsDashboard from './pages/GlsDashboard.jsx'
import Clearing from './components/Clearing.jsx'
import Rechnungen from './components/Rechnungen.jsx'
import Entdecken from './components/Entdecken.jsx'
import NetzwerkWachstum from './pages/NetzwerkWachstum.jsx'
import SmeUebersicht from './pages/sme/SmeUebersicht.jsx'
import SmeRechnungen from './pages/sme/SmeRechnungen.jsx'
import SmeClearing from './pages/sme/SmeClearing.jsx'
import SmeEntdecken from './pages/sme/SmeEntdecken.jsx'
import './styles/global.css'
import './styles/app.css'
import './styles/clearing-animation.css'
import './styles/network-explorer.css'

const GLS_NAV_ITEMS = [
  { id: 'uebersicht', labelKey: 'nav.uebersicht', icon: '◈' },
  { id: 'rechnungen', labelKey: 'nav.rechnungen', icon: '≡' },
  { id: 'vergleich',  labelKey: 'nav.vergleich',  icon: '⇄' },
  { id: 'entdecken',  labelKey: 'nav.entdecken',  icon: '⊙' },
  { id: 'admin',      labelKey: 'nav.admin',       icon: '⊞' },
]

const SME_NAV_ITEMS = [
  { id: 'sme-uebersicht', labelKey: 'nav.uebersicht', icon: '◈' },
  { id: 'sme-rechnungen', labelKey: 'nav.rechnungen', icon: '≡' },
  { id: 'sme-clearing',   labelKey: 'nav.clearing',   icon: '⇄' },
  { id: 'sme-entdecken',  labelKey: 'nav.entdecken',  icon: '⊙' },
]

const GLS_PAGES = {
  uebersicht: Uebersicht,
  rechnungen: Rechnungen,
  vergleich:  NettingVergleich,
  netzwerk:   NetworkExplorer,
  admin:      GlsDashboard,
  entdecken:  Entdecken,
  wachstum:   NetzwerkWachstum,
}

const SME_PAGES = {
  'sme-uebersicht': SmeUebersicht,
  'sme-rechnungen': SmeRechnungen,
  'sme-clearing':   SmeClearing,
  'sme-entdecken':  SmeEntdecken,
}

function AppShell() {
  const { role, companyId, setRole, setCompanyId } = useRole()
  const demoMode = isDemoMode()
  const { companies } = useCompanies()
  const defaultSmeCompany = getDefaultSmeCompany(companies)
  const { lang, setLang } = useLang()

  const [page, setPage] = useState('uebersicht')
  const [showCompanyMenu, setShowCompanyMenu] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // Sync body class for CSS variable switching
  useEffect(() => {
    document.body.classList.toggle('role-sme', role === 'sme')
    document.body.classList.toggle('role-bank', role === 'bank')
  }, [role])

  const navItems = role === 'bank' ? GLS_NAV_ITEMS : SME_NAV_ITEMS

  function handleRoleSwitch(newRole) {
    if (newRole === role) return
    if (newRole === 'sme' && !companyId) {
      setCompanyId(defaultSmeCompany.id)
    }
    setRole(newRole)
    setPage(newRole === 'bank' ? 'uebersicht' : 'sme-uebersicht')
  }

  function handleNav(id) {
    setPage(id)
    setShowCompanyMenu(false)
    setMobileNavOpen(false)
  }

  const activeCompany = companies.find(c => c.id === companyId) || defaultSmeCompany

  function handleDrillIn(companyId) {
    setRole('sme')
    setCompanyId(companyId)
    setPage('sme-uebersicht')
  }

  let PageComponent
  let pageProps = {}
  if (role === 'bank') {
    PageComponent = GLS_PAGES[page] || GLS_PAGES['uebersicht']
    if (page === 'admin') pageProps = { onDrillIn: handleDrillIn }
  } else {
    PageComponent = SME_PAGES[page] || SME_PAGES['sme-uebersicht']
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        {/* Brand / Logo */}
        <div className="app-header-brand">
          <span className="app-logo" style={{ color: role === 'sme' ? 'var(--accent-color)' : 'var(--logo-color)' }}>
            {role === 'sme' ? 'C' : 'CF'}
          </span>
          <span className="app-title">ClearFlow</span>
        </div>

        {/* Role toggle — iOS-style segmented pill */}
        <div className="role-toggle">
          <button
            className={`role-toggle-btn${role === 'bank' ? ' role-toggle-btn--active' : ''}`}
            onClick={() => handleRoleSwitch('bank')}
          >
            <span>⊞</span> {t('header.glsView')}
          </button>
          <div className="role-toggle-divider" />
          <div className="role-toggle-sme-wrap">
            <button
              className={`role-toggle-btn${role === 'sme' ? ' role-toggle-btn--active' : ''}`}
              onClick={() => {
                handleRoleSwitch('sme')
                if (role === 'sme') setShowCompanyMenu(v => !v)
              }}
            >
              <span>◈</span> {t('header.companyView')}
              {role === 'sme' && <span className="role-toggle-caret">▾</span>}
            </button>
            {role === 'sme' && showCompanyMenu && (
              <div className="company-dropdown">
                {companies.map(c => (
                  <button
                    key={c.id}
                    className={`company-dropdown-item${c.id === companyId ? ' company-dropdown-item--active' : ''}`}
                    onClick={() => { setCompanyId(c.id); setShowCompanyMenu(false) }}
                  >
                    <span className="company-dropdown-name">{c.name}</span>
                    <span className="company-dropdown-sector">{c.sector}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className="app-nav">
          {navItems.map(item => (
            <button
              key={item.id}
              className={`nav-btn${page === item.id ? ' nav-btn--active' : ''}`}
              onClick={() => handleNav(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{t(item.labelKey)}</span>
            </button>
          ))}
        </nav>

        {/* Identity badge + language toggle */}
        <div className="app-identity-badge">
          {role === 'bank' ? (
            <span className="identity-bank">{t('header.bankIdentity')}</span>
          ) : (
            <span className="identity-sme">
              <span className="identity-avatar">{activeCompany.name.charAt(0)}</span>
              <span className="identity-sme-text">
                <span className="identity-sme-name">{activeCompany.name}</span>
                <span className="identity-sme-sub">{t('header.accountLabel')}</span>
              </span>
            </span>
          )}
          {demoMode && (
            <span className="badge badge-amber" title={t('header.demoTooltip')} style={{ marginLeft: '0.5rem' }}>Demo</span>
          )}

          {/* DE | EN language toggle */}
          <div className="lang-toggle" style={{
            marginLeft: '0.75rem',
            display: 'flex', alignItems: 'center',
            background: 'rgba(255,255,255,0.12)',
            borderRadius: '99px',
            padding: '2px',
            gap: 0,
          }}>
            {['de', 'en'].map((code, i) => (
              <button
                key={code}
                onClick={() => setLang(code)}
                style={{
                  background: lang === code ? 'rgba(255,255,255,0.22)' : 'transparent',
                  border: 'none',
                  borderRadius: '99px',
                  padding: '2px 8px',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: lang === code ? 700 : 500,
                  color: lang === code ? 'var(--header-text)' : 'var(--header-muted)',
                  cursor: 'pointer',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  lineHeight: 1.6,
                  transition: 'all 0.15s',
                }}
              >
                {code.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Hamburger button — visible only at <900px */}
        <button
          className="nav-hamburger"
          onClick={() => setMobileNavOpen(v => !v)}
          aria-label={mobileNavOpen ? t('header.navClose') : t('header.navOpen')}
          aria-expanded={mobileNavOpen}
        >
          <span className="nav-hamburger-line" style={{ transform: mobileNavOpen ? 'rotate(45deg) translate(4px,4px)' : undefined }} />
          <span className="nav-hamburger-line" style={{ opacity: mobileNavOpen ? 0 : 1 }} />
          <span className="nav-hamburger-line" style={{ transform: mobileNavOpen ? 'rotate(-45deg) translate(4px,-4px)' : undefined }} />
        </button>
      </header>

      {/* Mobile nav drawer */}
      {mobileNavOpen && (
        <div className="mobile-nav-drawer">
          {/* Role toggle */}
          <div className="role-toggle">
            <button
              className={`role-toggle-btn${role === 'bank' ? ' role-toggle-btn--active' : ''}`}
              onClick={() => handleRoleSwitch('bank')}
            >
              <span>⊞</span> {t('header.glsView')}
            </button>
            <div className="role-toggle-divider" />
            <div className="role-toggle-sme-wrap">
              <button
                className={`role-toggle-btn${role === 'sme' ? ' role-toggle-btn--active' : ''}`}
                onClick={() => {
                  handleRoleSwitch('sme')
                  if (role === 'sme') setShowCompanyMenu(v => !v)
                }}
              >
                <span>◈</span> {t('header.companyView')}
                {role === 'sme' && <span className="role-toggle-caret">▾</span>}
              </button>
              {role === 'sme' && showCompanyMenu && (
                <div className="company-dropdown">
                  {companies.map(c => (
                    <button
                      key={c.id}
                      className={`company-dropdown-item${c.id === companyId ? ' company-dropdown-item--active' : ''}`}
                      onClick={() => { setCompanyId(c.id); setShowCompanyMenu(false) }}
                    >
                      <span className="company-dropdown-name">{c.name}</span>
                      <span className="company-dropdown-sector">{c.sector}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Nav items */}
          <nav className="mobile-nav-items">
            {navItems.map(item => (
              <button
                key={item.id}
                className={`nav-btn${page === item.id ? ' nav-btn--active' : ''}`}
                onClick={() => handleNav(item.id)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span>{t(item.labelKey)}</span>
              </button>
            ))}
          </nav>

          {/* Identity (mobile) */}
          <div style={{ paddingTop: 'var(--space-3)', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: 'var(--font-size-xs)', color: 'var(--header-muted)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            {role === 'bank' ? (
              <span>{t('header.bankIdentity')}</span>
            ) : (
              <>
                <span className="identity-avatar" style={{ width: 24, height: 24, fontSize: '0.6rem' }}>{activeCompany.name.charAt(0)}</span>
                <span>{activeCompany.name}</span>
              </>
            )}
            {demoMode && <span className="badge badge-amber" style={{ marginLeft: 'var(--space-2)' }}>Demo</span>}

            {/* Language toggle (mobile) */}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              {['de', 'en'].map(code => (
                <button
                  key={code}
                  onClick={() => setLang(code)}
                  style={{
                    background: lang === code ? 'rgba(255,255,255,0.2)' : 'transparent',
                    border: 'none', borderRadius: 4, padding: '2px 6px',
                    fontSize: 'var(--font-size-xs)', fontWeight: lang === code ? 700 : 400,
                    color: 'var(--header-muted)', cursor: 'pointer', textTransform: 'uppercase',
                  }}
                >
                  {code.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <main className="app-main">
        <PageComponent {...pageProps} />
      </main>
    </div>
  )
}

export default function App() {
  return (
    <RoleProvider>
      <AppShell />
    </RoleProvider>
  )
}
