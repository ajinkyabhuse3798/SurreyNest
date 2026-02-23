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
│   │   ├── main.py            ← FastAPI entry point [STUB — needs implementation]
│   │   ├── config.py          ← ✅ Env var loading (complete)
│   │   ├── database.py        ← ✅ SQLAlchemy engine + session (complete)
│   │   ├── models/            ← ✅ All 8 ORM models complete (see below)
│   │   ├── schemas/           ← All Pydantic schemas [STUBS — needs implementation]
│   │   ├── routers/           ← All route handlers [STUBS — needs implementation]
│   │   ├── services/          ← All business logic [STUBS — needs implementation]
│   │   ├── ml/                ← ML pipeline [STUBS — needs implementation]
│   │   └── data_pipelines/    ← ETL jobs [STUBS — needs implementation]
│   ├── data/
│   │   ├── raw/               ← Downloaded source files (gitignored)
│   │   └── processed/         ← Cleaned CSVs (gitignored)
│   ├── tests/
│   │   ├── conftest.py        ← [STUB]
│   │   ├── test_auth.py       ← [STUB]
│   │   ├── test_pipelines.py  ← [STUB]
│   │   ├── test_properties.py ← [STUB]
│   │   └── test_scores.py     ← [STUB]
│   ├── alembic/
│   │   ├── env.py             ← ✅ Complete
│   │   └── versions/
│   │       └── 62efbusz7xg4_initial_schema.py ← ✅ Full schema migration
│   ├── requirements.txt       ← ✅ All dependencies pinned
│   ├── .env.example           ← ✅ Template
│   └── Dockerfile             ← ✅ Production container
└── frontend/
    ├── src/
    │   ├── pages/             ← All pages [STUBS]
    │   ├── components/        ← All components [STUBS]
    │   ├── hooks/             ← useAuth.js [STUB]
    │   ├── services/          ← api.js [STUB]
    │   └── utils/             ← [empty]
    ├── vite.config.js         ← [STUB]
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

## ❌ What Does NOT Exist Yet (stub files only)

These files exist as empty stubs. **Build them in this order** (dependencies first):

### Phase 3 — Backend (current priority)
Build in this exact order:
1. `backend/app/data_pipelines/utils.py` — retry, logging, pipeline_run helpers
2. `backend/app/data_pipelines/epc_pipeline.py` — loads EPC CSV → properties table
3. `backend/app/data_pipelines/hmo_pipeline.py` — loads HMO CSV → hmo_records table
4. `backend/app/services/geocoding_service.py` — cache-first Postcodes.io lookup
5. `backend/app/data_pipelines/crime_pipeline.py` — police.uk → crime_data table
6. `backend/app/data_pipelines/land_registry_pipeline.py` — PPD CSV → processed CSV
7. `backend/app/ml/features.py` — build feature matrix from DB + processed CSVs
8. `backend/app/ml/train.py` — train GBR, save pkl
9. `backend/app/ml/evaluate.py` — MAE/RMSE/R² metrics
10. `backend/app/ml/predict.py` — load model, predict, compute fairness score
11. `backend/app/schemas/` — all Pydantic schemas (user, auth, property, review, score)
12. `backend/app/services/auth_service.py` — password hashing + JWT
13. `backend/app/services/property_service.py` — assemble full property detail
14. `backend/app/services/score_service.py` — safety + fairness score computation
15. `backend/app/main.py` — FastAPI app, CORS, routers, APScheduler lifespan
16. `backend/app/routers/auth.py` — register + login routes
17. `backend/app/routers/properties.py` — search + detail routes
18. `backend/app/routers/hmo.py` — HMO check route
19. `backend/app/routers/scores.py` — safety + fairness score routes
20. `backend/app/routers/reviews.py` — CRUD reviews + admin moderation
21. `backend/tests/conftest.py` + all test files

### Phase 4 — New Data Pipelines (after Phase 3 backend works)
These are NEW files not in the original scaffold — add them:
- `backend/app/data_pipelines/flood_pipeline.py` — EA Environment Agency flood data
- `backend/app/data_pipelines/voa_pipeline.py` — ONS/VOA rent bands

### Phase 5 — Frontend (after backend API is working)
All frontend files need implementation (currently all stubs).

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