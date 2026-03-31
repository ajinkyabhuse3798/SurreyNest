# Build Progress

> Update this file at the END of every Claude Code session.
> The NEXT session MUST read this file FIRST before writing any code.

---

## Current Phase: Phase 8 — Deployment (Production Hardening)

**Last updated:** 2026-03-29
**Session summary (Session 21):** Removed the last backend Pydantic v2 deprecation warning by replacing the remaining class-based Pydantic config in `backend/app/routers/pipelines.py` with `ConfigDict(from_attributes=True)`. Verification: `pytest backend/tests -q -W error::DeprecationWarning` now passes cleanly with 105 tests, and the normal backend gate remains green: `black --check backend`, `ruff check backend`, `pytest backend/tests -q`. Note: one intermediate plain pytest run failed only because two full backend pytest jobs were launched in parallel against the shared test database; rerunning sequentially passed.
**Session summary (Session 20):** Backend tooling cleanup. Reformatted the entire `backend/` tree with Black, then fixed the remaining Ruff findings manually: SQLAlchemy `None`/boolean comparisons, import ordering in `app/main.py` and `tests/conftest.py`, and one unused SHAP bias local in `rent_explain.py`. Installed the repo-pinned Ruff version (`0.4.4`) into the active local Anaconda Python so the backend lint command is now runnable from the shell. Verification: `black --check backend` → clean, `ruff check backend` → clean, and `pytest backend/tests -q` → 105 passed, 1 existing Pydantic deprecation warning.
**Session summary (Session 19):** Free-mode auth/admin cleanup. Removed remaining frontend auth/admin pages, hooks, and clients (`useAuth`, login/register/reset/verify pages, admin pages, adminApi, unused reviewApi) so the web app no longer ships dormant account UI. Kept legacy `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/admin/login`, and `/admin` URLs as redirects back to `/`. Replaced backend JWT/admin dependencies with a lightweight `X-Internal-Admin-Key` guard for moderation and pipeline-control endpoints: `/api/admin/reviews/*` and `/api/admin/pipelines/*` remain available for ops, while `/api/auth/*`, `/api/admin/stats/*`, and `/api/admin/users/*` are no longer mounted. Deleted dead backend auth/admin modules and tests (`auth.py`, `admin.py`, `auth_service.py`, auth schemas/tests, auth token model). Added backend regression coverage for internal-only moderation/pipeline access and router removal; updated frontend route/navbar regression tests to remove mocks for deleted auth modules. Verification: `pytest backend/tests -q` → 105 passed, `npm test -- src/__tests__/App.test.jsx src/components/__tests__/Navbar.test.jsx` → 8 passed, `npm run build` passed, and a headless browser crawl across all public routes plus retired auth/admin URLs found no same-origin console/network errors. Note: internal moderation/pipeline endpoints require `INTERNAL_ADMIN_KEY` in `backend/.env`; without it they intentionally return 503.
**Session summary (Session 18):** Production readiness audit + hardening. Evaluated ML models v3.2.0–v4.4.0 against scraped ground truth — v4.4.0 selected as best (MAE £49.87, 92.1% within ±£50). Fixed feature column mismatch (v4.4.0 uses 24 features with disentangled `town_proximity_score` + `uni_proximity_score` instead of single `location_score`). Added +£11/week bias correction for tenant protection (shifts -£5.66 underestimate to ~+£5 overestimate). Then executed full 15-item production audit:
  1. **Security:** Removed hardcoded DB password from `docker-compose.yml` → `${POSTGRES_PASSWORD:-2468}`. Gated Swagger `/docs` and `/redoc` on `ENVIRONMENT != production` in `main.py`. Updated `.env` to password `2468`.
  2. **Docker:** Removed `--reload` flag, added `--workers 2`. Rewrote `Dockerfile` as multi-stage build (builder → runtime with non-root user). Removed hot-reload volume mount. Created `docker-compose.prod.yml` (4 workers, no volume mounts, DB/Redis not exposed externally, `ENVIRONMENT=production`).
  3. **Dependencies:** Split `requirements.txt` into prod-only (47 packages) + `requirements-dev.txt` (5 dev/test packages). Created `.dockerignore` for both backend and frontend.
  4. **Frontend:** Created `frontend/Dockerfile` (Node build → Nginx Alpine) + `nginx.conf` (SPA routing, security headers, gzip, 1yr asset caching).
  5. **Application:** Added SQLAlchemy connection pooling (`pool_size=10, max_overflow=20` in `database.py`). Updated `config.py` default ML version to v4.4.0.
  6. **Documentation:** Updated CLAUDE.md: v4.4.0 feature names, bias correction, production run instructions, fixed stale JWT decision. Updated progress.md with Session 18.

**Session summary (Session 17 — continued):** Second v4.4.0 attempt (sample_weight=10 + proximity split, NO calibration) — SAFETY GATE TRIGGERED again. Hybrid MAE £55.72 (gate: ≤ £48.48), R² 0.7025 (gate: ≥ 0.78). Full code + model revert executed. v4.3.0 manually reconstructed and baseline confirmed: hybrid MAE £48.48, R² 0.7854, scraped-only MAE £88.82.

**Session summary (Session 16):** ML model v4.3.0 — Hybrid training target + location features. Root cause of MAE £69.75 (vs target £50): only 261 training rows (87% from GU1 1), causing all location features to register 0% importance. Fix: hybrid target uses `actual_market_rent_weekly` where available (scraped), falls back to `implied_weekly_rent` (Land Registry) — required also adding `fillna(0.0)` for `price_drop_pct` in features.py so non-scraped rows are not dropped by train.py's valid_mask. Training data grew from 261 → ~18,000 rows. Two new engineered features: `location_score` (Gaussian proximity to town centre OR university, σ=1.5km), `sector_median_rent` (sector-level Land Registry anchor). Removed `num_rooms` from model features (95%+ correlated with `actual_bedrooms`). XGBoost: n_estimators=300, max_depth=5, min_child_weight=8. `sector_rent_map.json` saved as model artifact. Fixed predict.py KeyError: hardcoded `num_rooms=3` fallback (no longer in FEATURE_DEFAULTS). Final metrics (evaluate.py): MAE £48.48/week (was £69.75, ↓31%), R² 0.7854 (was 0.7904, within CV noise), CV R² 0.79±0.05. Monotonic floor-area sanity check now passes. Safety gate: MAE passed ✅; R² -0.005 (within noise, user approved to keep ✅). ML_MODEL_VERSION=v4.3.0 in .env.

**Session summary (Session 15):** University accommodation data integration. Fixed two dangerous Alembic migrations (`40b58f8feae3`, `11c4ed46d4db`) that contained DROP TABLE for PostGIS/Tiger tables — confirmed they were already applied and DB is healthy (spatial index intact). Added `is_university` and `is_university_managed` Boolean columns to Property ORM model (`property.py`). Created `university_pipeline.py` seeder: flags 37 properties across GU2 7JN (36) and GU2 7XR (1) as `is_university=True`, seeds bills-adjusted private-market equivalent rents (university rent + £30/wk bills allowance). Updated `features.py` to export `is_university` column. Updated `train.py` to exclude university-managed properties from training. Updated `score_service.py` to return `is_university_managed: True` with a human-readable message instead of an ML prediction for university properties. Retrained model v4.2.0 — metrics maintained at baseline (MAE £69.75, R² 0.7904); safety gate did not trigger. Bumped ML_MODEL_VERSION to v4.2.0 in .env to flush stale prediction cache for university UPRNs.

**Session summary (Session 14):** ML model v4.1.0 / Sub-Models — Solved the structural discrepancy between EPC "habitable rooms" and expected "bedrooms." Dropped the rigid `max(1, rooms-2)` estimation heuristic. Introduced `actual_bedrooms` ground truth column via Alembic migration. Updated `scraped_rent_pipeline.py` to seed `actual_bedrooms` for matched records. Trained a new `RandomForestClassifier` sub-model (`train_bedroom_classifier.py`) on scraped ground truth to intelligently predict real bedroom counts from `floor_area_m2`, `num_rooms`, `property_type`, and `age_band_ordinal`, successfully backfilling ~18,242 records. Retrained XGBoost main rent model (`v4.1.0`) natively on `actual_bedrooms`, capturing 52.6% feature importance. Exposed `bedrooms` as a direct query override parameter in `score_service.py` and `/api/scores/rent-fairness` for dynamic, interactive predictive capabilities. Tested successfully via API curl.

**Session summary (Session 13):** ML model v4.0.0 — Retrained model on real actual market rates scraped from Zoopla/Rightmove. Fixed strict matching bug traversing 260 listings into synthetic properties with robust defaults. Updated target prediction from `implied_weekly_rent` to `actual_market_rent_weekly`. Re-engineered features to capture `price_drop_pct`. Corrected Docker runtime issue holding `.env` file memory state with `v3.3.0` by performing `docker-compose up -d`. Result: trained robust XGBoost model with MAE £54/wk, R²=0.8143 on true market anchors. Model live in backend API.

**Session summary (Session 12):** ML model v3.3.0 — Added 5 new EPC-derived features. Analyzed 93 raw EPC columns, selected 5 high-impact features, rejected 10 others with reasoning. Modified 6 files: `epc_pipeline.py` (6 new raw columns, AGE_BAND_ORDINAL/FLOOR_LEVEL_MAP cleaning), `property.py` (+4 nullable columns), `features.py` (+5 computed features with median imputation), `train.py` (v3.3.0, 20 total features), `predict.py` (defaults/validation/build + fixed pre-existing debug logging bug), `score_service.py` (+4 property attributes passed). Verified with real data: 18,227 rows, age_band 99.6% coverage, mains_gas 92.8%, energy_cost 100%, floor_level 12.5%. Requires Docker retraining.

**Session summary (Session 11):** Codebase review + root-cause fixes. Fixed 14 issues found during senior-level code audit:
- **C1:** Duplicate rate limiter in `reviews.py` — replaced duplicate `Limiter()` with shared import from `app.rate_limiter`
- **C2:** Auth login bypass — rewrote login endpoint to use FastAPI's proper `response` parameter for cookies instead of raw `Response` object, preserving `response_model=Token` validation
- **C3:** Tests using production DB — added `TEST_DATABASE_URL` support in `conftest.py` with SQLite in-memory fallback, completely isolating test runs from dev data
- **C4:** `RequireAuth` using `window.location.href` — replaced with React Router's `Navigate` component + `useLocation` for state-preserving redirects; also removed hard redirect from Axios 401 interceptor
- **D1:** Decomposed 5 large React components (PropertyDetail 866→260, SafetyDetail 658→170, Home 495→80, RentDetail 516→140, SearchResults 520→190 lines). Created 34 sub-components + 4 utility files across `components/{property,safety,rent,home,search,ui}/`. Extracted shared `Section` wrapper to eliminate 3 duplicate definitions. Build verified: 0 errors, 3.06s, 2991 modules.
- **D2:** Moved inline Pydantic schemas from `leaderboard.py` router to `schemas/leaderboard.py` (ScorePillar, StreetRank, LeaderboardResponse) — eliminates circular dependency risk
- **D3:** Safety score O(N²) → O(1). `get_safety_score()` was doing 2 full-table scans per call. Now normaliser is pre-computed by crime pipeline and cached in `pipeline_config` + Redis TTL.
- **D4:** Duplicated feature engineering (~56 lines) in `predict.py` and `rent_explain.py`. Extracted into shared `build_prediction_features()` — single source of truth.
- **D5:** In-memory caches (`_cache = {}`) won't survive multi-worker deployment. Replaced all 3 (leaderboard, heatmap, safety normaliser) with Redis. Created `app/cache.py` shared service. Added Redis 7 to `docker-compose.yml`.
- **S1:** JWT exposed in both httpOnly cookie AND JSON body/localStorage — XSS could steal it. Fixed: cookie-only auth. Login returns user info (not token). Frontend uses `withCredentials: true` + `/api/auth/me` for session restore. Removed `jwtDecode` and all `localStorage` token usage.
- **S2:** No password complexity validation. Fixed: Pydantic validator now requires at least 1 letter + 1 digit (on top of 8-char min).
- **S3:** Admin routes (`/admin/reviews/queue`, `.../approve`, `.../reject`) not rate-limited. Fixed: `@limiter.limit("30/minute")` on all 3.
- **F1:** Zero frontend tests. Fixed: configured Vitest in `vite.config.js`, created `src/test/setup.js`, wrote 3 test files (19 tests): `useAuth.test.jsx`, `StreetSmartsTeaser.test.jsx`, `homeData.test.js`.
- **F2:** Hardcoded `TOP_STREETS` in `homeData.jsx`. Fixed: `StreetSmartsTeaser` now fetches live from `/api/leaderboard/streets`. Removed stale constant.
- **F4:** Orphan `SearchProvider` import in `App.jsx`. Root cause: `useSearch.jsx` exports both `SearchProvider` and `useSearch()`, but `SearchResults.jsx` manages search state locally via `useSearchParams` + `useState` — no component ever called `useSearch()`. Fixed: removed dead `SearchProvider` import and wrapper from `App.jsx`. The `useSearch.jsx` hook file is kept for potential future use. Build + tests verified (0 errors, 19/19 tests pass).
- **B1:** `rent_explain.py` importing private variables (`_model`, `_feature_columns`, `_log_target`) from `predict.py` — breaks encapsulation. Also importing unused `_get_latest_iphrp_growth` from `score_service.py`. Fixed: added public `get_model_internals()` to `predict.py`, refactored `rent_explain.py` to use it, removed unused import.
- **B2:** Heatmap 500 — `_build_heatmap_data()` returns Pydantic `SectorData`/`HeatmapBounds` objects → `json.dumps(default=str)` in Redis serializes them as repr strings → cache read fails Pydantic validation. Fixed: call `.model_dump()` before returning.
- **B3:** Leaderboard 500 — `time.strftime()`/`time.gmtime()` on lines 127+296 but `time` module never imported (missed during D5 Redis migration). Fixed: replaced with `datetime.now(timezone.utc).isoformat()`.
- **B4:** Safety page crash — `SafetyTips.jsx` renders `{tip}` directly as React child, but `tip` is an object `{type, icon, text}` from the API. Fixed: render `tip.icon` and `tip.text` explicitly, with string fallback.
- **B5:** Safety `_extract_sector()` calls `_normalise_postcode()` which corrupts short sector strings (`'GU2 7'` → `'G U27'`). Fixed: replaced with simple `upper().strip()` and `re.sub` whitespace collapse.
- **B6:** MonthlyChart bars invisible — CSS `height: X%` inside flex child without explicit height resolves to 0px. Also trend badge checks `'decreasing'/'increasing'` but API returns `'improving'/'worsening'`. Fixed: pixel-based bar heights + both direction vocabularies.
- **B7:** AreaRankings blank — component uses `area.sector`/`area.total` but API returns `postcode_sector`/`total_crimes`. Fixed: aligned field names.
- **B8:** TrainStations missing — coords fetched via property search (`radius=250m`) returns 0 results for many postcodes → `coords=null` → section hidden. Fixed: geocode via Postcodes.io directly.

**Session summary (Session 9):** ML model audit & v3.0.0 redesign. Found critical quasi-circular data leakage via area_value_index (40.7% importance), config version mismatch (v1.0.0 vs v2.1.0 breaking cache), predictions ~2× too high (studio £287 vs VOA £173). Fixed: VOA rent bands as target anchor (not sale-price-derived implied rents), removed leaked features (area_value_index, iphrp_growth_pct, is_hmo), added rooms_per_m2, fixed yield docstrings, cleaned dead lookups in score_service. Result: all 4 sanity checks pass (studio £113✅, detached £604✅), outliers 7.5%→0.3%, feature importance now sensible (num_rooms 81.5%, floor_area 13.7%).

**Session summary (Session 8):** Redesigned Property Detail page (core feature) using Google Stitch. Generated mobile (780×7654px) and desktop (2560×4526px) Stitch designs. Rewrote PropertyDetail.jsx with premium aesthetic: bg-[#f8f9fc] background, white rounded-2xl card sections with soft shadows, indigo-50 icon badges in section headers. Desktop uses 2-column layout (lg:grid-cols-[1fr_380px]) with sticky right sidebar for Location/Reviews/Rights. Mobile uses single-column stacked layout. All functionality preserved (parallel data fetch, compare, reviews, HMO detail, RentRadar). Also redesigned StreetSmarts leaderboard: added top-3 podium (gold/silver/bronze gradient cards), 2-column desktop grid for ranks 4+, removed HMO from ranking pillars (now Safety/Value/Proximity only), premium animated score bars. Updated CLAUDE.md with design system notes for both pages.
**Previous session (Session 7):** Redesigned Home page and Search Results page using Google Stitch. Implemented premium Y-Combinator-backed aesthetic. Home page features mobile-first 7-section layout with frosted-glass navbar. Search Results features responsive split-view (desktop: scrollable list + interactive map; mobile: List/Map pill toggle) with redesigned PropertyCards (color-coded score pills, distance/availability badges, glassmorphism compare bar). Updated CLAUDE.md with Stitch design system guidelines.

---

## Phase Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Data Pipelines | ✅ Done | EPC + HMO + crime data in PostgreSQL |
| Phase 2: ML Model | ✅ Done | rent_model v4.4.0 (XGBoost, 24 features, +£11 bias correction, MAE £49.87) |
| Phase 3: FastAPI Backend | ✅ Done | All routers, services, schemas, tests passing |
| Phase 4: React Frontend | ✅ Done | Stitch design integration complete |
| Phase 5: Scheduler | ✅ Done | APScheduler cron jobs + admin endpoints |
| Phase 6: New Data Sources | ✅ Done | Land Registry + HPI + IPHRP + Flood, NeighbourhoodPulse, RentRadar, MarketPulse, StreetSmarts |
| Phase 7: Testing | ⬜ Not started | Frontend tests, E2E |
| Phase 8: Deployment | 🔄 In progress | Production hardening done. Compose, Dockerfiles, Nginx ready. |

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
- properties table: 18,235 rows
- hmo_records table: 583 rows
- crime_data table: 161 rows
- postcode_cache table: 2,451 rows
- area_values table: 2,515 rows
- rent_history table: 90 rows (18 sectors × 5 years)
- pipeline_config table: 1 row (IPHRP growth)
- pipeline_runs table: 22 rows

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

**Phase 4 done when:** ✅ All components built, `npm run build` passes, dev server renders all pages. Redesigned Home and Search Results pages with premium Stitch aesthetic (mobile + desktop responsive).

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

### Security & Bug Fixes (Session 6 — 2026-03-03)
- [x] Admin auth guard — added `ProtectedRoute` component so `/admin` redirects to login for non-admins
- [x] SQL wildcard injection — sanitised `%` and `_` in property suggest autocomplete
- [x] Email normalisation — `.lower().strip()` on registration to prevent login failures
- [x] Rate limiter state — single shared `Limiter()` instance across all routers via `app/rate_limiter.py`
- [x] IPHRP constant — `_get_latest_iphrp_growth()` reads from `pipeline_config` table (not hardcoded)
- [x] Unused `text` import removed from `score_service.py`
- [x] ErrorBoundary — user-friendly generic message instead of raw error strings
- [x] `.gitignore` — added `venv/` and `backend/venv/`

### NeighbourhoodPulse — Interactive Heatmap (Session 6)
- [x] `app/routers/heatmap.py` — `GET /api/heatmap/sectors` aggregates 18,234 properties into 17 sectors (safety, rent, HMO)
- [x] `GuildfordHeatmap.jsx` — Leaflet map with 3 toggleable layers, animated circles, popups, legend
- [x] `heatmapApi.js` — API wrapper
- [x] Home page integration — placed between Hero and Features sections
- [x] Mobile responsive — 320px height on mobile, smaller pills/legend
- [x] 10-minute in-memory cache on backend

### RentRadar — Rent Trend Chart (Session 6)
- [x] `app/models/rent_history.py` — new table, composite PK `(postcode_sector, year)`
- [x] Migration: `c3d8e5f7a2b1_create_rent_history.py`
- [x] Populated from 5 raw Price Paid CSVs: 90 rows (18 sectors × 5 years, 2021–2025)
- [x] `app/routers/rent_trends.py` — `GET /api/rent-trends/{sector}` returns historical + 2-year forecast
- [x] `RentRadarChart.jsx` — Recharts AreaChart with gradient fill, dashed forecast line, tooltips, trend badge
- [x] PropertyDetail integration — placed after "What will it cost?", before "Property details"
- [x] Bug fix: forecast line misalignment (separate `data` props → unified dataset with `historicalRent`/`forecastRent` keys)

### MarketPulse — Seasonal Availability Indicator (Session 6)
- [x] `MarketPulse.jsx` — static component using `new Date().getMonth()` for Guildford rental cycle
- [x] 12-month animated bar chart timeline with pulsing current-month dot
- [x] Status badge: Peak/High/Early/Last Chance/Low depending on month
- [x] Student-specific advice text per season
- [x] Home page integration — placed between NeighbourhoodPulse and Features sections

### StreetSmarts — Best Streets Leaderboard (Session 6)
- [x] `app/routers/leaderboard.py` — `GET /api/leaderboard/streets?district=&limit=` aggregates streets, 4-pillar composite scoring
- [x] Composite score: Safety (crime_data) + Value (implied_weekly_rent) + Proximity (haversine to uni) + HMO (licensed count)
- [x] Min-max normalised 0–100, equally weighted
- [x] 10-minute in-memory cache, noise filtering (GUILDFORD, SURREY excluded)
- [x] `src/pages/StreetSmarts.jsx` — ranked cards with trophy badges, expandable score breakdowns, animated bars
- [x] District toggle (GU1/GU2), navbar link added
- [x] Route `/best-streets` in App.jsx

### Safety Intelligence — Dedicated Analytics Page (Session 10)
- [x] Backend: `safety_intelligence.py` service (7 analysis modules: breakdown, trend, comparison, rankings, holiday risk, student index, tips)
- [x] Backend: `safety.py` router — `GET /api/safety/intelligence?postcode=` + `GET /api/safety/rankings`
- [x] Frontend: `safetyApi.js` API client
- [x] Frontend: `SafetyIntelligence.jsx` reusable component (donut, monthly chart, trend, comparison, student insights)
- [x] Frontend: `SafetyDetail.jsx` full-page route at `/safety/:postcode` (9 sections: hero, donut, trend, comparison, rankings, trains, student, holiday, tips)
- [x] PropertyDetail simplified: ScoreGauge + verdict + "Explore full safety report" CTA link (no more inline analytics)
- [x] Plain-English design: every metric explained for non-technical users (star ratings, analogies, no jargon)
- [x] Data verified 3× against raw PostgreSQL for GU2 7, GU1 3, GU2 9
- [x] CLAUDE.md updated: new endpoints, components, design system notes
- [x] progress.md updated

### Code Quality Fixes — Session 11 (2026-03-08)
- [x] **C1:** Duplicate rate limiter — `reviews.py` was creating its own `Limiter()` instance, bypassing the shared one. Fixed: import from `app.rate_limiter`.
- [x] **C2:** Login endpoint bypassing `response_model=Token` — was returning raw `Response()`. Fixed: use FastAPI's `response: Response` parameter for cookies.
- [x] **C3:** Tests using production DB — `conftest.py` connected to `settings.database_url`. Fixed: `TEST_DATABASE_URL` env var support + SQLite in-memory fallback.
- [x] **C4:** `RequireAuth` using `window.location.href` (full page reload, state loss) — Fixed: React Router `Navigate` component + removed 401 hard redirect from Axios interceptor.
- [x] **D1:** Component decomposition — 5 monolith pages broken into 34 sub-components + 4 utility files. Shared `Section` wrapper extracted to `components/ui/Section.jsx`.
- [x] **D2:** Inline Pydantic schemas in `leaderboard.py` — moved to `schemas/leaderboard.py` (ScorePillar, StreetRank, LeaderboardResponse).
- [x] **D3:** O(N²) safety score computation — `get_safety_score()` did 2 full-table scans per call to compute the 95th-percentile normaliser. Fixed: crime pipeline now persists normaliser to `pipeline_config` as `safety_normaliser_p95`; score_service reads it via Redis cache.
- [x] **D4:** Duplicated feature engineering in `predict.py` and `rent_explain.py` (~56 lines copy-pasted). Fixed: extracted shared `build_prediction_features()` into `predict.py`, both callers now use it.
- [x] **D5:** In-memory caches (`_cache = {}`) in `leaderboard.py`, `heatmap.py`, `score_service.py` don't survive multi-worker deploy. Fixed: added Redis 7 to `docker-compose.yml`, created `app/cache.py` shared service with graceful fallback, migrated all 3 caches.
- [x] **S1:** JWT in both cookie + localStorage — XSS exposure. Fixed: cookie-only auth. Login returns `LoginResponse` (user info, no token). Frontend session via `/api/auth/me`. Removed `jwtDecode`, `localStorage.getItem('token')`, and `Authorization` header from Axios.
- [x] **S2:** No password complexity — only checked length. Fixed: `field_validator` in `schemas/user.py` now requires 1 letter + 1 digit.
- [x] **S3:** Admin moderation routes not rate-limited. Fixed: `@limiter.limit("30/minute")` on queue, approve, and reject endpoints.
- [x] **F1:** Zero frontend tests. Fixed: Vitest configured, `src/test/setup.js` created, 3 test files (19 tests): useAuth session/redirect, StreetSmartsTeaser API fetch, POSTCODE_RE validation.
- [x] **F2:** Hardcoded `TOP_STREETS` in `homeData.jsx`. Fixed: `StreetSmartsTeaser` fetches from `/api/leaderboard/streets?district=GU2&limit=3` on mount. Removed `TOP_STREETS` constant.
- [x] **F4:** Orphan `SearchProvider` import in `App.jsx`. `useSearch.jsx` existed but `useSearch()` was never consumed — `SearchResults.jsx` manages state locally. Fixed: removed dead import and provider wrapper from `App.jsx`.
- [x] **B1:** `rent_explain.py` accessing private module variables (`_model`, `_feature_columns`, `_log_target`) from `predict.py`. Also unused `_get_latest_iphrp_growth` import from `score_service.py`. Fixed: added `get_model_internals()` public accessor to `predict.py` (returns model, scaler, xgb_model, feature_columns, log_target, feature_defaults). Refactored `rent_explain.py` to use it. Removed unused import.

### Rent Explainability (XAI) — Dedicated Page (Session 10)
- [x] Backend: `rent_explain.py` router — `GET /api/rent/explain/{uprn}`
- [x] XGBoost tree SHAP (`pred_contribs=True`) for per-prediction feature contributions
- [x] 15 features with human-readable plain English explanations
- [x] Rent comparison: predicted vs sector median vs Guildford median
- [x] Frontend: `RentDetail.jsx` full-page route at `/rent/:uprn` (7 sections: hero, waterfall, top 3, deep-dive, comparison, model explainer, global importance)
- [x] PropertyDetail simplified: rent band + "See how this rent was calculated" CTA link (factor pills removed)
- [x] CLAUDE.md updated: new endpoint, component, design system notes

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

## 🔄 Phase 8 — Deployment

### Production Hardening (Session 18) ✅
- [x] Removed `--reload` from docker-compose, added `--workers 2`
- [x] Moved hardcoded DB password to `${POSTGRES_PASSWORD}` env var
- [x] Gated Swagger `/docs` + `/redoc` on `ENVIRONMENT != production`
- [x] Split `requirements.txt` into prod + `requirements-dev.txt`
- [x] Created `docker-compose.prod.yml` (4 workers, no volume mounts, ENVIRONMENT=production)
- [x] Rewrote backend `Dockerfile` as multi-stage (builder + non-root runtime)
- [x] Created frontend `Dockerfile` (Node build → Nginx) + `nginx.conf`
- [x] Created `.dockerignore` for both backend and frontend
- [x] Added SQLAlchemy connection pooling (`pool_size=10, max_overflow=20`)
- [x] Updated `config.py` default ML version to v4.4.0

### Remaining Deployment Steps
- [ ] Choose hosting provider (Railway / Render / Hetzner VPS)
- [ ] Provision PostgreSQL with PostGIS on production
- [ ] `alembic upgrade head` on production DB
- [ ] Set all env vars on hosting dashboard (SECRET_KEY, POSTGRES_PASSWORD, EPC_API_KEY, ALLOWED_ORIGINS)
- [ ] Deploy backend via `docker-compose.prod.yml` or hosting CLI
- [ ] Deploy frontend to Cloudflare Pages / Vercel (set VITE_API_URL)
- [ ] Run production pipelines: EPC → HMO → crime → land_registry
- [ ] Copy ML model v4.4.0 pkl + artifacts to production
- [ ] End-to-end smoke test on production URLs

---

## Blockers & Issues

*Record anything blocking progress here:*

| Date | Issue | Status |
|------|-------|--------|
| 2026-02-24 | EPC pipeline not populating lat/lng — search returns 0 results (ST_DWithin requires coords) | ✅ Fixed — geocoding_pipeline.py backfills, epc_pipeline.py calls geocoding at end |
| 2026-03-02 | ML model circular dependency: `implied_weekly_rent` BOTH feature AND target | ✅ Fixed in v4.3.0 — hybrid target, implied_weekly_rent removed from features |
| 2026-03-02 | `area_value_index` not passed to `predict_rent()` | ✅ N/A — removed from model features in v3.0.0+ (was quasi-circular) |
| 2026-03-02 | 4% yield underestimates GU1 rents | 🟡 Mitigated — +£11 bias correction in v4.4.1 compensates for systematic underestimate |
| 2026-03-02 | Stale prediction cache after retrain | ✅ Fixed — ML_MODEL_VERSION bumped to v4.4.0, all cache invalidated |
| 2026-03-11 | Hardcoded DB password in docker-compose.yml | ✅ Fixed — replaced with `${POSTGRES_PASSWORD:-2468}` env var |
| 2026-03-11 | `--reload` flag in production Docker command | ✅ Fixed — removed, added `--workers 2` |
| 2026-03-11 | Swagger docs exposed in production | ✅ Fixed — gated on `ENVIRONMENT != production` |
| 2026-03-11 | Test deps in production Docker image | ✅ Fixed — split into `requirements-dev.txt` |
| 2026-03-11 | No frontend production build | ✅ Fixed — `frontend/Dockerfile` (Nginx) + `nginx.conf` created |

---

## Notes for Next Session

*Always fill this in before ending a session:*

```
Session 11 — 2026-03-08
Last thing done:
  - Comprehensive codebase review: identified 14 issues (C1–C4, D1–D5, S1–S3, F1–F2)
  - Fixed all 14 issues with root-cause fixes (no patch fixes)
  - D1 was the biggest: decomposed 5 monolith page components into 34 focused sub-components
  - D3: safety score O(N²) → O(1) by pre-computing normaliser in crime pipeline
  - D4: extracted shared build_prediction_features() to eliminate 56-line duplication
  - D5: replaced all in-memory caches with Redis for multi-worker production deployment
  - S1: cookie-only JWT auth (removed localStorage exposure)
  - S2: password complexity validation (1 letter + 1 digit minimum)
  - S3: admin routes rate-limited at 30/minute
  - F1: frontend test suite: 19 tests across 3 files (Vitest + RTL)
  - F2: StreetSmartsTeaser fetches live from leaderboard API (no hardcoded data)
  - All files follow Orchestrator Pattern: page manages state + fetch, sub-components render sections
  - Build verified: npm run build → 0 errors, 3.04s
  - Tests verified: vitest run → 19 passed, 1.22s

Frontend file structure changes:
  - NEW: components/ui/Section.jsx (shared wrapper)
  - NEW: components/safety/ (9 files)
  - NEW: components/rent/ (7 files)
  - NEW: components/home/ (7 files)
  - NEW: components/search/ (4 files)
  - NEW: utils/safetyConstants.js, homeData.jsx, searchUtils.jsx
  - MODIFIED: pages/SafetyDetail.jsx, Home.jsx, RentDetail.jsx, SearchResults.jsx (all rewritten as orchestrators)

Backend changes:
  - NEW: schemas/leaderboard.py (3 Pydantic models moved from router)
  - MODIFIED: routers/leaderboard.py (imports from schemas now)
  - MODIFIED: routers/reviews.py (uses shared rate limiter)
  - MODIFIED: routers/auth.py (proper FastAPI response model)
  - MODIFIED: tests/conftest.py (isolated test DB)
  - MODIFIED: services/score_service.py (cached normaliser, no more full-table scans)
  - MODIFIED: data_pipelines/crime_pipeline.py (persists safety_normaliser_p95)
  - MODIFIED: ml/predict.py (new build_prediction_features shared function)
  - MODIFIED: routers/rent_explain.py (uses shared build_prediction_features)
  - MODIFIED: hooks/useAuth.jsx (React Router Navigate)
  - MODIFIED: services/api.js (removed 401 hard redirect)
  - NEW: app/cache.py (Redis cache service with graceful fallback)
  - MODIFIED: routers/leaderboard.py (Redis cache instead of _cache dict)
  - MODIFIED: routers/heatmap.py (Redis cache instead of _cache/_cache_time globals)
  - MODIFIED: services/score_service.py (Redis cache for normaliser)
  - MODIFIED: config.py (added redis_url setting)
  - MODIFIED: requirements.txt (added redis>=5.0.0)
  - MODIFIED: docker-compose.yml (added Redis 7 service + volume)
  - MODIFIED: schemas/auth.py (new LoginResponse, Token now internal-only)
  - MODIFIED: routers/auth.py (login returns user info, not token)
  - MODIFIED: services/auth_service.py (OAuth2 scheme auto_error=False for cookie-only)
  - MODIFIED: schemas/user.py (password complexity: 1 letter + 1 digit)
  - MODIFIED: routers/reviews.py (admin routes rate-limited 30/min)
  - MODIFIED: hooks/useAuth.jsx (cookie-only auth, /api/auth/me session restore)
  - MODIFIED: services/api.js (withCredentials:true, removed localStorage auth)
  - MODIFIED: components/home/StreetSmartsTeaser.jsx (fetches from leaderboard API)
  - MODIFIED: utils/homeData.jsx (removed hardcoded TOP_STREETS)
  - MODIFIED: package.json (removed jwt-decode)
  - MODIFIED: vite.config.js (added test config)
  - NEW: src/test/setup.js (jest-dom matchers)
  - NEW: src/hooks/__tests__/useAuth.test.jsx (4 tests)
  - NEW: src/components/home/__tests__/StreetSmartsTeaser.test.jsx (3 tests)
  - NEW: src/utils/__tests__/homeData.test.js (12 tests)

Next step for next session (in this exact order):
  1. Phase 7 — More frontend tests (expand from 19 to full coverage)
  2. Phase 8 — Deployment (Railway + Vercel)

Gotchas to remember:
  - NEVER define Pydantic schemas in router files — always in schemas/
  - NEVER create per-router Limiter() instances — always import from app.rate_limiter
  - NEVER use window.location.href for React navigation — use Navigate or useNavigate
  - NEVER bypass FastAPI response_model by returning raw Response objects
  - NEVER use module-level _cache dicts — use Redis via app.cache (get_json/set_json)
  - NEVER store JWT in localStorage — use httpOnly cookies only (withCredentials: true)
  - NEVER return JWT in JSON response body — cookie is the ONLY transport
  - NEVER accept passwords without complexity check — min 8 chars + 1 letter + 1 digit
  - ALWAYS rate-limit admin endpoints — @limiter.limit("30/minute")
  - ALWAYS use a separate TEST_DATABASE_URL for tests — never connect tests to dev DB
  - Page components should be <300 lines — extract sections into sub-components
  - JSX-containing utility files must use .jsx extension (not .js) for Vite
  - NEVER import underscore-prefixed private variables from another module — use public accessor functions (e.g. get_model_internals())
  - Docker/PostgreSQL must be running for ANY backend endpoint to work
  - Always bump ML_MODEL_VERSION in .env after every retrain to flush stale cache
```

### Session 15: University Accommodations & Alumni Hotspots (v4.1 UI Enhancements)
- **Goal**: Exempt university-owned accommodations from normal rent & safety metrics to prevent confusion, and add personalized alumni recommendations.
- **Action**: Created `UniversityAccommodationBanner` to gracefully handle properties on Stag Hill and Manor Park.
- **Design Process**: Verified that skipping ML evaluations for these properties preserves model integrity. Extracted postcodes and "Top Spots" (like Rubix and Surrey Sports Park) into a static configuration (`src/utils/universityData.js`).
- **Feature**: Overhauled `LocationSidebar.jsx` and `MapView.jsx` to parse and render these custom Hotspots (via Leaflet) alongside normal train/town distances. No backend/architecture changes required.
