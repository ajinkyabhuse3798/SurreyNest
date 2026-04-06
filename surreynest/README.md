# SurreyNest 🏠

**Student housing quality and rights platform for Guildford, UK.**

Find fair-priced rentals, check HMO licensing status, see safety scores from local crime data, and know your rights as a tenant — all using free public data.

[![Built with FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688)](https://fastapi.tiangolo.com)
[![Frontend React](https://img.shields.io/badge/Frontend-React%2018-61DAFB)](https://react.dev)
[![Database PostgreSQL](https://img.shields.io/badge/DB-PostgreSQL%2015-336791)](https://postgresql.org)
[![All APIs Free](https://img.shields.io/badge/APIs-100%25%20Free-brightgreen)](#data-sources)

---

## The Problem

University of Surrey students face a documented housing crisis:
- Private rooms £500+/month with 19% year-on-year increases
- One in five homes in Onslow ward is an HMO — some unlicensed (fire safety risk)
- Students receive "very little information" about their legal rights
- No tool exists to benchmark whether rent is fair before signing

SurreyNest fixes this with free public data, a rent fairness ML model, and verified tenant reviews.

---

## Features

| Feature | Status | Description |
|---------|--------|-------------|
| 🔍 **Property Search** | 🔄 Building | Search by Guildford postcode + radius, results on interactive map |
| 💰 **Rent Fairness Score** | 🔄 Building | ML model predicts fair market rent, scores 0–100 |
| 🔒 **HMO Verification** | 🔄 Building | Real-time check against Guildford HMO public register |
| 🛡️ **Safety Score** | 🔄 Building | Aggregated from police.uk crime data by postcode sector |
| ⭐ **Tenant Reviews** | 🔄 Building | Structured ratings: landlord, condition, value, with moderation |
| ⚖️ **Rights Guide** | 🔄 Building | Interactive decision tree: deposits, repairs, eviction, HMO rights |
| 💷 **True Cost Calculator** | 📋 Planned | Rent + energy estimate (EPC) + council tax = real monthly cost |
| 📄 **Contract Review** | 📋 Planned | AI-powered tenancy agreement analysis (flags illegal clauses) |
| 💧 **Flood Risk** | 📋 Planned | Environment Agency flood data per postcode |

---

## Build Status

| Phase | Status | What's Done |
|-------|--------|-------------|
| Phase 1 — Data Pipelines | ✅ Complete | EPC + HMO data loaded in PostgreSQL |
| Phase 2 — ML Model | ✅ Complete | GBR model trained, rent_model_v1.pkl saved |
| Phase 3 — FastAPI Backend | 🔄 In Progress | Models done; routers/services being built |
| Phase 4 — React Frontend | ⏳ Pending | Depends on Phase 3 |
| Phase 5 — Scheduler | ⏳ Pending | APScheduler nightly jobs |
| Phase 6 — New Data Sources | ⏳ Pending | Flood risk, VOA rent bands |
| Phase 7 — Testing | ⏳ Pending | Full test suite |
| Phase 8 — Deployment | ⏳ Pending | Railway + Vercel |

---

## Data Sources (all free, zero paid APIs)

| Dataset | Source | Auth | Update Schedule |
|---------|--------|------|----------------|
| EPC Certificates | epc.opendatacommunities.org | Free account | Quarterly |
| Guildford HMO Register | guildford.gov.uk / data.gov.uk | None | Weekly |
| Crime Data | data.police.uk | None (no key needed) | Monthly |
| Postcode Geocoding | api.postcodes.io | None | Static |
| Land Registry PPD | gov.uk/land-registry | None | Monthly |
| VOA Rental Statistics | gov.uk/voa | None | Quarterly |
| Flood Risk | environment.data.gov.uk | None | Weekly |
| Map Tiles | openstreetmap.org | None (attribution required) | Real-time |

---

## Quick Start

### Prerequisites
- Docker Desktop
- Node.js 18+
- Python 3.11+

### 1. Clone and configure
```bash
git clone https://github.com/yourusername/surreynest
cd surreynest
cp backend/.env.example backend/.env
# Edit backend/.env — set DATABASE_URL and SECRET_KEY
cp frontend/.env.example frontend/.env.local
# Edit frontend/.env.local — VITE_API_URL=http://localhost:8000
```

### 2. Start database and backend
```bash
docker-compose up -d
docker exec surreynest-backend alembic upgrade head

# Verify all 8 tables were created:
docker exec -it surreynest-db psql -U surreynest -d surreynest -c "\dt"
```

### 3. Load data (first time — see note on timing below)
```bash
# EPC pipeline — ~10 minutes (requires manual CSV download first)
docker exec surreynest-backend python -m app.data_pipelines.epc_pipeline

# HMO pipeline — ~5 minutes (requires manual CSV download first)
docker exec surreynest-backend python -m app.data_pipelines.hmo_pipeline

# Crime pipeline — ~45 minutes (hits police.uk API for all GU postcodes)
docker exec surreynest-backend python -m app.data_pipelines.crime_pipeline

# Land Registry — ~5 minutes (requires manual CSV download first)
docker exec surreynest-backend python -m app.data_pipelines.land_registry_pipeline
```

### 4. Train ML model
```bash
docker exec surreynest-backend python -m app.ml.train
docker exec surreynest-backend python -m app.ml.evaluate
# Expect: MAE < £50/week, R² > 0.65
```

### 5. Start frontend
```bash
cd frontend && npm install && npm run dev
```

**App:** http://localhost:5173  
**API docs:** http://localhost:8000/docs

---

## Configuration

### Backend (`backend/.env`)
```env
DATABASE_URL=postgresql://surreynest:surreynest_dev_password@localhost:5432/surreynest
SECRET_KEY=<generate: python -c "import secrets; print(secrets.token_hex(32))">
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_DAYS=30
ENVIRONMENT=development
ALLOWED_ORIGINS=http://localhost:5173
ML_MODEL_VERSION=v1.0.0
RATE_LIMIT_SEARCH=60
RATE_LIMIT_REVIEWS=5
```

### Frontend (`frontend/.env.local`)
```env
VITE_API_URL=http://localhost:8000
VITE_APP_VERSION=0.1.0
```

---

## Database Schema

See `docs/data-dictionary.md` for complete column definitions.

| Table | Purpose | Rows (approx) |
|-------|---------|---------------|
| `properties` | EPC-sourced property records | ~12,000 |
| `hmo_records` | Guildford HMO licences | ~500 |
| `crime_data` | police.uk crime by postcode sector + month | ~50,000 |
| `reviews` | Tenant-submitted reviews (moderated) | User-generated |
| `users` | Registered accounts | User-generated |
| `postcode_cache` | Postcodes.io geocoding cache | ~15,000 |
| `rent_predictions` | Cached ML model predictions | ~12,000 |
| `pipeline_runs` | Pipeline execution audit log | Auto-grows |

---

## ML Model

**Algorithm:** GradientBoostingRegressor (scikit-learn Pipeline)  
**Input:** Property characteristics from EPC + HMO register + computed distances  
**Output:** Predicted fair weekly rent in £  
**Serialised to:** `backend/app/ml/models/rent_model_v1.pkl`

### Features used
| Feature | Source | Type |
|---------|--------|------|
| `floor_area_m2` | EPC | Numeric |
| `num_rooms` | EPC | Numeric |
| `energy_rating_encoded` | EPC (G=0, A=6) | Ordinal |
| `property_type` | EPC | One-hot |
| `built_form` | EPC | One-hot |
| `is_hmo` | HMO register | Boolean |
| `distance_to_town_km` | Computed | Numeric |
| `distance_to_uni_km` | Computed | Numeric |
| `area_value_index` | Land Registry | Numeric (0–1) |
| `safety_score` | police.uk | Numeric (0–100) |

**Retrain manually:** `docker exec surreynest-backend python -m app.ml.train`  
**See full model docs:** `docs/ml-model.md`

---

## Project Structure

``` 
surreynest/
├── docs/
│   ├── api-reference.md       ← All external APIs and how to call them
│   ├── conventions.md         ← Code style rules
│   ├── data-dictionary.md     ← Every DB table and column
│   ├── decisions.md           ← Architecture decisions (ADR-001 to ADR-012)
│   ├── deployment.md          ← Railway + Vercel deployment guide
│   ├── ml-model.md            ← ML model design and evaluation
│   └── progress.md            ← ⭐ Current build status and session notes
├── backend/
│   ├── app/
│   │   ├── config.py          ← ✅ Settings (env vars, validation)
│   │   ├── database.py        ← ✅ SQLAlchemy engine + session
│   │   ├── models/            ← ✅ All 8 ORM models (complete)
│   │   ├── schemas/           ← 🔄 Pydantic schemas (building)
│   │   ├── routers/           ← 🔄 Route handlers (building)
│   │   ├── services/          ← 🔄 Business logic (building)
│   │   ├── ml/                ← ✅ Model trained (pipeline stubs filled)
│   │   └── data_pipelines/    ← ✅ EPC + HMO + crime pipelines (done)
│   ├── alembic/               ← ✅ Migrations (initial schema complete)
│   └── tests/                 ← 🔄 Being written alongside Phase 3
└── frontend/
    └── src/                   ← ⏳ All stubs (Phase 4)
```

---

## Running Tests

```bash
# Backend — run from backend/ directory
cd backend && pytest -v --cov=app

# Run specific test file
cd backend && pytest tests/test_auth.py -v

# Frontend — run from frontend/ directory
cd frontend && npm run test
```

---

## Pipeline Reference

All pipelines write audit records to `pipeline_runs` table. Check status:
```bash
docker exec surreynest-backend python -c "
from app.database import SessionLocal
from app.models.pipeline_run import PipelineRun
db = SessionLocal()
runs = db.query(PipelineRun).order_by(PipelineRun.started_at.desc()).limit(10).all()
for r in runs:
    print(f'{r.pipeline_name}: {r.status} | {r.rows_processed} rows | {r.finished_at}')
"
```

| Pipeline | Command | Time | Frequency |
|----------|---------|------|-----------|
| EPC | `python -m app.data_pipelines.epc_pipeline` | ~10 min | Quarterly |
| HMO | `python -m app.data_pipelines.hmo_pipeline` | ~5 min | Weekly |
| Crime | `python -m app.data_pipelines.crime_pipeline` | ~45 min | Monthly |
| Land Registry | `python -m app.data_pipelines.land_registry_pipeline` | ~5 min | Monthly |
| Flood Risk | `python -m app.data_pipelines.flood_pipeline` | ~5 min | Weekly |
| VOA Rents | `python -m app.data_pipelines.voa_pipeline` | ~2 min | Quarterly |

---

## Deployment

**Backend + Database:** Railway.app (free tier + $5/month hobby plan)  
**Frontend:** Vercel (free tier)

See `docs/deployment.md` for complete step-by-step instructions.

```bash
# Quick reference
npm install -g @railway/cli vercel
railway login && railway init && railway link
railway variables set DATABASE_URL="..." SECRET_KEY="..." ENVIRONMENT="production"
railway up
cd frontend && vercel --prod
```

---

## Scoring Reference

### Rent Fairness Score
```
ratio = actual_weekly_rent / predicted_weekly_rent
≤ 0.85 → 90–100  "Excellent deal"          🟢
≤ 1.00 → 70–89   "Below market"             🟢
≤ 1.10 → 55–69   "At market rate"           🟡
≤ 1.25 → 35–54   "Slightly above market"    🟡
≤ 1.40 → 15–34   "Above market"             🔴
> 1.40 →  0–14   "Significantly overpriced" 🔴
```

### Safety Score
Computed from police.uk crime data per postcode sector (e.g. `GU2 7`).  
100 = safest areas in Guildford. 0 = highest crime.  
See `docs/api-reference.md` for full formula and category weights.

---

## Privacy & Legal

- Minimum data collection: email + hashed password only
- Reviews moderated before publication
- Account deletion: reviews anonymised (user_id set to NULL), account row deleted
- All datasets under Open Government Licence v3.0
- No personal information about landlords stored without consent

---

## Roadmap

- [x] Database schema (all 8 tables + PostGIS)
- [x] Data pipelines (EPC, HMO, crime)
- [x] ML rent fairness model (v1 — VOA bands as training target)
- [ ] FastAPI backend (routers, services, auth)
- [ ] React frontend (search, map, property detail, reviews)
- [ ] APScheduler nightly pipeline automation
- [ ] Flood risk pipeline (Environment Agency)
- [ ] VOA rent bands pipeline (improves ML model)
- [ ] True cost calculator (rent + energy + council tax)
- [ ] AI contract review (Anthropic API)
- [ ] Embeddable HMO checker widget
- [ ] Expand to other Surrey towns (Woking, Farnham, Egham)
- [ ] ML model v2 (user-submitted rents as training target — 50+ reviews needed)

---

## Contributing

Contributions should follow the project conventions in `docs/conventions.md` and keep documentation in sync with code changes.

---

## Licence

MIT — see `LICENSE`
