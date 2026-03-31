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

**Target users:** University of Surrey students and Guildford renters.

**Business model:** Fully free public web app for now — focus on useful housing intelligence first.

---

## Tech Stack (never deviate from this)

| Layer | Choice | Why |
|-------|--------|-----|
| Backend | **Python 3.11 + FastAPI** | Async, auto OpenAPI docs at /docs, easy ML integration |
| Frontend | **React 18 + Vite + TailwindCSS** | Fast dev, component reuse |
| Database | **PostgreSQL 15 + PostGIS** | Spatial radius queries via ST_DWithin |
| ML | **scikit-learn + pandas + joblib** | Tabular data, no GPU needed |
| Ops access | **`X-Internal-Admin-Key`** on internal routes | Keeps the public app auth-free while preserving moderation/pipeline controls |
| Maps | **Leaflet.js + react-leaflet + OpenStreetMap** | 100% free, no Google Maps API |
| Jobs | **APScheduler** inside FastAPI | No separate Celery/Redis for MVP |
| Deployment | **Railway.app** / **Render** / **Hetzner VPS** + **Cloudflare Pages** (frontend) | See `docker-compose.prod.yml` |

**All external APIs are free.** See `docs/api-reference.md` for full list.

---

## Project Structure

```
surreynest/
├── CLAUDE.md
├── README.md
├── docker-compose.yml
├── docker-compose.prod.yml
├── docs/
│   ├── api-reference.md
│   ├── conventions.md
│   ├── data-dictionary.md
│   ├── decisions.md
│   ├── deployment.md
│   ├── ml-model.md
│   ├── progress.md
│   └── release-tonight.md
├── backend/
│   ├── app/
│   │   ├── main.py            ← FastAPI app, router mounts, health endpoint
│   │   ├── config.py          ← env loading + production validation
│   │   ├── database.py        ← SQLAlchemy engine/session/base
│   │   ├── rate_limit.py      ← shared SlowAPI limiter singleton
│   │   ├── cache.py           ← Redis-backed caching helpers
│   │   ├── models/            ← property, review, HMO, flood, agent, pipeline, user legacy tables
│   │   ├── schemas/           ← agent, listings, property, rent_challenge, review, score, admin_schemas
│   │   ├── routers/           ← stats, properties, hmo, scores, safety, rent_explain, reviews, listings, heatmap, rent_trends, leaderboard, agents, rent_challenge, pipelines
│   │   ├── services/          ← score_service, property_service, safety_intelligence, listing_compliance_service, agent_service, rent_challenge_service, internal_admin
│   │   ├── ml/                ← train/evaluate/features/predict + calibration helpers
│   │   ├── data_pipelines/    ← EPC, HMO, crime, flood, VOA, geocoding, scraped-rent, scheduler jobs
│   │   └── utils/
│   ├── alembic/
│   ├── tests/
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   ├── .env.example
│   └── Dockerfile
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── src/
    │   ├── App.jsx
    │   ├── main.jsx
    │   ├── index.css
    │   ├── __tests__/App.test.jsx
    │   ├── components/        ← agent, home, property, rent, rent_challenge, safety, search, ui, plus shared top-level components
    │   ├── hooks/             ← useCompare.jsx, useSearch.jsx
    │   ├── pages/             ← Home, SearchResults, PropertyDetail, CompareProperties, About, CheckListing, StreetSmarts, SafetyOverview, SafetyDetail, RentDetail, RightsGuide, AgentDirectory, AgentDetail, RentChallengePage, NotFound
    │   ├── services/          ← api.js, propertyApi.js, scoreApi.js, hmoApi.js, heatmapApi.js, safetyApi.js, agentApi.js, rentChallengeApi.js
    │   ├── test/setup.js
    │   └── utils/
    ├── vite.config.js
    └── package.json
```

---

## ✅ What Is Already Built (NEVER modify without explicit instruction)

### Complete and Tested
- `backend/app/config.py` — Settings singleton, dotenv loading, production validation
- `backend/app/database.py` — SQLAlchemy engine, SessionLocal, Base, get_db dependency
- `backend/alembic/env.py` — Alembic wired to settings.database_url
- `backend/alembic/versions/62efbusz7xg4_initial_schema.py` — Full initial migration

### Current Feature Highlights
- **Property intelligence** — public search, property detail, comparison, rent fairness, HMO check, and anonymous moderated reviews
- **Safety surfaces** — postcode-sector safety overview, detailed intelligence, rankings, heatmap, and `/best-streets`
- **Tools** — Check Listing, Agent Tracker, and Challenge Rent Increase
- **Rights support** — `/rights` is the core rights guide, and legacy `/check-contract` redirects there

### Key SQLAlchemy Models (all in `backend/app/models/`)
The repo currently has 14 model files. The ones you will touch most often are:

| File | Table | Notes |
|------|-------|-------|
| `property.py` | `properties` | Canonical property record; use **`floor_area_m2`**, **`num_rooms`**, `energy_rating`, `potential_rating`, `built_form` |
| `review.py` | `reviews` | Public anonymous reviews with moderation flags; `agent_name` is present for agent reputation aggregation |
| `hmo_record.py` | `hmo_records` | Guildford HMO register records; `raw_address` and `is_active` matter a lot |
| `crime_data.py` | `crime_data` | Aggregated postcode-sector crime counts by category/month |
| `letting_agent.py` | `letting_agents` | Agent directory reputation aggregates |
| `rent_prediction.py` | `rent_predictions` | Cached model outputs keyed by UPRN/model version |
| `area_value.py` | `area_values` | Sale-price and implied-rent anchor data |
| `rent_history.py` | `rent_history` | Sector/year historical rent series |
| `pipeline_run.py` | `pipeline_runs` | Pipeline execution history |
| `pipeline_config.py` | `pipeline_config` | Cached shared constants/config written by pipelines |
| `postcode_cache.py` | `postcode_cache` | Geocoding cache |
| `flood_risk.py` | `flood_risk` | Environment Agency flood enrichment by postcode |
| `voa_rent_band.py` | `voa_rent_bands` | VOA/ONS reference rent bands |
| `user.py` | `users` | Legacy user table still exists, but the shipped public app has no login/register flow |

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
- Implied weekly rent: `adjusted_price × 3.5% ÷ 52` (changed from 4% to 3.5% in v4.5.0 to reduce GU1 underestimation)
- Output: `data/processed/land_registry_guildford.csv` (2,515 postcodes)
- DB upsert: `area_values` table with `area_value_index` (0.0–1.0)

### HMO Pipeline (`hmo_pipeline.py`)
- `licence_holder` stored in DB but **NOT exposed via API** (UK GDPR)
- `is_active` computed from `expiry_date > today`

### Crime Pipeline (`crime_pipeline.py`)
- police.uk API, all GU postcode sectors, 12 months rolling

### EDA Script (`eda_all_datasets.py`)
- Run: `python -m app.data_pipelines.eda_all_datasets`
- Audits the core raw datasets plus key DB tables, flags anomalies with ⚠️, and checks cross-dataset consistency

---

## API Endpoints — Current List

| Method | Path | Description | Router |
|--------|------|-------------|--------|
| GET | `/api/stats` | Public platform statistics | stats.py |
| GET | `/api/properties` | Search properties by postcode/radius and filters | properties.py |
| GET | `/api/properties/suggest` | Property autocomplete | properties.py |
| GET | `/api/properties/{uprn}` | Property detail | properties.py |
| GET | `/api/hmo/check` | HMO status by `uprn` or `postcode` | hmo.py |
| GET | `/api/scores/safety` | Safety score for a postcode | scores.py |
| GET | `/api/scores/rent-fairness` | Fairness score for a property + weekly rent | scores.py |
| GET | `/api/safety/guildford-overview` | Guildford-wide safety context | safety.py |
| GET | `/api/safety/intelligence` | Full crime analytics for a sector | safety.py |
| GET | `/api/safety/rankings` | Top safest + hotspot areas | safety.py |
| GET | `/api/safety/map` | Map-side sector summary data | safety.py |
| GET | `/api/rent/explain/{uprn}` | Rent-model explainability view | rent_explain.py |
| GET | `/api/reviews/{uprn}` | Property reviews | reviews.py |
| POST | `/api/reviews` | Submit anonymous review | reviews.py |
| DELETE | `/api/reviews/{review_id}` | Hide review (internal key required) | reviews.py |
| GET | `/api/admin/reviews/queue` | Moderation queue (internal key required) | reviews.py |
| POST | `/api/admin/reviews/{review_id}/approve` | Approve review (internal key required) | reviews.py |
| POST | `/api/admin/reviews/{review_id}/reject` | Reject review (internal key required) | reviews.py |
| POST | `/api/listings/check` | Check listing URL | listings.py |
| GET | `/api/heatmap/sectors` | All sector data for heatmap | heatmap.py |
| GET | `/api/rent-trends/{sector}` | Historical rent + forecast | rent_trends.py |
| GET | `/api/leaderboard/streets` | Ranked streets by composite score | leaderboard.py |
| GET | `/api/agents` | Agent list with sector filtering | agents.py |
| GET | `/api/agents/suggest` | Agent name autocomplete | agents.py |
| GET | `/api/agents/{agent_name}` | Agent detail + recent reviews | agents.py |
| GET | `/api/admin/pipelines/status` | Pipeline status (internal key required) | pipelines.py |
| POST | `/api/admin/pipelines/{pipeline_name}/trigger` | Trigger pipeline (internal key required) | pipelines.py |
| POST | `/api/rent/challenge-increase` | Section 13 rent challenge analysis | rent_challenge.py |

---

## Frontend Components — Key Files

| Component | Used On | Notes |
|-----------|---------|-------|
| `GuildfordHeatmap.jsx` | Home page | Leaflet map, 3 layers (rent/safety/HMO), 17 sectors |
| `RentRadarChart.jsx` | PropertyDetail | Recharts AreaChart, 5yr history + 2yr forecast |
| `SearchAutocomplete.jsx` | Home, Search | Input with debounced suggest API |
| `MapView.jsx` | SearchResults | react-leaflet with CircleMarkers |
| `ScoreGauge.jsx` | PropertyDetail | SVG gauge for safety/fairness |
| `CrimeBreakdown.jsx` | PropertyDetail | Category breakdown bar chart |
| `EpcBand.jsx` | PropertyDetail | EPC rating visual band |
| `MarketPulse.jsx` | Home page | Seasonal availability indicator, static data, animated timeline |
| `StreetSmarts.jsx` | /best-streets (page) | Leaderboard with ranked cards, district toggle, score breakdowns |
| `SafetyIntelligence.jsx` | (reusable component) | Crime donut, monthly chart, trend, comparison, student insights |
| `SafetyDetail.jsx` | /safety/:postcode (page) | Full-page safety analytics — 9 sections, data-driven, plain English |
| `RentDetail.jsx` | /rent/:uprn (page) | Full-page rent XAI — waterfall, top factors, model explainer, comparison |
| `safetyApi.js` | (service) | API client for `/api/safety/intelligence` and `/api/safety/rankings` |
| `AgentDirectory.jsx` | /agent (page) | Agent list with reputation scores, sector filter, search |
| `AgentDetail.jsx` | /agent/:name (page) | Agent detail page with score cards, reviews history |
| `CheckListing.jsx` | /check-listing (page) | Listing URL analyzer with risk explanation cards |
| `RentChallengePage.jsx` | /challenge-rent-increase (page) | Section 13 challenge form + verdict + Tribunal brief |

### Navbar Tools Dropdown
The Navbar has a **Tools** dropdown (desktop: hover/click; mobile: expandable section) with three items:
- **Check Listing** → `/check-listing`
- **Agent Tracker** → `/agent`
- **Challenge Rent Increase** → `/challenge-rent-increase`

Legacy `/check-contract` now redirects to `/rights` from `App.jsx`; there is no dedicated contract-checker page in the current app.

---

## Remaining Work

### Next priorities:
1. Expand browser/E2E coverage beyond the current smoke checks
2. Deployment hardening and release-runbook cleanup
3. Seed `letting_agents` table with real agent data from reviews pipeline
4. Decide whether `/check-contract` stays a permanent redirect to `/rights`

---

## Potential Future Enrichments

Flood and VOA data are already wired into the repo, so the external-data backlog is now smaller:
- **Companies House** — company enrichment for agents/landlords if corporate-link analysis becomes a product need
- **More scraped rent ground truth** — still the most valuable data improvement for the ML model
- **University/open civic data** — any reliable free datasets that improve student-specific context without adding account complexity

---

## ML Model — Current State

The rent model loads from `backend/app/ml/models/` and currently resolves to **`v7.0.0`** via `model_metadata.json`.

### Current Artifact Snapshot
- Loaded version: `v7.0.0`
- Feature count: `36`
- Training rows: `497`
- Group count: `11`
- Target column: `actual_market_rent_weekly`
- Evaluation method: `LOSO(11)`
- Current metadata metrics: `MAE £52.75/week`, `RMSE £75.75/week`, `R² 0.8293`, `MAPE 11.53%`
- Interval coverage in metadata: `79.88%`
- `backend/app/ml/models/evaluation_report.md` contains the fuller generated audit, including calibration lift and the 2026-03-26 nested-audit note

### Model Artifacts
- `rent_model_v1.pkl` — fallback artifact name still supported by the loader
- `rent_model_v7.0.0.pkl` — current versioned artifact
- `feature_columns.json` — exact ordered feature list used at inference
- `model_metadata.json` — model version, metric snapshot, feature count, evaluation method
- `sector_rent_map.json` — postcode-sector rent anchors
- `prediction_calibration.json` — calibration artifact applied after raw model output
- `prediction_intervals.json` — interval-width artifact
- `bedroom_classifier_v1.pkl` — bedroom estimator helper model
- `evaluation_report.md` — latest human-readable evaluation summary

### Feature Names (current `feature_columns.json`, 36 total)

```python
# Core numeric features
'floor_area_m2'
'actual_bedrooms'
'rooms_per_m2'
'energy_rating_ordinal'
'potential_rating_ordinal'
'distance_to_town_km'
'distance_to_uni_km'
'distance_to_station_km'
'town_proximity_score'
'uni_proximity_score'
'station_proximity_score'
'accessibility_score'
'safety_score'
'sale_count'
'sector_median_rent'
'has_mains_gas'
'flat_floor_premium'
'annual_energy_cost'
'energy_improvement_gap'
'price_drop_pct'
'is_studio'
'is_student_zone'
'm2_per_bedroom'

# Property type one-hot features
'ptype_Detached'
'ptype_Flat'
'ptype_Semi-Detached'
'ptype_Terraced'

# Built-form one-hot features
'bform_Detached'
'bform_Enclosed End-Terrace'
'bform_Enclosed Mid-Terrace'
'bform_End-Terrace'
'bform_Mid-Terrace'
'bform_NO DATA!'
'bform_Not Recorded'
'bform_Semi-Detached'
'bform_Unknown'
```

### Operational Cautions
- Keep `ML_MODEL_VERSION` in `backend/.env` aligned with the artifact version in `model_metadata.json`. A mismatch will not stop boot, but it will log loudly and invalidate stale cached predictions.
- `feature_columns.json` must match the artifact's expected feature count or startup will fail.
- `prediction_calibration.json` and `prediction_intervals.json` are optional at load time. If missing, the app falls back to raw predictions and/or disables intervals with warnings.
- The single source of truth for inference-time feature building remains `backend/app/ml/predict.py` (`build_prediction_features()`).

---

## Database — Schema Rules

**Alembic is already established and the repo now has multiple follow-up migrations beyond the initial schema.** Treat `62efbusz7xg4_initial_schema.py` as the starting point, not the full current schema.

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

### Pydantic Schemas
- **ALWAYS** define schemas in `app/schemas/` — NEVER inline in router files
- Routers import from schemas: `from app.schemas.leaderboard import LeaderboardResponse`
- This prevents circular dependency risk when other services need to reuse schemas
- Each domain gets its own schema file: `agent.py`, `property.py`, `review.py`, `score.py`, `leaderboard.py`, etc.

### FastAPI Response Models
- **NEVER** return raw `Response()` objects from endpoints that declare `response_model=`
- This bypasses FastAPI's response validation and breaks OpenAPI docs
- Return the declared Pydantic model directly after any side effects are complete
- Example: `def get_stats() -> PublicStats: return PublicStats(...)`

### Internal Ops Access
- The public web app has **no login/register/account flow**
- Internal moderation and pipeline routes use `X-Internal-Admin-Key`
- Configure the key via `INTERNAL_ADMIN_KEY` in `backend/.env`
- If the key is unset, internal endpoints intentionally return `503`

### Internal Moderation + Pipeline Endpoints
- Internal review moderation and pipeline endpoints MUST keep `@limiter.limit("30/minute")` (or stricter)
- Always add `request: Request` as the first parameter when using `@limiter.limit()`
- Import from: `from app.rate_limit import limiter`

### Tests
- **NEVER** connect tests to the production/dev database
- Use `TEST_DATABASE_URL` env var (e.g. SQLite in-memory: `sqlite:///./test.db`)
- `conftest.py` must check `os.environ.get("TEST_DATABASE_URL")` before falling back
- All tests use transactional rollback — but this is defense-in-depth, NOT a substitute for a separate DB

### Frontend Tests (Vitest + React Testing Library)
- Test config lives in `vite.config.js` `test` block (jsdom, globals, setup file)
- Setup file: `src/test/setup.js` (imports `@testing-library/jest-dom`)
- Test files go in `__tests__/` directories next to the code they test
- Mock `framer-motion` in component tests to avoid animation issues
- Mock `api` module for component tests that make API calls
- Run: `npm run test` (single run) or `npm run test:watch` (watch mode)

### Frontend — No Hardcoded Data
- **NEVER** hardcode data that comes from an API (e.g. `TOP_STREETS`, leaderboard rankings)
- Components must fetch live data from the API and handle loading/error states
- Static UI content (labels, icons, steps) is fine in `utils/` data files
- Dynamic data (rankings, scores, statistics) must come from API calls

### Git commits (conventional commits)
- `feat:` new feature
- `fix:` bug fix
- `data:` pipeline or data changes
- `ml:` model changes
- `docs:` documentation only
- `test:` test additions

### Frontend — Component Size (Apple <300 lines rule)
- Page components MUST be **<300 lines** — they are thin orchestrators (state, fetch, composition)
- Visual sections must be extracted into focused sub-components under `components/{domain}/`
- Shared UI primitives go in `components/ui/` (e.g. `Section.jsx`)
- Pure functions (helpers, constants, data) go in `utils/` (e.g. `propertyUtils.js`)
- JSX-containing utility files MUST use `.jsx` extension (Vite requires this for JSX parsing)

### Frontend — React Navigation
- **NEVER** use `window.location.href` for navigation — it causes full page reload and destroys all React state
- Use React Router's `useNavigate()` hook or `<Navigate>` component
- Legacy `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, and `/admin/*` URLs should redirect to `/`
- Keep navigation declarative inside `App.jsx` wherever possible

### Frontend Charts (Recharts)
- **NEVER** use separate `data` props on child `<Area>` or `<Line>` components inside a parent `<AreaChart>`/`<LineChart>`
- **DO** use a single unified dataset on the parent, with separate `dataKey` props on each child
- To show historical + forecast as separate lines: use `historicalRent` and `forecastRent` as keys, set `undefined` for non-applicable years
- Always add `connectNulls={false}` to prevent unwanted line connections across undefined gaps

### Leaflet Maps
- Map height: use Tailwind responsive classes `h-[320px] md:h-[480px]`, NOT `style={{ height: '480px' }}`
- Always check for null postcodes before calling `_extract_sector()` on the backend
- Popups work with tap on mobile — no special handling needed
- Mobile responsive: smaller pills `px-3 py-1.5 text-xs` → `md:px-4 md:py-2 md:text-sm`

- **When adding a context Provider to App.jsx**, verify that at least one component imports and calls the corresponding `useXxx()` hook.
  If no consumer exists yet, do NOT wrap the app — add the provider when the first consumer is built.
  (F4 lesson: `SearchProvider` wrapped the entire app for months while `SearchResults.jsx` managed state locally.)

### Backend Rate Limiting
- Use the SHARED `Limiter()` instance from `app/rate_limit.py`
- NEVER create a new `Limiter()` in individual router files — state won't be shared
- Import: `from app.rate_limit import limiter`

### Security
- Always sanitise `%` and `_` in SQL LIKE/ILIKE queries to prevent wildcard injection
- Use `secrets.compare_digest()` for internal admin key checks
- Never expose raw error messages to users — use generic fallbacks in ErrorBoundary

### Performance — Cache Expensive Constants
- If a value is **identical across all API calls** and only changes when a pipeline runs, it MUST be pre-computed and cached
- Pattern: pipeline writes to `pipeline_config` table → service reads via Redis cache (`app.cache`)
- Example: `safety_normaliser_p95` — 95th-percentile weighted crime sum, written by `crime_pipeline`, read by `score_service`
- Example: `iphrp_growth_pct` — South East IPHRP annual %, written by features pipeline, read by `score_service`
- **NEVER** do full-table scans inside request handlers to compute static constants

### Caching — Always Use Redis (`app.cache`)
- **NEVER** use module-level `_cache = {}` dicts — they reset per-worker in production (`--workers N`)
- **ALWAYS** use `from app.cache import get_json, set_json` for all response/data caching
- Redis handles TTL automatically — no manual `time.time()` tracking needed
- Graceful degradation: if Redis is down, `get_json()` returns `None` (cache miss) — app still works
- Cache keys use namespaced format: `leaderboard:{district}_{limit}`, `heatmap:sectors`, `safety:normaliser_p95`
- For cache invalidation when pipelines refresh data: use `delete_pattern("leaderboard:*")`

### DRY — Feature Engineering (Single Source of Truth)
- All ML feature engineering at inference time MUST go through `predict.py:build_prediction_features()`
- This function is the SINGLE SOURCE OF TRUTH for: distances, energy ordinals, bedroom estimation, rooms_per_m2, one-hot encoding
- **NEVER** duplicate this logic in router files (e.g. `rent_explain.py`) — always import and call `build_prediction_features()`
- If a new derived feature is added, add it ONLY in `build_prediction_features()` so both prediction and XAI stay in sync
- **NEVER** import underscore-prefixed private variables (`_model`, `_feature_columns`, `_log_target`) from `predict.py` or any other module
- To access ML model internals (for XAI, debugging, etc.), use `get_model_internals()` — it returns `model`, `scaler`, `xgb_model`, `feature_columns`, `log_target`, and `feature_defaults` in a dict
- Pipeline structure knowledge (which step is the scaler vs. the estimator) is encapsulated inside `get_model_internals()` — callers never index into `_model.steps[]`

### Pydantic + Redis Cache
- **ALWAYS** call `.model_dump()` on Pydantic models before passing to `set_json()` — `json.dumps(default=str)` converts Pydantic objects to repr strings, not dicts, causing validation failure on cache read (B2 lesson)
- When caching response data that contains Pydantic models, convert the entire structure to plain dicts first

### Import Hygiene
- After refactoring code that removes in-memory caches (like the D5 Redis migration), **verify that all replaced code paths still have the necessary imports** — `time`, `datetime`, etc. (B3 lesson: `time.strftime` was unreachable behind the old cache but became live code after migration)

### React Sub-Component Data Contracts
- When extracting React sub-components, verify the **shape** of props from API responses — never render API response objects `{tip}` directly as React children. Always destructure: `tip.text`, `tip.icon`, etc. (B4 lesson)
- `_normalise_postcode()` from `geocoding_service.py` is for **full UK postcodes only** (7+ chars). NEVER pass postcode sectors or partial strings through it — use simple `upper().strip()` instead (B5 lesson)

### CSS Height Gotchas
- **NEVER** use `height: X%` inside a flex child that has no explicit height — CSS percentage heights resolve to 0 when the containing block has no definite height. Use pixel-based heights instead (B6 lesson)

### Frontend–Backend Field Name Alignment
- When creating React components that consume API data, **always verify the exact field names** from the API response (e.g. `postcode_sector` vs `sector`, `total_crimes` vs `total`). A single field rename breaks rendering silently — no errors, just blank data (B7 lesson)
- When the backend returns enum-like strings (e.g. trend `direction`), ensure the frontend handles **all possible values** — not just a subset. Map synonyms: `'improving'`↔`'decreasing'`, `'worsening'`↔`'increasing'` (B6 lesson)

### Geocoding for Non-Property Contexts
- **NEVER** use property search (`/api/properties?radius=X`) to geocode a postcode — many postcodes have 0 nearby properties. Use Postcodes.io directly (`https://api.postcodes.io/postcodes/{postcode}`) for reliable coords (B8 lesson)

---

## Environment Variables

Backend reads from `backend/.env`. Frontend reads from `frontend/.env.local`.
See `.env.example` in each directory for required keys.

```bash
# Core backend vars
INTERNAL_ADMIN_KEY=replace_me_with_a_strong_random_value
ML_MODEL_VERSION=v7.0.0
REDIS_URL=redis://localhost:6379/0
RATE_LIMIT_SEARCH=60
RATE_LIMIT_REVIEWS=5

# Frontend
VITE_API_URL=http://localhost:8000

# Optional placeholders currently present in config
ANTHROPIC_API_KEY=                 # reserved in config, not used by the shipped public app today
```

---

## Running the Project Locally (Development)

```bash
# Start database + backend + Redis
docker-compose up -d

# Verify containers are running
docker ps | grep surreynest

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

# Run backend tests (install dev deps first)
cd backend && pip install -r requirements-dev.txt && pytest -v

# API docs (development only — disabled in production)
open http://localhost:8000/docs
```

## Running in Production

```bash
# Set required env vars (or create .env.production)
export POSTGRES_PASSWORD=<strong-password>
export INTERNAL_ADMIN_KEY=$(python -c "import secrets; print(secrets.token_urlsafe(32))")
export ALLOWED_ORIGINS=https://your-domain.com
export VITE_API_URL=https://api.your-domain.com
export REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379/0

# Build and start all services
docker-compose -f docker-compose.prod.yml up -d --build

# Run migrations on production DB
docker exec surreynest-backend alembic upgrade head

# Verify health
curl http://localhost:8000/health
# /docs is NOT available in production (ENVIRONMENT=production)
```

---

## Key Architecture Decisions (already made — do not relitigate)

All decisions logged in `docs/decisions.md` (ADR-001 through ADR-012). Summary:

1. **No TypeScript for MVP** — plain JS with JSDoc
2. **APScheduler not Celery** — runs in-process; no separate queue worker is required for scheduled jobs
3. **scikit-learn not PyTorch** — tabular data, GBR is sufficient
4. **Soft-delete reviews** — `is_flagged=True` never hard delete
5. **Public app is auth-free** — no login/register flow in the shipped web app; internal ops use `X-Internal-Admin-Key`
6. **PostGIS ST_DWithin** — not Haversine in Python, spatial queries in DB
7. **OpenStreetMap not Google Maps** — zero cost, attribution required
8. **Observed market rents are the primary ML target** — sector anchors and reference datasets support the model, but `actual_market_rent_weekly` is the canonical target in current metadata
9. **Legacy user records remain, but no public account flow** — `users` table still exists for historical data and future decisions

---

## What NOT to Build Yet

- Payment/subscription system
- Public login/register/account flows
- Landlord-side dashboard
- Mobile app (PWA via React)
- Elasticsearch
- Auto-scheduling `rent_history` population (currently manual via script)
- Choropleth map with real GeoJSON sector boundaries (currently uses CircleMarkers)

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

## Design System (Stitch)

**Always adhere to these guidelines for any UI development:**
- **Primary Color:** `#4F46E5` (indigo-600)
- **Accents:** `emerald-500` (positive/rental), `amber-500` (warning), `rose-500` (negative)
- **Typography:** `Manrope` (primary font for a premium feel)
- **Backgrounds:** `#f8f9fc` (soft blue-gray) for app backgrounds, white for cards
- **Cards & Elements:** `rounded-2xl` or `rounded-xl`, borders: `border-slate-100` to `border-slate-200`
- **Shadows:** Soft, premium shadows (e.g., `shadow-[0_4px_20px_-2px_rgba(80,72,229,0.08)]`)
- **Effects:** Glassmorphism (`bg-white/90 backdrop-blur-lg`) for sticky headers and floating bottom bars
- **Icons:** Lucide React icons
- **Layout:** Mobile-first, but robust desktop scaling (e.g., max-w-7xl containers, split-view for search, multi-column grids for features)

### Property Detail Page
- **Layout:** 2-column `grid lg:grid-cols-[1fr_380px]` — left = data sections (Safety, Cost, RentRadar, Details, HMO, Flood Risk), right = sticky sidebar (Location, Reviews, Rights)
- **Section cards:** White `rounded-2xl` cards with `shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)]`, section headers have indigo-50 icon badges (8×8 `rounded-lg`)
- **Stat cards:** 4 in a row (hero), `shadow-[0_2px_12px_-2px_rgba(80,72,229,0.08)]` + `border-slate-100`
- **Rights cards:** Left indigo border accent `border-l-4 border-indigo-400`
- **Verdict cards:** emerald-50/amber-50/red-50 with matching border
- **Safety section:** Brief only — ScoreGauge + verdict + CTA link to `/safety/:postcode`. **All detailed analytics live on the dedicated SafetyDetail page, NOT on PropertyDetail.**
- **Mobile:** Single-column stacked, all sections in order, stat cards flow-wrapped

### Safety Detail Page (`/safety/:postcode`)
- **Hero:** `bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700`, white text, ScoreGauge inside `bg-white/10 backdrop-blur-sm`, 5-star amber overlay
- **Sections:** Same white `rounded-2xl` cards with indigo-50 icon badge headers (matches PropertyDetail pattern)
- **Data source:** police.uk, updated monthly. All analytics are per postcode sector, not per property.
- **Components used:** CrimeDonut (SVG), MonthlyChart (pixel-height bars), GuildfordComparison (5-star), AreaRankings (safest+hotspots), TrainStations, StudentSafety, HolidayAlert, SafetyTips
- **Language:** Plain English only — no percentiles, no indices, no jargon. Target audience: non-technical students.

### Rent XAI Page (`/rent/:uprn`)
- **Hero:** `bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-700`, white text, predicted rent inside `bg-white/10 backdrop-blur-sm`
- **Waterfall:** Horizontal bars (emerald = pushes rent ↑, rose = pushes rent ↓), max 8 features
- **Top 3 cards:** Gradient from-indigo/emerald/amber backgrounds, numbered badges, plain English explanations
- **Feature deep-dive:** Expandable list; major features (≥3%) shown by default, minor features hidden behind "Show X smaller factors"
- **Rent comparison:** Predicted vs sector median vs Guildford median with ↑/↓ percentage badges
- **Model explainer:** 3-step visual (Collect → Extract → Predict) with icons
- **Cost section on PropertyDetail:** Brief only — rent band + CTA link to `/rent/:uprn`. **Factor pills removed.**

### StreetSmarts Leaderboard
- **Background:** `#f8f9fc`, hero has indigo dot pattern (`opacity-[0.15]`)
- **Top-3 Podium:** 3-column grid, center (#1) card is `lg:scale-105` with `shadow-[0_8px_30px_-4px_rgba(245,158,11,0.25)]` amber glow
- **Rank badges:** gold = `from-yellow-400 to-amber-500`, silver = `from-gray-300 to-gray-400`, bronze = `from-amber-600 to-amber-700`
- **Leaderboard grid:** `lg:grid-cols-2` for ranks 4+, white `rounded-2xl` cards with indigo hover glow
- **Pillars:** 3 only — Safety (emerald), Value (blue), Proximity (violet) — **HMO excluded**
- **Score bars:** Gradient fills with `framer-motion` animation, `h-2 rounded-full`
- **Quick stat pills:** `rounded-full` with colored borders (blue/slate/violet)

### Rent Challenge Page (`/challenge-rent-increase`)
- **Hero:** Indigo gradient, bold "Fight Your Rent Increase" headline
- **Form:** ChallengeForm.jsx — postcode, current rent, proposed rent inputs with validation
- **Results:** VerdictCard (CHALLENGE / BORDERLINE / ACCEPT), ComparablesTable, TribunalBrief (pre-filled text for copy-paste)
- **Challenge strength:** STRONG / MODERATE / WEAK with color coding (rose/amber/emerald)

### Legacy Check Contract Route (`/check-contract`)
- The route is intentionally redirected to `/rights`
- There is no dedicated contract-checker page or backend contract API in the current repo

### Agent Directory Page (`/agent`)
- **List view:** AgentDirectory.jsx — sector filter dropdown, search bar, cards with reputation score badge
- **Detail view:** AgentDetail.jsx — AgentHero (name + score), AgentScoreCards (rating breakdown), AgentReviewCard list
- **Reputation score:** 0–100, computed from `avg_rating × review_count` (reputation-weighted)

---

## Current Build Phase

See `docs/progress.md` for the full checklist.
When starting a session, **read that file first** before writing any code.
This `CLAUDE.md` section is the current design-system reference; there is no separate `docs/design-system.md` file in the repo.
