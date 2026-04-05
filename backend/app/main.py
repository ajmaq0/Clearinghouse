from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import Base, engine
from app.api import companies, invoices, clearing, network, admin

# Create tables on startup if they don't already exist (Alembic handles migrations)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="ClearFlow API",
    description="Bilateral invoice netting engine for ClearFlow Hamburg",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(companies.router)
app.include_router(invoices.router)
app.include_router(clearing.router)
app.include_router(network.router)
app.include_router(admin.router)


@app.get("/health")
def health():
    return {"status": "ok"}
