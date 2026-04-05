# Network Analysis — ClearFlow Hamburg Synthetic Trade Graph

_Generated: 2026-04-05_
_Dataset: 50 Hamburg SMEs · 320 invoices · 275 directed edges_

---

## Summary

| Metric | Value |
|--------|-------|
| Nodes (companies) | 50 |
| Directed edges (unique pairs) | 275 |
| Total invoices | 320 |
| Total invoice volume | €9.199.058,23 |
| Bilateral nettable pairs | 123 |
| **Bilateral netting savings** | **27.9%** |
| **Multilateral netting savings (3-cycles)** | **+18.0%** |
| **Combined netting savings** | **45.9%** |
| Fleischman benchmark | 25–50% ✅ |

---

## Cycle Census

All simple cycles enumerated up to length 7 using Johnson's algorithm.

| Cycle length | Count | Multilateral netting? |
|-------------|-------|-----------------------|
| 2-cycles (bilateral pairs) | 123 | Bilateral only |
| 3-cycles (triangles) | 74 | ✅ Yes — canonical multilateral |
| 4-cycles | 998 | ✅ Yes |
| 5-cycles | 1,728 | ✅ Yes |
| 6-cycles | 11,400 | ✅ Yes |
| 7-cycles | 31,171 | ✅ Yes |
| **Total** | **45,494** | |

The graph is **cycle-rich**: 45,494 simple cycles across all lengths. This far exceeds the
minimum density required for multilateral netting demo purposes.

### Sample 3-Cycles (Triangles)

These canonical triangles are the simplest multilateral netting structures:

```
Hanseatic Spedition GmbH → Nord-Zoll Dienstleistungen GmbH → Lagerhaus am Waltershof GmbH → (back)
Hanseatic Spedition GmbH → Nord-Zoll Dienstleistungen GmbH → Hamburger Lagerhausgesellschaft mbH → (back)
Hanseatic Spedition GmbH → Weichert Zollabfertigung GmbH → Hamburger Lagerhausgesellschaft mbH → (back)
```

Each triangle demonstrates: instead of 3 bilateral payments, each participant makes/receives
one net payment — reducing cash movements by the minimum flow within the cycle.

### Sample 4-Cycles

```
Hanseatic Spedition GmbH → Nord-Zoll Dienstleistungen GmbH → Nord-Express Spedition GmbH → Weichert Zollabfertigung GmbH → (back)
```

---

## Connected Components

### Weakly Connected Components
- **1 weakly connected component**
- Isolated nodes: **0**

All 50 nodes are reachable from each other in the undirected sense.

### Strongly Connected Components (SCCs)
- **3 SCCs** with more than 1 node

| SCC | Nodes | Sector |
|-----|-------|--------|
| SCC-1 | 18 | Port/Logistics |
| SCC-2 | 17 | Food/Beverage |
| SCC-3 | 15 | Renewable Energy |

Each industry cluster forms its own strongly connected component. Cross-cluster edges
(10 total) connect the three SCCs into a single weakly connected super-component.

---

## Degree Distribution

| Metric | Out-degree | In-degree |
|--------|-----------|----------|
| Average | 5.50 | 5.50 |
| Maximum | 13 | 12 |
| Isolated nodes | 0 | — |

The degree distribution is **right-skewed**: a small number of Spedition, Großhandel, and
Energieversorger hubs account for a disproportionate share of invoice volume, consistent
with real-world B2B networks (power-law-like behaviour, cf. Atalay et al., 2011).

---

## Netting Analysis

### Bilateral Netting
**Methodology:** For each pair (A, B) with invoices flowing in both directions, min(A→B, B→A)
can be cancelled without cash movement.

- Savings: **€2.562.363,29 (27.9%)**
- Nettable pairs: **123**

### Multilateral Netting (3-cycles)
**Methodology:** For each triangle (A→B→C→A), the minimum flow around the cycle can be
cancelled via a single net settlement per participant (3 net payments instead of 3 bilateral pairs).
Conservative estimate: `min(flow_AB, flow_BC, flow_CA) × 2`.

- Additional savings: **€1.664.601,16**
- 3-cycles contributing: **74 triangles**

### Combined Savings
| Component | Amount | % of Total |
|-----------|--------|-----------|
| Bilateral netting | €2.562.363,29 | 27.9% |
| Multilateral (3-cycle) | €1.664.601,16 | 18.1% |
| **Combined** | **€4.226.964,45** | **45.9%** |

**Fleischman benchmark: 25–50% → ✅ PASS (45.9%)**

Higher-order cycles (4+) would yield further savings but are not included in this
conservative estimate, meaning the actual multilateral potential is even higher.

---

## Cluster Topology

| Cluster | Companies | Intra-cluster edges | Notes |
|---------|-----------|--------------------|-|
| Port/Logistics | 18 | high density | SCC, hub: Nord-Zoll |
| Food/Beverage | 17 | medium density | SCC, hub: Fruchthof |
| Renewable Energy | 15 | medium density | SCC, hub: Hamburger Wärmenetz |
| Cross-cluster | — | 10 edges | Bridges connecting SCCs |

The 10 cross-cluster edges are sufficient to form the single weakly-connected super-component
but do not create cross-cluster SCCs, consistent with realistic industry separation in Hamburg.

---

## Top 10 Hubs (by total degree)

| Rank | Company | Sector | Total Degree |
|------|---------|--------|-------------|
| 1 | Container Service Hamburg GmbH | Port/Logistics | 20 |
| 2 | Hamburger Wärmenetz GmbH | Renewable Energy | 20 |
| 3 | Smart Energy Hamburg GmbH | Renewable Energy | 20 |
| 4 | Nord-Zoll Dienstleistungen GmbH | Port/Logistics | 19 |
| 5 | Lagerhaus am Waltershof GmbH | Port/Logistics | 18 |
| 6 | Hamburger Lagerhausgesellschaft mbH | Port/Logistics | 18 |
| 7 | Fruchthof Hamburg Großhandel GmbH | Food/Beverage | 18 |
| 8 | Hanseatic Spedition GmbH | Port/Logistics | 17 |
| 9 | Weichert Zollabfertigung GmbH | Port/Logistics | 16 |
| 10 | Hamburger Zuckerwerk GmbH | Food/Beverage | 16 |

---

## Topology Export (Backend / Frontend)

The file `data/topology_export.json` provides a machine-readable snapshot containing:
- Full node list with sector, subtype, size, district, GLS membership, in/out degree
- Full directed edge list with total amount and invoice count per pair
- Cluster definitions by sector
- Connected component counts
- Cycle census summary
- Netting savings figures

This file is the canonical topology source for the backend API seed and frontend graph visualisation.

---

## Hamburg Economic Context

- Hamburg has ~170,000 registered businesses (Handelskammer Hamburg, 2023)
- Port/Logistics: 550+ LIHH member companies
- Food/Beverage: ~4,500 businesses in Hamburg
- Renewable Energy: 190+ EEHH members
- **70% of SMEs could pay on time if paid on time** — the cash-flow cascade effect,
  which is the core narrative of the ClearFlow demo for Ela Kagel / GLS Bank Hamburg

---

_All amounts in EUR. Graph generated with deterministic seed (0xDEADBEEF) for reproducibility._
_Cycle analysis: Johnson's algorithm, cycles up to length 7. Script: `data/cycle_analysis.js`._
_Topology export: `data/topology_export.json`_
