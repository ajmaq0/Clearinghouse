import React, { useState, useEffect } from 'react'
import { RoleProvider, useRole } from './hooks/RoleContext.jsx'
import { isDemoMode } from './hooks/useApi.js'
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
import { MOCK_COMPANIES } from './mock/fullDataset.js'
import './styles/global.css'
import './styles/app.css'
import './styles/clearing-animation.css'
import './styles/network-explorer.css'

const GLS_NAV_ITEMS = [
  { id: 'uebersicht', label: 'Übersicht',  icon: '◈' },
  { id: 'rechnungen', label: 'Rechnungen', icon: '≡' },
  { id: 'vergleich',  label: 'Vergleich',  icon: '⇄' },
  { id: 'entdecken',  label: 'Entdecken',  icon: '⊙' },
  { id: 'admin',      label: 'GLS Admin',  icon: '⊞' },
]

const SME_NAV_ITEMS = [
  { id: 'sme-uebersicht', label: 'Übersicht',  icon: '◈' },
  { id: 'sme-rechnungen', label: 'Rechnungen', icon: '≡' },
  { id: 'sme-clearing',   label: 'Clearing',   icon: '⇄' },
  { id: 'sme-entdecken',  label: 'Entdecken',  icon: '⊙' },
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

const DEFAULT_SME_COMPANY = MOCK_COMPANIES.find(c => c.id === 'c4') || MOCK_COMPANIES[0]

function AppShell() {
  const { role, companyId, setRole, setCompanyId } = useRole()
  const demoMode = isDemoMode()

  const [page, setPage] = useState('uebersicht')
  const [showCompanyMenu, setShowCompanyMenu] = useState(false)

  // Sync body class for CSS variable switching
  useEffect(() => {
    document.body.classList.toggle('role-sme', role === 'sme')
    document.body.classList.toggle('role-bank', role === 'bank')
  }, [role])

  const navItems = role === 'bank' ? GLS_NAV_ITEMS : SME_NAV_ITEMS
  const defaultPage = role === 'bank' ? 'uebersicht' : 'sme-uebersicht'

  function handleRoleSwitch(newRole) {
    if (newRole === role) return
    if (newRole === 'sme' && !companyId) {
      setCompanyId(DEFAULT_SME_COMPANY.id)
    }
    setRole(newRole)
    setPage(newRole === 'bank' ? 'uebersicht' : 'sme-uebersicht')
  }

  function handleNav(id) {
    setPage(id)
    setShowCompanyMenu(false)
  }

  const activeCompany = MOCK_COMPANIES.find(c => c.id === companyId) || DEFAULT_SME_COMPANY

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
            <span>⊞</span> GLS-Ansicht
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
              <span>◈</span> Unternehmen
              {role === 'sme' && <span className="role-toggle-caret">▾</span>}
            </button>
            {role === 'sme' && showCompanyMenu && (
              <div className="company-dropdown">
                {MOCK_COMPANIES.map(c => (
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
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Identity badge */}
        <div className="app-identity-badge">
          {role === 'bank' ? (
            <span className="identity-bank">GLS Bank · Hamburg</span>
          ) : (
            <span className="identity-sme">
              <span className="identity-avatar">{activeCompany.name.charAt(0)}</span>
              <span className="identity-sme-text">
                <span className="identity-sme-name">{activeCompany.name}</span>
                <span className="identity-sme-sub">GLS Konto 4821</span>
              </span>
            </span>
          )}
          {demoMode && (
            <span className="badge badge-amber" title="Demo-Datensatz aktiv" style={{ marginLeft: '0.5rem' }}>Demo</span>
          )}
        </div>
      </header>

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
