# Build Progress

> Update this file at the end of every Claude Code session.
> The next session should read this first before touching any code.

---

## Current Phase: Phase 1 — Data Pipelines (In Progress)

**Last updated:** 2026-02-20
**Last worked on:** Session 1 — Project scaffolding: full file/folder structure, config.py, database.py, all 8 SQLAlchemy models, Alembic initialised with initial migration (revision 62efbusz7xg4).

---

## Phase Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Data Pipelines | 🔄 In progress | Setup done; pipelines not yet written |
| Phase 2: ML Model | ⬜ Not started | Depends on Phase 1 |
| Phase 3: FastAPI Backend | ⬜ Not started | Depends on Phase 1 |
| Phase 4: Auth System | ⬜ Not started | Part of Phase 3 |
| Phase 5: React Frontend | ⬜ Not started | Depends on Phase 3 |
| Phase 6: Integration | ⬜ Not started | Depends on Phase 4+5 |
| Phase 7: Testing | ⬜ Not started | Runs alongside Phase 3-6 |
| Phase 8: Deployment | ⬜ Not started | Final phase |

Status key: ⬜ Not started | 🔄 In progress | ✅ Done | ❌ Blocked

---

## Detailed Checklist

### Phase 1: Data Pipelines

#### Setup
- [x] Create project folder structure (all empty files)
- [x] Set up `backend/requirements.txt` with data pipeline dependencies
- [x] Set up `docker-compose.yml` with postgres service
- [ ] Create PostgreSQL database locally (run `docker-compose up -d`)
- [ ] Set up `backend/.env` from `.env.example`

#### EPC Pipeline (`app/data_pipelines/epc_pipeline.py`)
- [ ] Download EPC bulk data for Guildford (manual step — epc.opendatacommunities.org)
- [ ] Write cleaning function: filter rental tenure
- [ ] Write cleaning function: filter post-2018 dates
- [ ] Write cleaning function: filter GU postcodes
- [ ] Write cleaning function: normalise property_type to 5 categories
- [ ] Write cleaning function: normalise postcode format
- [ ] Write cleaning function: deduplicate on UPRN (keep latest)
- [ ] Save cleaned output to `data/processed/epc_clean.csv`
- [ ] Write DB upsert function to `properties` table
- [ ] Verify: row count in expected range (8,000–15,000)

#### HMO Pipeline (`app/data_pipelines/hmo_pipeline.py`)
- [ ] Download HMO register CSV (manual step — guildford.gov.uk)
- [ ] Write postcode extraction regex
- [ ] Write `is_active` flag computation (expiry_date > today)
- [ ] Geocode all postcodes via Postcodes.io batch API
- [ ] Write DB upsert function to `hmo_records` table
- [ ] Verify: row count in expected range (400–700)

#### Crime Pipeline (`app/data_pipelines/crime_pipeline.py`)
- [ ] Write Postcodes.io geocoding service with DB cache
- [ ] Write police.uk API caller with rate limiting (0.08s sleep)
- [ ] Write 12-month iteration logic
- [ ] Write aggregation by postcode_sector + category
- [ ] Write safety score computation formula
- [ ] Write DB upsert to `crime_data` table
- [ ] Verify: all GU postcodes have scores

#### Land Registry Pipeline (`app/data_pipelines/land_registry_pipeline.py`)
- [ ] Download PPD bulk CSV (manual step)
- [ ] Filter to GU postcodes, post-2020
- [ ] Compute median sale price per postcode
- [ ] Normalise to 0–1 area_value_index
- [ ] Save to `data/processed/land_registry_clean.csv`

#### Pipeline Utilities (`app/data_pipelines/utils.py`)
- [ ] Write `api_call_with_retry()` function
- [ ] Write structured logging setup
- [ ] Create `pipeline_runs` DB table + log function

**Phase 1 done when:** All three CSVs clean + data loaded in PostgreSQL, row counts verified

---

### Phase 2: ML Model

#### Feature Engineering (`app/ml/features.py`)
- [ ] Load and merge epc_clean.csv + land_registry_clean.csv
- [ ] Geocode all postcodes (hitting cache mostly)
- [ ] Compute `distance_to_town_km` using geopy
- [ ] Compute `distance_to_uni_km` using geopy
- [ ] One-hot encode property_type and built_form
- [ ] Ordinal encode energy_rating
- [ ] Merge crime safety_score per postcode_sector
- [ ] Merge is_hmo flag from HMO register
- [ ] Handle nulls: drop critical, impute optional with median
- [ ] Save `data/processed/features.csv`
- [ ] Log: feature matrix shape, null counts, feature distributions

#### Training (`app/ml/train.py`)
- [ ] Download VOA rent stats and create rent bands dict
- [ ] Map properties to expected_weekly_rent target
- [ ] Train/test split 80/20 random_state=42
- [ ] Build sklearn Pipeline (StandardScaler + GradientBoostingRegressor)
- [ ] Baseline models: Ridge, RandomForest
- [ ] GridSearchCV hyperparameter tuning
- [ ] Retrain best model on full dataset
- [ ] Serialise to `app/ml/models/rent_model_v1.pkl`

#### Evaluation (`app/ml/evaluate.py`)
- [ ] Compute MAE, RMSE, R² on test set
- [ ] Run 5-fold cross-validation
- [ ] Generate feature importance plot
- [ ] Generate residual scatter plot
- [ ] Log results to console — record key metrics here:
  - MAE: ____ (target < £50)
  - RMSE: ____ (target < £75)
  - R²: ____ (target > 0.65)

#### Prediction service (`app/ml/predict.py`)
- [ ] Write `load_model()` function (loads pkl once on startup)
- [ ] Write `predict_rent(property_features: dict) -> dict` function
- [ ] Write `compute_fairness_score(actual, predicted) -> dict` function

**Phase 2 done when:** Model serialised, R² > 0.50, prediction function returns valid output

---

### Phase 3: FastAPI Backend Core

#### Database Setup
- [x] Install and configure Alembic
- [x] Write all SQLAlchemy models (models/)
- [x] Generate initial migration (revision 62efbusz7xg4) — includes PostGIS extension + GIST index
- [ ] Run migration against live DB: `docker exec surreynest-backend alembic upgrade head`
- [ ] Verify: `\dt` in psql shows all tables

#### Core API
- [ ] `app/main.py` — FastAPI app, CORS, router mounting, startup event
- [x] `app/config.py` — env var loading with sensible defaults
- [x] `app/database.py` — engine, session factory, get_db dependency
- [ ] `GET /properties` — postcode search with radius, paginated
- [ ] `GET /properties/{uprn}` — full property detail
- [ ] `GET /hmo/check?uprn={uprn}` — HMO status lookup
- [ ] `GET /scores/safety?postcode={postcode}` — safety score
- [ ] `GET /scores/rent-fairness` — ML prediction endpoint
- [ ] Verify all endpoints in FastAPI /docs

#### Services
- [ ] `app/services/geocoding_service.py` — cache-first postcode lookup
- [ ] `app/services/property_service.py` — assemble full property detail
- [ ] `app/services/score_service.py` — safety score + fairness score

---

### Phase 4: Auth System

- [ ] `app/routers/auth.py` — POST /auth/register + POST /auth/login
- [ ] `app/services/auth_service.py` — hash_password, verify_password, create_jwt
- [ ] `app/schemas/auth.py` — Token, TokenData schemas
- [ ] `app/schemas/user.py` — UserCreate (email + password validators), UserResponse
- [ ] `get_current_user` dependency function
- [ ] Apply auth dependency to POST /reviews route
- [ ] Apply admin role check to DELETE /reviews/{id}
- [ ] Test: register → login → get token → access protected route

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
| | | |

---

## Notes for Next Session

*Record what you were doing and what to do next:*

```
Session 1 — 2026-02-20
Last thing done: Full project scaffolding complete.
  - Created all backend/ and frontend/ directories and stub files
  - Wrote backend/app/config.py (dotenv + Settings singleton + validation)
  - Wrote backend/app/database.py (SQLAlchemy engine, SessionLocal, Base, get_db)
  - Wrote all 8 SQLAlchemy models (users, properties, hmo_records, crime_data,
    reviews, postcode_cache, rent_predictions, pipeline_runs)
  - Initialised Alembic; wrote initial migration (revision 62efbusz7xg4) with
    PostGIS extension + GIST spatial index on properties(lat, lng)

Next step:
  1. Copy backend/.env.example → backend/.env and fill in values
  2. `docker-compose up -d` — start Postgres + backend containers
  3. `docker exec surreynest-backend alembic upgrade head` — run migration
  4. Verify `\dt` shows all 8 tables in psql
  5. Begin Phase 1 data pipelines: start with epc_pipeline.py

Any gotchas discovered:
  - alembic.ini sqlalchemy.url is intentionally left blank; env.py overrides it
    from settings.database_url at runtime — do not set it in alembic.ini.
  - PostGIS GIST index is created via raw SQL in the migration (Alembic has no
    native ST_Point GIST support without geoalchemy2 dialect).
  - review.py: one review per user per property enforced by UniqueConstraint on
    (user_id, uprn) — note this means deleted-account (user_id=NULL) reviews
    are exempt from the unique constraint in PostgreSQL (NULL != NULL).
```
