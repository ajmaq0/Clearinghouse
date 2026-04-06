import React, { useState } from 'react'
import { isDemoMode } from './hooks/useApi.js'
import Uebersicht from './components/Uebersicht.jsx'
import NetworkExplorer from './pages/NetworkExplorer.jsx'
import NettingVergleich from './pages/NettingVergleich.jsx'
import GlsDashboard from './pages/GlsDashboard.jsx'
import Clearing from './components/Clearing.jsx'
import Rechnungen from './components/Rechnungen.jsx'
import Entdecken from './components/Entdecken.jsx'
import './styles/global.css'
import './styles/app.css'
import './styles/clearing-animation.css'
import './styles/network-explorer.css'

const NAV_ITEMS = [
  { id: 'uebersicht', label: 'Übersicht',    icon: '◈' },
  { id: 'rechnungen', label: 'Rechnungen',   icon: '≡' },
  { id: 'clearing',   label: 'Clearing',     icon: '⇄' },
  { id: 'vergleich',  label: 'Vergleich',    icon: '→' },
  { id: 'netzwerk',   label: 'Netzwerk',     icon: '⬡' },
  { id: 'admin',      label: 'GLS Admin',    icon: '⊞' },
  { id: 'entdecken',  label: 'Entdecken',    icon: '⊙' },
]

const PAGES = {
  uebersicht: Uebersicht,
  rechnungen: Rechnungen,
  clearing:   Clearing,
  vergleich:  NettingVergleich,
  netzwerk:   NetworkExplorer,
  admin:      GlsDashboard,
  entdecken:  Entdecken,
}

export default function App() {
  const [page, setPage] = useState('uebersicht')
  const demoMode = isDemoMode()
  const Page = PAGES[page] || Uebersicht

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-brand">
          <span className="app-logo">CF</span>
          <span className="app-title">ClearFlow Hamburg</span>
          <span className="app-subtitle">GLS Bank · Rechnungsclearing-Netzwerk</span>
        </div>
        <nav className="app-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`nav-btn${page === item.id ? ' nav-btn--active' : ''}`}
              onClick={() => setPage(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="app-header-badge">
          {demoMode
            ? <span className="badge badge-amber" title="Backend wird ignoriert — Demo-Datensatz aktiv">Demo-Modus</span>
            : <span className="badge badge-green">Live Demo</span>
          }
        </div>
      </header>

      <main className="app-main">
        <Page />
      </main>
    </div>
  )
}
