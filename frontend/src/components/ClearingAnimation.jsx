/**
 * ClearingAnimation
 *
 * Step-by-step D3 animation of bilateral invoice netting:
 *   Phase 0 — Ruhezustand (idle)
 *   Phase 1 — Alle Brutto-Flüsse als Pfeile sichtbar
 *   Phase 2 — Gegenseitige Flüsse verblassen (Netting)
 *   Phase 3 — Netto-Flüsse erscheinen als dicke orange Pfeile
 *   Phase 4 — Einsparungen-Zähler läuft hoch
 *
 * Props:
 *   nodes    — [{ id, name, x?, y? }]
 *   grossLinks — [{ source, target, amount }]   (before netting)
 *   netLinks   — [{ source, target, amount }]   (after  netting)
 *   savingsPct — number  (e.g. 63.4)
 *   onDone     — callback when animation completes
 */
import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as d3 from 'd3'

const W = 600
const H = 380
const NODE_R = 28
const PHASE_DURATION = 900   // ms per phase
const COUNTER_STEPS  = 40

// Place N nodes in a circle
function circleLayout(nodes, cx, cy, r) {
  return nodes.map((n, i) => ({
    ...n,
    x: cx + r * Math.cos((2 * Math.PI * i) / nodes.length - Math.PI / 2),
    y: cy + r * Math.sin((2 * Math.PI * i) / nodes.length - Math.PI / 2),
  }))
}

function formatEur(v) {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace('.', ',') + ' Mio €'
  return (v / 1_000).toFixed(0) + ' Tsd €'
}

// Draw a curved arrow between two points with optional opacity/color/width
function linkPath(x1, y1, x2, y2, curvature = 0.25) {
  const dx = x2 - x1, dy = y2 - y1
  const mx = (x1 + x2) / 2 - dy * curvature
  const my = (y1 + y2) / 2 + dx * curvature
  return `M${x1},${y1} Q${mx},${my} ${x2},${y2}`
}

// Shorten path end-points so arrows don't overlap node circles
function shortenEndpoints(x1, y1, x2, y2, pad) {
  const dx = x2 - x1, dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  return {
    sx: x1 + (dx / len) * pad,
    sy: y1 + (dy / len) * pad,
    ex: x2 - (dx / len) * pad,
    ey: y2 - (dy / len) * pad,
  }
}

export default function ClearingAnimation({
  nodes: rawNodes,
  grossLinks,
  netLinks,
  savingsPct = 0,
  onDone,
}) {
  const svgRef  = useRef(null)
  const [phase, setPhase]     = useState(0)
  const [counter, setCounter] = useState(0)
  const [playing, setPlaying] = useState(false)

  // layout nodes in a circle
  const nodes = circleLayout(rawNodes, W / 2, H / 2, Math.min(W, H) / 2 - 60)

  const nodeById = Object.fromEntries(nodes.map(n => [n.id, n]))

  // ---- Draw / update SVG ----
  useEffect(() => {
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    // Defs: arrow markers
    const defs = svg.append('defs')
    ;[
      { id: 'arrow-gross',  color: '#4a7c59' },
      { id: 'arrow-net',    color: '#c97a2f' },
      { id: 'arrow-faded',  color: '#c9bfaf' },
    ].forEach(({ id, color }) => {
      defs.append('marker')
        .attr('id', id)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 8)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
          .attr('d', 'M0,-5L10,0L0,5')
          .attr('fill', color)
    })

    // --- Gross links (phase 1+) ---
    const grossGroup = svg.append('g').attr('class', 'gross-links')
    if (phase >= 1) {
      grossLinks.forEach(link => {
        const s = nodeById[link.source], t = nodeById[link.target]
        if (!s || !t) return
        const { sx, sy, ex, ey } = shortenEndpoints(s.x, s.y, t.x, t.y, NODE_R + 4)
        const isCancelled = phase >= 2 && netLinks.every(
          nl => !(nl.source === link.source && nl.target === link.target)
        )
        grossGroup.append('path')
          .attr('d', linkPath(sx, sy, ex, ey))
          .attr('fill', 'none')
          .attr('stroke', isCancelled ? '#c9bfaf' : '#4a7c59')
          .attr('stroke-width', 2)
          .attr('opacity', isCancelled ? 0.3 : 0.75)
          .attr('stroke-dasharray', isCancelled ? '5,4' : null)
          .attr('marker-end', isCancelled ? 'url(#arrow-faded)' : 'url(#arrow-gross)')
      })
    }

    // --- Net links (phase 3+) ---
    if (phase >= 3) {
      const netGroup = svg.append('g').attr('class', 'net-links')
      netLinks.forEach(link => {
        const s = nodeById[link.source], t = nodeById[link.target]
        if (!s || !t) return
        const { sx, sy, ex, ey } = shortenEndpoints(s.x, s.y, t.x, t.y, NODE_R + 4)
        netGroup.append('path')
          .attr('d', linkPath(sx, sy, ex, ey, -0.2))
          .attr('fill', 'none')
          .attr('stroke', '#c97a2f')
          .attr('stroke-width', 4)
          .attr('opacity', 0.9)
          .attr('marker-end', 'url(#arrow-net)')
      })
    }

    // --- Nodes ---
    const nodeGroup = svg.append('g').attr('class', 'nodes')
    nodes.forEach(n => {
      const g = nodeGroup.append('g').attr('transform', `translate(${n.x},${n.y})`)

      g.append('circle')
        .attr('r', NODE_R)
        .attr('fill', 'var(--color-surface)')
        .attr('stroke', 'var(--color-primary)')
        .attr('stroke-width', 2)

      // short label (first word, max 8 chars)
      const label = (n.name || '').split(' ')[0].slice(0, 8)
      g.append('text')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', '10')
        .attr('font-weight', '600')
        .attr('fill', 'var(--color-text)')
        .text(label)
    })
  }, [phase, nodes, grossLinks, netLinks])

  // ---- Phase machine ----
  const runAnimation = useCallback(() => {
    if (playing) return
    setPlaying(true)
    setCounter(0)
    setPhase(0)

    let p = 0
    const advance = () => {
      p++
      setPhase(p)
      if (p < 3) {
        setTimeout(advance, PHASE_DURATION)
      } else if (p === 3) {
        // start counter
        let step = 0
        const tick = setInterval(() => {
          step++
          setCounter(Math.round((savingsPct * step) / COUNTER_STEPS * 10) / 10)
          if (step >= COUNTER_STEPS) {
            clearInterval(tick)
            setPlaying(false)
            onDone?.()
          }
        }, PHASE_DURATION / COUNTER_STEPS)
      }
    }
    setTimeout(advance, PHASE_DURATION)
  }, [playing, savingsPct, onDone])

  const reset = () => {
    setPhase(0)
    setCounter(0)
    setPlaying(false)
  }

  const PHASE_LABELS = [
    'Bereit',
    '① Brutto-Flüsse sichtbar',
    '② Gegenseitige Forderungen werden verrechnet',
    '③ Netto-Zahlungsflüsse',
  ]

  return (
    <div className="clearing-anim-wrap">
      {/* SVG canvas */}
      <div className="clearing-anim-canvas">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          style={{ maxHeight: 380, display: 'block' }}
        />

        {/* Phase 4: overlay savings counter */}
        {phase >= 3 && (
          <div className="clearing-anim-savings">
            <span className="clearing-anim-savings-label">Einsparungen</span>
            <span className="clearing-anim-savings-value">
              {counter.toFixed(1).replace('.', ',')} %
            </span>
          </div>
        )}
      </div>

      {/* Phase label */}
      <div className="clearing-anim-status">
        <span className={`clearing-anim-phase-badge${playing ? ' clearing-anim-phase-badge--active' : ''}`}>
          {PHASE_LABELS[Math.min(phase, 3)]}
        </span>
      </div>

      {/* Controls */}
      <div className="clearing-anim-controls">
        <button
          className="btn btn-accent"
          onClick={runAnimation}
          disabled={playing}
        >
          {playing ? '▶ Läuft …' : phase === 0 ? '▶ Animation starten' : '▶ Nochmal abspielen'}
        </button>
        {phase > 0 && !playing && (
          <button className="btn btn-secondary" onClick={reset}>
            ↺ Zurücksetzen
          </button>
        )}
      </div>

      {/* Legend */}
      <div className="clearing-anim-legend">
        <span className="clearing-anim-legend-item clearing-anim-legend-item--gross">
          <span className="clearing-anim-legend-line" /> Brutto-Fluss
        </span>
        <span className="clearing-anim-legend-item clearing-anim-legend-item--faded">
          <span className="clearing-anim-legend-line clearing-anim-legend-line--dashed" /> Verrechnet (entfällt)
        </span>
        <span className="clearing-anim-legend-item clearing-anim-legend-item--net">
          <span className="clearing-anim-legend-line clearing-anim-legend-line--thick" /> Netto-Fluss
        </span>
      </div>
    </div>
  )
}
