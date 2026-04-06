# ClearFlow Hamburg

Multilateral invoice clearing and netting for Hamburg SMEs, built as a GLS Bank cooperative banking service.

**The problem:** 70% of SMEs could pay on time if they were paid on time. Late payments cascade through supply chains, creating artificial cash-flow crises. ClearFlow breaks the cycle by netting mutual obligations before anyone moves real money.

**How it works:**

1. **Collect** invoices between participating companies
2. **Bilateral netting** — for each pair A-B, opposing flows cancel; only the net difference is owed
3. **Multilateral netting** — find cycles in the residual obligation graph (A owes B, B owes C, C owes A) and reduce each by its minimum edge weight using Johnson's algorithm
4. **Settle** only the reduced net positions

The demo dataset of 50 Hamburg SMEs and 320 invoices (~16.4M gross) achieves **28.3% netting savings**, within the Fleischman benchmark of 25-50%.

## Tech Stack

| Layer      | Technology                                              |
| ---------- | ------------------------------------------------------- |
| Backend    | Python 3.12, FastAPI, SQLAlchemy 2.0, Alembic           |
| Frontend   | React 18, Vite 5, D3.js v7                              |
| Database   | PostgreSQL 16                                            |
| Infra      | Docker Compose (dev + prod), nginx reverse proxy         |

## Quick Start

```bash
# Dev — all services with hot-reload frontend
docker compose up --build

# Frontend:  http://localhost:3000
# API:       http://localhost:8000
# Swagger:   http://localhost:8000/docs
```

Startup order is enforced by Docker health checks: `db` -> `migrate` (Alembic) -> `seed` (idempotent) -> `api` -> `frontend`.

### Without Docker

```bash
# Backend
cd backend
pip install -r requirements.txt
DATABASE_URL=postgresql://clearflow:clearflow@localhost:5432/clearflow \
  uvicorn app.main:app --reload

# Frontend (falls back to mock data if backend is unreachable)
cd frontend
npm install
npm run dev
```

## Production Deployment

Deployed at `clearflow.poeticte.ch`. Only port 80 is exposed via nginx; the API container is internal-only.

```bash
export POSTGRES_PASSWORD=<strong-password>
docker compose -f docker-compose.prod.yml up -d --build
```

## Project Structure

```
Clearinghouse/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, CORS, router registration
│   │   ├── models.py            # Company, Invoice, ClearingCycle, ClearingResult, NetPosition
│   │   ├── schemas.py           # Pydantic v2 request/response models
│   │   ├── netting.py           # Bilateral + multilateral netting engine (Johnson's algorithm)
│   │   ├── core/                # Config (DATABASE_URL), database session
│   │   └── api/                 # Route modules: companies, invoices, clearing, network, admin
│   ├── seeds/                   # Idempotent seeder: 50 companies + 320 invoices
│   └── alembic/                 # Single migration: full schema
├── frontend/
│   └── src/
│       ├── App.jsx              # Tab navigation shell (7 tabs)
│       ├── components/          # Uebersicht, Rechnungen, Clearing, Entdecken
│       ├── pages/               # NettingVergleich, NetworkExplorer, GlsDashboard
│       ├── api/                 # Fetch client with mock-data fallback
│       ├── hooks/               # useApi generic fetch hook
│       └── styles/              # CSS custom properties, component styles
├── data/                        # Seed data generators, network analysis report
├── nginx/                       # Dev nginx config
├── docker-compose.yml           # Dev: all services, frontend hot-reload
└── docker-compose.prod.yml      # Prod: nginx on :80, no exposed API port
```

## Frontend Views

| Tab         | Description                                                                                  |
| ----------- | -------------------------------------------------------------------------------------------- |
| Ubersicht   | KPI cards (companies, savings rate, confirmed invoices) + mini D3 force-directed network      |
| Rechnungen  | Invoice list with status filters, confirm action, and new invoice submission form             |
| Clearing    | Run bilateral clearing with animated 3-step result display and per-pair breakdown             |
| Vergleich   | Read-only multilateral comparison: animated Brutto -> Bilateral -> Multilateral stage cards   |
| Netzwerk    | Full D3 topology explorer with cluster hulls, inter-cluster gap arcs, and company detail panel |
| GLS Admin   | Bank admin dashboard: KPIs, trade network (node size = throughput), net-position table         |
| Entdecken   | Discovery insights: potential new trade connections + funding gap detection for factoring/SCF  |

Cluster color coding: Port & Logistik (blue), Handwerk & Bau (brown), Gastronomie & Handel (green).

## API Endpoints

All routes are served under `/api/` in production via nginx proxy.

**Companies** `/companies`
- `GET /companies` — list all
- `POST /companies` — create `{name, sector?, city?}`
- `GET /companies/{id}/net-position` — latest net position + totals

**Invoices** `/invoices`
- `GET /invoices` — list (filterable by `status`, `from_company_id`, `to_company_id`)
- `POST /invoices` — submit invoice with optional line items
- `PATCH /invoices/{id}/confirm` — transition pending -> confirmed (required before clearing)

**Clearing** `/clearing`
- `POST /clearing/run` — run bilateral clearing over confirmed invoices (persists results)
- `POST /clearing/multilateral` — compute full netting comparison (read-only, returns savings)
- `GET /clearing/cycles` — list past clearing cycles
- `GET /clearing/cycles/{id}` — cycle detail with results and net positions

**Network** `/network`
- `GET /network/stats` — KPIs: company count, invoice count, gross, net, savings
- `GET /network/topology` — full graph: nodes, edges, clusters, inter-cluster gaps

**Admin** `/admin`
- `GET /admin/dashboard` — latest cycle summary + per-company net positions
- `GET /admin/network` — nodes + edges for force graph rendering

**Health** `GET /health` -> `{"status": "ok"}`

## Seed Data

50 Hamburg SMEs across 3 industry clusters:

| Cluster             | Sector Key         | Companies |
| ------------------- | ------------------ | --------- |
| Port & Logistik     | `port_logistics`   | 18        |
| Gastronomie & Handel| `food_beverage`    | 17        |
| Handwerk & Bau      | `renewable_energy` | 15        |

Companies span micro (14), small (23), and medium (13) sizes across Hamburg districts. 22 of 50 are GLS Bank members. 320 invoices with line items are seeded as confirmed.

## Netting Engine

The netting engine in `backend/app/netting.py` implements two stages:

**Bilateral** (`run_bilateral`): For each company pair with opposing invoices, compute the net obligation. Creates `ClearingCycle`, `ClearingResult`, and `NetPosition` records. Marks processed invoices as `cleared`.

**Multilateral** (`run_multilateral`): Builds a directed obligation graph from the bilateral residuals, then applies Johnson's cycle-finding algorithm (SIAM 1975) to detect all simple cycles. Each cycle is reduced by its minimum edge weight, eliminating circular debt. A 10,000-iteration safety cap prevents runaway computation on dense graphs.

All amounts are stored as integer EUR cents to avoid floating-point precision issues.

## Environment Variables

| Variable             | Default                                                    | Context  |
| -------------------- | ---------------------------------------------------------- | -------- |
| `DATABASE_URL`       | `postgresql://clearflow:clearflow@db:5432/clearflow`       | Backend  |
| `VITE_API_BASE_URL`  | `/api`                                                     | Frontend |
| `POSTGRES_PASSWORD`  | `clearflow`                                                | Docker   |

## License

See [LICENSE](LICENSE).
