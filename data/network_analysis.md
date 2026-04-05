# Network Analysis — ClearFlow Hamburg Synthetic Trade Graph

_Generated: 2026-04-05_
_Dataset: 50 Hamburg SMEs · 320 invoices_

---

## Summary

| Metric | Value |
|--------|-------|
| Nodes (companies) | 50 |
| Directed edges (invoices) | 320 |
| Total invoice volume | €9.199.058,23 |
| Nettable pairs | 123 |
| Nettable volume | €2.562.363,29 |
| **Netting savings potential** | **27.9%** |

---

## Degree Distribution

| Metric | Out-degree | In-degree |
|--------|-----------|----------|
| Average | 6.40 | 6.40 |
| Maximum | 13 | 12 |
| Isolated nodes | 0 | — |

The degree distribution is **right-skewed**: a small number of Spedition and Großhandel hubs
account for a disproportionate share of invoice volume, consistent with real-world B2B networks
(power-law-like behaviour in trade graphs, cf. Atalay et al., 2011).

---

## Connected Components

### Weakly Connected Components
- **1 weakly connected component(s)**
- Isolated nodes (no edges at all): **0**

All nodes are connected in the undirected sense.

### Strongly Connected Components (SCCs)
- **3 SCCs total**
- Large SCCs (>1 node): SCC-1 (18 nodes), SCC-2 (17 nodes), SCC-3 (15 nodes)

The three industry clusters (Port/Logistics, Food/Beverage, Renewable Energy) each form
their own SCC, connected by cross-cluster edges into a weakly connected super-component.

---

## Cycle Census

| Cycle length | Count |
|-------------|-------|
| 3-cycles (triangles) | 95 |

### Key Port Cluster Cycles
The Port/Logistics SCC contains the canonical cycle structure required for multilateral netting:

```
Spedition → Zolldienstleister → Lagerhaus → Spedition
```

Example instances present in this dataset:
- Hanseatic Spedition GmbH → Nord-Zoll Dienstleistungen GmbH → Lagerhaus am Waltershof GmbH → Hanseatic Spedition GmbH
- Elbe Logistik AG → Weichert Zollabfertigung GmbH → Freihafen Lagerei GmbH → Elbe Logistik AG

These cycles demonstrate how multilateral netting can settle three bilateral obligations
in a single net payment per participant.

---

## Netting Potential

**Target (Fleischman benchmark): 25–50% savings**
**This dataset: 27.9%**

✅ Within benchmark range.

### Methodology
Netting potential = Σ min(A→B, B→A) / Σ all invoice amounts

For each pair (A, B) with invoices flowing in both directions, the smaller of the two
directional totals can be cancelled without cash movement. This is the bilateral netting
saving. Multilateral netting across cycles (Spedition → Zoll → Lagerhaus → Spedition)
yields additional savings not captured here.

### Hamburg Economic Context
- Hamburg has ~170,000 registered businesses (Handelskammer Hamburg, 2023)
- Port/Logistics: 550+ LIHH member companies
- Food/Beverage: ~4,500 businesses in Hamburg
- Renewable Energy: 190+ EEHH members
- **70% of SMEs could pay on time if paid on time** (cash-flow cascade effect)
  — this is the core narrative of the ClearFlow demo

---

## Top 10 Hubs (by total degree)

| Rank | Company | Total Degree |
|------|---------|-------------|
| 1 | Nord-Zoll Dienstleistungen GmbH | 25 |
| 2 | Hamburger Wärmenetz GmbH | 24 |
| 3 | Smart Energy Hamburg GmbH | 24 |
| 4 | Container Service Hamburg GmbH | 21 |
| 5 | Hanseatic Spedition GmbH | 20 |
| 6 | Elbe Logistik AG | 20 |
| 7 | Hamburger Lagerhausgesellschaft mbH | 20 |
| 8 | Lagerhaus am Waltershof GmbH | 19 |
| 9 | Fruchthof Hamburg Großhandel GmbH | 19 |
| 10 | Hamburger Zuckerwerk GmbH | 19 |

---

## Industry Cluster Summary

| Cluster | Companies | Invoices (approx.) | SCC |
|---------|-----------|-------------------|-----|
| Port/Logistics | 18 | high | ✓ |
| Food/Beverage | 17 | medium | ✓ |
| Renewable Energy | 15 | medium | ✓ |
| Cross-cluster edges | — | low | — |

---

_All amounts in EUR. Graph generated with deterministic seed (0xDEADBEEF) for reproducibility._
