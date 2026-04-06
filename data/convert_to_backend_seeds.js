#!/usr/bin/env node
/**
 * Convert data/seed_data.json + data/invoices.json (C00X IDs)
 * → backend/seeds/seed_data.json + backend/seeds/invoices.json (UUID format)
 *
 * UUID mapping: C001 → f47ac10b-0001-4000-8000-000000000000
 *               C010 → f47ac10b-000a-4000-8000-000000000000
 *               C050 → f47ac10b-0032-4000-8000-000000000000
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = __dirname;
const SEEDS_DIR = path.join(__dirname, '..', 'backend', 'seeds');

function cidToUuid(cid) {
  const n = parseInt(cid.slice(1), 10);
  const hex = n.toString(16).padStart(4, '0');
  return `f47ac10b-${hex}-4000-8000-000000000000`;
}

// ── Convert companies ────────────────────────────────────────────────────────
const companies = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'seed_data.json'), 'utf8'));

const seedCompanies = {
  companies: companies.map(c => ({
    id: cidToUuid(c.id),
    name: c.name,
    sector: c.sector,
    attributes: {
      subtype: c.subtype || null,
      district: c.district || null,
      gls_member: c.gls_member || false,
      founded: c.founded || null,
      size: c.size || null,
    },
  })),
};

fs.writeFileSync(
  path.join(SEEDS_DIR, 'seed_data.json'),
  JSON.stringify(seedCompanies, null, 2)
);
console.log(`✓ backend/seeds/seed_data.json written (${seedCompanies.companies.length} companies)`);

// ── Convert invoices ─────────────────────────────────────────────────────────
const invoicesRaw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'invoices.json'), 'utf8'));

const sectorByCid = {};
companies.forEach(c => { sectorByCid[c.id] = c.sector; });

const SECTOR_DESC = {
  port_logistics: [
    'Frachtabwicklung', 'Zollabfertigung Containerimport',
    'Lagereingang Sammelgut', 'Warenausgabe Hanseatic',
    'Container-Spedition FCL', 'Frachtkosten Rücktransport',
    'Lagernutzung Zollware', 'Umschlaggebühr', 'Hafengebühr THC',
    'Speicherung Frachtgut Q1',
  ],
  food_beverage: [
    'Warenlieferung Lebensmittel', 'Rohstofflieferung Brauerei',
    'Gastronomieausrüstung', 'Braudienstleistungen März',
    'Catering-Service', 'Transportkosten Lebensmittel',
    'Qualitätsprüfung Waren',
  ],
  renewable_energy: [
    'Stromerzeugung Windkraft', 'Photovoltaik-Wartung',
    'Netzanbindungsgebühr April', 'Speichermiete Batteriespeicher',
    'Regelenergie-Dienstleistung', 'Ertragsgutachten Solaranlage',
  ],
};

function getDesc(fromCid) {
  const sector = sectorByCid[fromCid] || 'cross_cluster';
  const descs = SECTOR_DESC[sector] || ['Dienstleistung B2B', 'Warenlieferung', 'Beratungsleistung'];
  const h = parseInt(crypto.createHash('md5').update(fromCid).digest('hex').slice(0, 8), 16);
  return descs[h % descs.length];
}

const invoices = {
  invoices: invoicesRaw.map((inv, i) => {
    const lineItems = (inv.line_items || []).map(li => ({
      description: li.description,
      amount_cents: (li.unit_price_cents || 0) * (li.quantity || 1),
      quantity: li.quantity || 1,
    }));

    return {
      id: `INV-${String(i + 1).padStart(4, '0')}`,
      from_company_id: cidToUuid(inv.from_company_id),
      to_company_id: cidToUuid(inv.to_company_id),
      amount_cents: inv.amount_cents,
      description: getDesc(inv.from_company_id),
      due_date: inv.due_date || '2026-06-30',
      status: 'pending',
      line_items: lineItems,
    };
  }),
};

fs.writeFileSync(
  path.join(SEEDS_DIR, 'invoices.json'),
  JSON.stringify(invoices, null, 2)
);
console.log(`✓ backend/seeds/invoices.json written (${invoices.invoices.length} invoices)`);

// ── Netting sanity check ────────────────────────────────────────────────────
const gross = invoices.invoices.reduce((s, inv) => s + inv.amount_cents, 0);
const bilateral = {};
invoices.invoices.forEach(inv => {
  const key = [inv.from_company_id, inv.to_company_id].sort().join('|');
  if (!bilateral[key]) bilateral[key] = {};
  bilateral[key][inv.from_company_id] = (bilateral[key][inv.from_company_id] || 0) + inv.amount_cents;
});
const nettable = Object.values(bilateral)
  .filter(v => Object.keys(v).length === 2)
  .reduce((s, v) => s + Math.min(...Object.values(v)), 0);
const pct = (nettable / gross * 100).toFixed(1);

console.log(`\nNetting sanity:`);
console.log(`  Gross:    €${(gross / 100).toLocaleString('de-DE')}`);
console.log(`  Nettable: €${(nettable / 100).toLocaleString('de-DE')}`);
console.log(`  Savings:  ${pct}%`);
console.log(pct >= 25 ? '  ✅ Meets ≥25% Fleischman benchmark' : '  ⚠ Below 25% benchmark');
