"""
Report endpoints for ClearFlow PDF export.

GET /clearing/report     — returns structured data used to build the PDF
GET /clearing/report/pdf — generates and streams a one-page PDF (reportlab)
"""

import io
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app import models

router = APIRouter(prefix="/clearing", tags=["report"])


# ── helpers ──────────────────────────────────────────────────────────────────


def _fmt_eur(cents: int) -> str:
    """German-locale currency: €1.234.567 (no decimals for whole euros)."""
    val = abs(round(cents) / 100)
    # Build integer string with period thousands separator
    s = f"{val:,.0f}".replace(",", ".")
    prefix = "−€" if cents < 0 else "€"
    return f"{prefix}{s}"


def _fmt_pct(pct: float) -> str:
    return f"{pct:.1f} %".replace(".", ",")


def _build_report_data(db: Session) -> dict:
    # ── network stats ────────────────────────────────────────────────────────
    total_companies = db.query(func.count(models.Company.id)).scalar() or 0
    total_invoices = db.query(func.count(models.Invoice.id)).scalar() or 0
    total_gross_cents = int(
        db.query(func.coalesce(func.sum(models.Invoice.amount_cents), 0)).scalar() or 0
    )

    # ── latest clearing cycle ────────────────────────────────────────────────
    latest_cycle = (
        db.query(models.ClearingCycle)
        .filter(models.ClearingCycle.status == "completed")
        .order_by(models.ClearingCycle.completed_at.desc())
        .first()
    )

    gross_cents = 0
    net_cents = 0
    savings_pct = 0.0
    cycle_date = None
    netting_type = "bilateral"

    if latest_cycle:
        gross_cents = sum(r.gross_amount_cents for r in latest_cycle.results)
        net_cents = sum(r.net_amount_cents for r in latest_cycle.results)
        savings_pct = (
            round((gross_cents - net_cents) / gross_cents * 100, 1)
            if gross_cents > 0 else 0.0
        )
        cycle_date = latest_cycle.completed_at
        netting_type = latest_cycle.netting_type or "bilateral"

    # ── top-5 companies by netting savings ───────────────────────────────────
    invoices = (
        db.query(models.Invoice)
        .filter(models.Invoice.status == "confirmed")
        .all()
    )

    top5 = []
    if invoices:
        gross_flow: dict = defaultdict(lambda: defaultdict(int))
        for inv in invoices:
            gross_flow[inv.from_company_id][inv.to_company_id] += inv.amount_cents

        all_ids = sorted(
            set(gross_flow.keys()) | {b for a_map in gross_flow.values() for b in a_map}
        )

        gross_payable: dict = defaultdict(int)
        gross_receivable: dict = defaultdict(int)
        for a, targets in gross_flow.items():
            for b, amt in targets.items():
                gross_payable[a] += amt
                gross_receivable[b] += amt

        net_flow: dict = defaultdict(lambda: defaultdict(int))
        visited: set = set()
        for a in all_ids:
            for b in all_ids:
                if a == b or (a, b) in visited or (b, a) in visited:
                    continue
                visited.add((a, b))
                diff = gross_flow[a][b] - gross_flow[b][a]
                if diff > 0:
                    net_flow[a][b] = diff
                elif diff < 0:
                    net_flow[b][a] = -diff

        bilateral_net: dict = defaultdict(int)
        for a, targets in net_flow.items():
            for b, amt in targets.items():
                bilateral_net[a] += amt
                bilateral_net[b] -= amt

        company_names = {
            c.id: c.name
            for c in db.query(models.Company).filter(models.Company.id.in_(all_ids)).all()
        }

        rows = []
        for cid in all_ids:
            gp = gross_payable[cid]
            bil = bilateral_net[cid]
            # Savings = reduction in outbound obligation
            savings = max(0, gp - max(0, bil))
            rows.append({
                "company_name": company_names.get(cid, cid),
                "gross_payable_cents": gp,
                "gross_receivable_cents": gross_receivable[cid],
                "bilateral_net_cents": bil,
                "savings_cents": savings,
            })

        rows.sort(key=lambda r: r["savings_cents"], reverse=True)
        top5 = rows[:5]

    return {
        "generated_at": datetime.now(tz=timezone.utc).isoformat(),
        "network": {
            "total_companies": total_companies,
            "total_invoices": total_invoices,
            "total_gross_cents": total_gross_cents,
        },
        "latest_clearing": {
            "gross_cents": gross_cents,
            "net_cents": net_cents,
            "savings_cents": gross_cents - net_cents,
            "savings_pct": savings_pct,
            "cycle_date": cycle_date.isoformat() if cycle_date else None,
            "netting_type": netting_type,
        },
        "top5_companies": top5,
        "watermark": "Simulationsdaten",
    }


def _generate_pdf(data: dict) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.lib import colors
    from reportlab.lib.colors import HexColor
    from reportlab.pdfgen import canvas
    from reportlab.platypus import Table, TableStyle

    # ── palette ───────────────────────────────────────────────────────────────
    GRN_DK  = HexColor("#2d5237")
    GRN     = HexColor("#4a7c59")
    GRN_LT  = HexColor("#e8f3ec")
    GRAY_DK = HexColor("#3d3830")
    GRAY    = HexColor("#7a6e64")
    GRAY_LT = HexColor("#f5f2ee")
    BORDER  = HexColor("#d0c9c0")
    ORANGE  = HexColor("#c97a2f")

    W, H = A4  # 595.27 × 841.89 pt
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)

    margin = 20 * mm
    content_w = W - 2 * margin

    # ── watermark (diagonal, behind content) ─────────────────────────────────
    c.saveState()
    c.setFont("Helvetica", 52)
    c.setFillColor(colors.Color(0.85, 0.82, 0.78, alpha=0.18))
    c.translate(W / 2, H / 2)
    c.rotate(35)
    c.drawCentredString(0, 0, "SIMULATIONSDATEN")
    c.restoreState()

    y = H - margin  # cursor, descending

    # ── header band ──────────────────────────────────────────────────────────
    header_h = 18 * mm
    c.setFillColor(GRN_DK)
    c.rect(0, H - header_h, W, header_h, fill=1, stroke=0)

    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(margin, H - header_h + 6 * mm, "ClearFlow Hamburg")
    c.setFont("Helvetica", 9)
    c.drawRightString(W - margin, H - header_h + 9 * mm, "GLS Bank · Netzwerk-Clearing")
    c.drawRightString(W - margin, H - header_h + 4 * mm, "Vertraulich — nur für interne Weitergabe")

    y = H - header_h - 7 * mm

    # ── sub-header: report title + timestamp ─────────────────────────────────
    c.setFillColor(GRAY_DK)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(margin, y, "Clearing-Bericht")

    gen_dt = datetime.fromisoformat(data["generated_at"].replace("Z", "+00:00"))
    gen_str = gen_dt.strftime("%d.%m.%Y, %H:%M Uhr (UTC)")
    c.setFont("Helvetica", 8)
    c.setFillColor(GRAY)
    c.drawRightString(W - margin, y, f"Erstellt: {gen_str}")

    y -= 5 * mm

    # thin rule
    c.setStrokeColor(BORDER)
    c.setLineWidth(0.5)
    c.line(margin, y, W - margin, y)
    y -= 6 * mm

    # ── KPI row (3 boxes) ────────────────────────────────────────────────────
    net = data["network"]
    clr = data["latest_clearing"]
    savings_cents = clr["savings_cents"]
    savings_pct   = clr["savings_pct"]

    kpis = [
        ("Unternehmen im Netz", str(net["total_companies"]), ""),
        ("Bruttovolumen", _fmt_eur(net["total_gross_cents"]), "ausstehende Verpflichtungen"),
        ("Einsparung durch Netting", _fmt_eur(savings_cents), _fmt_pct(savings_pct) + " des Bruttovolumens"),
    ]

    kpi_w = (content_w - 2 * 4 * mm) / 3
    kpi_h = 18 * mm
    kpi_x = margin

    for label, value, sub in kpis:
        c.setFillColor(GRN_LT)
        c.setStrokeColor(BORDER)
        c.setLineWidth(0.5)
        c.roundRect(kpi_x, y - kpi_h, kpi_w, kpi_h, 3, fill=1, stroke=1)

        c.setFillColor(GRAY)
        c.setFont("Helvetica", 7)
        c.drawCentredString(kpi_x + kpi_w / 2, y - 5 * mm, label.upper())

        c.setFillColor(GRN_DK)
        c.setFont("Helvetica-Bold", 14)
        c.drawCentredString(kpi_x + kpi_w / 2, y - 11 * mm, value)

        if sub:
            c.setFillColor(GRAY)
            c.setFont("Helvetica", 7)
            c.drawCentredString(kpi_x + kpi_w / 2, y - 15.5 * mm, sub)

        kpi_x += kpi_w + 4 * mm

    y -= kpi_h + 7 * mm

    # ── clearing waterfall bar ────────────────────────────────────────────────
    c.setFillColor(GRAY_DK)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(margin, y, "Netting-Ergebnis (Wasserfall)")
    y -= 5 * mm

    bar_h = 9 * mm
    gross_c = max(clr["gross_cents"], 1)
    net_c   = clr["net_cents"]
    sav_c   = max(0, gross_c - net_c)

    # gross bar (full width, warm gray)
    c.setFillColor(HexColor("#c9bfaf"))
    c.rect(margin, y - bar_h, content_w, bar_h, fill=1, stroke=0)

    # net bar (green overlay)
    net_w = content_w * net_c / gross_c if gross_c else 0
    c.setFillColor(GRN)
    c.rect(margin, y - bar_h, net_w, bar_h, fill=1, stroke=0)

    # labels inside bars
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 8)
    if net_w > 30:
        c.drawString(margin + 4, y - bar_h + 3 * mm, f"Netto  {_fmt_eur(net_c)}")
    if content_w - net_w > 40:
        c.setFillColor(GRAY_DK)
        c.drawString(margin + net_w + 4, y - bar_h + 3 * mm, f"Einsp.  {_fmt_eur(sav_c)}")

    # axis labels below bar
    c.setFillColor(GRAY)
    c.setFont("Helvetica", 7)
    c.drawString(margin, y - bar_h - 4, _fmt_eur(0))
    c.drawRightString(W - margin, y - bar_h - 4, _fmt_eur(gross_c))

    # netting type note
    nt_label = {"bilateral": "Bilateral", "optimal": "LP-Optimal", "multilateral": "Multilateral"}.get(
        clr.get("netting_type", "bilateral"), "Bilateral"
    )
    c.setFont("Helvetica", 7)
    c.setFillColor(GRAY)
    if clr.get("cycle_date"):
        cd = datetime.fromisoformat(clr["cycle_date"].replace("Z", "+00:00"))
        c.drawRightString(W - margin, y + 2, f"Methode: {nt_label} · Clearing vom {cd.strftime('%d.%m.%Y')}")
    else:
        c.drawRightString(W - margin, y + 2, f"Methode: {nt_label}")

    y -= bar_h + 10 * mm

    # ── top-5 Gewinner table ─────────────────────────────────────────────────
    c.setFillColor(GRAY_DK)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(margin, y, "Top-5 Unternehmen nach Netting-Einsparung")
    y -= 5 * mm

    top5 = data.get("top5_companies", [])

    if top5:
        col_w = [content_w * r for r in (0.38, 0.20, 0.20, 0.22)]
        header_row = ["Unternehmen", "Brutto (Zahlbar)", "Nettoposition", "Einsparung"]
        table_data = [header_row]
        for row in top5:
            bil = row["bilateral_net_cents"]
            table_data.append([
                row["company_name"],
                _fmt_eur(row["gross_payable_cents"]),
                ("+" if bil >= 0 else "") + _fmt_eur(bil),
                _fmt_eur(row["savings_cents"]),
            ])

        tbl = Table(table_data, colWidths=col_w)
        tbl.setStyle(TableStyle([
            # Header
            ("BACKGROUND",    (0, 0), (-1, 0), GRN_DK),
            ("TEXTCOLOR",     (0, 0), (-1, 0), colors.white),
            ("FONT",          (0, 0), (-1, 0), "Helvetica-Bold", 7.5),
            ("ALIGN",         (0, 0), (0, 0), "LEFT"),
            ("ALIGN",         (1, 0), (-1, 0), "RIGHT"),
            ("TOPPADDING",    (0, 0), (-1, 0), 4),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 4),
            # Data rows
            ("FONT",          (0, 1), (-1, -1), "Helvetica", 7.5),
            ("ALIGN",         (0, 1), (0, -1), "LEFT"),
            ("ALIGN",         (1, 1), (-1, -1), "RIGHT"),
            ("TOPPADDING",    (0, 1), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 1), (-1, -1), 3),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, GRAY_LT]),
            ("TEXTCOLOR",     (0, 1), (-1, -1), GRAY_DK),
            ("GRID",          (0, 0), (-1, -1), 0.4, BORDER),
            # Savings column in green
            ("TEXTCOLOR",     (3, 1), (3, -1), GRN),
            ("FONT",          (3, 1), (3, -1), "Helvetica-Bold", 7.5),
        ]))
        tbl.wrapOn(c, content_w, H)
        tbl_h = tbl._height
        tbl.drawOn(c, margin, y - tbl_h)
        y -= tbl_h + 8 * mm
    else:
        c.setFillColor(GRAY)
        c.setFont("Helvetica", 8)
        c.drawString(margin, y, "Kein Clearing durchgeführt — keine Vergleichsdaten.")
        y -= 10 * mm

    # ── growth potential sentence ─────────────────────────────────────────────
    if net["total_companies"] > 0 and savings_pct > 0:
        growth_text = (
            f"Durch Aufnahme weiterer Hamburger Handelspartner in das ClearFlow-Netzwerk "
            f"kann der Einsparungseffekt von derzeit {_fmt_pct(savings_pct)} "
            f"weiter gesteigert werden — ohne zusätzlichen Liquiditätsbedarf."
        )
        c.setFillColor(GRN_DK)
        c.setFont("Helvetica-Oblique", 8)

        # Simple word-wrap for the growth sentence
        words = growth_text.split()
        line, lines = [], []
        for w in words:
            test = " ".join(line + [w])
            if c.stringWidth(test, "Helvetica-Oblique", 8) > content_w:
                lines.append(" ".join(line))
                line = [w]
            else:
                line.append(w)
        if line:
            lines.append(" ".join(line))

        # draw background box
        box_h = len(lines) * 5 * mm + 6 * mm
        c.setFillColor(GRN_LT)
        c.setStrokeColor(HexColor("#b8d8c4"))
        c.setLineWidth(0.5)
        c.roundRect(margin, y - box_h, content_w, box_h, 3, fill=1, stroke=1)

        c.setFillColor(GRN_DK)
        c.setFont("Helvetica-Oblique", 8)
        ty = y - 4.5 * mm
        for ln in lines:
            c.drawString(margin + 4, ty, ln)
            ty -= 5 * mm
        y -= box_h + 6 * mm

    # ── footer ────────────────────────────────────────────────────────────────
    footer_y = 12 * mm
    c.setStrokeColor(BORDER)
    c.setLineWidth(0.4)
    c.line(margin, footer_y + 5 * mm, W - margin, footer_y + 5 * mm)

    c.setFont("Helvetica", 6.5)
    c.setFillColor(GRAY)
    c.drawString(margin, footer_y + 2 * mm,
        "Alle Daten sind Simulationsdaten und dienen ausschließlich Demonstrationszwecken. "
        "Keine realen Finanzdaten.")
    c.drawRightString(W - margin, footer_y + 2 * mm, "ClearFlow Hamburg · clearflow.hamburg")

    c.showPage()
    c.save()
    buf.seek(0)
    return buf.read()


# ── endpoints ─────────────────────────────────────────────────────────────────


@router.get("/report")
def get_report(db: Session = Depends(get_db)):
    """Return all structured data needed to render the PDF report."""
    return _build_report_data(db)


@router.get("/report/pdf")
def get_report_pdf(db: Session = Depends(get_db)):
    """Generate and return a one-page PDF report (reportlab)."""
    data = _build_report_data(db)
    pdf_bytes = _generate_pdf(data)

    today = datetime.now().strftime("%Y-%m-%d")
    filename = f"ClearFlow_Bericht_{today}.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
