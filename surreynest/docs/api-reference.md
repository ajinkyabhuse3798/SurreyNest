# API Reference — All Free Data Sources

> Every external API and dataset used in SurreyNest is free.
> This file is the single source of truth for how to call each one.
> **Never add a paid API. Never scrape websites. Use only official open data.**

---

## 1. EPC Register API (Domestic) — ✅ CREDENTIALS AVAILABLE

**Base URL:** `https://epc.opendatacommunities.org/api/v1/domestic`
**Auth:** HTTP Basic — Base64-encoded `email:api-key`
**Cost:** Free under Open Government Licence v3.0
**Which API:** **Domestic Energy Performance Certificates API** — correct for SurreyNest (residential rentals)

### How authentication works
Your credentials from the EPC portal:
- **Username:** your registered email address
- **API key:** the key shown in your developer dashboard

The Authorization header uses HTTP Basic auth. The token is `Base64(email:api-key)`:
```python
import base64

# Generate once and store result in .env as EPC_API_TOKEN
# Do this in a Python shell, not in code committed to git
token = base64.b64encode(b"yourname@email.com:your-api-key-here").decode("utf-8")
print(token)  # Store this value as EPC_API_TOKEN in backend/.env
```

**Add to `backend/.env`:**
```bash
EPC_API_USERNAME=yourname@email.com
EPC_API_KEY=your-api-key-from-dashboard
# Pipeline generates Base64 token at runtime from the above two values
```

**Add to `backend/.env.example`:**
```bash
EPC_API_USERNAME=your-registered-email@example.com
EPC_API_KEY=your-api-key-from-epc-portal
```

### Main search endpoint — filter by local authority
```
GET https://epc.opendatacommunities.org/api/v1/domestic/search
     ?local-authority=E07000209   ← Guildford Borough ONS code
     &size=5000                   ← max records per page
     &search-after={cursor}       ← pagination token from previous response header
```

**Guildford Borough ONS local authority code:** `E07000209`

### Full pipeline implementation
```python
import base64, csv, io, logging, time
import requests
from pathlib import Path

logger = logging.getLogger(__name__)

EPC_BASE_URL = "https://epc.opendatacommunities.org/api/v1/domestic/search"
GUILDFORD_LA_CODE = "E07000209"


def build_auth_header(username: str, api_key: str) -> str:
    """Build HTTP Basic auth header value from credentials.
    
    Args:
        username: Registered email address
        api_key: API key from EPC developer dashboard
    
    Returns:
        Base64-encoded Authorization header value
    """
    token = base64.b64encode(f"{username}:{api_key}".encode()).decode()
    return f"Basic {token}"


def download_guildford_epc(username: str, api_key: str, output_path: Path) -> int:
    """Download all Guildford domestic EPC records via paginated API.
    
    Writes all records as CSV to output_path.
    Uses search-after pagination — handles any number of pages automatically.
    
    Args:
        username: EPC API username (email)
        api_key: EPC API key
        output_path: Where to write the CSV file
    
    Returns:
        Total rows written
    """
    headers = {
        "Accept": "text/csv",
        "Authorization": build_auth_header(username, api_key),
    }
    params = {
        "local-authority": GUILDFORD_LA_CODE,
        "size": 5000,
    }

    total_rows = 0
    first_request = True
    search_after = None
    writer = None

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        while search_after is not None or first_request:
            if not first_request:
                params["search-after"] = search_after

            response = requests.get(
                EPC_BASE_URL, headers=headers, params=params, timeout=30
            )
            response.raise_for_status()

            reader = csv.DictReader(io.StringIO(response.text))
            rows = list(reader)

            if not rows:
                break

            if writer is None:
                writer = csv.DictWriter(f, fieldnames=reader.fieldnames)
                writer.writeheader()

            writer.writerows(rows)
            total_rows += len(rows)

            # Pagination cursor comes from response header
            search_after = response.headers.get("X-Next-Search-After")
            first_request = False

            logger.info("EPC download progress: %d records", total_rows)
            time.sleep(0.5)  # Polite rate limiting

    return total_rows
```

### Key CSV column names → DB column mapping
These are the EXACT column headers returned by the API:

| API CSV Header | DB Column | Notes |
|---------------|-----------|-------|
| `uprn` | `properties.uprn` | Primary key — may be empty for older certs |
| `address1` | → `properties.address` | Street address line 1 |
| `postcode` | `properties.postcode` | Normalise: uppercase + single space |
| `property-type` | `properties.property_type` | Normalise → Flat/Terraced/Semi-Detached/Detached/Other |
| `built-form` | `properties.built_form` | Keep raw value |
| `total-floor-area` | **`properties.floor_area_m2`** | Float — most important ML feature |
| `number-habitable-rooms` | **`properties.num_rooms`** | Int — proxy for bedrooms |
| `current-energy-rating` | `properties.energy_rating` | A through G |
| `potential-energy-rating` | `properties.potential_rating` | A through G |
| `lodgement-datetime` | `properties.epc_date` | Filter: keep > 2018-01-01 |
| `tenure` | `properties.tenure` | Filter: keep rows containing 'rental' |

### Cleaning rules in `epc_pipeline.py`
```python
# 1. Filter tenure
df = df[df['tenure'].str.contains('rental', case=False, na=False)]

# 2. Filter date
df['lodgement-datetime'] = pd.to_datetime(df['lodgement-datetime'], errors='coerce')
df = df[df['lodgement-datetime'] > '2018-01-01']

# 3. Filter to GU postcodes only
df = df[df['postcode'].str.startswith(('GU1', 'GU2', 'GU3', 'GU4'), na=False)]

# 4. Drop critical nulls
df = df.dropna(subset=['total-floor-area', 'number-habitable-rooms'])
df = df[df['total-floor-area'].astype(float) >= 10]

# 5. Normalise property_type to 5 values
type_map = {
    'Flat': 'Flat', 'Maisonette': 'Flat',
    'Terraced': 'Terraced', 'End-Terrace': 'Terraced',
    'Semi-Detached': 'Semi-Detached',
    'Detached': 'Detached',
}
df['property_type'] = df['property-type'].map(type_map).fillna('Other')

# 6. Normalise postcode format
def normalise_postcode(pc: str) -> str:
    pc = pc.upper().strip().replace(' ', '')
    return f"{pc[:-3]} {pc[-3:]}"
df['postcode'] = df['postcode'].apply(normalise_postcode)

# 7. Deduplicate on uprn — keep most recent
df = df.sort_values('lodgement-datetime', ascending=False)
df = df.drop_duplicates(subset=['uprn'], keep='first')
```

### Expected row counts
- Raw API response: ~50,000 records for Guildford
- After cleaning: 8,000–15,000 rental properties

### Single certificate lookup (live — for property detail page)
```
GET https://epc.opendatacommunities.org/api/v1/domestic/certificate/{lmk-key}
```
Use when a UPRN exists in our DB but has no EPC data (edge case).

### Update schedule
Quarterly (Jan, Apr, Jul, Oct) — re-run the pipeline

---

## 2. Postcodes.io — Geocoding

**Base URL:** `https://api.postcodes.io`
**Auth required:** No
**Rate limit:** ~100 req/sec — use batch endpoint
**Cost:** Free forever

### Batch lookup (always use this in pipelines)
```python
def geocode_batch(postcodes: list[str]) -> dict[str, dict | None]:
    """Geocode up to 100 postcodes in one request.
    
    Returns:
        Dict mapping postcode → {lat, lng, ward, district} or None if invalid
    """
    response = requests.post(
        "https://api.postcodes.io/postcodes",
        json={"postcodes": postcodes[:100]},
        timeout=10,
    )
    response.raise_for_status()
    
    results = {}
    for item in response.json()["result"]:
        postcode = item["query"]
        if item["result"]:
            r = item["result"]
            results[postcode] = {
                "lat": r["latitude"],
                "lng": r["longitude"],
                "ward": r.get("admin_ward"),
                "district": r.get("admin_district"),
            }
        else:
            results[postcode] = None  # invalid/terminated postcode
    return results
```

### Rules
- **Always** check `postcode_cache` DB table before calling
- If `is_valid=False` in cache: do NOT retry — postcode is gone
- Batch in groups of 100 — never call one-by-one in a pipeline loop

### In code: `app/services/geocoding_service.py`

---

## 3. Police UK Crime API

**Base URL:** `https://data.police.uk/api`
**Auth required:** No API key — completely open
**Rate limit:** ~15 req/sec → use `time.sleep(0.08)` (12 req/sec)
**Cost:** Free under OGL

### Endpoint
```
GET /crimes-at-location?lat={lat}&lng={lng}&date={YYYY-MM}
```

### Safety score formula
```python
CATEGORY_WEIGHTS = {
    "violent-crime": 3.0, "robbery": 2.5,
    "anti-social-behaviour": 2.0, "burglary": 2.0,
    "drugs": 1.5, "public-order": 1.5,
    "vehicle-crime": 1.0, "theft-from-the-person": 1.0,
}

weighted_sum = sum(
    count * CATEGORY_WEIGHTS.get(cat, 1.0)
    for cat, count in sector_crimes.items()
)
normaliser = 95th_percentile_across_all_guildford_sectors
safety_score = max(0, min(100, 100 - (weighted_sum / normaliser * 100)))
```

Aggregate to postcode sector: `GU2 7XH` → sector `GU2 7`

### In code: `app/data_pipelines/crime_pipeline.py`

---

## 4. Land Registry Price Paid Data

**URL:** `https://www.gov.uk/government/statistical-data-sets/price-paid-data-downloads`
**Auth:** No — direct download
**Cost:** Free under OGL

### Direct download
```
http://prod.publicdata.landregistry.gov.uk.s3-website-eu-west-1.amazonaws.com/pp-2024.csv
```

Filter to GU postcodes post-2020. Compute median sale price per postcode → normalise 0–1 → `area_value_index` ML feature.

### In code: `app/data_pipelines/land_registry_pipeline.py`

---

## 5. Guildford HMO Register

**URL:** `https://www.guildford.gov.uk` → Housing → HMO Register
**Auth:** No — public register
**Cost:** Free under OGL

Extract postcode with `r'GU\d{1,2}\s?\d[A-Z]{2}'`.
Compute `is_active = expiry_date > today`.
DB target: `hmo_records` table (column: `raw_address` not `address`).

### In code: `app/data_pipelines/hmo_pipeline.py`

---

## 6. VOA Private Rental Market Statistics (Phase 6)

**Guildford code:** `E07000209`
Provides median rents by bedroom count — improves ML training labels.

### In code: `app/data_pipelines/voa_pipeline.py`

---

## 7. Environment Agency Flood Monitoring (Phase 6)

**Base URL:** `https://environment.data.gov.uk/flood-monitoring`
**Auth:** No
Maps GU postcodes to risk: Very Low=0, Low=1, Medium=2, High=3.

### In code: `app/data_pipelines/flood_pipeline.py`

---

## 8. OpenStreetMap

**URL:** `https://tile.openstreetmap.org/{z}/{x}/{y}.png`
Attribution required: "© OpenStreetMap contributors"
Used via Leaflet.js TileLayer in React frontend.

---

## Error Handling Pattern (all pipelines)

```python
def api_call_with_retry(url: str, max_retries: int = 3, **kwargs) -> dict:
    for attempt in range(max_retries):
        try:
            response = requests.get(url, timeout=10, **kwargs)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as exc:
            if attempt == max_retries - 1:
                raise
            wait = 2 ** attempt  # 1s → 2s → 4s
            logger.warning("Attempt %d/%d failed: %s. Retrying in %ds",
                           attempt + 1, max_retries, exc, wait)
            time.sleep(wait)
```

Score endpoints — graceful null (never return 500 for missing data):
```python
return {"score": None, "label": "Data loading", "available": False}
```
