# CLAUDE.md — SurreyNest Project Context

> This file is read automatically by Claude Code at the start of every session.
> It contains everything needed to work on this project without re-explaining context.
> **Read `docs/progress.md` next — it tells you exactly what to do in the current session.**

---

## ⚠️ MANDATORY: PLAN MODE BEFORE ANY CODE

**Claude must enter plan mode before writing any code, creating any file, or modifying anything.**

Plan mode means stating **out loud**:
1. Every file that will be **created** (new file)
2. Every file that will be **modified** (changes to existing file)
3. Every database migration required (if schema changes)
4. Every test that must be written or updated
5. The exact **order of operations** (dependencies first)

Then say: `Does this plan look right? I'll wait for your go-ahead.`

**No exceptions for:**
- New endpoints
- New services or service functions
- Database model changes
- Pipeline additions
- Frontend pages or components
- Schema changes

**Plan mode is optional only for:**
- Single-line bug fixes
- Updating a comment or docstring
- Updating `docs/progress.md`

---

## What is SurreyNest?

SurreyNest is a **student housing quality and rights platform** for Guildford, UK.
It solves three documented problems for University of Surrey students:

1. **Rent transparency** — students overpay with no benchmark. We provide ML-predicted fair rent scores.
2. **HMO safety** — landlords operate unlicensed HMOs (real fire risk). We show licensing status from the Guildford HMO public register.
3. **Rights awareness** — students don't know their legal rights. We provide an interactive rights guide.

**Target users:** University of Surrey students, Guildford renters, landlords seeking verified badges.

**Business model:** Freemium (free search, premium landlord verification) — focus on the product first.

---

## Tech Stack (never deviate from this)

| Layer | Choice | Why |
|-------|--------|-----|
| Backend | **Python 3.11 + FastAPI** | Async, auto OpenAPI docs at /docs, easy ML integration |
| Frontend | **React 18 + Vite + TailwindCSS** | Fast dev, component reuse |
| Database | **PostgreSQL 15 + PostGIS** | Spatial radius queries via ST_DWithin |
| ML | **scikit-learn + pandas + joblib** | Tabular data, no GPU needed |
| Auth | **JWT (python-jose) + bcrypt (passlib)** | No paid auth services ever |
| Maps | **Leaflet.js + react-leaflet + OpenStreetMap** | 100% free, no Google Maps API |
| Jobs | **APScheduler** inside FastAPI | No separate Celery/Redis for MVP |
| Deployment | **Railway.app** (backend + DB) + **Vercel** (frontend) | Both free tiers |

**All external APIs are free.** See `docs/api-reference.md` for full list.

---

## Project Structure

```
surreynest/
├── CLAUDE.md                  ← YOU ARE HERE — read every session
├── README.md
├── docker-compose.yml
├── .gitignore
├── docs/
│   ├── api-reference.md       ← All free APIs used (police.uk, Postcodes.io, EA, VOA)
│   ├── conventions.md         ← Code style rules — must follow always
│   ├── data-dictionary.md     ← Every DB table and column defined
│   ├── decisions.md           ← Architecture decision log (ADR-001 through ADR-012)
│   ├── deployment.md          ← Railway + Vercel deployment steps
│   ├── ml-model.md            ← ML model design, features, evaluation targets
│   └── progress.md            ← ⭐ READ THIS FIRST — current phase checklist
├── backend/
│   ├── app/
│   │   ├── main.py            ← ✅ FastAPI entry point (complete)
│   │   ├── config.py          ← ✅ Env var loading (complete)
│   │   ├── database.py        ← ✅ SQLAlchemy engine + session (complete)
│   │   ├── models/            ← ✅ All 8 ORM models complete (see below)
│   │   ├── schemas/           ← ✅ All Pydantic schemas complete
│   │   ├── routers/           ← ✅ All route handlers complete (incl. listings)
│   │   ├── services/          ← ✅ All business logic complete
│   │   ├── ml/                ← ✅ ML pipeline complete (train, predict, evaluate, features)
│   │   └── data_pipelines/    ← ✅ All ETL jobs complete
│   ├── data/
│   │   ├── raw/               ← Downloaded source files (gitignored)
│   │   │   ├── land_registry/ ← pp-2021.csv to pp-2025.csv (Price Paid, NO headers)
│   │   │   ├── hpi/           ← UK-HPI-full-file CSVs (2024+2025)
│   │   │   ├── iphrp/         ← Rental index XLSX (South East regional)
│   │   │   ├── certificates.csv ← EPC bulk data
│   │   │   └── voa_rental_stats_2024.csv
│   │   └── processed/         ← Cleaned CSVs (gitignored)
│   │       ├── epc_clean.csv
│   │       ├── features.csv
│   │       └── land_registry_guildford.csv ← 2,515 postcodes with implied rents
│   ├── tests/                 ← ✅ All tests passing
│   ├── alembic/               ← ✅ Migrations complete
│   ├── requirements.txt       ← ✅ All dependencies pinned
│   ├── .env.example           ← ✅ Template
│   └── Dockerfile             ← ✅ Production container
└── frontend/
    ├── src/
    │   ├── pages/             ← ✅ All pages complete (incl. CheckListing)
    │   ├── components/        ← ✅ All components complete
    │   ├── hooks/             ← ✅ useAuth complete
    │   ├── services/          ← ✅ api.js complete
    │   └── utils/
    ├── vite.config.js         ← ✅ Complete
    └── package.json           ← ✅ All dependencies listed
```

---

## ✅ What Is Already Built (NEVER modify without explicit instruction)

### Complete and Tested
- `backend/app/config.py` — Settings singleton, dotenv loading, production validation
- `backend/app/database.py` — SQLAlchemy engine, SessionLocal, Base, get_db dependency
- `backend/alembic/env.py` — Alembic wired to settings.database_url
- `backend/alembic/versions/62efbusz7xg4_initial_schema.py` — Full initial migration

### Complete SQLAlchemy Models (all in `backend/app/models/`)
All 8 models are complete with correct column names — **use these exact names everywhere**:

| File | Table | Key columns |
|------|-------|-------------|
| `user.py` | `users` | `id` (UUID), `email`, `hashed_password`, `role`, `is_verified`, `last_login` |
| `property.py` | `properties` | `uprn` (PK), `address`, `postcode`, `lat`, `lng`, `property_type`, `built_form`, **`floor_area_m2`**, **`num_rooms`**, `energy_rating`, `potential_rating`, `epc_date`, `tenure` |
| `hmo_record.py` | `hmo_records` | `id`, `uprn` (FK nullable), `raw_address`, `postcode`, `lat`, `lng`, `licence_number`, `max_occupants`, `licence_holder`, `expiry_date`, `is_active` |
| `crime_data.py` | `crime_data` | `id`, `postcode_sector`, `category`, `month`, `count` |
| `review.py` | `reviews` | `id` (UUID), `user_id` (FK nullable), `uprn` (FK), `overall_rating`, `landlord_rating`, `condition_rating`, `value_rating`, `weekly_rent_paid`, `move_in_year`, `review_text`, `is_moderated`, `is_flagged` |
| `postcode_cache.py` | `postcode_cache` | `postcode` (PK), `lat`, `lng`, `ward`, `district`, `is_valid` |
| `rent_prediction.py` | `rent_predictions` | `uprn` (PK/FK), `predicted_weekly_rent`, `confidence_low`, `confidence_high`, `model_version`, `computed_at` |
| `pipeline_run.py` | `pipeline_runs` | `id`, `pipeline_name`, `started_at`, `finished_at`, `status`, `rows_processed`, `error_message` |

**Critical column names — never get these wrong:**
```python
# Property model uses:
property.floor_area_m2      # NOT total_floor_area, NOT floor_area
property.num_rooms           # NOT number_habitable_rooms, NOT rooms
property.energy_rating       # NOT current_energy_rating
# HMO model uses:
hmo.raw_address              # NOT address
hmo.is_active                # Boolean
# Review model uses:
review.is_moderated          # NOT moderated
review.is_flagged            # NOT deleted, NOT removed
```

---

## Data Pipeline Cleaning Rules

These rules are applied during ingestion. **Do not change them** without explicit instruction:

### EPC Pipeline (`epc_pipeline.py`)
- Filter: GU1–GU5, GU7 postcodes only (Guildford core + Godalming)
- Post-2018 lodgement dates only
- Tenure normalisation: `rented (private)` → `rental (private)`, `rented (social)` → `rental (social)`
- Remove: `floor_area_m2 < 10` (data errors), `num_rooms > 15` (commercial)
- Cap: `floor_area_m2` at 300m²
- Dedup on UPRN (keep most recent EPC)

### Land Registry Pipeline (`land_registry_pipeline.py`)
- Loads all `data/raw/land_registry/pp-*.csv` files (NO headers — use COLUMN_NAMES)
- Filter: GU1–GU5, GU7 districts only
- Outlier removal: drop prices < £30,000 or > £3,000,000
- HPI time-adjustment: normalises all sale prices to latest month using Guildford-specific UK HPI index
- Implied weekly rent: `adjusted_price × 4% ÷ 52`
- Output: `data/processed/land_registry_guildford.csv` (2,515 postcodes)
- DB upsert: `area_values` table with `area_value_index` (0.0–1.0)

### HMO Pipeline (`hmo_pipeline.py`)
- `licence_holder` stored in DB but **NOT exposed via API** (UK GDPR)
- `is_active` computed from `expiry_date > today`

### Crime Pipeline (`crime_pipeline.py`)
- police.uk API, all GU postcode sectors, 12 months rolling

### EDA Script (`eda_all_datasets.py`)
- Run: `python -m app.data_pipelines.eda_all_datasets`
- Audits all 7 datasets, flags anomalies with ⚠️, checks cross-dataset consistency

---

## Remaining Work

### Next priorities:
1. Retrain ML model with real Price Paid rent targets (instead of synthetic formula)
2. Update `features.py` to use `land_registry_guildford.csv` implied rents
3. Phase 7 — Testing (frontend Vitest + E2E)
4. Phase 8 — Deployment (Railway + Vercel)

---

## New Free APIs to Add (Phase 4+)

These were not in the original plan but are free and add significant value:

| API | URL | Auth | What it adds |
|-----|-----|------|-------------|
| EA Flood | `https://environment.data.gov.uk/flood-monitoring` | None | Flood risk per postcode |
| ONS/VOA | CSV download from ons.gov.uk | None | Median rents by bedroom — improves ML labels |
| Companies House | `https://developer.companieshouse.gov.uk` | Free key | Corporate landlord detection |

**When to add:** After the Phase 3 backend is fully working. Add new models + migration first.

---

## ⛔ ML Model — Known Bugs (MUST FIX before next retrain)

These bugs were found on 2026-03-02 after user observed predictions too low for GU1 properties.
**Do NOT retrain the model without fixing all three first.**

### Bug 1: Circular Dependency in MODE C Training (`train.py`)
**File:** `backend/app/ml/train.py` — `get_feature_columns()` and `compute_real_target()`
**Problem:** `implied_weekly_rent` is used as BOTH a training feature AND the basis for the training target.
The GBR learns `output ≈ implied_weekly_rent_input`. All other features (floor area, rooms, property type,
distance to uni/town, safety score) become near-irrelevant. Changing datasets has no effect because
the model just echoes back the `implied_weekly_rent` feature.
**Fix:** Remove `implied_weekly_rent` from `get_feature_columns()` so it is used only as the target.
Keep `median_sale_price`, `sale_count`, `area_value_index` as features (they don't cause circularity).

### Bug 2: `area_value_index` Missing from Prediction Features (`score_service.py`)
**File:** `backend/app/services/score_service.py` — `get_rent_prediction()`
**Problem:** The `features` dict built and passed to `predict_rent()` never includes `area_value_index`.
Every prediction falls back to the hardcoded default of 0.5, meaning GU1 (expensive) and GU5 (cheaper)
properties get the same area adjustment.
**Fix:** Add to features dict:
```python
"area_value_index": float(area_val.area_value_index) if area_val else 0.5,
```

### Bug 3: 4% Yield Underestimates GU1 Rents (`land_registry_pipeline.py`)
**Problem:** The implied_weekly_rent formula uses `adjusted_price × 4% ÷ 52`. In GU1 (town centre),
property prices have risen faster than rents — actual gross yield is 3–3.5%, not 4%.
Using 4% makes the training signal systematically too low for expensive GU1 postcodes.
**Fix:** Change yield rate from 4% to 3.5% in `land_registry_pipeline.py`, then re-run the pipeline
before retraining.

### Bug 4: Stale Prediction Cache After Retrain
**Problem:** `score_service.get_rent_prediction()` checks `cached.model_version == settings.ml_model_version`.
If `.env` ML_MODEL_VERSION is not bumped after retraining, old wrong predictions are served from cache.
**Fix:** Always update `ML_MODEL_VERSION` in `backend/.env` after every retrain (e.g. v2.0.0 → v2.1.0).

---

## ML Model — Feature Names (exact, match the DB columns)

The ML model in `docs/ml-model.md` uses these features. Column names must match exactly:

```python
# From properties table:
'floor_area_m2'           # property.floor_area_m2
'num_rooms'               # property.num_rooms
'energy_rating_encoded'   # derived from property.energy_rating (G=0...A=6)

# From properties table (one-hot encoded):
'property_type'           # property.property_type
'built_form'              # property.built_form

# From hmo_records table:
'is_hmo'                  # bool: any active HMO record for this UPRN/postcode

# Computed (no DB column — calculated in features.py):
'distance_to_town_km'     # Haversine to GU1 3AY (51.2362, -0.5704)
'distance_to_uni_km'      # Haversine to Surrey Uni (51.2417, -0.5888)

# From crime_data table (aggregated):
'safety_score'            # score_service.compute_safety_score(postcode_sector)
                          # Fill with dataset median when crime data is sparse

# From processed Land Registry CSV:
'area_value_index'        # Median sale price per postcode, normalised 0-1
                          # Fill with 0.5 (median) when data missing
'median_sale_price'       # Absolute neighbourhood value (£) — OK as feature
'sale_count'              # Market liquidity signal — OK as feature

# ⛔ NOT a training feature — training target only:
# 'implied_weekly_rent'   # NEVER put this in get_feature_columns()
#                         # It IS the MODE C training target basis.
#                         # Using it as both feature AND target creates a circular
#                         # dependency: model learns output ≈ input, ignores all else.
```

---

## Database — Schema Rules

**The initial migration (62efbusz7xg4) is complete.** It creates all 8 tables + PostGIS + GIST index.

**Before adding any new table:**
1. Create the SQLAlchemy model file in `backend/app/models/`
2. Import it in `backend/app/models/__init__.py`
3. Generate migration: `alembic revision --autogenerate -m "description"`
4. Review the generated migration before running it
5. Run: `alembic upgrade head`

**Never:**
- Manually ALTER TABLE in production
- Drop and recreate tables in pipelines
- Run raw SQL without `text()` and parameters

---

## Coding Conventions (follow always)

See `docs/conventions.md` for complete details. Key rules:

### Python
- `black` formatter + `ruff` linter — zero warnings
- Type hints required on all function signatures
- Google-style docstrings on all public functions
- `logging.getLogger(__name__)` — never `print()`
- All secrets via `from app.config import settings`
- Never bare `except:` — always catch specific exceptions
- SQLAlchemy ORM queries only — no raw SQL string concatenation

### Git commits (conventional commits)
- `feat:` new feature
- `fix:` bug fix
- `data:` pipeline or data changes
- `ml:` model changes
- `docs:` documentation only
- `test:` test additions

---

## Environment Variables

Backend reads from `backend/.env`. Frontend reads from `frontend/.env.local`.
See `.env.example` in each directory for required keys.

```bash
# New vars to add when building new features:
ANTHROPIC_API_KEY=sk-ant-...      # For AI contract review (Phase 4+)
RATE_LIMIT_SEARCH=60              # Already in .env.example
RATE_LIMIT_REVIEWS=5              # Already in .env.example
```

---

## Running the Project Locally

```bash
# Start database and backend
docker-compose up -d

# Run DB migrations (first time, or after new migration)
docker exec surreynest-backend alembic upgrade head

# Verify all tables exist
docker exec -it surreynest-db psql -U surreynest -d surreynest -c "\dt"

# Run data pipelines (first time setup — in order)
docker exec surreynest-backend python -m app.data_pipelines.epc_pipeline
docker exec surreynest-backend python -m app.data_pipelines.hmo_pipeline
docker exec surreynest-backend python -m app.data_pipelines.crime_pipeline

# Train ML model
docker exec surreynest-backend python -m app.ml.train
docker exec surreynest-backend python -m app.ml.evaluate

# Start frontend (separate terminal)
cd frontend && npm run dev

# Run backend tests
cd backend && pytest -v

# API docs
open http://localhost:8000/docs
```

---

## Key Architecture Decisions (already made — do not relitigate)

All decisions logged in `docs/decisions.md` (ADR-001 through ADR-012). Summary:

1. **No TypeScript for MVP** — plain JS with JSDoc
2. **APScheduler not Celery** — runs in-process, no Redis needed
3. **scikit-learn not PyTorch** — tabular data, GBR is sufficient
4. **Soft-delete reviews** — `is_flagged=True` never hard delete
5. **JWT in localStorage** — acceptable risk for MVP, document trade-offs
6. **PostGIS ST_DWithin** — not Haversine in Python, spatial queries in DB
7. **OpenStreetMap not Google Maps** — zero cost, attribution required
8. **VOA median bands as ML target** — switch to user rents when 50+ reviews
9. **No email verification at launch** — `is_verified` column exists for post-MVP

---

## What NOT to Build Yet

- Payment/subscription system
- Email verification (schema ready, logic deferred)
- Landlord-side dashboard
- Mobile app (PWA via React)
- Redis caching layer
- Elasticsearch

---

## Score Formulas (single source of truth)

### Safety Score (computed in `score_service.py`, NOT stored in DB)
```python
CATEGORY_WEIGHTS = {
    "violent-crime": 3.0, "robbery": 2.5, "anti-social-behaviour": 2.0,
    "burglary": 2.0, "drugs": 1.5, "public-order": 1.5,
    "vehicle-crime": 1.0, "theft-from-the-person": 1.0
}
weighted_sum = sum(count * CATEGORY_WEIGHTS.get(category, 1.0)
                   for category, count in sector_crimes.items())
normaliser = 95th_percentile_across_all_guildford_sectors
safety_score = max(0, min(100, 100 - (weighted_sum / normaliser * 100)))
```

### Rent Fairness Score (computed in `score_service.py` / `ml/predict.py`)
```python
ratio = actual_rent / predicted_rent
# ratio ≤ 0.85  → score 90-100 "Excellent deal"      green
# ratio ≤ 1.00  → score 70-89  "Below market"         green
# ratio ≤ 1.10  → score 55-69  "At market rate"       amber
# ratio ≤ 1.25  → score 35-54  "Slightly above market" amber
# ratio ≤ 1.40  → score 15-34  "Above market"          red
# ratio > 1.40  → score 0-14   "Significantly overpriced" red
```

---

## Session Checklist (run through this every session)

Before starting work:
- [ ] Read `docs/progress.md` — what was done last, what's next
- [ ] Check which files are stubs vs complete (see structure above)
- [ ] State your plan before writing any code

After finishing work:
- [ ] Run `pytest -v` — all tests must pass
- [ ] Run `black . && ruff check .` — no formatting/lint errors
- [ ] Update `docs/progress.md` — mark completed items, add session notes
- [ ] Commit with conventional commit message

---

## Current Build Phase

See `docs/progress.md` for the full checklist.
When starting a session, **read that file first** before writing any code.

docs/design-system.md   ← read EVERY design rule before building any UI