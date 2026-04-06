#!/usr/bin/env python3
"""
Convert data/seed_data.json + data/invoices.json (C00X IDs)
→ backend/seeds/seed_data.json + backend/seeds/invoices.json (UUID format)

UUID mapping: C001 → f47ac10b-0001-4000-8000-000000000000
              C010 → f47ac10b-000a-4000-8000-000000000000
              C050 → f47ac10b-0032-4000-8000-000000000000
"""
import json
import os
import re
from pathlib import Path

ROOT = Path(__file__).parent.parent
DATA_DIR = Path(__file__).parent
SEEDS_DIR = ROOT / "backend" / "seeds"


def cid_to_uuid(cid: str) -> str:
    """Convert 'C001' → 'f47ac10b-0001-4000-8000-000000000000'"""
    n = int(cid[1:])
    return f"f47ac10b-{n:04x}-4000-8000-000000000000"


def convert_companies():
    with open(DATA_DIR / "seed_data.json") as f:
        companies = json.load(f)

    out = {"companies": []}
    for c in companies:
        out["companies"].append({
            "id": cid_to_uuid(c["id"]),
            "name": c["name"],
            "sector": c["sector"],
            "attributes": {
                "subtype": c.get("subtype"),
                "district": c.get("district"),
                "gls_member": c.get("gls_member", False),
                "founded": c.get("founded"),
                "size": c.get("size"),
            },
        })

    target = SEEDS_DIR / "seed_data.json"
    with open(target, "w") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
    print(f"✓ {target} written ({len(out['companies'])} companies)")
    return out["companies"]


def convert_invoices():
    with open(DATA_DIR / "invoices.json") as f:
        invoices = json.load(f)

    # Sector hint lookup for descriptions
    with open(DATA_DIR / "seed_data.json") as f:
        companies_raw = json.load(f)
    sector_by_cid = {c["id"]: c["sector"] for c in companies_raw}

    SECTOR_DESC = {
        "port_logistics": [
            "Frachtabwicklung", "Zollabfertigung Containerimport",
            "Lagereingang Sammelgut", "Warenausgabe", "Container-Spedition",
            "Frachtkosten Rücktransport", "Lagernutzung", "Umschlaggebühr",
            "Hafengebühr THC", "Speicherung Frachtgut",
        ],
        "food_beverage": [
            "Warenlieferung Lebensmittel", "Rohstofflieferung",
            "Gastronomieausrüstung", "Braudienstleistungen", "Catering-Service",
            "Transportkosten Lebensmittel", "Qualitätsprüfung Waren",
        ],
        "renewable_energy": [
            "Stromerzeugung Windkraft", "Photovoltaik-Wartung",
            "Netzanbindungsgebühr", "Speichermiete Batteriespeicher",
            "Regelenergie-Dienstleistung", "Ertragsgutachten Solaranlage",
        ],
    }
    DEFAULT_DESCS = ["Dienstleistung B2B", "Warenlieferung", "Beratungsleistung"]

    def get_desc(from_cid):
        sector = sector_by_cid.get(from_cid, "")
        descs = SECTOR_DESC.get(sector, DEFAULT_DESCS)
        import hashlib
        h = int(hashlib.md5(from_cid.encode()).hexdigest(), 16)
        return descs[h % len(descs)]

    out_invoices = []
    for i, inv in enumerate(invoices, 1):
        from_cid = inv["from_company_id"]
        to_cid = inv["to_company_id"]

        # Convert line items: unit_price_cents → amount_cents
        line_items = []
        for li in inv.get("line_items", []):
            qty = li.get("quantity", 1)
            unit = li.get("unit_price_cents", 0)
            li_total = unit * qty
            line_items.append({
                "description": li["description"],
                "amount_cents": li_total,
                "quantity": qty,
            })

        out_invoices.append({
            "id": f"INV-{i:04d}",
            "from_company_id": cid_to_uuid(from_cid),
            "to_company_id": cid_to_uuid(to_cid),
            "amount_cents": inv["amount_cents"],
            "description": get_desc(from_cid),
            "due_date": inv.get("due_date", "2026-06-30"),
            "status": "pending",
            "line_items": line_items,
        })

    target = SEEDS_DIR / "invoices.json"
    with open(target, "w") as f:
        json.dump({"invoices": out_invoices}, f, indent=2, ensure_ascii=False)
    print(f"✓ {target} written ({len(out_invoices)} invoices)")

    # Quick netting analysis
    gross = sum(inv["amount_cents"] for inv in out_invoices)
    bilateral = {}
    for inv in out_invoices:
        a, b = inv["from_company_id"], inv["to_company_id"]
        key = tuple(sorted([a, b]))
        if key not in bilateral:
            bilateral[key] = {a: 0, b: 0}
        bilateral[key][a] = bilateral[key].get(a, 0) + inv["amount_cents"]
    nettable = sum(min(v.values()) for v in bilateral.values() if len(v) == 2)
    pct = nettable / gross * 100 if gross else 0
    print(f"  Gross: €{gross/100:,.0f}  Nettable: €{nettable/100:,.0f}  Savings: {pct:.1f}%")


if __name__ == "__main__":
    convert_companies()
    convert_invoices()
