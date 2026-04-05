/**
 * NetworkExplorer — D3 force-directed graph with pan/zoom
 *
 * Features:
 * - D3 force simulation (charge + link + center)
 * - Pan & zoom via d3.zoom
 * - Click a node → highlight its invoice links, show tooltip panel
 * - Tooltip: company name, sector, net position in EUR
 * - Color nodes by sector
 * - Link width proportional to invoice amount
 */
import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as d3 from 'd3'
import { networkApi } from '../api/network.js'
import { companiesApi } from '../api/companies.js'
import { invoicesApi } from '../api/invoices.js'
import '../styles/network-explorer.css'

// ---- Mock data ----------------------------------------
const MOCK_NODES = [
  { id: 'MUL', name: 'Müller Logistik GmbH',     sector: 'Logistik',    netPosition:  142000 },
  { id: 'SCH', name: 'Schreiber & Co. KG',        sector: 'Handel',      netPosition:   98500 },
  { id: 'HAF', name: 'Hafentechnik Hamburg AG',   sector: 'Technik',     netPosition:  -67200 },
  { id: 'NOR', name: 'Nordsee Fisch GmbH',        sector: 'Lebensmittel',netPosition:   55000 },
  { id: 'ELB', name: 'Elbe Import Export',        sector: 'Handel',      netPosition:  -44800 },
  { id: 'ALT', name: 'Altonaer Maschinenbau',     sector: 'Technik',     netPosition:   31000 },
  { id: 'HAR', name: 'Harburg Textil GmbH',       sector: 'Textil',      netPosition:  -28000 },
  { id: 'BER', name: 'Bergedorfer Bäckerei KG',   sector: 'Lebensmittel',netPosition:   19500 },
  { id: 'EIM', name: 'Eimsbüttel Design GmbH',    sector: 'Dienstleist.', netPosition:  -12000 },
  { id: 'WAN', name: 'Wandsbek Bau GmbH',         sector: 'Bau',         netPosition:   88000 },
  { id: 'OHL', name: 'Ohlsdorf Chemie AG',        sector: 'Chemie',      netPosition:  -55000 },
  { id: 'POP', name: 'Poppenbüttel IT GmbH',      sector: 'IT',          netPosition:   42000 },
]

const MOCK_LINKS = [
  { source: 'MUL', target: 'SCH', amount: 45000 },
  { source: 'SCH', target: 'MUL', amount: 30000 },
  { source: 'SCH', target: 'HAF', amount: 62000 },
  { source: 'HAF', target: 'SCH', amount: 62000 },
  { source: 'NOR', target: 'ELB', amount: 28000 },
  { source: 'ELB', target: 'NOR', amount: 15000 },
  { source: 'ALT', target: 'MUL', amount: 38000 },
  { source: 'MUL', target: 'ALT', amount: 22000 },
  { source: 'HAR', target: 'NOR', amount: 19000 },
  { source: 'ELB', target: 'HAF', amount: 33000 },
  { source: 'HAF', target: 'ALT', amount: 41000 },
  { source: 'ALT', target: 'HAR', amount: 27000 },
  { source: 'BER', target: 'SCH', amount: 14000 },
  { source: 'EIM', target: 'POP', amount: 22000 },
  { source: 'POP', target: 'WAN', amount: 35000 },
  { source: 'WAN', target: 'OHL', amount: 48000 },
  { source: 'OHL', target: 'MUL', amount: 29000 },
  { source: 'NOR', target: 'BER', amount: 11000 },
]

const SECTOR_COLORS = {
  'Logistik':    '#4a7c59',
  'Handel':      '#c97a2f',
  'Technik':     '#2c6e8a',
  'Lebensmittel':'#7a9e3e',
  'Textil':      '#8a5c9e',
  'Dienstleist.':'#9e7a2c',
  'Bau':         '#6e4a2c',
  'Chemie':      '#2c7a8a',
  'IT':          '#5c6e9e',
}

function sectorColor(sector) {
  return SECTOR_COLORS[sector] || '#7a6e64'
}

function formatEur(v) {
  if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(2).replace('.', ',') + ' Mio €'
  if (Math.abs(v) >= 1_000)     return (v / 1_000).toFixed(0) + ' Tsd €'
  return v.toLocaleString('de-DE') + ' €'
}

const NODE_R = 18
const LINK_SCALE = d3.scaleLinear().domain([10000, 80000]).range([1.5, 5]).clamp(true)

export default function NetworkExplorer() {
  const svgRef    = useRef(null)
  const simRef    = useRef(null)
  const [selected, setSelected] = useState(null)   // selected node id
  const [stats, setStats]       = useState(null)
  const [graphNodes, setGraphNodes] = useState(MOCK_NODES)
  const [graphLinks, setGraphLinks] = useState(MOCK_LINKS)

  useEffect(() => {
    networkApi.stats()
      .then(setStats)
      .catch(() => setStats({ totalCompanies: 50, totalInvoices: 312 }))
  }, [])

  // Try to load real companies + invoices; fall back to mock
  useEffect(() => {
    Promise.all([companiesApi.list(), invoicesApi.list()])
      .then(([companies, invoicesRaw]) => {
        const invoices = Array.isArray(invoicesRaw) ? invoicesRaw : (invoicesRaw?.items || [])
        if (!companies?.length || !invoices?.length) return
        const nodes = companies.map(c => ({
          id: c.id,
          name: c.name,
          sector: c.sector || 'Sonstiges',
          netPosition: c.net_position_cents || 0,
        }))
        const nodeIds = new Set(nodes.map(n => n.id))
        const links = invoices
          .filter(inv => {
            const src = inv.from_company?.id || inv.from_company
            const tgt = inv.to_company?.id   || inv.to_company
            return nodeIds.has(src) && nodeIds.has(tgt)
          })
          .map(inv => ({
            source: inv.from_company?.id || inv.from_company,
            target: inv.to_company?.id   || inv.to_company,
            amount: inv.total_amount_cents || 0,
          }))
        setGraphNodes(nodes)
        setGraphLinks(links)
      })
      .catch(() => { /* keep mock */ })
  }, [])

  // Build D3 simulation
  useEffect(() => {
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const width  = svgRef.current.clientWidth  || 800
    const height = svgRef.current.clientHeight || 500

    // Deep-copy so D3 can mutate
    const nodes = graphNodes.map(n => ({ ...n }))
    const links = graphLinks.map(l => ({ ...l }))

    // Arrow markers per sector
    const defs = svg.append('defs')
    Object.entries(SECTOR_COLORS).forEach(([sector, color]) => {
      defs.append('marker')
        .attr('id', `arrow-${sector.replace(/\W/g, '_')}`)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', NODE_R + 10)
        .attr('refY', 0)
        .attr('markerWidth', 5)
        .attr('markerHeight', 5)
        .attr('orient', 'auto')
        .append('path').attr('d', 'M0,-5L10,0L0,5').attr('fill', color)
    })
    defs.append('marker')
      .attr('id', 'arrow-default')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', NODE_R + 10)
      .attr('refY', 0)
      .attr('markerWidth', 5)
      .attr('markerHeight', 5)
      .attr('orient', 'auto')
      .append('path').attr('d', 'M0,-5L10,0L0,5').attr('fill', '#7a6e64')

    // Root group (zoom target)
    const root = svg.append('g').attr('class', 'zoom-root')

    // Zoom
    const zoom = d3.zoom()
      .scaleExtent([0.3, 3])
      .on('zoom', e => root.attr('transform', e.transform))
    svg.call(zoom)
    svg.call(zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(0.85))

    // Simulation
    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(140).strength(0.4))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(0, 0))
      .force('collision', d3.forceCollide(NODE_R + 12))
    simRef.current = sim

    // Links
    const linkSel = root.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .join('line')
        .attr('stroke', d => sectorColor(nodes.find(n => n.id === (d.source?.id || d.source))?.sector))
        .attr('stroke-width', d => LINK_SCALE(d.amount))
        .attr('stroke-opacity', 0.55)
        .attr('marker-end', d => {
          const sNode = nodes.find(n => n.id === (d.source?.id || d.source))
          return `url(#arrow-${(sNode?.sector || 'default').replace(/\W/g, '_')})`
        })

    // Node groups
    const nodeSel = root.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(nodes)
      .join('g')
        .attr('class', 'node-group')
        .style('cursor', 'pointer')
        .call(
          d3.drag()
            .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
            .on('drag',  (e, d) => { d.fx = e.x; d.fy = e.y })
            .on('end',   (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null })
        )
        .on('click', (e, d) => {
          e.stopPropagation()
          setSelected(prev => prev === d.id ? null : d.id)
        })

    nodeSel.append('circle')
      .attr('r', NODE_R)
      .attr('fill', d => sectorColor(d.sector))
      .attr('fill-opacity', 0.15)
      .attr('stroke', d => sectorColor(d.sector))
      .attr('stroke-width', 2.5)

    nodeSel.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '9')
      .attr('font-weight', '700')
      .attr('fill', d => sectorColor(d.sector))
      .text(d => (d.name || d.id).split(' ')[0].slice(0, 6))

    // Deselect on canvas click
    svg.on('click', () => setSelected(null))

    sim.on('tick', () => {
      linkSel
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y)
      nodeSel.attr('transform', d => `translate(${d.x},${d.y})`)
    })

    return () => { sim.stop(); svg.on('click', null) }
  }, [graphNodes, graphLinks])

  // Highlight selected node and its links
  useEffect(() => {
    const svg = d3.select(svgRef.current)
    if (!selected) {
      svg.selectAll('.node-group circle').attr('fill-opacity', 0.15).attr('stroke-width', 2.5)
      svg.selectAll('.links line').attr('stroke-opacity', 0.55)
      return
    }
    svg.selectAll('.node-group').each(function(d) {
      const isSelected = d.id === selected
      d3.select(this).select('circle')
        .attr('fill-opacity', isSelected ? 0.35 : 0.10)
        .attr('stroke-width',  isSelected ? 4 : 1.5)
    })
    svg.selectAll('.links line').attr('stroke-opacity', d => {
      const sid = d.source?.id || d.source
      const tid = d.target?.id || d.target
      return (sid === selected || tid === selected) ? 0.9 : 0.12
    })
  }, [selected])

  const selectedNode = selected ? graphNodes.find(n => n.id === selected) : null
  const selectedLinks = selected
    ? graphLinks.filter(l => {
        const src = l.source?.id || l.source
        const tgt = l.target?.id || l.target
        return src === selected || tgt === selected
      })
    : []

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Netzwerk-Explorer</h1>
        <p className="page-subtitle">
          Handels- und Rechnungsbeziehungen zwischen Hamburger KMUs · {stats ? `${stats.totalCompanies} Unternehmen` : '…'}
        </p>
      </div>

      <div className="network-layout">
        {/* Graph */}
        <div className="card network-card">
          <div className="network-hint">
            Scrollen zum Zoomen · Ziehen zum Verschieben · Knoten anklicken
          </div>
          <svg
            ref={svgRef}
            className="network-svg"
            width="100%"
            height="500"
          />
        </div>

        {/* Sidebar */}
        <div className="network-sidebar">
          {/* Sector legend */}
          <div className="card">
            <h3 className="toolbar-title" style={{ marginBottom: 'var(--space-4)' }}>Sektoren</h3>
            {Object.entries(SECTOR_COLORS).map(([sector, color]) => (
              <div key={sector} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                <span style={{
                  width: 12, height: 12, borderRadius: '50%',
                  background: color, flexShrink: 0,
                  border: `2px solid ${color}`,
                }} />
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>{sector}</span>
              </div>
            ))}
          </div>

          {/* Selected node detail */}
          {selectedNode ? (
            <div className="card network-detail-card">
              <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, marginBottom: 'var(--space-3)', color: sectorColor(selectedNode.sector) }}>
                {selectedNode.name}
              </h3>
              <div style={{ marginBottom: 'var(--space-3)' }}>
                <span className="badge badge-gray">{selectedNode.sector}</span>
              </div>
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <div className="kpi-label">Netto-Position</div>
                <div style={{
                  fontSize: 'var(--font-size-xl)',
                  fontWeight: 800,
                  color: selectedNode.netPosition >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
                }}>
                  {selectedNode.netPosition >= 0 ? '+' : ''}{formatEur(selectedNode.netPosition)}
                </div>
              </div>

              <div className="kpi-label" style={{ marginBottom: 'var(--space-2)' }}>
                Rechnungsbeziehungen ({selectedLinks.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {selectedLinks.map((l, i) => {
                  const src = l.source?.id || l.source
                  const tgt = l.target?.id || l.target
                  const isOut = src === selected
                  const other = isOut ? tgt : src
                  const otherNode = graphNodes.find(n => n.id === other)
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                      padding: 'var(--space-2) var(--space-3)',
                      background: 'var(--color-surface-alt)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 'var(--font-size-xs)',
                    }}>
                      <span style={{ color: isOut ? 'var(--color-danger)' : 'var(--color-success)', fontWeight: 700 }}>
                        {isOut ? '→' : '←'}
                      </span>
                      <span style={{ flex: 1, color: 'var(--color-text)' }}>{otherNode?.name || other}</span>
                      <span style={{ fontWeight: 700, color: 'var(--color-text-muted)' }}>
                        {formatEur(l.amount)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)' }}>
              <div style={{ fontSize: '2rem', marginBottom: 'var(--space-3)', opacity: 0.3 }}>⬡</div>
              <p style={{ fontSize: 'var(--font-size-sm)' }}>
                Klicken Sie auf ein Unternehmen, um Details und Rechnungsbeziehungen anzuzeigen.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
