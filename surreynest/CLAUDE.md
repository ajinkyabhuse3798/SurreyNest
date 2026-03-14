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
| Deployment | **Railway.app** / **Render** / **Hetzner VPS** + **Cloudflare Pages** (frontend) | See `docker-compose.prod.yml` |

**All external APIs are free.** See `docs/api-reference.md` for full list.

---

## Project Structure

```
surreynest/
├── CLAUDE.md                  ← YOU ARE HERE — read every session
├── README.md
├── docker-compose.yml
├── docker-compose.prod.yml    ← Production compose (4 workers, no hot-reload, ENVIRONMENT=production)
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
│   │   ├── models/            ← ✅ All 12 ORM models complete (see below)
│   │   │   └── letting_agent.py  ← NEW: letting agent model
│   │   ├── schemas/           ← ✅ All Pydantic schemas complete
│   │   │   ├── agent.py          ← NEW: agent list/detail schemas
│   │   │   ├── rent_challenge.py ← NEW: Section 13 challenge schemas
│   │   │   └── contract.py       ← NEW: AI contract checker schemas
│   │   ├── routers/           ← ✅ All route handlers complete
│   │   │   ├── agents.py         ← NEW: agent directory + detail endpoints
│   │   │   ├── rent_challenge.py ← NEW: Section 13 analysis endpoint
│   │   │   └── contract.py       ← NEW: AI contract check endpoint
│   │   ├── services/          ← ✅ All business logic complete
│   │   │   ├── agent_service.py         ← NEW: agent reputation scoring
│   │   │   ├── rent_challenge_service.py ← NEW: Section 13 analysis logic
│   │   │   └── contract_service.py      ← NEW: Anthropic-powered contract review
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
│   ├── requirements-dev.txt   ← Dev/test-only deps (pytest, black, ruff, etc.)
│   ├── .env.example           ← ✅ Template
│   ├── Dockerfile             ← ✅ Multi-stage production container (non-root)
│   └── .dockerignore          ← ✅ Excludes tests, raw data, dev files
└── frontend/
    ├── Dockerfile             ← ✅ Node build → Nginx Alpine container
    ├── nginx.conf             ← ✅ SPA routing, security headers, gzip, 1yr asset caching
    ├── .dockerignore
    ├── src/
    │   ├── pages/             ← ✅ All pages are thin orchestrators (<300 lines each)
    │   │   ├── AgentDetail.jsx      ← NEW: agent detail + recent reviews
    │   │   ├── AgentDirectory.jsx   ← NEW: agent list with reputation scores
    │   │   ├── RentChallengePage.jsx ← NEW: Section 13 rent increase challenger
    │   │   └── ContractChecker.jsx  ← NEW: AI tenancy agreement checker
    │   ├── components/        ← ✅ Sub-components organized by domain:
    │   │   ├── ui/            ←   Section.jsx (shared card wrapper)
    │   │   ├── property/      ←   7 sub-components (PropertyHero, SafetySection, etc.)
    │   │   ├── safety/        ←   9 sub-components (SafetyHero, CrimeDonut, etc.)
    │   │   ├── rent/          ←   7 sub-components (RentHero, WaterfallChart, etc.)
    │   │   ├── home/          ←   7 sub-components (HeroSection, TrustBar, etc.)
    │   │   ├── search/        ←   4 sub-components (SearchHeader, FilterBar, etc.)
    │   │   ├── agent/         ←   NEW: AgentHero.jsx, AgentReviewCard.jsx, AgentScoreCards.jsx
    │   │   ├── rent_challenge/ ←  NEW: ChallengeForm.jsx, ComparablesTable.jsx, TribunalBrief.jsx, VerdictCard.jsx
    │   │   └── contract/      ←   NEW: ClauseCard.jsx, ContractInput.jsx, ContractSummary.jsx, OverallRiskBadge.jsx
    │   ├── hooks/             ← ✅ useAuth, useCompare active; useSearch.jsx exists (dormant — not consumed yet)
    │   ├── services/          ← ✅ All API clients complete
    │   │   ├── api.js         ← Axios base instance
    │   │   ├── heatmapApi.js
    │   │   ├── safetyApi.js
    │   │   ├── agentApi.js         ← NEW
    │   │   ├── rentChallengeApi.js ← NEW
    │   │   └── contractApi.js      ← NEW
    │   └── utils/             ← ✅ propertyUtils.js, homeData.jsx, searchUtils.jsx, safetyConstants.js
    ├── vite.config.js         ← ✅ Complete
    └── package.json           ← ✅ All dependencies listed (incl. recharts)
```

---

## ✅ What Is Already Built (NEVER modify without explicit instruction)

### Complete and Tested
- `backend/app/config.py` — Settings singleton, dotenv loading, production validation
- `backend/app/database.py` — SQLAlchemy engine, SessionLocal, Base, get_db dependency
- `backend/alembic/env.py` — Alembic wired to settings.database_url
- `backend/alembic/versions/62efbusz7xg4_initial_schema.py` — Full initial migration

### Three New Features (Session 19)
- **Agent Directory** — Letting agent reputation tracker with review-based scores, sector search, autocomplete, and detail pages
- **Rent Challenge Tool** — Section 13 rent increase analyser: ML prediction + comparables + Tribunal brief generator (Renters' Rights Act 2025)
- **Contract Checker** — AI-powered tenancy agreement reviewer using Anthropic Claude; flags unfair/illegal clauses; falls back gracefully when API key not set

### Complete SQLAlchemy Models (all in `backend/app/models/`)
All 12 models are complete with correct column names — **use these exact names everywhere**:

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
| `area_value.py` | `area_values` | `postcode` (PK), `median_sale_price`, `area_value_index`, `implied_weekly_rent`, `sale_count`, `updated_at` |
| `rent_history.py` | `rent_history` | `postcode_sector` + `year` (composite PK), `median_sale_price`, `implied_weekly_rent`, `transaction_count` |
| `pipeline_config.py` | `pipeline_config` | `key` (PK), `value`, `description`, `updated_at` |
| `letting_agent.py` | `letting_agents` | `id` (UUID), `name`, `postcode_sector`, `review_count`, `avg_rating`, `last_seen` |

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
- Audits all 7 datasets, flags anomalies with ⚠️, checks cross-dataset consistency

---

## API Endpoints — Complete List

| Method | Path | Description | Router |
|--------|------|-------------|--------|
| POST | `/api/auth/register` | Register new user | auth.py |
| POST | `/api/auth/login` | Login, return JWT | auth.py |
| GET | `/api/auth/me` | Current user | auth.py |
| DELETE | `/api/auth/me` | Delete account | auth.py |
| GET | `/api/properties?postcode=&radius=` | Search properties | properties.py |
| GET | `/api/properties/{uprn}` | Property detail | properties.py |
| GET | `/api/properties/suggest?q=` | Autocomplete | properties.py |
| GET | `/api/hmo/check?uprn=` | HMO status | hmo.py |
| GET | `/api/scores/safety?postcode=` | Safety score | scores.py |
| GET | `/api/scores/rent-fairness?uprn=&weekly_rent=` | Fairness score | scores.py |
| GET | `/api/reviews/{uprn}` | Property reviews | reviews.py |
| POST | `/api/reviews/{uprn}` | Submit review | reviews.py |
| POST | `/api/listings/check` | Check listing URL | listings.py |
| GET | `/api/heatmap/sectors` | All sector data for heatmap | heatmap.py |
| GET | `/api/rent-trends/{sector}` | Historical rent + forecast | rent_trends.py |
| GET | `/api/leaderboard/streets?district=&limit=` | Ranked streets by composite score | leaderboard.py |
| GET | `/api/admin/pipelines/status` | Pipeline status | pipelines.py |
| POST | `/api/admin/pipelines/{name}/trigger` | Trigger pipeline | pipelines.py |
| GET | `/api/safety/intelligence?postcode=` | Full crime analytics for a sector | safety.py |
| GET | `/api/safety/rankings` | Top 5 safest + top 5 hotspot areas | safety.py |
| GET | `/api/rent/explain/{uprn}` | XAI: per-prediction SHAP contributions | rent_explain.py |
| GET | `/api/agents?sector=&limit=20` | Agent list with reputation scores | agents.py |
| GET | `/api/agents/suggest?q=` | Agent name autocomplete | agents.py |
| GET | `/api/agents/{agent_name}` | Agent detail + recent reviews | agents.py |
| POST | `/api/rent/challenge-increase` | Section 13 rent challenge analysis | rent_challenge.py |
| POST | `/api/contract/check` | AI tenancy agreement checker | contract.py |

---

## Frontend Components — Key Files

| Component | Used On | Notes |
|-----------|---------|-------|
| `GuildfordHeatmap.jsx` | Home page | Leaflet map, 3 layers (rent/safety/HMO), 17 sectors |
| `RentRadarChart.jsx` | PropertyDetail | Recharts AreaChart, 5yr history + 2yr forecast |
| `SearchAutocomplete.jsx` | Home, Search | Input with debounced suggest API |
| `MapView.jsx` | SearchResults | react-leaflet with CircleMarkers |
| `ProtectedRoute.jsx` | App routing | Auth guard — redirects to login if not authenticated |
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
| `RentChallengePage.jsx` | /challenge-rent-increase (page) | Section 13 challenge form + verdict + Tribunal brief |
| `ContractChecker.jsx` | /check-contract (page) | Paste contract text → AI clause analysis + risk badge |

### Navbar Tools Dropdown
The Navbar has a **Tools** dropdown (desktop: hover/click; mobile: expandable section) with three items:
- **Agent Tracker** → `/agent`
- **Challenge Rent Increase** → `/challenge-rent-increase`
- **Check Contract** → `/check-contract`

These routes are all registered in `App.jsx` and backed by dedicated page components.

---

## Remaining Work

### Next priorities:
1. Phase 7 — Testing (frontend Vitest + E2E)
2. Phase 8 — Deployment (Railway + Vercel / Hetzner)
3. Seed `letting_agents` table with real agent data from reviews pipeline
4. Add `ANTHROPIC_API_KEY` to `.env` to enable live AI contract checking

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

## ⛔ ML Model — Known Issues

### Bug 3: 4% Yield Underestimates GU1 Rents (`land_registry_pipeline.py`)
**Status:** Mitigated — yield changed to 3.5% in v4.5.0. The +£11/week bias correction in `predict.py` further compensates.

### Bug 4: Stale Prediction Cache After Retrain
**Problem:** `score_service.get_rent_prediction()` checks `cached.model_version == settings.ml_model_version`.
If `.env` ML_MODEL_VERSION is not bumped after retraining, old wrong predictions are served from cache.
**Fix:** Always update `ML_MODEL_VERSION` in `backend/.env` after every retrain (e.g. v4.3.0 → v4.5.0).

### Resolved Bugs (kept for history)
- Bug 1: Circular Dependency in MODE C Training — RESOLVED in v4.3.0
- Bug 2: `area_value_index` Missing from Prediction Features — RESOLVED (feature removed from model in v3.0.0+)

---

## ML Model — Feature Names (v4.5.0, exact column names — 25 features)

The ML model uses these features. Column names must match exactly:

```python
# From properties table:
'floor_area_m2'           # property.floor_area_m2

# Derived features (computed at train/predict time, or from database sub-model):
'actual_bedrooms'         # v4.1.0+: EPC-based RF Classifier estimate (not constant 2)
                          # v4.5.0 fix: actual_bedrooms now estimated from EPC floor_area_m2
                          # + num_rooms via RF Classifier, not hardcoded to 2
'rooms_per_m2'            # v3.0.0: num_rooms / floor_area_m2 (space efficiency)
                          # NOTE: num_rooms still used to compute rooms_per_m2 but is
                          # NOT itself a model feature (95%+ correlated with actual_bedrooms)

# From properties table:
'energy_rating_ordinal'   # derived from property.energy_rating (G=0...A=6)
'potential_rating_ordinal' # derived from property.potential_rating

# From properties table (one-hot encoded):
'ptype_Flat', 'ptype_Detached', 'ptype_Semi-Detached', 'ptype_Terraced', 'ptype_Unknown'

# Computed (no DB column — calculated in predict.py):
'distance_to_town_km'     # Haversine to GU1 3AY (51.2362, -0.5704)
'distance_to_uni_km'      # Haversine to Surrey Uni (51.2417, -0.5888)
'distance_to_station_km'  # Haversine to Guildford Station
'town_proximity_score'    # v4.4.0: Gaussian proximity to town, σ=1.5km, [0,1]
'uni_proximity_score'     # v4.4.0: Gaussian proximity to uni, σ=1.5km, [0,1]
'station_proximity_score' # v4.6.0: Gaussian proximity to Guildford station, σ=1.5km, [0,1]
'accessibility_score'     # v4.6.0: max(town, uni, station) — best proximity signal
                          # These replaced the single 'location_score' from v4.3.0

# From crime_data table (aggregated):
'safety_score'            # score_service.compute_safety_score(postcode_sector)

# From processed Land Registry CSV:
'sale_count'              # Market liquidity signal
'sector_median_rent'      # v4.3.0: sector-level implied rent anchor (£/week)
                          # Loaded at inference from sector_rent_map.json (model artifact)

# v3.3.0: new EPC-derived features (from property.construction_age_band etc.):
'age_band_ordinal'        # Construction era, 0=pre-1900, 11=2012+ (from CONSTRUCTION_AGE_BAND)
'has_mains_gas'           # 1=mains gas, 0=off-gas (from MAINS_GAS_FLAG Y/N)
'flat_floor_premium'      # v4.6.0: floor_level_ordinal × ptype_Flat (signal only for flats)
'annual_energy_cost'      # £/year total: HEATING + HOT_WATER + LIGHTING costs from EPC
'energy_improvement_gap'  # potential_rating_ordinal - energy_rating_ordinal (condition proxy)

# v4.0.0: new scraped market features:
'price_drop_pct'          # % price drops on listings (derived from scraping)

# v4.6.0: new interaction features
'is_student_zone'         # GU1/GU2=1 (student-dominated market), else 0
'm2_per_bedroom'          # floor_area_m2 / actual_bedrooms (space generosity per bedroom)

# ⛔ REMOVED from features in v4.6.0:
# 'floor_level_ordinal'   — replaced by flat_floor_premium (floor_level_ordinal × ptype_Flat)

# ⛔ REMOVED from features in v4.4.0:
# 'location_score'        — split into town_proximity_score + uni_proximity_score (v4.4.0)
# 'num_rooms'             — 95%+ correlated with actual_bedrooms → double-counting (v4.3.0)

# ⛔ REMOVED from features in v3.0.0+ (data leakage / zero info):
# 'area_value_index'      — quasi-circular with target (40.7% importance in v2.1.0)
# 'is_hmo'                — 0% importance, inaccurate postcode-level matching
# 'iphrp_growth_pct'      — constant across all rows = zero information
# 'median_sale_price'     — 91.6% correlation with target (removed in v2.1.0)

# ⛔ NOT training features — used as training target:
# 'actual_market_rent_weekly' # v4.0.0+ primary target. NEVER in get_feature_columns()
# 'implied_weekly_rent'   # v4.3.0 fallback target only. NEVER in get_feature_columns()
```

### Model Artifacts (must all exist after retraining)
- `rent_model_v1.pkl` — trained sklearn Pipeline
- `feature_columns.json` — ordered feature list (saved by train.py)
- `model_metadata.json` — version, log_target flag, outlier_cap
- `sector_rent_map.json` — postcode_sector → sector_median_rent map (v4.3.0, NEW)

### Training Target (v4.3.0 hybrid)
`compute_real_target()` in train.py: scraped `actual_market_rent_weekly` first (priority), then
`implied_weekly_rent` fallback. Training data: 261 → ~18,000 rows. This is the canonical training mode.

### Proximity Score Convention (v4.4.0)
In v4.4.0, the single `location_score` was disentangled into two independent features:
`town_proximity_score` and `uni_proximity_score`, both computed inline in
`build_prediction_features()` using the same Gaussian formula (σ=1.5km).
features.py replicates this formula at training time. Both must stay in sync.

### actual_bedrooms Fix (v4.5.0)
In earlier sessions, `actual_bedrooms` fell back to a hardcoded constant of `2` for all ~18k non-scraped
training rows. This meant the model never learned bedroom variation from the bulk of training data.
v4.5.0 fixes this: when `actual_bedrooms` is NULL in the DB, `features.py` now estimates bedrooms from
EPC habitable rooms using the same formula as `estimate_bedrooms()` in `train.py`:
- **Flats:** `max(0, num_rooms - 1)` — subtract 1 living room; studios get 0 bedrooms
- **Houses:** `max(1, num_rooms - 2)` — subtract living room + kitchen; minimum 1 bedroom

`predict.py` does the same at inference time: if `actual_bedrooms` is not provided, it estimates from
`num_rooms` and `property_type`. This keeps train/predict aligned.

**Result:** bedroom distribution in training went from constant 2 → realistic 1–7 range.

### Bias Correction (v4.5.0)
`predict.py` adds a +£11/week bias correction after raw model prediction.
The raw model has a systematic underestimate bias on scraped ground truth.
For tenant protection, slight overestimation is safer. The correction shifts bias to approximately +£5/week.

### Evaluation Metrics (v4.6.0 — current deployed model)

| Metric | v4.5.0 baseline | **v4.6.0 current** | Change |
|--------|-----------------|---------------------|--------|
| Hybrid MAE | £41.59/wk | **£41.76/wk** | ~same |
| Hybrid R² | 0.8123 | **0.8164** | +0.5% |
| Scraped-only MAE | £67.64/wk | **£61.75/wk** | **-8.7%** |
| Scraped-only R² | 0.7150 | **0.7544** | **+5.5%** |

Scraped-only = evaluated on 62 real Zoopla/Rightmove rents = **primary production quality metric**.
Getting to R²>0.85 requires more scraped ground-truth rows (≥10 sectors × ≥5 scraped each).

### Sanity Checks (v4.6.0 state)
- ✅ 34.5m² studio flat → £293/wk
- ✅ 120m² detached house → £458/wk (£350–700/wk range)
- ✅ Type ordering: Flat (£340) < Semi (£374) < Detached (£424)
- ❌ Monotonic floor area — same pre-existing test design issue (GU1 small studio premium)
- ❌ Monotonic floor area with same bedroom count (30m²=£275 > 60m²=£259) — test design issue, not model bug

### ⛔ Session 17 Safety Gate — Failed (lesson learned)
Per-sector calibration (scraped/implied ratio per postcode sector) failed catastrophically:
- Only GU1 1 had ≥5 scraped rows after university exclusion (260 rows)
- Global fallback factor = £460/£312 = 1.469 (scraped £460 = GU1 1 town centre avg; implied £312 = all-sector avg)
- 1.469× applied to ALL non-GU1-1 implied rents → training targets inflated by 47% → hybrid MAE £83.81 (was £48.48)
- GU2 7 had calibration factor 0.656 in evaluate.py but 1.469 in train.py (university exclusion removed GU2 7 scraped rows)
- **DO NOT attempt global calibration** until scraped data covers all sectors adequately (min 10+ sectors with ≥5 scraped each)
- **Second attempt (sample_weight=10 + split location_score, no calibration) ALSO failed**: hybrid MAE £55.72 (gate ≤ £48.48), R² 0.7025 (gate ≥ 0.78). sample_weight shifts model focus away from implied-rent dominated test set.
- **⛔ CRITICAL GIT LESSON**: After two git checkouts, code reverted to an older HEAD state (v4.1.0) that predated v4.3.0 features (location_score, sector_median_rent, price_drop_pct fillna, rooms_per_m2). These were NEVER committed. Always commit the working tree state before attempting major changes — or use git stash.
- **v4.3.0 manually reconstructed** (2026-03-10 session 17 cont): features.py, predict.py, train.py all restored to match the backup pkl. Baseline confirmed: hybrid MAE £48.48, R² 0.7854, scraped-only MAE £88.82.
- **Next safe steps**: (A) scrape more data (need ≥5 scraped/sector for calibration), (B) hyperparameter tuning only, (C) accept v4.3.0 and proceed to Phase 7 testing.

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

### Pydantic Schemas
- **ALWAYS** define schemas in `app/schemas/` — NEVER inline in router files
- Routers import from schemas: `from app.schemas.leaderboard import LeaderboardResponse`
- This prevents circular dependency risk when other services need to reuse schemas
- Each domain gets its own schema file: `auth.py`, `property.py`, `review.py`, `score.py`, `leaderboard.py`, etc.

### FastAPI Response Models
- **NEVER** return raw `Response()` objects from endpoints that declare `response_model=`
- This bypasses FastAPI's response validation and breaks OpenAPI docs
- To set cookies: use `response: Response` as a FastAPI parameter, set cookie on it, then return the Pydantic model normally
- Example: `def login(response: Response) -> LoginResponse: response.set_cookie(...); return LoginResponse(...)`

### Authentication — Cookie-Only JWT
- JWT is stored ONLY in httpOnly cookies — **NEVER** in localStorage, sessionStorage, or JSON response bodies
- Login endpoint returns `LoginResponse` (user info) — NOT the JWT string
- Frontend uses `withCredentials: true` in Axios — browser sends cookie automatically
- Session restore: `GET /api/auth/me` on mount — **NEVER** decode JWT client-side with `jwtDecode`
- `oauth2_scheme` has `auto_error=False` so cookie-only requests work without `Authorization` header
- `get_current_user()` priority: httpOnly cookie → Authorization header (for API clients/tests) → 401

### Password Validation
- Minimum 8 characters, at least 1 letter + 1 digit (enforced in `schemas/user.py`)
- **NEVER** accept passwords without complexity validation

### Admin Endpoints
- All admin endpoints MUST have `@limiter.limit("30/minute")` (or stricter)
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
- For auth redirects: use `<Navigate to="/login" state={{ from: location }} replace />` to preserve return URL
- Axios 401 interceptors should ONLY clear tokens — let React components handle navigation

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
- Use the SHARED `Limiter()` instance from `app/rate_limiter.py`
- NEVER create a new `Limiter()` in individual router files — state won't be shared
- Import: `from app.rate_limiter import limiter`

### Security
- Always sanitise `%` and `_` in SQL LIKE/ILIKE queries to prevent wildcard injection
- Always `.lower().strip()` emails on registration AND login
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
# New vars to add when building new features:
ANTHROPIC_API_KEY=sk-ant-...      # For AI contract review — add to .env to enable live checking
RATE_LIMIT_SEARCH=60              # Already in .env.example
RATE_LIMIT_REVIEWS=5              # Already in .env.example
REDIS_URL=redis://localhost:6379/0  # Shared cache (defaults to localhost)
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
export SECRET_KEY=$(python -c "import secrets; print(secrets.token_hex(32))")
export ALLOWED_ORIGINS=https://your-domain.com
export VITE_API_URL=https://api.your-domain.com

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
2. **APScheduler not Celery** — runs in-process, no Redis needed
3. **scikit-learn not PyTorch** — tabular data, GBR is sufficient
4. **Soft-delete reviews** — `is_flagged=True` never hard delete
5. **JWT in httpOnly cookies only** — never localStorage (XSS-safe, enforced session 11)
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

### Contract Checker Page (`/check-contract`)
- **Layout:** ContractInput (paste area) → submit → ContractSummary + ClauseCard list + OverallRiskBadge
- **Risk levels per clause:** HIGH (rose), MEDIUM (amber), LOW (emerald)
- **Fallback:** When ANTHROPIC_API_KEY not set, backend returns 503 with human-readable message

### Agent Directory Page (`/agent`)
- **List view:** AgentDirectory.jsx — sector filter dropdown, search bar, cards with reputation score badge
- **Detail view:** AgentDetail.jsx — AgentHero (name + score), AgentScoreCards (rating breakdown), AgentReviewCard list
- **Reputation score:** 0–100, computed from `avg_rating × review_count` (reputation-weighted)

---

## Current Build Phase

See `docs/progress.md` for the full checklist.
When starting a session, **read that file first** before writing any code.

docs/design-system.md   ← read EVERY design rule before building any UI
