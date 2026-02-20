# API Reference — All Free Data Sources

> Every external API and dataset used in SurreyNest is free.
> This file is the single source of truth for how to call each one.

---

## 1. Postcodes.io — Geocoding

**Base URL:** `https://api.postcodes.io`
**Auth required:** No
**Rate limit:** ~100 req/sec
**Cost:** Free forever

### Single postcode lookup
```
GET /postcodes/{postcode}
```
Response includes: `latitude`, `longitude`, `ward`, `admin_district`, `parliamentary_constituency`

### Batch lookup (preferred — use this in pipelines)
```
POST /postcodes
Body: { "postcodes": ["GU1 3AY", "GU2 7XH", ...] }  ← max 100 per request
```

### Usage rules
- Always check postcode cache table before calling — saves API calls
- Handle null result gracefully (invalid/terminated postcodes exist in EPC data)
- Batch requests for pipeline runs — do NOT call one-by-one in a loop

### In code: `app/services/geocoding_service.py`

---

## 2. Police UK Crime API

**Base URL:** `https://data.police.uk/api`
**Auth required:** No
**Rate limit:** ~15 req/sec (be conservative — use 12/sec)
**Cost:** Free

### Crimes at location (main endpoint)
```
GET /crimes-at-location?lat={lat}&lng={lng}&date={YYYY-MM}
```
Returns: array of crimes with `category`, `location`, `month` fields

### Available crime categories
- `anti-social-behaviour`
- `bicycle-theft`
- `burglary`
- `criminal-damage-arson`
- `drugs`
- `other-crime`
- `other-theft`
- `possession-of-weapons`
- `public-order`
- `robbery`
- `shoplifting`
- `theft-from-the-person`
- `vehicle-crime`
- `violent-crime`

### Categories we track for safety score
```python
TRACKED_CATEGORIES = [
    "anti-social-behaviour",
    "burglary",
    "drugs",
    "robbery",
    "theft-from-the-person",
    "vehicle-crime",
    "violent-crime",
    "public-order"
]
```

### Safety score weighting
```python
CATEGORY_WEIGHTS = {
    "violent-crime": 3.0,
    "robbery": 2.5,
    "anti-social-behaviour": 2.0,
    "burglary": 2.0,
    "drugs": 1.5,
    "public-order": 1.5,
    "vehicle-crime": 1.0,
    "theft-from-the-person": 1.0
}
```

Score formula:
1. Sum `count × weight` for all categories in a postcode sector
2. Divide by 95th percentile across all Guildford sectors (normalise)
3. `safety_score = max(0, 100 - (weighted_sum / normaliser * 100))`
4. Clamp to 0–100

### Date range for pipeline
- Collect last 12 months: iterate `date` param from current month back 12 months
- Format: `YYYY-MM` (e.g., `2024-01`)

### Rate limiting in pipeline
```python
import time
time.sleep(0.08)  # ~12 requests/sec — safely under limit
```

### In code: `app/data_pipelines/crime_pipeline.py`

---

## 3. EPC Register (Energy Performance Certificates)

**URL:** `https://epc.opendatacommunities.org`
**Auth required:** Free account (register with email)
**Rate limit:** N/A — bulk download, not an API
**Cost:** Free under Open Government Licence v3.0

### Download method
1. Log in at epc.opendatacommunities.org
2. Navigate to: Domestic EPCs → Download by local authority
3. Filter: Local Authority = **Guildford**
4. Download: all domestic EPCs as CSV
5. Save to: `backend/data/raw/epc_guildford_raw.csv`

### Key columns (our pipeline uses)
| Column | Type | Notes |
|--------|------|-------|
| `UPRN` | string | Primary key — join to HMO register |
| `ADDRESS1` | string | Street address |
| `POSTCODE` | string | Needs normalisation |
| `PROPERTY-TYPE` | categorical | Flat/House/Bungalow/Maisonette/Park home |
| `BUILT-FORM` | categorical | Detached/Semi-Detached/Terraced/End-Terrace |
| `TOTAL-FLOOR-AREA` | float | m² — strongest ML feature |
| `NUMBER-HABITABLE-ROOMS` | int | Proxy for bedrooms |
| `CURRENT-ENERGY-RATING` | categorical | A–G |
| `POTENTIAL-ENERGY-RATING` | categorical | A–G |
| `TENURE` | string | Filter: keep rows containing 'rental' |
| `LODGEMENT-DATE` | date | Filter: keep post-2018-01-01 |
| `TRANSACTION-TYPE` | string | Secondary filter |

### Update schedule: Quarterly (Jan, Apr, Jul, Oct)

### In code: `app/data_pipelines/epc_pipeline.py`

---

## 4. Guildford HMO Register

**URL:** `https://www.guildford.gov.uk` → Housing → Landlords → HMO Register
**Also on:** `https://data.gov.uk` — search "Guildford HMO"
**Auth required:** No
**Cost:** Free under Open Government Licence v3.0

### Download method
1. Visit Guildford Borough Council website
2. Navigate to: Housing → Landlords → Houses in Multiple Occupation
3. Download the public register CSV
4. Save to: `backend/data/raw/hmo_register_raw.csv`

### Expected columns
- Property address (full)
- Licence number
- Maximum permitted occupants
- Licence holder name
- Licence expiry date
- Property description

### Key processing
- Extract postcode from address using regex: `r'GU\d{1,2}\s?\d[A-Z]{2}'`
- `is_active = expiry_date > datetime.today()`
- Geocode extracted postcode via Postcodes.io

### Update schedule: Weekly (re-download Sunday 2am)

### In code: `app/data_pipelines/hmo_pipeline.py`

---

## 5. Land Registry Price Paid Data

**URL:** `https://www.gov.uk/government/statistical-data-sets/price-paid-data-downloads`
**Auth required:** No
**Cost:** Free under Open Government Licence v3.0

### Download method
- Download the "yearly file" for most recent year
- Filter county: Surrey
- Or use: `https://landregistry.data.gov.uk/app/ppd` for filtered download

### Columns we use
| Column | Use |
|--------|-----|
| `Price` | Sale price in £ |
| `Postcode` | For grouping |
| `Property Type` | D/S/T/F (Detached/Semi/Terraced/Flat) |
| `Date of Transfer` | Filter: post-2020-01-01 only |

### Processing
- Filter to GU postcodes only
- Compute `median_sale_price` per postcode
- This becomes `area_value_index` feature (normalised 0–1)

### Update schedule: Monthly (2nd of month 3am)

### In code: `app/data_pipelines/land_registry_pipeline.py`

---

## 6. VOA Private Rental Market Statistics

**URL:** `https://www.gov.uk/government/collections/private-rental-market-summary-statistics`
**Auth required:** No
**Cost:** Free under Open Government Licence v3.0

### What it provides
Median and lower/upper quartile rents by:
- Local authority (Guildford Borough)
- Number of bedrooms (1, 2, 3, 4+)
- Quarter

### Use in ML model
These quarterly medians are our **initial rent training target** for the ML model.
`expected_weekly_rent = voa_monthly_median_rent / 4.33`

When we have sufficient user-submitted rents (50+), we transition to using those as the target instead.

### Update schedule: Quarterly

### In code: `app/ml/train.py` — used to build training labels

---

## 7. OpenStreetMap (Map Tiles)

**URL:** `https://tile.openstreetmap.org/{z}/{x}/{y}.png`
**Auth required:** No
**Attribution required:** Yes — must display "© OpenStreetMap contributors"
**Cost:** Free (reasonable use policy applies)

### Usage in frontend
Via Leaflet.js TileLayer component. Attribution automatically shown by Leaflet.

### Rate limiting / etiquette
- Do not make bulk tile requests (Leaflet handles this efficiently)
- For production: consider Stadia Maps free tier (better performance, no rate concerns)

---

## 8. Companies House API (optional — future feature)

**URL:** `https://api.company-search.companieshouse.gov.uk`
**Auth required:** Free API key (register at developer.company-search.service.gov.uk)
**Cost:** Free

### Use case
Identify corporate landlords by searching company names found in Land Registry or HMO register.
Show "corporate landlord" badge on property detail pages.

### Not built yet — add post-MVP

---

## Error Handling for All External APIs

All pipeline calls to external APIs follow this pattern:

```python
import time
import requests
from app.data_pipelines.utils import api_call_with_retry

# In utils.py:
def api_call_with_retry(url, max_retries=3):
    for attempt in range(max_retries):
        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            if attempt == max_retries - 1:
                raise
            time.sleep(2 ** attempt)  # 1s, 2s, 4s backoff
```

For real-time score endpoints (not pipelines), if an external API fails:
- Return `{"score": null, "message": "Score temporarily unavailable", "cached_at": null}`
- Never return an error 500 to the frontend for a missing score
