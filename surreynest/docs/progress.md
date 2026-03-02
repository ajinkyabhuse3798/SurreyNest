# Build Progress

> Update this file at the END of every Claude Code session.
> The NEXT session MUST read this file FIRST before writing any code.

---

## Current Phase: Phase 6 — New Data Sources

**Last updated:** 2026-03-02
**Session summary:** Added 3 new datasets (Land Registry Price Paid, HPI, IPHRP). Created comprehensive EDA script. Rewrote land_registry_pipeline for multi-year + HPI time-adjustment. Fixed EPC pipeline (tenure normalisation, outlier removal). Removed HMO licence holder name for UK GDPR. Built Check Listing feature.

---

## Phase Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Data Pipelines | ✅ Done | EPC + HMO + crime data in PostgreSQL |
| Phase 2: ML Model | ✅ Done | rent_model_v1.pkl trained and saved |
| Phase 3: FastAPI Backend | ✅ Done | All routers, services, schemas, tests passing |
| Phase 4: React Frontend | ✅ Done | Stitch design integration complete |
| Phase 5: Scheduler | ✅ Done | APScheduler cron jobs + admin endpoints |
| Phase 6: New Data Sources | 🔄 In progress | Land Registry + HPI + IPHRP + Flood done, EPC cleaned |
| Phase 7: Testing | ⬜ Not started | Frontend tests, E2E |
| Phase 8: Deployment | ⬜ Not started | Railway + Vercel |

Status key: ⬜ Not started | 🔄 In progress | ✅ Done | ❌ Blocked

---

## ✅ Phase 1 — Data Pipelines (Complete)

### What was built
- `epc_pipeline.py` — EPC bulk CSV → properties table (UPSERT on uprn), calls geocoding at end
- `hmo_pipeline.py` — HMO register CSV → hmo_records table, is_active flag computed, UPRN matching via address_matcher
- `crime_pipeline.py` — police.uk API for all GU postcodes, 12 months, → crime_data table (bulk ON CONFLICT upsert)
- `land_registry_pipeline.py` — PPD CSV filtered to GU postcodes → area_value_index per postcode → area_values DB table
- `geocoding_pipeline.py` — standalone backfill: queries properties with NULL lat/lng, batch-geocodes via Postcodes.io, bulk-updates
- `utils.py` — `api_call_with_retry()`, `log_pipeline_run()`, rate limit helper
- `geocoding_service.py` — cache-first Postcodes.io lookup (single + batch via `geocode_batch()`)

### Verified row counts
- properties table: _______ rows (expected 8,000–15,000)
- hmo_records table: _______ rows (expected 400–700)
- crime_data table: _______ rows (expected ~50,000+)
- postcode_cache table: _______ rows (expected ~12,000+)

---

## ✅ Phase 2 — ML Model (Complete)

### What was built
- `features.py` — joins properties + hmo_records + crime_data + land_registry, computes distance features
- `train.py` — GBR Pipeline, VOA-band-based target (bedroom × adjustments + noise), saves feature_columns.json
- `evaluate.py` — comprehensive: metrics (MAE/RMSE/R²/MAPE), 5-fold CV, feature importance + residual plots, sanity checks, prediction distribution, generates `evaluation_report.md`
- `predict.py` — `load_model()`, `predict_rent()`, `compute_fairness_score()`

### Model metrics (fill in after training)
- MAE: _______ (target: < £50/week)
- RMSE: _______ (target: < £75/week)
- R²: _______ (target: > 0.65)
- Model version: v1.0.0
- Training dataset size: _______ properties

### Model file location
`backend/app/ml/models/rent_model_v1.pkl` (gitignored — do not commit)

---

## 🔄 Phase 3 — FastAPI Backend (Current)

Build in this exact order. Each item depends on the one above it.

### Critical: use these exact column names from the real models
```
properties:  floor_area_m2, num_rooms, energy_rating (NOT total_floor_area etc.)
hmo_records: raw_address, is_active, max_occupants (NOT hmo_licences)
reviews:     is_moderated, is_flagged (soft delete only)
```

### Step 3.1 — Pydantic Schemas (no DB access, no dependencies)
- [x] `app/schemas/user.py` — `UserCreate` (email + password validator), `UserResponse` (no password fields)
- [x] `app/schemas/auth.py` — `Token`, `TokenData`
- [x] `app/schemas/property.py` — `PropertySearch`, `PropertySummary`, `PropertyDetail`
- [x] `app/schemas/review.py` — `ReviewCreate` (50–1000 chars), `ReviewResponse`
- [x] `app/schemas/score.py` — `SafetyScoreResponse`, `FairnessScoreResponse`

### Step 3.2 — Auth Service
- [x] `app/services/auth_service.py`
  - [x] `hash_password(plain: str) -> str` — passlib bcrypt
  - [x] `verify_password(plain: str, hashed: str) -> bool`
  - [x] `create_access_token(user_id: str, role: str) -> str` — python-jose JWT
  - [x] `get_current_user(token, db)` — decode JWT, fetch user, raise 401 if invalid
  - [x] `require_admin(current_user)` — raise 403 if role != "admin"

### Step 3.3 — Score Service
- [x] `app/services/score_service.py`
  - [x] `compute_safety_score(postcode_sector: str, db: Session) -> dict`
    - Returns `{"score": int|None, "label": str, "available": bool}`
    - Returns null score gracefully if no crime data (not an error)
  - [x] `compute_fairness_score(actual_rent: float, predicted_rent: float) -> dict`
    - Uses formula from `docs/ml-model.md` and `CLAUDE.md`
    - Returns `{"score": int, "label": str, "colour": str, "ratio": float}`

### Step 3.4 — Property Service
- [x] `app/services/property_service.py`
  - [x] `search_properties(postcode: str, radius: int, db: Session) -> list`
    - Geocode via postcode_cache (or Postcodes.io if not cached)
    - PostGIS: `ST_DWithin(geography, ST_MakePoint(lng,lat)::geography, radius)`
    - Join: properties + hmo_records (any active) + crime_data (safety score) + reviews (count + avg)
  - [x] `get_property_detail(uprn: str, db: Session) -> dict`
    - Joins all tables for one property
    - Raises 404 if uprn not found

### Step 3.5 — FastAPI main.py
- [x] `app/main.py`
  - [x] FastAPI app with title "SurreyNest API", version "1.0.0"
  - [x] CORSMiddleware from `settings.allowed_origins`
  - [x] Mount all routers under `/api` prefix
  - [x] `GET /health` → `{"status": "ok", "environment": settings.environment}`
  - [x] Global exception handler: log full traceback, return `{"detail": "Internal server error"}`
  - [x] APScheduler lifespan: start on startup, shutdown on exit (schedules added in Phase 5)
  - [x] slowapi rate limiting: 60/min per IP on GET, 5/hour per user on POST /reviews

### Step 3.6 — Auth Router
- [x] `app/routers/auth.py`
  - [x] `POST /api/auth/register`
    - Check duplicate email → 400 with message "Email already registered"
    - Hash password, insert user, return UserResponse (201)
  - [x] `POST /api/auth/login`
    - Return 401 "Invalid credentials" for BOTH wrong email AND wrong password (never reveal which)
    - On success: update last_login, return Token
  - [x] `GET /api/auth/me` — returns current user (requires auth)
  - [x] `DELETE /api/auth/me` — anonymise reviews (user_id=NULL), delete user row

### Step 3.7 — Properties Router
- [x] `app/routers/properties.py`
  - [x] `GET /api/properties?postcode=GU2+7XH&radius=500`
    - Validate postcode regex: `^[A-Z]{1,2}[0-9][0-9A-Z]?\s*[0-9][A-Z]{2}$`
    - radius options: 250, 500, 1000, 2000 (metres)
    - Returns list of PropertySummary
  - [x] `GET /api/properties/{uprn}` → PropertyDetail or 404

### Step 3.8 — HMO Router
- [x] `app/routers/hmo.py`
  - [x] `GET /api/hmo/check?uprn={uprn}` or `?postcode={postcode}`
    - Check hmo_records for active licence
    - Returns: `{"status": "licensed"|"expired"|"not_found", "record": {...}|null}`

### Step 3.9 — Scores Router
- [x] `app/routers/scores.py`
  - [x] `GET /api/scores/safety?postcode=GU2+7XH` → SafetyScoreResponse
  - [x] `GET /api/scores/rent-fairness?uprn={uprn}&weekly_rent={rent}` → FairnessScoreResponse
    - Calls `predict.predict_rent()` then `score_service.compute_fairness_score()`

### Step 3.10 — Reviews Router
- [x] `app/routers/reviews.py`
  - [x] `GET /api/reviews/{uprn}` — paginated, only `is_moderated=True AND is_flagged=False`
  - [x] `POST /api/reviews/{uprn}` — requires auth, rate limited 5/hour per user
    - Check one review per user per property → 400 if already reviewed
    - New reviews: `is_moderated=False` (not visible until approved)
  - [x] `DELETE /api/reviews/{review_id}` — own review OR admin, sets `is_flagged=True` (never hard delete)
  - [x] `GET /api/admin/reviews/queue` — admin only, returns `is_moderated=False AND is_flagged=False`
  - [x] `POST /api/admin/reviews/{id}/approve` — sets `is_moderated=True`
  - [x] `POST /api/admin/reviews/{id}/reject` — sets `is_flagged=True`

### Step 3.11 — Tests (write alongside each step)
- [x] `tests/conftest.py` — test DB, TestClient, seed user + property + review fixtures
- [x] `tests/test_auth.py` — register, login, JWT, protected routes, admin guard
- [x] `tests/test_properties.py` — search, detail, invalid postcode, 404
- [x] `tests/test_scores.py` — fairness formula, safety score, graceful null
- [x] `tests/test_pipelines.py` — EPC cleaning functions, HMO is_active logic
- [x] `tests/test_reviews.py` — submit, moderate, duplicate prevention, soft delete

**Phase 3 done when:** `pytest -v` exits 0 and `http://localhost:8000/docs` shows all endpoints

---

## ✅ Phase 4 — React Frontend

Build only after Phase 3 backend endpoints are verified in `/docs`.

### Setup
- [x] Vite project exists (package.json ✅)
- [x] `vite.config.js` — add proxy `/api` → `http://localhost:8000` (eliminates CORS in dev)
- [x] Tailwind configured (`tailwind.config.js` + `postcss.config.js`)
- [x] `src/services/api.js` — Axios instance: base URL from env, auth header interceptor
- [x] `src/hooks/useAuth.jsx` — JWT localStorage, login(), logout(), currentUser state

### Pages
- [x] `Home.jsx` — search bar + hero + 3 feature cards + how-it-works
- [x] `SearchResults.jsx` — two-panel: property list (left) + Leaflet map (right)
- [x] `PropertyDetail.jsx` — 4 tabs: Overview | Reviews | Safety | Rights
- [x] `Login.jsx` and `Register.jsx`
- [x] `RightsGuide.jsx` — interactive decision tree
- [x] `AdminDashboard.jsx` — moderation queue (admin guard)

### Components
- [x] `MapView.jsx` — react-leaflet + OSM tiles, CircleMarker per property, colour from fairness score
- [x] `PropertyCard.jsx` — summary card with score dots and HMO badge
- [x] `ScoreBadge.jsx` — colour-coded score dot (green/amber/red)
- [x] `HMOBadge.jsx` — Licensed / Expired / Unknown indicator
- [x] `ReviewList.jsx` — paginated, moderated reviews
- [x] `ReviewForm.jsx` — 4 rating categories + text + optional rent paid
- [x] `SafetyScorePanel.jsx` — crime breakdown by category
- [x] `Navbar.jsx` — auth-aware links

**Phase 4 done when:** ~~Can search postcode → see map + list → click property → see all scores → submit review~~ ✅ All components built, `npm run build` passes, dev server renders all pages.

---

## ✅ Phase 5 — Scheduler

- [x] `app/data_pipelines/scheduler.py`
  - [x] APScheduler AsyncIOScheduler with CronTrigger
  - [x] Jobs: crime (nightly 3am), HMO (weekly Mon 2am), EPC (monthly 1st 2am), Land Registry (monthly 1st 3am)
  - [x] Each job: wraps `run_pipeline_with_tracking` → writes `pipeline_runs` record
  - [x] ThreadPoolExecutor to run sync pipelines off async event loop
  - [x] Start in FastAPI lifespan (wired in main.py)
- [x] `GET /api/admin/pipelines/status` — last run per pipeline (admin only)
- [x] `POST /api/admin/pipelines/{name}/trigger` — manual trigger (admin only)

---

## 🔄 Phase 6 — New Data Sources

New pipelines and data integrations.

### Land Registry Price Paid (Multi-Year + HPI)
- [x] `eda_all_datasets.py` — comprehensive EDA across all 7 datasets
- [x] `land_registry_pipeline.py` — rewritten: globs pp-*.csv files, filters GU1-5+GU7, removes outliers (£30k-£3M), HPI time-adjusts to current market, computes implied weekly rent at 4% yield, aggregates 2,515 postcodes
- [x] HPI integration: Guildford-specific monthly index (Jan 1995 – Dec 2025), mean adjustment factor 1.016
- [x] IPHRP: South East rental index loaded (informational, not used in model features)
- [x] Processed data: `data/processed/land_registry_guildford.csv` (2,515 rows)
- [x] DB upsert: 2,515 area_value entries updated with real sale-price-derived values

### EPC Pipeline Fixes
- [x] Tenure normalisation: `rented (private)` → `rental (private)`, `rented (social)` → `rental (social)`
- [x] Outlier removal: `floor_area_m2 < 10` (3 rows) and `num_rooms > 15` (6 rows)

### Privacy / GDPR
- [x] Removed HMO licence holder name from frontend display and backend API

### Check Listing Feature
- [x] `POST /api/listings/check` — paste SpareRoom/Rightmove URL → extract postcode → show analysis
- [x] Frontend page: `CheckListing.jsx` with URL input and results dashboard

### Flood Risk (Environment Agency)
- [x] New model: `app/models/flood_risk.py` → `flood_risk` table
- [x] Migration: `e2f3a4b5c6d7_add_flood_risk.py`
- [x] `app/data_pipelines/flood_pipeline.py` — EA API, GU postcodes → flood_risk table

### Data Folder Structure
```
backend/data/raw/
├── land_registry/     ← pp-2021.csv to pp-2025.csv (5 files, ~800MB total)
├── hpi/               ← UK-HPI-full-file-2024-12.csv + 2025-12.csv
├── iphrp/             ← iphrpreferencetable...xlsx
├── certificates.csv   ← EPC data
└── voa_rental_stats_2024.csv
```

---

## ⬜ Phase 7 — Testing

Full test suite across all phases.

- [ ] All Phase 3 tests passing (see Phase 3 checklist)
- [ ] Pipeline integration tests
- [ ] Frontend Vitest component tests (Navbar, PropertyCard, ScoreBadge)
- [ ] E2E test: search → detail → review

---

## ⬜ Phase 8 — Deployment

See `docs/deployment.md` for full instructions.

- [ ] Supabase or Railway PostgreSQL provisioned
- [ ] PostGIS extension enabled on production DB
- [ ] `alembic upgrade head` run on production
- [ ] All env vars set in Railway dashboard
- [ ] Backend deployed: `railway up`
- [ ] Frontend deployed: `vercel --prod`
- [ ] VITE_API_URL set to Railway backend URL
- [ ] ALLOWED_ORIGINS updated to Vercel domain
- [ ] Production pipelines run: EPC → HMO → crime → land_registry
- [ ] ML model trained on production DB
- [ ] End-to-end smoke test on production URLs

---

## Blockers & Issues

*Record anything blocking progress here:*

| Date | Issue | Status |
|------|-------|--------|
| 2026-02-24 | EPC pipeline not populating lat/lng — search returns 0 results (ST_DWithin requires coords) | ✅ Fixed — geocoding_pipeline.py backfills, epc_pipeline.py calls geocoding at end |
| 2026-03-02 | ML model circular dependency: `implied_weekly_rent` is BOTH a training feature AND the training target in MODE C. Model learns to echo back the feature; all other features become irrelevant. Changing datasets has no effect on predictions. | ❌ NOT FIXED — model must be retrained with `implied_weekly_rent` removed from features (use it as target only) |
| 2026-03-02 | `area_value_index` is never passed to `predict_rent()` in `score_service.py`. Every prediction uses the neutral default (0.5) regardless of property location. | ❌ NOT FIXED — add `area_value_index` to features dict in `score_service.py` get_rent_prediction() |
| 2026-03-02 | 4% yield formula systematically underestimates GU1 rents. Actual Guildford yields near town centre (GU1) are 3–3.5% because prices rose faster than rents. Model inherits this underestimate as its training signal. | ❌ NOT FIXED — fix yield rate to 3.5% OR switch training target to VOA actual rent bands instead of yield-derived |
| 2026-03-02 | Stale prediction cache: `rent_predictions` table caches old wrong values. Even after retraining, properties already in cache serve the old prediction unless `ml_model_version` in `.env` is bumped. | ❌ NOT FIXED — bump ML_MODEL_VERSION in .env after every retrain |

---

## Notes for Next Session

*Always fill this in before ending a session:*

```
Session 5 — 2026-03-02
Last thing done:
  - Diagnosed ML model producing wrong (too low) rent predictions for GU1 properties
  - Found 3 critical bugs in train.py / score_service.py (documented in Blockers above)
  - Updated progress.md and CLAUDE.md with all bugs and prevention rules

CRITICAL: ML model is broken. Do NOT mark Phase 2 as complete until all 3 bugs are fixed.

Next step for next session (in this exact order):
  1. Fix score_service.py: add `area_value_index` to features dict in get_rent_prediction()
  2. Fix train.py MODE C: remove `implied_weekly_rent` from training feature columns
     (use as target only — not both feature AND target)
  3. Fix yield rate in land_registry_pipeline.py: change 4% to 3.5% for GU1 accuracy
  4. Retrain model: docker exec surreynest-backend python -m app.ml.train (will auto-detect MODE C)
  5. Bump ML_MODEL_VERSION in backend/.env (e.g. v2.0.0) to invalidate stale prediction cache
  6. Verify: check 9a Epsom Road GU1 prediction is in £350-500/week range
  7. Phase 7 — Testing
  8. Phase 8 — Deployment

Gotchas to remember:
  - Land Registry PP files have NO headers (use COLUMN_NAMES list)
  - HPI has Guildford-specific rows (RegionName=Guildford)
  - IPHRP is regional (South East), not Guildford-specific
  - Price Paid file for 2025 is named "pp-2025 (1).csv" (space + parens)
  - EPC tenure: normalised now, rented → rental
  - HMO licence_holder removed from API response and frontend
  - implied_weekly_rent MUST NOT be a training feature when it IS the training target (circular)
  - Always bump ML_MODEL_VERSION in .env after every retrain to flush stale cache
```
