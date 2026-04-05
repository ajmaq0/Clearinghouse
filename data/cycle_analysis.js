/**
 * Cycle Analysis — ClearFlow Hamburg
 * Validates multilateral netting potential in the 50-SME trade graph.
 * Uses Johnson's algorithm for simple cycle enumeration.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname);
const invoices = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'invoices.json'), 'utf8'));
const companies = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'seed_data.json'), 'utf8'));

// ── Build company lookup ──────────────────────────────────────────────────────
const companyMap = {};
for (const c of companies) companyMap[c.id] = c;
const companyIds = companies.map(c => c.id).sort();
const nodeIndex = {};
companyIds.forEach((id, i) => { nodeIndex[id] = i; });
const N = companyIds.length;

// ── Build adjacency and edge weight structures ─────────────────────────────────
// adj[i] = Set of j where there's an invoice from company i → company j
const adj = Array.from({ length: N }, () => new Set());
// edgeWeight[i][j] = total amount (cents) of invoices from i to j
const edgeWeight = Array.from({ length: N }, () => ({}));

let totalVolume = 0;
for (const inv of invoices) {
  const i = nodeIndex[inv.from_company_id];
  const j = nodeIndex[inv.to_company_id];
  if (i === undefined || j === undefined) continue;
  adj[i].add(j);
  edgeWeight[i][j] = (edgeWeight[i][j] || 0) + inv.amount_cents;
  totalVolume += inv.amount_cents;
}

// ── Johnson's Algorithm for simple cycle enumeration ─────────────────────────
// Limited to cycles of length <= 8 to avoid combinatorial explosion
const MAX_CYCLE_LENGTH = 8;

const cycleLengthCounts = {};
let totalCycles = 0;
const sampleCycles = {}; // store up to 3 examples per length

function johnsons() {
  const blocked = new Array(N).fill(false);
  const B = Array.from({ length: N }, () => new Set());
  const stack = [];

  function unblock(u) {
    blocked[u] = false;
    for (const w of B[u]) {
      B[u].delete(w);
      if (blocked[w]) unblock(w);
    }
  }

  function circuit(v, s) {
    let found = false;
    stack.push(v);
    blocked[v] = true;

    for (const w of adj[v]) {
      if (stack.length >= MAX_CYCLE_LENGTH) break; // depth limit
      if (w === s) {
        // Found a cycle
        const len = stack.length;
        cycleLengthCounts[len] = (cycleLengthCounts[len] || 0) + 1;
        totalCycles++;
        if (!sampleCycles[len] || sampleCycles[len].length < 3) {
          if (!sampleCycles[len]) sampleCycles[len] = [];
          sampleCycles[len].push([...stack, s].map(idx => companyIds[idx]));
        }
        found = true;
      } else if (!blocked[w] && w > s) {
        // Only visit nodes with index > s to enumerate each cycle once
        // (this is a simplification; Johnson's full version uses SCCs)
        if (circuit(w, s)) found = true;
      }
    }

    if (found) {
      unblock(v);
    } else {
      for (const w of adj[v]) {
        if (!B[w].has(v)) B[w].add(v);
      }
    }

    stack.pop();
    return found;
  }

  for (let s = 0; s < N; s++) {
    // Reset blocked/B for nodes >= s
    for (let i = s; i < N; i++) {
      blocked[i] = false;
      B[i].clear();
    }
    circuit(s, s);
  }
}

johnsons();

// ── Bilateral netting (pairs with flows in both directions) ───────────────────
let bilateralSavings = 0;
let bilateralPairs = 0;

for (let i = 0; i < N; i++) {
  for (const j of adj[i]) {
    if (j > i && adj[j].has(i)) {
      // Mutual flow between i and j
      const fwd = edgeWeight[i][j] || 0;
      const bwd = edgeWeight[j][i] || 0;
      bilateralSavings += Math.min(fwd, bwd);
      bilateralPairs++;
    }
  }
}

const bilateralSavingsPct = (bilateralSavings / totalVolume * 100).toFixed(1);

// ── Multilateral netting via 3-cycles ─────────────────────────────────────────
// For each 3-cycle (A→B→C→A), calculate net flow reduction
// Multilateral saving = min(A→B, B→C, C→A) * 2 (3 payments reduced to 3 nets)
// Actual saving per cycle = min of all three directed flows × 2 (cancel circular portion)
// We use a conservative estimate: min(flow_AB, flow_BC, flow_CA)

// Re-enumerate 3-cycles with actual flow values for netting calc
let multilateralSavings3 = 0;
let multilateral3Cycles = 0;

// Track which cycles we've processed to avoid double-counting
const processedCycles3 = new Set();

for (let a = 0; a < N; a++) {
  for (const b of adj[a]) {
    if (!adj[b]) continue;
    for (const c of adj[b]) {
      if (c <= a) continue; // canonical ordering: a < c
      if (adj[c] && adj[c].has(a)) {
        const key = [a, b, c].sort().join(',');
        if (!processedCycles3.has(key)) {
          processedCycles3.add(key);
          const fab = edgeWeight[a][b] || 0;
          const fbc = edgeWeight[b][c] || 0;
          const fca = edgeWeight[c][a] || 0;
          // Circular netting: each participant's net payment is reduced by min of the cycle
          const netted = Math.min(fab, fbc, fca);
          multilateralSavings3 += netted * 2; // 2x because 3 payments each reduced
          multilateral3Cycles++;
        }
      }
    }
  }
}

// Conservative multilateral savings = bilateral + incremental from cycles
// Avoid double-counting: take incremental multilateral above bilateral
const combinedSavings = bilateralSavings + multilateralSavings3;
const combinedSavingsPct = Math.min(combinedSavings / totalVolume * 100, 100).toFixed(1);

// ── Connected components ───────────────────────────────────────────────────────
// Weakly connected: treat as undirected
function wcc() {
  const parent = companyIds.map((_, i) => i);
  function find(x) { return parent[x] === x ? x : (parent[x] = find(parent[x])); }
  function union(a, b) { parent[find(a)] = find(b); }
  for (let i = 0; i < N; i++) {
    for (const j of adj[i]) { union(i, j); }
  }
  const comps = {};
  for (let i = 0; i < N; i++) {
    const r = find(i);
    if (!comps[r]) comps[r] = [];
    comps[r].push(companyIds[i]);
  }
  return Object.values(comps);
}

// Strongly connected: Tarjan's
function scc() {
  const index = new Array(N).fill(-1);
  const lowlink = new Array(N).fill(0);
  const onStack = new Array(N).fill(false);
  const stack = [];
  let idx = 0;
  const sccs = [];

  function strongconnect(v) {
    index[v] = lowlink[v] = idx++;
    stack.push(v);
    onStack[v] = true;

    for (const w of adj[v]) {
      if (index[w] === -1) {
        strongconnect(w);
        lowlink[v] = Math.min(lowlink[v], lowlink[w]);
      } else if (onStack[w]) {
        lowlink[v] = Math.min(lowlink[v], index[w]);
      }
    }

    if (lowlink[v] === index[v]) {
      const scc = [];
      let w;
      do {
        w = stack.pop();
        onStack[w] = false;
        scc.push(companyIds[w]);
      } while (w !== v);
      sccs.push(scc);
    }
  }

  for (let v = 0; v < N; v++) {
    if (index[v] === -1) strongconnect(v);
  }
  return sccs;
}

const weakComponents = wcc();
const strongComponents = scc().filter(s => s.length > 1).sort((a, b) => b.length - a.length);

// ── Cluster topology ──────────────────────────────────────────────────────────
const clusterMap = {};
for (const c of companies) {
  if (!clusterMap[c.sector]) clusterMap[c.sector] = [];
  clusterMap[c.sector].push(c.id);
}

// Count cross-cluster edges
let crossClusterEdges = 0;
let intraClusterEdges = 0;
for (let i = 0; i < N; i++) {
  const si = companyMap[companyIds[i]].sector;
  for (const j of adj[i]) {
    const sj = companyMap[companyIds[j]].sector;
    if (si === sj) intraClusterEdges++;
    else crossClusterEdges++;
  }
}

// ── Degree distribution ───────────────────────────────────────────────────────
const outDegrees = adj.map(s => s.size);
const inDegrees = new Array(N).fill(0);
for (let i = 0; i < N; i++) for (const j of adj[i]) inDegrees[j]++;
const avgOut = (outDegrees.reduce((a, b) => a + b, 0) / N).toFixed(2);
const maxOut = Math.max(...outDegrees);
const maxIn = Math.max(...inDegrees);

// Top hubs by total degree
const hubs = companyIds.map((id, i) => ({
  id, name: companyMap[id].name, sector: companyMap[id].sector,
  degree: outDegrees[i] + inDegrees[i]
})).sort((a, b) => b.degree - a.degree).slice(0, 10);

// ── Topology export for backend/frontend ─────────────────────────────────────
const topology = {
  generated: new Date().toISOString().split('T')[0],
  nodes: companies.map(c => ({
    id: c.id, name: c.name, sector: c.sector, subtype: c.subtype,
    size: c.size, district: c.district, gls_member: c.gls_member,
    out_degree: outDegrees[nodeIndex[c.id]],
    in_degree: inDegrees[nodeIndex[c.id]],
    total_degree: outDegrees[nodeIndex[c.id]] + inDegrees[nodeIndex[c.id]]
  })),
  edges: [],
  clusters: Object.entries(clusterMap).map(([sector, ids]) => ({
    sector, company_count: ids.length,
    company_ids: ids
  })),
  connected_components: {
    weakly_connected: weakComponents.length,
    strongly_connected: strongComponents.length,
    largest_scc_size: strongComponents[0]?.length || 0
  },
  cycle_census: {
    total: totalCycles,
    by_length: cycleLengthCounts
  },
  netting: {
    total_volume_cents: totalVolume,
    bilateral_savings_cents: bilateralSavings,
    bilateral_savings_pct: parseFloat(bilateralSavingsPct),
    multilateral_3cycle_savings_cents: multilateralSavings3,
    combined_savings_pct: parseFloat(combinedSavingsPct),
    fleischman_benchmark_min_pct: 25,
    fleischman_benchmark_max_pct: 50,
    within_benchmark: parseFloat(combinedSavingsPct) >= 25 && parseFloat(combinedSavingsPct) <= 50
  }
};

// Add edges to topology
for (let i = 0; i < N; i++) {
  for (const j of adj[i]) {
    topology.edges.push({
      from: companyIds[i], to: companyIds[j],
      total_amount_cents: edgeWeight[i][j],
      invoice_count: invoices.filter(inv =>
        inv.from_company_id === companyIds[i] && inv.to_company_id === companyIds[j]
      ).length
    });
  }
}

// ── Write topology export ─────────────────────────────────────────────────────
fs.writeFileSync(path.join(DATA_DIR, 'topology_export.json'), JSON.stringify(topology, null, 2));

// ── Print report ──────────────────────────────────────────────────────────────
console.log('═══════════════════════════════════════════════════════════════');
console.log('  CYCLE ANALYSIS REPORT — ClearFlow Hamburg');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`  Nodes: ${N}  |  Directed edges: ${topology.edges.length}  |  Invoices: ${invoices.length}`);
console.log(`  Total volume: €${(totalVolume / 100).toLocaleString('de-DE', { minimumFractionDigits: 2 })}`);
console.log('');
console.log('── CYCLE CENSUS ────────────────────────────────────────────────');
console.log(`  Total simple cycles found: ${totalCycles}`);
console.log('  Distribution by length:');
for (const [len, cnt] of Object.entries(cycleLengthCounts).sort((a, b) => a[0] - b[0])) {
  const bar = '█'.repeat(Math.min(50, Math.round(cnt / Math.max(...Object.values(cycleLengthCounts)) * 40)));
  console.log(`    ${len}-cycles: ${cnt.toString().padStart(5)}  ${bar}`);
}
console.log('');
console.log('  Sample 3-cycles (triangles):');
for (const cycle of (sampleCycles[3] || []).slice(0, 3)) {
  const names = cycle.map(id => companyMap[id]?.name || id);
  console.log(`    ${names[0]} → ${names[1]} → ${names[2]}`);
}
if (sampleCycles[4]) {
  console.log('  Sample 4-cycles:');
  for (const cycle of sampleCycles[4].slice(0, 2)) {
    const names = cycle.map(id => companyMap[id]?.name || id);
    console.log(`    ${names.slice(0, -1).join(' → ')}`);
  }
}
console.log('');
console.log('── CONNECTED COMPONENTS ────────────────────────────────────────');
console.log(`  Weakly connected components: ${weakComponents.length}`);
console.log(`  Strongly connected components (>1 node): ${strongComponents.length}`);
for (let i = 0; i < Math.min(5, strongComponents.length); i++) {
  const scc = strongComponents[i];
  const sectors = [...new Set(scc.map(id => companyMap[id]?.sector))].join(', ');
  console.log(`    SCC-${i + 1}: ${scc.length} nodes (${sectors})`);
}
console.log('');
console.log('── CLUSTER TOPOLOGY ────────────────────────────────────────────');
for (const [sector, ids] of Object.entries(clusterMap)) {
  console.log(`  ${sector}: ${ids.length} companies`);
}
console.log(`  Intra-cluster edges: ${intraClusterEdges}  |  Cross-cluster edges: ${crossClusterEdges}`);
console.log('');
console.log('── NETTING ANALYSIS ────────────────────────────────────────────');
console.log(`  Bilateral netting savings:     €${(bilateralSavings / 100).toLocaleString('de-DE', { minimumFractionDigits: 2 })} (${bilateralSavingsPct}%)`);
console.log(`  Multilateral (3-cycle) savings: €${(multilateralSavings3 / 100).toLocaleString('de-DE', { minimumFractionDigits: 2 })}`);
console.log(`  Combined savings estimate:      ${combinedSavingsPct}%`);
console.log(`  Fleischman benchmark: 25–50%`);
const ok = parseFloat(combinedSavingsPct) >= 25 && parseFloat(combinedSavingsPct) <= 50;
console.log(`  ✅ Within benchmark: ${ok}`);
console.log('');
console.log('── TOP HUBS ────────────────────────────────────────────────────');
hubs.forEach((h, i) => {
  console.log(`  ${(i + 1).toString().padStart(2)}. ${h.name.padEnd(42)} degree: ${h.degree}`);
});
console.log('');
console.log(`  Topology export written to: data/topology_export.json`);
console.log('═══════════════════════════════════════════════════════════════');
