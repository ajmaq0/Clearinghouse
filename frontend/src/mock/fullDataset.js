/**
 * fullDataset.js — Single source of truth for all mock/demo data.
 *
 * All API response shapes are pre-computed from the real seed data
 * (50 companies, ~320 invoices) so they stay consistent across pages.
 *
 * Usage:
 *   import { MOCK_COMPANIES, MOCK_INVOICES, … } from '../mock/fullDataset.js'
 *
 * This file is the canonical source; mock/data.js re-exports from here
 * for backwards-compatibility.
 */

// ── Network stats ──────────────────────────────────────────────────────────────

export const MOCK_NETWORK_STATS = {
  company_count: 50,
  invoice_count: 312,
  confirmed_invoice_count: 187,
  gross_total_cents: 84_230_000,
  last_clearing_savings_cents: 29_480_500,
  last_clearing_savings_pct: 35.0,
  next_clearing_in_hours: 4.5,
  active_cycles: 1,
}

// ── Companies ─────────────────────────────────────────────────────────────────

export const MOCK_COMPANIES = [
  { id: 'c1', name: 'Hamburger Hafen GmbH',          sector: 'Port/Logistik',   gls_member: true,  size: 'large' },
  { id: 'c2', name: 'Elbe Spedition KG',             sector: 'Port/Logistik',   gls_member: true,  size: 'medium' },
  { id: 'c3', name: 'Nordsee Zolldienstleister AG',  sector: 'Port/Logistik',   gls_member: false, size: 'medium' },
  { id: 'f47ac10b-001d-4000-8000-000000000000', name: 'Elbe Bäckerei Verwaltungs GmbH', sector: 'Lebensmittel', gls_member: true,  size: 'small' },
  { id: 'c5', name: 'Biokontor Hamburg eG',          sector: 'Lebensmittel',    gls_member: true,  size: 'small' },
  { id: 'c6', name: 'Windkraft Nordsee GmbH',        sector: 'Erneuerbare',     gls_member: true,  size: 'large' },
  { id: 'c7', name: 'Lagerhaus Veddel GmbH',         sector: 'Port/Logistik',   gls_member: false, size: 'medium' },
  { id: 'c8', name: 'Solar HH Technik AG',           sector: 'Erneuerbare',     gls_member: true,  size: 'small' },
]

// ── Invoices ──────────────────────────────────────────────────────────────────

export const MOCK_INVOICES = [
  {
    id: 'inv1',
    from_company: { id: 'c2', name: 'Elbe Spedition KG' },
    to_company:   { id: 'c1', name: 'Hamburger Hafen GmbH' },
    total_amount_cents: 1_240_000,
    status: 'confirmed',
    due_date: '2026-04-28',
    sector: 'Port/Logistik',
    line_items: [
      { description: 'Containerumschlag April',    amount_cents: 980_000 },
      { description: 'Lagergebühren Woche 14',     amount_cents: 260_000 },
    ]
  },
  {
    id: 'inv2',
    from_company: { id: 'c1', name: 'Hamburger Hafen GmbH' },
    to_company:   { id: 'c7', name: 'Lagerhaus Veddel GmbH' },
    total_amount_cents: 870_000,
    status: 'confirmed',
    due_date: '2026-05-03',
    sector: 'Port/Logistik',
    line_items: [
      { description: 'Dienstleistungen Lager Q2',  amount_cents: 870_000 },
    ]
  },
  {
    id: 'inv3',
    from_company: { id: 'c7', name: 'Lagerhaus Veddel GmbH' },
    to_company:   { id: 'c3', name: 'Nordsee Zolldienstleister AG' },
    total_amount_cents: 510_000,
    status: 'pending',
    due_date: '2026-05-15',
    sector: 'Port/Logistik',
    line_items: [
      { description: 'Zolldokumentation',           amount_cents: 510_000 },
    ]
  },
  {
    id: 'inv4',
    from_company: { id: 'f47ac10b-001d-4000-8000-000000000000', name: 'Elbe Bäckerei Verwaltungs GmbH' },
    to_company:   { id: 'c5', name: 'Biokontor Hamburg eG' },
    total_amount_cents: 340_000,
    status: 'confirmed',
    due_date: '2026-04-22',
    sector: 'Lebensmittel',
    line_items: [
      { description: 'Biomehl 500kg',               amount_cents: 220_000 },
      { description: 'Lieferung & Handling',        amount_cents: 120_000 },
    ]
  },
  {
    id: 'inv5',
    from_company: { id: 'c6', name: 'Windkraft Nordsee GmbH' },
    to_company:   { id: 'c8', name: 'Solar HH Technik AG' },
    total_amount_cents: 2_100_000,
    status: 'pending',
    due_date: '2026-05-10',
    sector: 'Erneuerbare',
    line_items: [
      { description: 'Netzanbindung Offshore',      amount_cents: 1_800_000 },
      { description: 'Wartungsvertrag Q2',           amount_cents: 300_000 },
    ]
  },
  {
    id: 'inv6',
    from_company: { id: 'c5', name: 'Biokontor Hamburg eG' },
    to_company:   { id: 'f47ac10b-001d-4000-8000-000000000000', name: 'Elbe Bäckerei Verwaltungs GmbH' },
    total_amount_cents: 190_000,
    status: 'confirmed',
    due_date: '2026-04-30',
    sector: 'Lebensmittel',
    line_items: [
      { description: 'Verpackungsmaterial',         amount_cents: 190_000 },
    ]
  },
]

// ── Clearing result (bilateral) ───────────────────────────────────────────────

export const MOCK_CLEARING_RESULT = {
  cycle_id: 'cyc1',
  type: 'bilateral',
  started_at: '2026-04-05T08:00:00Z',
  completed_at: '2026-04-05T08:00:03Z',
  gross_cents: 84_230_000,
  net_cents: 54_749_500,
  savings_cents: 29_480_500,
  savings_pct: 35.0,
  pairs: [
    {
      company_a: { id: 'f47ac10b-001d-4000-8000-000000000000', name: 'Elbe Bäckerei Verwaltungs GmbH' },
      company_b: { id: 'c5', name: 'Biokontor Hamburg eG' },
      gross_a_to_b_cents: 340_000,
      gross_b_to_a_cents: 190_000,
      net_cents: 150_000,
      savings_cents: 190_000,
      savings_pct: 55.9,
    },
    {
      company_a: { id: 'c1', name: 'Hamburger Hafen GmbH' },
      company_b: { id: 'c2', name: 'Elbe Spedition KG' },
      gross_a_to_b_cents: 0,
      gross_b_to_a_cents: 1_240_000,
      net_cents: 1_240_000,
      savings_cents: 0,
      savings_pct: 0,
    },
    {
      company_a: { id: 'c1', name: 'Hamburger Hafen GmbH' },
      company_b: { id: 'c7', name: 'Lagerhaus Veddel GmbH' },
      gross_a_to_b_cents: 870_000,
      gross_b_to_a_cents: 0,
      net_cents: 870_000,
      savings_cents: 0,
      savings_pct: 0,
    },
  ]
}

// ── Company comparison (bilateral vs multilateral vs optimal) ─────────────────

export const MOCK_COMPANY_COMPARISON = {
  total_companies: 8,
  lp_status: 'optimal',
  rows: [
    {
      company_id: 'c6',
      company_name: 'Windkraft Nordsee GmbH',
      gross_payable:              2_100_000,
      gross_receivable:           0,
      bilateral_net:              1_680_000,
      multilateral_net:           1_210_000,
      optimal_net:                945_000,
      savings_vs_bilateral_cents: 735_000,
      savings_vs_bilateral_pct:   43.8,
    },
    {
      company_id: 'c1',
      company_name: 'Hamburger Hafen GmbH',
      gross_payable:              870_000,
      gross_receivable:           1_240_000,
      bilateral_net:              1_020_000,
      multilateral_net:           720_000,
      optimal_net:                620_000,
      savings_vs_bilateral_cents: 400_000,
      savings_vs_bilateral_pct:   39.2,
    },
    {
      company_id: 'f47ac10b-001d-4000-8000-000000000000',
      company_name: 'Elbe Bäckerei Verwaltungs GmbH',
      gross_payable:              340_000,
      gross_receivable:           190_000,
      bilateral_net:              150_000,
      multilateral_net:           110_000,
      optimal_net:                90_000,
      savings_vs_bilateral_cents: 60_000,
      savings_vs_bilateral_pct:   40.0,
    },
    {
      company_id: 'c2',
      company_name: 'Elbe Spedition KG',
      gross_payable:              1_240_000,
      gross_receivable:           0,
      bilateral_net:              1_240_000,
      multilateral_net:           900_000,
      optimal_net:                870_000,
      savings_vs_bilateral_cents: 370_000,
      savings_vs_bilateral_pct:   29.8,
    },
    {
      company_id: 'c7',
      company_name: 'Lagerhaus Veddel GmbH',
      gross_payable:              510_000,
      gross_receivable:           870_000,
      bilateral_net:              360_000,
      multilateral_net:           290_000,
      optimal_net:                270_000,
      savings_vs_bilateral_cents: 90_000,
      savings_vs_bilateral_pct:   25.0,
    },
    {
      company_id: 'c5',
      company_name: 'Biokontor Hamburg eG',
      gross_payable:              190_000,
      gross_receivable:           340_000,
      bilateral_net:              150_000,
      multilateral_net:           130_000,
      optimal_net:                120_000,
      savings_vs_bilateral_cents: 30_000,
      savings_vs_bilateral_pct:   20.0,
    },
    {
      company_id: 'c3',
      company_name: 'Nordsee Zolldienstleister AG',
      gross_payable:              0,
      gross_receivable:           510_000,
      bilateral_net:              510_000,
      multilateral_net:           510_000,
      optimal_net:                490_000,
      savings_vs_bilateral_cents: 20_000,
      savings_vs_bilateral_pct:   3.9,
    },
    {
      company_id: 'c8',
      company_name: 'Solar HH Technik AG',
      gross_payable:              0,
      gross_receivable:           2_100_000,
      bilateral_net:              2_100_000,
      multilateral_net:           2_100_000,
      optimal_net:                2_100_000,
      savings_vs_bilateral_cents: 0,
      savings_vs_bilateral_pct:   0,
    },
  ],
}

// ── Netting waterfall (optimal) — derived from real seed data ─────────────────
// Values: 50 companies, ~320 invoices

export const MOCK_NETTING_OPTIMAL = {
  gross_cents:                  1_636_341_787,
  bilateral_cents:                711_721_961,
  johnson_cents:                  574_878_953,
  optimal_cents:                  449_752_456,
  optimal_savings_cents:        1_186_589_331,
  optimal_savings_pct:               7250,
  improvement_over_johnson_cents:  125_126_497,
  improvement_over_johnson_pct:       2177,
  lp_status:                      'Optimal',
}

// ── Admin dashboard ───────────────────────────────────────────────────────────

export const MOCK_ADMIN_DASHBOARD = {
  latest_cycle: null,
  total_gross_cents: 84_230_000,
  total_net_cents:   54_749_500,
  savings_bps:       3500,
  savings_percent:   35.0,
  company_positions: [
    { company_id: 'c1', company_name: 'Hamburger Hafen GmbH',       receivable_cents: 1_240_000, payable_cents:   870_000, net_cents:   370_000 },
    { company_id: 'c2', company_name: 'Elbe Spedition KG',           receivable_cents:         0, payable_cents: 1_240_000, net_cents: -1_240_000 },
    { company_id: 'f47ac10b-001d-4000-8000-000000000000', company_name: 'Elbe Bäckerei Verwaltungs GmbH',  receivable_cents:         0, payable_cents:   150_000, net_cents:  -150_000 },
    { company_id: 'c5', company_name: 'Biokontor Hamburg eG',        receivable_cents:   150_000, payable_cents:         0, net_cents:   150_000 },
    { company_id: 'c7', company_name: 'Lagerhaus Veddel GmbH',       receivable_cents:   870_000, payable_cents:         0, net_cents:   870_000 },
  ],
}

// ── Potential new connections (Entdecken) ─────────────────────────────────────

export const MOCK_POTENTIAL_CONNECTIONS = [
  {
    id: 'pc1',
    company_a: { id: 'c3', name: 'Nordsee Zolldienstleister AG', sector: 'Port/Logistik', gls_member: false },
    company_b: { id: 'c1', name: 'Hamburger Hafen GmbH',          sector: 'Port/Logistik', gls_member: true  },
    sector: 'Port/Logistik',
    estimated_annual_volume_cents: 3_800_000,
    similarity_score: 94,
    reason: 'Beide im Hafencluster aktiv — kein direkter Rechnungsaustausch in letzten 90 Tagen.',
    action: 'Einladung senden',
    non_member: 'Nordsee Zolldienstleister AG',
  },
  {
    id: 'pc2',
    company_a: { id: 'c7', name: 'Lagerhaus Veddel GmbH',         sector: 'Port/Logistik', gls_member: false },
    company_b: { id: 'c2', name: 'Elbe Spedition KG',             sector: 'Port/Logistik', gls_member: true  },
    sector: 'Port/Logistik',
    estimated_annual_volume_cents: 2_950_000,
    similarity_score: 88,
    reason: 'Gemeinsame Kunden im Hafenumschlag; Lagerhaus Veddel handelt bereits mit c1.',
    action: 'Einladung senden',
    non_member: 'Lagerhaus Veddel GmbH',
  },
  {
    id: 'pc3',
    company_a: { id: 'c3', name: 'Nordsee Zolldienstleister AG',  sector: 'Port/Logistik', gls_member: false },
    company_b: { id: 'c2', name: 'Elbe Spedition KG',             sector: 'Port/Logistik', gls_member: true  },
    sector: 'Port/Logistik',
    estimated_annual_volume_cents: 1_720_000,
    similarity_score: 81,
    reason: 'Speditionsrouten überschneiden sich laut Zolldaten — kein GLS-Clearing genutzt.',
    action: 'Einladung senden',
    non_member: 'Nordsee Zolldienstleister AG',
  },
  {
    id: 'pc4',
    company_a: { id: 'c8', name: 'Solar HH Technik AG',           sector: 'Erneuerbare',   gls_member: true  },
    company_b: { id: 'c6', name: 'Windkraft Nordsee GmbH',        sector: 'Erneuerbare',   gls_member: true  },
    sector: 'Erneuerbare',
    estimated_annual_volume_cents: 4_200_000,
    similarity_score: 77,
    reason: 'Beide im Sektor Erneuerbare Energien — bisher nur einseitige Rechnungsbeziehung.',
    action: 'Netting-Analyse starten',
    non_member: null,
  },
  {
    id: 'pc5',
    company_a: { id: 'f47ac10b-001d-4000-8000-000000000000', name: 'Elbe Bäckerei Verwaltungs GmbH',    sector: 'Lebensmittel',  gls_member: true  },
    company_b: { id: 'c5', name: 'Biokontor Hamburg eG',          sector: 'Lebensmittel',  gls_member: true  },
    sector: 'Lebensmittel',
    estimated_annual_volume_cents: 980_000,
    similarity_score: 72,
    reason: 'Gegenseitige Rechnungen vorhanden — Potenzial für multilaterales Clearing mit dritten Partnern.',
    action: 'Multilateral-Analyse',
    non_member: null,
  },
]

// ── Clearing history timeline ─────────────────────────────────────────────────
// 8 monthly cycles, savings_pct in 28–47 % range with upward trend

export const MOCK_CLEARING_HISTORY = {
  total_cycles: 8,
  cycles: [
    { id: 'cyc-h8', completed_at: '2026-04-05T08:00:00Z', netting_type: 'optimal',   gross_cents: 84_230_000, net_cents: 48_853_400, savings_pct: 42.0, invoice_count: 312, company_count: 50 },
    { id: 'cyc-h7', completed_at: '2026-03-06T08:00:00Z', netting_type: 'optimal',   gross_cents: 81_200_000, net_cents: 47_502_000, savings_pct: 41.5, invoice_count: 271, company_count: 44 },
    { id: 'cyc-h6', completed_at: '2026-02-06T08:00:00Z', netting_type: 'bilateral', gross_cents: 78_900_000, net_cents: 48_707_100, savings_pct: 38.3, invoice_count: 258, company_count: 42 },
    { id: 'cyc-h5', completed_at: '2026-01-09T08:00:00Z', netting_type: 'bilateral', gross_cents: 80_400_000, net_cents: 51_456_000, savings_pct: 36.0, invoice_count: 269, company_count: 43 },
    { id: 'cyc-h4', completed_at: '2025-12-05T08:00:00Z', netting_type: 'bilateral', gross_cents: 83_600_000, net_cents: 55_176_000, savings_pct: 34.0, invoice_count: 278, company_count: 44 },
    { id: 'cyc-h3', completed_at: '2025-11-07T08:00:00Z', netting_type: 'bilateral', gross_cents: 77_500_000, net_cents: 52_772_500, savings_pct: 31.9, invoice_count: 255, company_count: 40 },
    { id: 'cyc-h2', completed_at: '2025-10-03T08:00:00Z', netting_type: 'bilateral', gross_cents: 79_100_000, net_cents: 55_370_000, savings_pct: 30.0, invoice_count: 261, company_count: 41 },
    { id: 'cyc-h1', completed_at: '2025-09-05T08:00:00Z', netting_type: 'bilateral', gross_cents: 74_200_000, net_cents: 53_424_000, savings_pct: 28.0, invoice_count: 247, company_count: 38 },
  ],
}

// ── Funding gaps (Entdecken) ──────────────────────────────────────────────────

export const MOCK_FUNDING_GAPS = [
  {
    id: 'fg1',
    debtor:   { id: 'c8', name: 'Solar HH Technik AG',     sector: 'Erneuerbare',   gls_member: true  },
    creditor: { id: 'c6', name: 'Windkraft Nordsee GmbH',  sector: 'Erneuerbare',   gls_member: true  },
    invoice_id: 'inv5',
    amount_cents: 2_100_000,
    due_date: '2026-05-10',
    days_until_due: 35,
    gap_type: 'Factoring',
    opportunity_cents: 2_100_000,
    margin_bps: 120,
    description: 'Große ausstehende Rechnung — Schuldner ist GLS-Mitglied, Zahlungsverzögerung wahrscheinlich.',
  },
  {
    id: 'fg2',
    debtor:   { id: 'c1', name: 'Hamburger Hafen GmbH',    sector: 'Port/Logistik', gls_member: true  },
    creditor: { id: 'c2', name: 'Elbe Spedition KG',       sector: 'Port/Logistik', gls_member: true  },
    invoice_id: 'inv1',
    amount_cents: 1_240_000,
    due_date: '2026-04-28',
    days_until_due: 23,
    gap_type: 'Lieferantenfinanzierung',
    opportunity_cents: 1_240_000,
    margin_bps: 95,
    description: 'Fällig in 23 Tagen — Elbe Spedition könnte frühzeitige Zahlung durch GLS-Finanzierung nutzen.',
  },
  {
    id: 'fg3',
    debtor:   { id: 'c7', name: 'Lagerhaus Veddel GmbH',   sector: 'Port/Logistik', gls_member: false },
    creditor: { id: 'c1', name: 'Hamburger Hafen GmbH',    sector: 'Port/Logistik', gls_member: true  },
    invoice_id: 'inv2',
    amount_cents: 870_000,
    due_date: '2026-05-03',
    days_until_due: 28,
    gap_type: 'Onboarding + Factoring',
    opportunity_cents: 870_000,
    margin_bps: 140,
    description: 'Schuldner noch kein GLS-Mitglied — Onboarding würde Factoring-Pipeline öffnen.',
  },
]

// ── SME Company Positions — keyed by companyId ───────────────────────────────

export const MOCK_COMPANY_POSITIONS = {
  c1: {
    company_id: 'c1', company_name: 'Hamburger Hafen GmbH',
    open_invoice_count: 3, confirmed_invoice_count: 2,
    gross_payable_cents:     870_000,
    gross_receivable_cents: 1_240_000,
    net_after_clearing_cents: 290_000,
    savings_cents:            580_000,
    savings_pct:               40.2,
    days_until_clearing:        24,
    counterparties: [
      { company_id: 'c2', name: 'Elbe Spedition KG',       net_cents: -870_000 },
      { company_id: 'c7', name: 'Lagerhaus Veddel GmbH',   net_cents:  870_000 },
      { company_id: 'c3', name: 'Nordsee Zolldienstl. AG', net_cents:  290_000 },
    ],
  },
  'f47ac10b-001d-4000-8000-000000000000': {
    company_id: 'f47ac10b-001d-4000-8000-000000000000', company_name: 'Elbe Bäckerei Verwaltungs GmbH',
    open_invoice_count: 2, confirmed_invoice_count: 1,
    gross_payable_cents:     150_000,
    gross_receivable_cents:        0,
    net_after_clearing_cents: 120_000,
    savings_cents:             30_000,
    savings_pct:               20.0,
    days_until_clearing:        24,
    counterparties: [
      { company_id: 'c5', name: 'Biokontor Hamburg eG', net_cents: -150_000 },
    ],
  },
  c5: {
    company_id: 'c5', company_name: 'Biokontor Hamburg eG',
    open_invoice_count: 2, confirmed_invoice_count: 2,
    gross_payable_cents:          0,
    gross_receivable_cents:  150_000,
    net_after_clearing_cents: 120_000,
    savings_cents:             30_000,
    savings_pct:               20.0,
    days_until_clearing:        24,
    counterparties: [
      { company_id: 'f47ac10b-001d-4000-8000-000000000000', name: 'Elbe Bäckerei Verwaltungs GmbH', net_cents: 150_000 },
    ],
  },
  default: {
    company_id: null, company_name: 'Unbekannt',
    open_invoice_count: 0, confirmed_invoice_count: 0,
    gross_payable_cents: 0, gross_receivable_cents: 0,
    net_after_clearing_cents: 0, savings_cents: 0, savings_pct: 0,
    days_until_clearing: 24, counterparties: [],
  },
}

// ── SME Matching Hints — keyed by companyId ───────────────────────────────────

export const MOCK_MATCHING_HINTS = {
  'f47ac10b-001d-4000-8000-000000000000': {
    company_id: 'f47ac10b-001d-4000-8000-000000000000',
    supplier_matches: [
      {
        id: 'sm-c4-1',
        partner: { id: 'c5', name: 'Biokontor Hamburg eG', sector: 'Lebensmittel', gls_member: true },
        similarity_score: 91,
        shared_customers: 3,
        estimated_monthly_volume_cents: 82_000,
        reason: 'Gleicher Sektor, gemeinsame Großabnehmer in Hamburg-Nord — Clearing könnte monatlich ~82 % Netto einsparen.',
        match_type: 'bilateral',
      },
      {
        id: 'sm-c4-2',
        partner: { id: 'c1', name: 'Hamburger Hafen GmbH', sector: 'Port/Logistik', gls_member: true },
        similarity_score: 64,
        shared_customers: 1,
        estimated_monthly_volume_cents: 45_000,
        reason: 'Hafen-Logistik-Kette berührt Lebensmittelimporte — Potenzial für trilaterales Netting.',
        match_type: 'multilateral',
      },
      {
        id: 'sm-c4-3',
        partner: { id: 'c8', name: 'Solar HH Technik AG', sector: 'Erneuerbare', gls_member: true },
        similarity_score: 55,
        shared_customers: 0,
        estimated_monthly_volume_cents: 28_000,
        reason: 'Energiekosten-Quersubventionierung möglich: Bäckerei ↔ Solar-Anbieter über GLS-Netz.',
        match_type: 'new_connection',
      },
    ],
    business_opportunities: [
      {
        id: 'bo-c4-1',
        title: 'Sektor-Cluster Lebensmittel',
        description: '4 weitere GLS-Mitglieder im Lebensmittelsektor ohne aktive Clearing-Verbindung zu Ihnen. Potenzial: bis zu 40 % Netto-Reduktion.',
        opportunity_cents: 320_000,
        action: 'Cluster beitreten',
      },
      {
        id: 'bo-c4-2',
        title: 'Frühzahlungs-Rabatt',
        description: 'Biokontor Hamburg bietet 1,5 % Skonto bei 10 Tagen — nutzen Sie GLS-Liquiditätsreserven.',
        opportunity_cents: 2_250,
        action: 'Angebot ansehen',
      },
    ],
  },
  default: {
    company_id: null,
    supplier_matches: [],
    business_opportunities: [],
  },
}
