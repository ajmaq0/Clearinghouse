import React from 'react'

const TABS = [
  { id: 'uebersicht', label: 'Übersicht',  icon: '◈' },
  { id: 'rechnungen', label: 'Rechnungen', icon: '≡' },
  { id: 'clearing',   label: 'Clearing',   icon: '⇄' },
  { id: 'entdecken',  label: 'Entdecken',  icon: '⊙' },
]

export default function Layout({ activeTab, onTabChange, children }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        padding: '0 var(--space-8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '72px',
        boxShadow: 'var(--shadow-sm)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          {/* GLS-style wordmark */}
          <div style={{
            background: 'var(--color-primary)',
            color: 'var(--header-text)',
            fontWeight: 700,
            fontSize: 'var(--font-size-sm)',
            letterSpacing: '0.06em',
            padding: '6px 12px',
            borderRadius: 'var(--radius-sm)',
          }}>GLS</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 'var(--font-size-md)', color: 'var(--color-text)' }}>
              ClearFlow
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '-2px' }}>
              Hamburg — Rechnungsclearing-Plattform
            </div>
          </div>
        </div>

        {/* Tab navigation */}
        <nav style={{ display: 'flex', gap: 'var(--space-1)' }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              style={{
                background: activeTab === tab.id ? 'var(--color-primary-lt)' : 'transparent',
                color: activeTab === tab.id ? 'var(--color-primary-dk)' : 'var(--color-text-muted)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3) var(--space-5)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: activeTab === tab.id ? 700 : 500,
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                transition: 'all 0.15s',
                cursor: 'pointer',
                borderBottom: activeTab === tab.id ? '2px solid var(--color-primary)' : '2px solid transparent',
              }}
            >
              <span style={{ fontSize: '1em' }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Status pill */}
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)',
            background: 'var(--color-primary-lt)', color: 'var(--color-primary-dk)',
            borderRadius: '99px', padding: '4px 12px', fontWeight: 600,
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: 'var(--color-primary)', display: 'inline-block'
            }} />
            System aktiv
          </span>
        </div>
      </header>

      {/* Main content */}
      <main style={{ flex: 1, padding: 'var(--space-8)', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        {children}
      </main>

      <footer style={{
        borderTop: '1px solid var(--color-border)',
        padding: 'var(--space-4) var(--space-8)',
        fontSize: 'var(--font-size-xs)',
        color: 'var(--color-text-muted)',
        textAlign: 'center',
        background: 'var(--color-surface)',
      }}>
        GLS Bank Hamburg · ClearFlow Clearing-Plattform · Demo-System
      </footer>
    </div>
  )
}
