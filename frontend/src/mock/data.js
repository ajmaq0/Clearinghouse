// Mock data for development — removed once backend is live

export const MOCK_NETWORK_STATS = {
  company_count: 50,
  invoice_count: 312,
  confirmed_invoice_count: 187,
  gross_total_cents: 84_230_000,       // €842,300
  last_clearing_savings_cents: 29_480_500, // €294,805
  last_clearing_savings_pct: 35.0,
  next_clearing_in_hours: 4.5,
  active_cycles: 1,
}

export const MOCK_COMPANIES = [
  { id: 'c1', name: 'Hamburger Hafen GmbH',          sector: 'Port/Logistik',   gls_member: true,  size: 'large' },
  { id: 'c2', name: 'Elbe Spedition KG',             sector: 'Port/Logistik',   gls_member: true,  size: 'medium' },
  { id: 'c3', name: 'Nordsee Zolldienstleister AG',  sector: 'Port/Logistik',   gls_member: false, size: 'medium' },
  { id: 'c4', name: 'Alstermühle Bäckerei GmbH',    sector: 'Lebensmittel',    gls_member: true,  size: 'small' },
  { id: 'c5', name: 'Biokontor Hamburg eG',          sector: 'Lebensmittel',    gls_member: true,  size: 'small' },
  { id: 'c6', name: 'Windkraft Nordsee GmbH',        sector: 'Erneuerbare',     gls_member: true,  size: 'large' },
  { id: 'c7', name: 'Lagerhaus Veddel GmbH',         sector: 'Port/Logistik',   gls_member: false, size: 'medium' },
  { id: 'c8', name: 'Solar HH Technik AG',           sector: 'Erneuerbare',     gls_member: true,  size: 'small' },
]

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
    from_company: { id: 'c4', name: 'Alstermühle Bäckerei GmbH' },
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
    to_company:   { id: 'c4', name: 'Alstermühle Bäckerei GmbH' },
    total_amount_cents: 190_000,
    status: 'confirmed',
    due_date: '2026-04-30',
    sector: 'Lebensmittel',
    line_items: [
      { description: 'Verpackungsmaterial',         amount_cents: 190_000 },
    ]
  },
]

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
      company_a: { id: 'c4', name: 'Alstermühle Bäckerei GmbH' },
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
