# CLAUDE.md — SurreyNest Project Context

> This file is read automatically by Claude Code at the start of every session.
> It contains everything needed to work on this project without re-explaining context.

---

## What is SurreyNest?

SurreyNest is a **student housing quality and rights platform** for Guildford, UK.
It solves three documented problems for University of Surrey students:

1. **Rent transparency** — students overpay with no benchmark. We provide ML-predicted fair rent scores.
2. **HMO safety** — landlords operate unlicensed HMOs (real fire risk). We show licensing status from the Guildford HMO public register.
3. **Rights awareness** — students don't know their legal rights. We provide an interactive rights guide.

**Target users:** University of Surrey students, Guildford renters, landlords seeking verified badges.

**Business model:** Freemium (free search, premium landlord verification), not yet implemented — focus on the product first.

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
| Deployment | **Railway.app** (backend + DB) + **Vercel** (frontend) | Both free tiers |

**All external APIs are free.** See `docs/api-reference.md` for full list.

---

## Project Structure

```
surreynest/
├── CLAUDE.md                  ← YOU ARE HERE
├── README.md
├── docker-compose.yml
├── .gitignore
├── docs/
│   ├── api-reference.md       ← All free APIs used
│   ├── data-dictionary.md     ← What every DB column means
│   ├── ml-model.md            ← ML model design decisions
│   └── decisions.md           ← Architecture decision log
├── backend/
│   ├── app/
│   │   ├── main.py            ← FastAPI entry point
│   │   ├── config.py          ← Env var loading
│   │   ├── database.py        ← SQLAlchemy engine + session
│   │   ├── models/            ← ORM table definitions
│   │   ├── schemas/           ← Pydantic validation shapes
│   │   ├── routers/           ← Route handlers (thin)
│   │   ├── services/          ← Business logic
│   │   ├── ml/                ← Training, prediction, evaluation
│   │   └── data_pipelines/    ← ETL jobs
│   ├── data/
│   │   ├── raw/               ← Downloaded source files (gitignored)
│   │   └── processed/         ← Cleaned CSVs (gitignored)
│   ├── tests/
│   ├── alembic/
│   ├── requirements.txt
│   ├── .env.example
│   └── Dockerfile
└── frontend/
    ├── src/
    │   ├── pages/
    │   ├── components/
    │   ├── hooks/
    │   ├── services/
    │   └── utils/
    ├── vite.config.js
    └── package.json
```

---

## Coding Conventions (follow always)

### Python (Backend)
- **Formatter:** `black` — run before every commit
- **Linter:** `ruff` — zero warnings allowed
- **Type hints:** required on all function signatures
- **Docstrings:** Google style on all public functions and classes
- **Imports:** stdlib → third-party → local, separated by blank lines
- **Error handling:** raise specific HTTPException with detail messages, never bare `except:`
- **Logging:** use `logging.getLogger(__name__)` — never use `print()` in production code
- **Secrets:** always read from `config.py` which reads from env vars — never hardcode

### TypeScript/JavaScript (Frontend)
- **No TypeScript** for MVP — plain JavaScript with JSDoc comments
- **Formatter:** Prettier — run before every commit
- **Component style:** functional components with hooks only — no class components
- **State:** useState + useContext for auth, no Redux for MVP
- **API calls:** all go through `src/services/api.js` Axios instance — never fetch() directly
- **Error handling:** every API call in try/catch — show user-friendly error messages

### Git
- **Branch naming:** `feature/`, `fix/`, `data/`, `ml/`
- **Commit messages:** conventional commits — `feat:`, `fix:`, `data:`, `ml:`, `docs:`
- **Never commit:** `.env`, `data/raw/`, `data/processed/`, `*.pkl` model files, `__pycache__`

---

## Environment Variables

Backend reads from `backend/.env` (never committed). See `backend/.env.example` for required keys.

```
DATABASE_URL=postgresql://surreynest:password@localhost:5432/surreynest
SECRET_KEY=<64-char hex — generate with: python -c "import secrets; print(secrets.token_hex(32))">
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_DAYS=30
ENVIRONMENT=development
ALLOWED_ORIGINS=http://localhost:5173
```

Frontend reads from `frontend/.env.local`:
```
VITE_API_URL=http://localhost:8000
```

---

## Running the Project Locally

```bash
# Start database and backend
docker-compose up -d

# Run DB migrations
docker exec surreynest-backend alembic upgrade head

# Start frontend (separate terminal)
cd frontend && npm run dev

# Run data pipelines (first time setup)
cd backend && python -m app.data_pipelines.epc_pipeline
cd backend && python -m app.data_pipelines.hmo_pipeline
cd backend && python -m app.data_pipelines.crime_pipeline

# Train ML model
cd backend && python -m app.ml.train

# Run backend tests
cd backend && pytest -v

# Run frontend tests
cd frontend && npm run test
```

FastAPI auto-docs available at: `http://localhost:8000/docs`

---

## Key Decisions Already Made

1. **No TypeScript for MVP** — adds complexity without benefit at this stage
2. **APScheduler not Celery** — Celery requires Redis broker; APScheduler runs in-process; fine for MVP
3. **scikit-learn not PyTorch** — tabular rent prediction doesn't need deep learning
4. **Soft-delete reviews** — never hard-delete; set `is_flagged=True`; needed for audit trail
5. **JWT not sessions** — stateless auth works well for the SPA architecture
6. **PostGIS not Haversine in Python** — spatial queries in the DB are faster at scale
7. **OpenStreetMap not Google Maps** — zero cost, attribution required in UI

See `docs/decisions.md` for full reasoning on each.

---

## What NOT to Build Yet

- Payment/subscription system
- Email verification on registration (add post-MVP)
- Landlord-side dashboard (add post-MVP)
- Mobile app (PWA via React is sufficient)
- Redis caching layer (add when needed, not upfront)
- Elasticsearch (PostgreSQL full-text search is enough for MVP)

---

## Current Build Phase

Check `docs/progress.md` for what's done and what's next.
When starting a session, read that file first before writing any code.
