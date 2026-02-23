# SurreyNest — Claude Code Session Prompts
## Copy the correct prompt for your session type. Never skip the reading step.

---

## PROMPT A — Standard Session Start (use this every time)

```
You are working on SurreyNest — a student housing transparency platform.

BEFORE WRITING A SINGLE LINE OF CODE, do this in order:

STEP 1 — READ THESE FILES (use the Read tool on each):
  1. CLAUDE.md                    ← project rules, column names, what's built
  2. docs/progress.md             ← what was done last session, what's next
  3. docs/conventions.md          ← code style rules you must follow
  4. docs/api-reference.md        ← API credentials and endpoints

STEP 2 — CONFIRM WHAT YOU READ:
After reading all four files, write a short summary:
  - "Phase X is current. Last session did: [X]. Next task is: [X]."
  - "I confirmed these critical column names: floor_area_m2, num_rooms, hmo_records table, raw_address column."

STEP 3 — ENTER PLAN MODE:
Before writing any code, state your complete plan:
  - Every FILE you will CREATE (new file — did not exist before)
  - Every FILE you will MODIFY (changes to existing file)
  - Every ALEMBIC MIGRATION needed (if DB schema changes)
  - Every TEST you will write
  - Exact ORDER of operations (dependencies first)

End your plan with: "Does this plan look correct? I'll wait for your go-ahead before writing any code."

DO NOT write any code until I confirm the plan.

Today's goal: [DESCRIBE IN ONE SENTENCE WHAT YOU WANT TO BUILD]
```

---

## PROMPT B — EPC Pipeline Session (use when building epc_pipeline.py)

```
You are working on SurreyNest — a student housing platform.

STEP 1 — READ THESE FILES FIRST (use Read tool):
  1. CLAUDE.md
  2. docs/progress.md
  3. docs/api-reference.md        ← EPC API section has full auth + pagination code
  4. docs/data-dictionary.md      ← properties table exact column names
  5. backend/app/models/property.py    ← real SQLAlchemy model
  6. backend/app/database.py      ← how to get DB session

STEP 2 — CONFIRM critical facts:
  - EPC API URL: https://epc.opendatacommunities.org/api/v1/domestic/search
  - Auth: HTTP Basic, token = Base64(EPC_API_USERNAME + ":" + EPC_API_KEY) from .env
  - Guildford local authority code: E07000209
  - DB table is: properties
  - Column names: floor_area_m2 (NOT total_floor_area), num_rooms (NOT number_habitable_rooms)

STEP 3 — PLAN BEFORE CODING:
Show your plan for backend/app/data_pipelines/epc_pipeline.py covering:
  - Function: build_auth_header(username, api_key) → str
  - Function: download_guildford_epc(username, api_key, output_path) → int  [paginated]
  - Function: clean_epc_dataframe(df) → df  [filtering + normalisation]
  - Function: upsert_properties(df, db) → int  [UPSERT on uprn conflict]
  - Function: run_epc_pipeline() → None  [orchestrator, logs to pipeline_runs]
  - Which .env vars it reads (EPC_API_USERNAME, EPC_API_KEY)
  - How pagination works (X-Next-Search-After header)
  - How UPSERT works (PostgreSQL INSERT ... ON CONFLICT DO UPDATE)

Rules for the pipeline:
  - UPSERT on UPRN conflict — never DROP table
  - Log start + finish to pipeline_runs table via utils.log_pipeline_run()
  - time.sleep(0.5) between API pages
  - Skip rows where uprn is empty — log a warning, don't crash
  - Filter: tenure contains 'rental', date > 2018-01-01, GU postcodes only
  - floor_area_m2 must be >= 10 (corrupt data guard)

Wait for my plan approval before writing code.
```

---

## PROMPT C — Phase 3 Backend (schemas + services + routers)

```
You are working on SurreyNest — a student housing platform.
Phase 1 (data pipelines) and Phase 2 (ML model) are complete.
We are now on Phase 3: building the FastAPI backend.

STEP 1 — READ THESE FILES (use Read tool on each before doing anything):
  1. CLAUDE.md                         ← critical column names + build order
  2. docs/progress.md                  ← Phase 3 checklist — find next unchecked item
  3. docs/conventions.py               ← code style rules
  4. backend/app/database.py           ← how to get DB session
  5. backend/app/models/__init__.py    ← all 8 model imports
  6. The specific model file for what you're building today

STEP 2 — CONFIRM what you read:
Tell me:
  - Which Phase 3 step is next (from progress.md checklist)
  - The exact DB table names and column names for what you'll touch
  - Which existing files you'll import from (never recreate what exists)

STEP 3 — PLAN (required before any code):
For the step you're building, list:
  a) Files to CREATE (new — state full path)
  b) Files to MODIFY (existing — state what changes)
  c) Any new DB tables or columns needed → migration required?
  d) Tests to write alongside this step
  e) Order: schema → service → router → test (always this order)

Architecture rules to follow:
  - Schemas first (no DB access, no dependencies)
  - Services call DB — no HTTP, no request/response objects
  - Routers call services only — no DB queries in routers
  - Tests use fixtures from conftest.py — no real DB in unit tests
  - All rating columns: 1–5 range enforced by Pydantic validator AND DB CHECK constraint
  - is_moderated defaults False — reviews not public until admin approves
  - Soft delete only: set is_flagged=True, never DELETE FROM reviews

Wait for my plan approval before writing any code.
Today's goal: [DESCRIBE THE SPECIFIC STEP e.g. "Step 3.1 — Pydantic schemas"]
```

---

## PROMPT D — Frontend Session (Phase 4)

```
You are working on SurreyNest — a student housing platform.
The FastAPI backend is complete and working (Phase 3 done).
We are now on Phase 4: React frontend.

STEP 1 — READ THESE FILES (use Read tool):
  1. CLAUDE.md
  2. docs/progress.md             ← find next unchecked frontend item
  3. docs/conventions.md          ← JS/JSDoc rules, no TypeScript
  4. frontend/package.json        ← available packages (DO NOT add new ones without asking)

STEP 2 — CONFIRM:
  - Which page or component you're building today
  - What API endpoints it calls (check backend /docs first)
  - What props/state it needs

STEP 3 — PLAN:
For each file you'll create or modify:
  a) Full file path
  b) Props it accepts
  c) State variables (useState)
  d) API calls (which endpoint, what it returns)
  e) Error/loading/empty states (all three required)
  f) Any new component it depends on

Frontend rules:
  - All API calls go through src/services/api.js — never fetch() directly
  - All auth state via useAuth hook — never touch localStorage directly
  - Every page handles: loading state (skeleton), error state, empty state
  - Tailwind only — no inline styles, no CSS files
  - Score colours always from scoreHelpers.js — never hardcode green/amber/red
  - Leaflet maps: always include OSM attribution "© OpenStreetMap contributors"
  - vite.config.js proxy: /api → http://localhost:8000 (eliminates CORS in dev)

Wait for my plan approval before writing any code.
Today's goal: [DESCRIBE THE SPECIFIC PAGE/COMPONENT]
```

---

## PROMPT E — New Database Table Session (Phase 6+)

```
You are working on SurreyNest — a student housing platform.
I need to add a new database table.

STEP 1 — READ THESE FILES (use Read tool):
  1. CLAUDE.md
  2. docs/data-dictionary.md               ← existing table definitions
  3. backend/app/models/__init__.py         ← existing model imports
  4. backend/alembic/versions/62efbusz7xg4_initial_schema.py ← existing migration

STEP 2 — PLAN (required):
For the new table, specify:
  a) Table name
  b) Every column: name, type, nullable, default, index, FK
  c) Constraints (unique, check)
  d) Which existing tables it references (FK)
  e) The Alembic migration steps
  f) Any service or pipeline changes needed

Order of operations:
  1. Create SQLAlchemy model file in backend/app/models/
  2. Import it in backend/app/models/__init__.py
  3. alembic revision --autogenerate -m "add_{table_name}_table"
  4. Review generated migration (show me before running)
  5. alembic upgrade head
  6. Write the pipeline or service that populates it

Wait for my plan approval before writing any model file.
New table needed: [DESCRIBE WHAT DATA IT STORES AND WHY]
```

---

## PROMPT F — Bug Fix Session

```
You are working on SurreyNest — a student housing platform.

STEP 1 — READ THESE FILES (use Read tool):
  1. CLAUDE.md                    ← don't break what's working
  2. docs/progress.md             ← understand current phase context
  3. The specific file with the bug

STEP 2 — DIAGNOSE before fixing:
  - State what the bug is (exact error message or wrong behaviour)
  - State which file and line number
  - State what the correct behaviour should be
  - State why this bug exists (root cause)

STEP 3 — PLAN the fix:
  - Show the specific change (before/after)
  - Confirm no other files need changing
  - State which test would catch this if it existed

For single-line bug fixes: plan mode is optional but still explain the diagnosis.
For anything touching more than one file: full plan required, wait for approval.

Bug description: [PASTE ERROR MESSAGE OR DESCRIBE WRONG BEHAVIOUR]
```

---

## PROMPT G — End of Session (always run this before stopping)

```
Session is ending. Please do these three things:

1. UPDATE docs/progress.md:
   - Mark completed checklist items with [x]
   - Add a new "Notes for Next Session" block at the bottom with:
     - What was done this session (specific files created/modified)
     - Exact next step for the next session
     - Any gotchas or discoveries (column name surprises, API quirks, etc.)

2. RUN and confirm:
   cd backend && pytest -v --tb=short
   cd backend && black . --check
   cd backend && ruff check .
   Tell me the results (pass/fail counts).

3. COMMIT:
   Suggest a conventional commit message for what was built:
   Format: "feat: [what you built]" or "fix: [what you fixed]" or "data: [pipeline changes]"

Do not end the session without completing all three.
```

---

## Quick Reference — Critical Facts Claude Must Know

```
COLUMN NAMES (never get these wrong):
  properties.floor_area_m2       NOT total_floor_area, NOT floor_area
  properties.num_rooms           NOT number_habitable_rooms, NOT rooms
  properties.energy_rating       NOT current_energy_rating
  hmo_records (table name)       NOT hmo_licences
  hmo_records.raw_address        NOT address
  reviews.is_moderated           NOT moderated
  reviews.is_flagged             NOT deleted (soft delete only)

EPC API:
  URL:  https://epc.opendatacommunities.org/api/v1/domestic/search
  Auth: Basic Base64(EPC_API_USERNAME:EPC_API_KEY) from .env
  LA:   E07000209 = Guildford Borough
  Max:  5000 records per page
  Pagination: X-Next-Search-After response header

BUILD ORDER (Phase 3):
  schemas → services → main.py → routers → tests

SCORE FORMULAS:
  Safety:   100 - clamp((weighted_crimes / 95th_percentile) × 100, 0, 100)
  Fairness: ratio = actual/predicted → green ≤1.10, amber ≤1.25, red >1.25

NEVER:
  - Hard delete reviews (use is_flagged=True)
  - Store hashed_password in any response schema
  - Return 500 for missing score data (return null + available:false)
  - Call Postcodes.io without checking postcode_cache first
  - Use print() in backend code (use logging)
  - Modify Phase 1 or Phase 2 files without explicit instruction
```
