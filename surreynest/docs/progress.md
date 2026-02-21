# Build Progress

> Update this file at the end of every Claude Code session.
> The next session should read this first before touching any code.

---

## Current Phase: Phase 3 — FastAPI Backend (Complete)

**Last updated:** 2026-02-21
**Last worked on:** Session 4 — Built complete FastAPI backend: all schemas, services, routes, auth, reviews, rate limiting. 16/16 tests pass.

---

## Phase Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Data Pipelines | ✅ Done | EPC, HMO, Crime pipelines running; Land Registry stubbed |
| Phase 2: ML Model | ✅ Done | MODE A trained (R² 0.9962); MODE B when VOA data arrives |
| Phase 3: FastAPI Backend | ✅ Done | 11 endpoints, 16 tests passing, rate limiting |
| Phase 4: Auth System | ✅ Done | Merged into Phase 3 — register, login, JWT, role-based guards |
| Phase 5: React Frontend | ⬜ Not started | Depends on Phase 3 |
| Phase 6: Integration | ⬜ Not started | Depends on Phase 4+5 |
| Phase 7: Testing | 🔄 In progress | 16 backend tests passing |
| Phase 8: Deployment | ⬜ Not started | Final phase |

Status key: ⬜ Not started | 🔄 In progress | ✅ Done | ❌ Blocked

---

## Detailed Checklist

### Phase 1: Data Pipelines

#### Setup
- [x] Create project folder structure (all empty files)
- [x] Set up `backend/requirements.txt` with data pipeline dependencies
- [x] Set up `docker-compose.yml` with postgres service
- [x] Create PostgreSQL database locally (run `docker-compose up -d`)
- [x] Set up `backend/.env` from `.env.example`
- [x] Added `xlrd`, `lxml`, `html5lib` to `requirements.txt` (HMO register is HTML disguised as .xls)
- [x] Upgraded Python 3.9 → 3.12.7 (Anaconda) for OpenSSL 3.0.15 (fixed police.uk TLS issue)
- [x] Fixed all 8 SQLAlchemy models for Python 3.9→3.12 compat (`Optional[str]` syntax)

#### EPC Pipeline (`app/data_pipelines/epc_pipeline.py`) ✅
- [x] Download EPC bulk data for Guildford (manual step — `certificates.csv` copied to `data/raw/`)
- [x] Write cleaning function: filter rental tenure
- [x] Write cleaning function: filter post-2018 dates
- [x] Write cleaning function: filter GU postcodes
- [x] Write cleaning function: filter postcode districts to GU1-GU5, GU7 (Guildford core + Godalming)
- [x] Write cleaning function: normalise property_type to 5 categories (Flat, Terraced, Semi-Detached, Detached, Other)
- [x] Write cleaning function: normalise postcode format
- [x] Write cleaning function: cap `floor_area_m2` at 300m² (outlier correction, 3 rows capped)
- [x] Write cleaning function: deduplicate on UPRN (keep latest)
- [x] Save cleaned output to `data/processed/epc_clean.csv`
- [x] Write DB upsert function to `properties` table (ON CONFLICT DO UPDATE on UPRN)
- [x] Verify: **2,801 rows** cleaned and upserted (64,238 raw → 2,801 after filters)

#### HMO Pipeline (`app/data_pipelines/hmo_pipeline.py`) ✅
- [x] ~~Download HMO register CSV~~ → File is `hmo_register_raw.xls` (HTML table, not binary XLS)
- [x] Parse via `pd.read_html()` instead of `pd.read_excel()`
- [x] Write postcode extraction regex (GU area postcodes from address strings)
- [x] Write `is_active` flag computation (expiry_date > today)
- [x] Geocode all postcodes via Postcodes.io batch API (with `postcode_cache` table)
- [x] Write DB insert function to `hmo_records` table
- [x] Verify: **583 rows** (671 raw → 583 after dedup), all geocoded

#### Crime Pipeline (`app/data_pipelines/crime_pipeline.py`) ✅
- [x] Write Postcodes.io geocoding service with DB cache
- [x] Write police.uk API caller with rate limiting (12 req/sec)
- [x] Write 12-month iteration logic (auto-adjusts for API lag)
- [x] Write aggregation by postcode_sector + category
- [x] Write safety score computation formula (weighted categories, 95th percentile normalisation)
- [x] Write DB upsert to `crime_data` table (check-and-insert pattern, no unique constraint)
- [x] Verify: **111 crime data rows** across **23 postcode sectors**
- [x] Sample scores: GU1 1=56.9, GU1 2=89.7, GU2 7=46.6, GU2 8=91.4

#### Land Registry Pipeline (`app/data_pipelines/land_registry_pipeline.py`) 🔄 Stubbed
- [x] Write full cleaning logic (filter GU postcodes, post-2020, compute median per postcode)
- [x] Graceful skip when raw file unavailable (logs warning, returns 0)
- [ ] Download PPD bulk CSV (manual step — to `data/raw/land_registry_ppd_2024.csv`)
- [ ] Run pipeline with actual data

#### Pipeline Utilities (`app/data_pipelines/utils.py`) ✅
- [x] Write `api_call_with_retry()` function (exponential backoff: 1s, 2s, 4s)
- [x] Write `RateLimiter` class (configurable requests/second)
- [x] Write `start_pipeline_run()` / `finish_pipeline_run()` audit functions
- [x] Write `run_pipeline_with_tracking()` wrapper (separate sessions for tracking vs pipeline)

#### Batch Geocoding ✅
- [x] Geocoded all unique EPC postcodes via Postcodes.io batch API
- [x] Updated all 2,801 properties with lat/lng from `postcode_cache`
- [x] Properties with coordinates: **2,801 / 2,801** (100%)

**Phase 1 done when:** All three CSVs clean + data loaded in PostgreSQL, row counts verified ✅

---

### Phase 2: ML Model

#### Feature Engineering (`app/ml/features.py`) ✅
- [x] Load properties from DB (2,801 rows)
- [x] Fill lat/lng from `postcode_cache` table
- [x] Compute `distance_to_town_km` using geopy (Guildford High Street: 51.2362, -0.5704)
- [x] Compute `distance_to_uni_km` using geopy (University of Surrey: 51.2430, -0.5890)
- [x] One-hot encode property_type (ptype_Flat, ptype_Terraced, ptype_Semi-Detached, ptype_Detached)
- [x] Ordinal encode energy_rating (A=6, B=5, ..., G=0)
- [x] Merge crime safety_score per postcode_sector
- [x] Merge is_hmo flag from HMO register
- [x] Handle nulls: drop rows missing floor_area, impute optional with median
- [x] Save `data/processed/features.csv`
- [x] Feature matrix shape: **2,801 × 18**
- [x] `area_value_index` = 0.5 placeholder (until Land Registry data arrives)

#### Training (`app/ml/train.py`) ✅ (MODE A)
- [x] MODE A: Rule-based TEMPORARY_TARGET (floor_area_m2 × £18/m², adjusted for property_type + distance_to_uni_km)
- [ ] MODE B: Map properties to VOA median rents (when `voa_rental_stats_2024.csv` is available)
- [x] Train/test split 80/20 random_state=42
- [x] Build sklearn Pipeline: StandardScaler + GradientBoostingRegressor(n_estimators=200, max_depth=5)
- [x] Serialise to `app/ml/models/rent_model_v1.pkl`
- [x] Model version: v1.0.0

#### Evaluation Results (MODE A) — after data quality fixes
- MAE: **£2.74/week**
- RMSE: **£7.83/week**
- R²: **0.9962**
- Train: 2,240 | Test: 561
- Features: 13 numeric
- Top importances: floor_area_m2 (94.6%), distance_to_uni_km (2.5%), ptype_Flat (1.2%), distance_to_town_km (0.8%)
- Note: Previous run (pre-cleanup) had MAE=£6.45, RMSE=£95, R²=0.75 due to 1,156m² floor area outlier + non-core postcodes

#### Prediction service (`app/ml/predict.py`) ✅
- [x] Write `load_model()` function (loads pkl once on startup)
- [x] Write `predict_rent(property_features: dict) -> dict` function
- [x] `compute_fairness_score(actual, predicted)` in `score_service.py`

**Phase 2 done when:** Model serialised ✅, R² > 0.50 ✅ (0.9962), prediction function returns valid output ✅

---

### Phase 3: FastAPI Backend Core

#### Database Setup
- [x] Install and configure Alembic
- [x] Write all SQLAlchemy models (models/)
- [x] Generate initial migration (revision 62efbusz7xg4) — includes PostGIS extension + GIST index
- [x] Run migration against live DB: `alembic upgrade head`
- [x] Verify: all 8 tables created in PostgreSQL

#### Core API ✅
- [x] `app/main.py` — FastAPI app, CORS, router mounting, startup ML load, global exception handler
- [x] `app/config.py` — env var loading with sensible defaults + ML model settings + rate limits
- [x] `app/database.py` — engine, session factory, get_db dependency
- [x] `GET /api/properties` — PostGIS spatial search with radius, paginated (614 results within 1km of GU2 7XH)
- [x] `GET /api/properties/{uprn}` — full property detail (HMO + reviews + safety score + rent prediction)
- [x] `GET /api/hmo/check?uprn={uprn}` — HMO status lookup with postcode fallback
- [x] `GET /api/scores/safety?postcode={postcode}` — safety score (47.5 for GU2 7)
- [x] `GET /api/scores/rent-fairness?uprn=...&asking_rent=...` — ML prediction + fairness formula
- [x] Verify all endpoints in FastAPI /docs ✅
- [x] Rate limiting via slowapi (60/min properties, 5/hr reviews)

#### Schemas ✅
- [x] `app/schemas/auth.py` — Token, TokenData
- [x] `app/schemas/user.py` — UserCreate (with validators), UserResponse
- [x] `app/schemas/property.py` — PropertyResponse, PropertyDetail, PropertySearchParams/Response
- [x] `app/schemas/review.py` — ReviewCreate, ReviewResponse, ReviewListResponse
- [x] `app/schemas/score.py` — SafetyScoreResponse, RentFairnessResponse

#### Services ✅
- [x] `app/services/geocoding_service.py` — cache-first postcode lookup via Postcodes.io
- [x] `app/services/property_service.py` — search (PostGIS ST_DWithin) + full detail assembly
- [x] `app/services/score_service.py` — safety score + fairness score + cached rent prediction
- [x] `app/services/auth_service.py` — bcrypt hashing, JWT create/verify, role guards

#### Backend Tests ✅ (16/16 passing)
- [x] `tests/conftest.py` — transactional DB sessions, test client, fixtures
- [x] `tests/test_auth.py` — register, duplicate, login, wrong password, 401 without token
- [x] `tests/test_properties.py` — health check, detail, 404, HMO check, missing postcode 422
- [x] `tests/test_scores.py` — safety score, rent fairness validation, fairness formula unit test

#### Dependencies Fixed
- [x] Pinned `bcrypt==4.0.1` in `requirements.txt` (passlib compatibility fix)

---

### Phase 4: Auth System ✅ (Merged into Phase 3)

- [x] `app/routers/auth.py` — POST /api/auth/register (201) + POST /api/auth/login (JWT)
- [x] `app/services/auth_service.py` — hash_password, verify_password, create_jwt
- [x] `app/schemas/auth.py` — Token, TokenData schemas
- [x] `app/schemas/user.py` — UserCreate (email + password validators), UserResponse
- [x] `get_current_user` dependency function
- [x] Applied auth dependency to POST /api/reviews route
- [x] Applied admin role check to DELETE /api/reviews/{id}
- [x] Test: register → login → get token → access protected route ✅

---

### Phase 5: React Frontend

#### Setup
- [ ] Vite project initialised
- [ ] TailwindCSS configured
- [ ] React Router configured in App.jsx
- [ ] Axios instance in services/api.js
- [ ] useAuth hook with localStorage JWT

#### Pages
- [ ] Home.jsx (search bar + hero)
- [ ] SearchResults.jsx (list + map)
- [ ] PropertyDetail.jsx (full detail tabs)
- [ ] Login.jsx
- [ ] Register.jsx
- [ ] RightsGuide.jsx (static decision tree)
- [ ] AdminDashboard.jsx (moderation queue)

#### Components
- [ ] MapView.jsx (Leaflet + OSM)
- [ ] PropertyCard.jsx
- [ ] ScoreBadge.jsx
- [ ] HMOBadge.jsx
- [ ] ReviewList.jsx
- [ ] ReviewForm.jsx
- [ ] SafetyScorePanel.jsx
- [ ] Navbar.jsx

**End-to-end test:** Search postcode → see results on map → click property → see full detail with scores

---

### Phase 6: Integration & Scheduling

- [ ] APScheduler configured in main.py startup
- [ ] All 6 pipeline jobs scheduled (see CLAUDE.md for schedule)
- [ ] Frontend connected to production backend URL
- [ ] CORS configured for production domains

---

### Phase 7: Testing

- [ ] `tests/conftest.py` — fixtures, test DB
- [ ] `tests/test_auth.py` — all auth edge cases
- [ ] `tests/test_properties.py` — search, detail, 404
- [ ] `tests/test_scores.py` — fairness + safety scores
- [ ] `tests/test_pipelines.py` — EPC cleaning, HMO flags
- [ ] Frontend: key component tests with Vitest
- [ ] All tests passing: `pytest -v` exits 0

---

### Phase 8: Deployment

- [ ] Railway.app account created
- [ ] Backend deployed to Railway
- [ ] PostgreSQL database on Railway
- [ ] All env vars set in Railway dashboard
- [ ] Migrations run on production DB
- [ ] Vercel project created
- [ ] Frontend deployed to Vercel
- [ ] `VITE_API_URL` set to Railway backend URL
- [ ] End-to-end test on production URLs
- [ ] Privacy policy page live

---

## Blockers & Issues

*Record anything blocking progress here:*

| Date | Issue | Status |
|------|-------|--------|
| 2026-02-20 | HMO register is HTML table disguised as .xls — needed `pd.read_html()` instead of `pd.read_excel()` | ✅ Resolved |
| 2026-02-20 | Python 3.9 LibreSSL 2.8.3 → TLS handshake fails with police.uk | ✅ Fixed: upgraded to Python 3.12.7 (Anaconda) |
| 2026-02-20 | Python 3.9 doesn't support `str \| None` union syntax in SQLAlchemy models | ✅ Fixed: replaced with `Optional[str]` |
| 2026-02-20 | pandas NaN in INTEGER columns → psycopg2 NumericValueOutOfRange | ✅ Fixed: convert NaN→None before upsert |
| 2026-02-20 | Land Registry PPD data not yet downloaded | 🔄 Pipeline stubbed with graceful skip |
| 2026-02-20 | VOA rental statistics not yet downloaded | 🔄 Using MODE A temp target; MODE B ready |
| 2026-02-21 | 620 properties outside Guildford core (GU8/10/12/16/23/24) | ✅ Fixed: postcode filter now GU1-GU5, GU7 only |
| 2026-02-21 | 1,156m² floor area outlier inflating RMSE to £95 | ✅ Fixed: floor_area capped at 300m² (3 rows capped) |

---

## Notes for Next Session

*Record what you were doing and what to do next:*

```
Session 3 — 2026-02-21
Last thing done: Data quality fixes + pipeline re-run + model retrain.

Data quality fixes applied:
  - Postcode filter: GU1-GU5+GU7 only (dropped GU8/10/12/16/23/24 — 633 non-core rows)
  - Floor area cap: 300m² max (3 rows capped, including 1,156m² outlier in GU5 9AW)
  - Properties cascade-truncated and re-inserted

Pipeline results (after cleanup):
  - EPC: 2,801 rows (was 3,415 → dropped 614 non-core postcodes)
    Breakdown: GU1=1,312 | GU2=923 | GU4=341 | GU3=117 | GU5=102 | GU7=6
  - HMO: 583 rows (re-inserted after cascade truncate)
  - Crime: 111 aggregated rows, 23 sectors (unchanged)
  - Land Registry: stubbed, graceful skip
  - Batch geocoding: all 2,801 properties have lat/lng

ML results (after cleanup):
  - Feature matrix: 2,801 × 18
  - Model: GradientBoostingRegressor, R²=0.9962, MAE=£2.74/week, RMSE=£7.83/week
  - Saved: app/ml/models/rent_model_v1.pkl (v1.0.0, MODE A)
  - Previous metrics (pre-cleanup): R²=0.7484, MAE=£6.45, RMSE=£95.00

Files modified this session:
  - backend/app/data_pipelines/epc_pipeline.py (MODIFIED — postcode district filter + floor area cap)
  - backend/data/processed/epc_clean.csv (REGENERATED)
  - backend/data/processed/features.csv (REGENERATED)
  - backend/app/ml/models/rent_model_v1.pkl (REGENERATED)

Next step:
  1. Download Land Registry Price Paid Data → run pipeline
  2. Download VOA rental statistics → switch to MODE B training
  3. Write app/ml/predict.py (load_model, predict_rent, compute_fairness_score)
  4. Begin Phase 3: FastAPI backend (main.py, routers, services)

Any gotchas discovered (this session):
  - Postcode prefix filter with [:3] slicing fails: GU12→GU1, GU24→GU2 false matches.
    Must extract full outward code by splitting on space.
  - floor_area 1,156m² property (UPRN 10007065368, GU5 9AW) was single-handedly
    inflating RMSE from £7 to £95 — likely commercial building mislabelled in EPC.
  - TRUNCATE CASCADE on properties also drops hmo_records, reviews, rent_predictions.
```
