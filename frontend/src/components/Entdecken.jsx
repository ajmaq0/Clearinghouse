import React from 'react'

export default function Entdecken() {
  return (
    <div>
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, marginBottom: 'var(--space-1)' }}>
          Entdecken
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
          Neue GLS-Mitglieder identifizieren — Onboarding-Pipeline
        </p>
      </div>

      <div className="card" style={{
        textAlign: 'center', padding: 'var(--space-16)',
        background: 'var(--color-surface-alt)',
        border: '2px dashed var(--color-border)',
      }}>
        <div style={{ fontSize: '2.5em', marginBottom: 'var(--space-4)' }}>⊙</div>
        <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, marginBottom: 'var(--space-3)' }}>
          Netzwerk-Entdeckung — Sprint 2
        </h2>
        <p style={{ color: 'var(--color-text-muted)', maxWidth: 420, margin: '0 auto', lineHeight: 1.6 }}>
          Zeigt isolierte Unternehmen im Handelsnetz, die noch nicht GLS-Mitglied sind —
          priorisiert nach Netting-Potential und Sektor.
        </p>
        <div style={{
          marginTop: 'var(--space-8)', padding: 'var(--space-4) var(--space-6)',
          background: 'var(--color-primary-lt)', border: '1px solid #c8dfd0',
          borderRadius: 'var(--radius-md)', display: 'inline-block',
          fontSize: 'var(--font-size-sm)', color: 'var(--color-primary-dk)', fontWeight: 600,
        }}>
          Geplant für Sprint 2 — multilaterales Netting + Onboarding-Dashboard
        </div>
      </div>
    </div>
  )
}
