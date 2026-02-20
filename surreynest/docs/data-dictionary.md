# Data Dictionary

> Every database table, column, and important enum value defined.
> Update this file when you add or change DB schema.

---

## Table: `users`

Stores all registered user accounts.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | UUID | NO | Primary key — use `uuid_generate_v4()` |
| `email` | VARCHAR(255) | NO | Unique, indexed. Lowercased on insert. |
| `hashed_password` | VARCHAR(255) | NO | bcrypt hash — never the plain text |
| `role` | VARCHAR(20) | NO | Enum: `student`, `landlord`, `admin`. Default: `student` |
| `created_at` | TIMESTAMP | NO | UTC — use `datetime.utcnow()` |
| `is_verified` | BOOLEAN | NO | Email verified. Default: `false`. Post-MVP only. |
| `last_login` | TIMESTAMP | YES | Updated on each successful login |

**Indexes:** unique on `email`

**Notes:**
- We do NOT store: name, phone, address, university course, student ID
- On account deletion: anonymise reviews (set `user_id` to NULL), delete user row

---

## Table: `properties`

Core property records sourced from EPC register.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `uprn` | VARCHAR(20) | NO | Primary key — Unique Property Reference Number from EPC |
| `address` | VARCHAR(500) | NO | Full street address as in EPC |
| `postcode` | VARCHAR(10) | NO | Normalised: uppercase, single space (GU2 7XH) |
| `lat` | FLOAT | YES | Latitude — populated by geocoding pipeline |
| `lng` | FLOAT | YES | Longitude — populated by geocoding pipeline |
| `property_type` | VARCHAR(50) | YES | Normalised to: Flat, Terraced, Semi-Detached, Detached, Other |
| `built_form` | VARCHAR(50) | YES | From EPC: Detached, Semi-Detached, Terraced, End-Terrace, Enclosed End-Terrace, Enclosed Mid-Terrace |
| `floor_area_m2` | FLOAT | YES | Total floor area in m² — from EPC TOTAL-FLOOR-AREA |
| `num_rooms` | INT | YES | Habitable rooms — from EPC NUMBER-HABITABLE-ROOMS |
| `energy_rating` | CHAR(1) | YES | Current EPC rating A–G |
| `potential_rating` | CHAR(1) | YES | Potential EPC rating A–G if improvements made |
| `epc_date` | DATE | YES | Date EPC was lodged — from LODGEMENT-DATE |
| `tenure` | VARCHAR(100) | YES | Tenure description from EPC |
| `created_at` | TIMESTAMP | NO | When row was first inserted |
| `updated_at` | TIMESTAMP | NO | Last time row was updated by pipeline |

**Indexes:**
- Standard index on `postcode`
- PostGIS GIST index on `(lat, lng)` — enables `ST_DWithin` radius queries
- Note: requires `CREATE EXTENSION IF NOT EXISTS postgis;`

**Source:** EPC bulk download — updated quarterly

---

## Table: `hmo_records`

Houses in Multiple Occupation from Guildford Borough Council public register.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | SERIAL | NO | Primary key |
| `uprn` | VARCHAR(20) | YES | FK → properties.uprn — populated if match found |
| `raw_address` | VARCHAR(500) | NO | Original address from HMO register |
| `postcode` | VARCHAR(10) | YES | Extracted from raw_address via regex |
| `lat` | FLOAT | YES | Geocoded via Postcodes.io |
| `lng` | FLOAT | YES | Geocoded via Postcodes.io |
| `licence_number` | VARCHAR(100) | YES | Official GBC licence number |
| `max_occupants` | INT | YES | Maximum permitted number of occupants |
| `licence_holder` | VARCHAR(255) | YES | Name of licence holder |
| `expiry_date` | DATE | YES | Licence expiry date |
| `is_active` | BOOLEAN | NO | `expiry_date > TODAY`. Recomputed on each pipeline run. |
| `last_updated` | TIMESTAMP | NO | When row was last updated by pipeline |

**Notes:**
- A property can be on the HMO register with `is_active=false` (expired licence)
- A property NOT on the register may still be operated as an HMO (unlicensed)
- We flag both of these cases in the UI

---

## Table: `crime_data`

Aggregated crime counts from police.uk API, by postcode sector.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | SERIAL | NO | Primary key |
| `postcode_sector` | VARCHAR(10) | NO | First segment, e.g. `GU2 7`. Indexed. |
| `category` | VARCHAR(50) | NO | Crime category from police.uk API |
| `month` | DATE | NO | First day of the month, e.g. `2024-01-01` |
| `count` | INT | NO | Number of crimes of this category in this sector this month |
| `updated_at` | TIMESTAMP | NO | When row was last updated |

**Computed column (not stored — calculated in `score_service.py`):**
- `safety_score` per postcode sector = computed from all categories + months for that sector

**Notes:**
- Postcode sector = everything before the last 3 characters: `GU2 7XH` → `GU2 7`
- We aggregate to sector level (not street level) to avoid data sparsity

---

## Table: `reviews`

Tenant-submitted reviews for properties.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | UUID | NO | Primary key |
| `user_id` | UUID | YES | FK → users.id. NULL = anonymised (deleted account) |
| `uprn` | VARCHAR(20) | NO | FK → properties.uprn. Indexed. |
| `overall_rating` | INT | NO | 1–5 stars |
| `landlord_rating` | INT | NO | 1–5: responsiveness and professionalism |
| `condition_rating` | INT | NO | 1–5: property condition and maintenance |
| `value_rating` | INT | NO | 1–5: rent value for money |
| `weekly_rent_paid` | FLOAT | YES | Self-reported weekly rent in £ — used for fairness model training |
| `move_in_year` | INT | YES | Year tenancy started — for temporal context |
| `review_text` | TEXT | NO | Free text, 50–1000 characters |
| `created_at` | TIMESTAMP | NO | UTC |
| `is_moderated` | BOOLEAN | NO | Default false — not visible until admin approves |
| `is_flagged` | BOOLEAN | NO | Default false — set true when admin rejects |

**Constraints:**
- One review per user per property: unique constraint on `(user_id, uprn)`
- rating columns: check constraint 1 <= value <= 5

**Notes:**
- Never hard-delete — soft delete via `is_flagged=true`
- `weekly_rent_paid` is optional but shown as "help improve the model" in UI

---

## Table: `postcode_cache`

Caches Postcodes.io API results to avoid repeat calls.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `postcode` | VARCHAR(10) | NO | Primary key. Normalised uppercase. |
| `lat` | FLOAT | NO | Latitude |
| `lng` | FLOAT | NO | Longitude |
| `ward` | VARCHAR(100) | YES | Electoral ward name |
| `district` | VARCHAR(100) | YES | Admin district |
| `is_valid` | BOOLEAN | NO | False if Postcodes.io returned no result |
| `cached_at` | TIMESTAMP | NO | When entry was stored |

**Notes:**
- Check this table FIRST before calling Postcodes.io
- If `is_valid=false`, do not retry — postcode is terminated or invalid
- Pipeline upserts on conflict

---

## Table: `rent_predictions`

Cached ML model predictions per property.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `uprn` | VARCHAR(20) | NO | PK + FK → properties.uprn |
| `predicted_weekly_rent` | FLOAT | NO | Model output in £/week |
| `confidence_low` | FLOAT | YES | Lower bound of confidence interval |
| `confidence_high` | FLOAT | YES | Upper bound of confidence interval |
| `model_version` | VARCHAR(20) | NO | e.g. `v1.0.0` — matches pkl filename |
| `computed_at` | TIMESTAMP | NO | When prediction was run |

**Notes:**
- Refreshed weekly by APScheduler job
- On ML model update, recompute all predictions (run `python -m app.ml.predict --all`)

---

## Table: `pipeline_runs`

Audit log of all data pipeline executions.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | SERIAL | NO | Primary key |
| `pipeline_name` | VARCHAR(100) | NO | e.g. `epc_pipeline`, `crime_pipeline` |
| `started_at` | TIMESTAMP | NO | When job started |
| `finished_at` | TIMESTAMP | YES | When job finished (null if still running) |
| `status` | VARCHAR(20) | NO | `running`, `success`, `failed` |
| `rows_processed` | INT | YES | Number of rows upserted |
| `error_message` | TEXT | YES | Full error + stack trace if failed |

---

## Enums & Allowed Values

### `users.role`
- `student` — default, can search and review
- `landlord` — future feature, can claim properties
- `admin` — can moderate reviews, view pipeline status

### `properties.property_type` (normalised)
- `Flat`
- `Terraced`
- `Semi-Detached`
- `Detached`
- `Other`

### `properties.energy_rating` / `potential_rating`
- `A` through `G` (A = most efficient)
- Ordinal encoding for ML: A=6, B=5, C=4, D=3, E=2, F=1, G=0

### `pipeline_runs.status`
- `running` — job is currently executing
- `success` — completed without errors
- `failed` — threw an exception (see `error_message`)

---

## Key Computed Values (not stored, calculated in services)

### Safety Score
Calculated per postcode sector in `app/services/score_service.py`:
```
safety_score = max(0, min(100, 100 - (weighted_crime_sum / normaliser * 100)))
```
Where `normaliser` = 95th percentile weighted crime sum across all Guildford sectors.

### Rent Fairness Score
Calculated per property when a user provides their actual rent:
```
ratio = actual_rent / predicted_rent
score = fairness_formula(ratio)  # see ml/predict.py
```

### Average Review Ratings
Calculated on-the-fly in `app/services/property_service.py`:
```sql
SELECT AVG(overall_rating), AVG(landlord_rating), AVG(condition_rating), 
       AVG(value_rating), COUNT(*) 
FROM reviews 
WHERE uprn = :uprn AND is_moderated = true AND is_flagged = false
```
