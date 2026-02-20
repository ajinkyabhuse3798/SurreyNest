# SurreyNest 🏠

**Student housing quality and rights platform for Guildford, UK.**

Find fair-priced rentals, check HMO licensing status, see safety scores from local crime data, and know your rights as a tenant — all using free public data.

[![Built with FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688)](https://fastapi.tiangolo.com)
[![Frontend React](https://img.shields.io/badge/Frontend-React%2018-61DAFB)](https://react.dev)
[![Database PostgreSQL](https://img.shields.io/badge/DB-PostgreSQL%2015-336791)](https://postgresql.org)
[![All APIs Free](https://img.shields.io/badge/APIs-100%25%20Free-brightgreen)](#data-sources)

---

## The Problem

University of Surrey students face a documented housing crisis:
- Average campus rent ~£120/week with landlords generating £13M profit from halls
- Private rooms £500+/month with 19% year-on-year increases
- One in five homes in Onslow ward is an HMO — some unlicensed (fire safety risk)
- Students receive "very little information" about their legal rights

SurreyNest fixes this with free public data, a rent fairness ML model, and structured tenant reviews.

---

## Features

| Feature | Description |
|---------|-------------|
| 🔍 **Property Search** | Search by Guildford postcode + radius, results on interactive map |
| 💰 **Rent Fairness Score** | ML model predicts fair market rent, scores 0–100 |
| 🔒 **HMO Verification** | Real-time check against Guildford HMO public register |
| 🛡️ **Safety Score** | Aggregated from police.uk crime data by postcode sector |
| ⭐ **Tenant Reviews** | Structured ratings: landlord, condition, value, with moderation |
| ⚖️ **Rights Guide** | Interactive decision tree: deposits, repairs, eviction, HMO rights |

---

## Data Sources (all free)

| Dataset | Source | Update Frequency |
|---------|--------|-----------------|
| EPC Register | epc.opendatacommunities.org | Monthly |
| Guildford HMO Register | guildford.gov.uk / data.gov.uk | Weekly |
| Crime Data | data.police.uk | Monthly |
| Postcode Geocoding | api.postcodes.io | Static |
| Land Registry PPD | gov.uk/land-registry | Monthly |
| VOA Rental Stats | gov.uk/voa | Quarterly |
| Map Tiles | openstreetmap.org | Real-time |

---

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+
- Python 3.11+

### Setup

```bash
# Clone and enter project
git clone https://github.com/yourusername/surreynest
cd surreynest

# Copy env templates
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

# Edit both .env files with your values (see Configuration section)

# Start database + backend
docker-compose up -d

# Run migrations
docker exec surreynest-backend alembic upgrade head

# Load initial data (takes ~10-20 minutes first time)
docker exec surreynest-backend python -m app.data_pipelines.epc_pipeline
docker exec surreynest-backend python -m app.data_pipelines.hmo_pipeline
docker exec surreynest-backend python -m app.data_pipelines.crime_pipeline

# Train ML model
docker exec surreynest-backend python -m app.ml.train

# Start frontend
cd frontend && npm install && npm run dev
```

App will be at: http://localhost:5173
API docs at: http://localhost:8000/docs

---

## Configuration

### Backend (`backend/.env`)

```env
DATABASE_URL=postgresql://surreynest:password@localhost:5432/surreynest
SECRET_KEY=<generate: python -c "import secrets; print(secrets.token_hex(32))">
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_DAYS=30
ENVIRONMENT=development
ALLOWED_ORIGINS=http://localhost:5173
```

### Frontend (`frontend/.env.local`)

```env
VITE_API_URL=http://localhost:8000
```

---

## Project Structure

```
surreynest/
├── CLAUDE.md              ← AI assistant context (read this first)
├── docker-compose.yml
├── docs/                  ← Architecture docs, API reference, decisions
├── backend/
│   ├── app/
│   │   ├── main.py        ← FastAPI app
│   │   ├── models/        ← SQLAlchemy ORM models
│   │   ├── schemas/       ← Pydantic validation
│   │   ├── routers/       ← Route handlers
│   │   ├── services/      ← Business logic
│   │   ├── ml/            ← ML training + prediction
│   │   └── data_pipelines/ ← ETL jobs
│   └── tests/
└── frontend/
    └── src/
        ├── pages/
        ├── components/
        ├── hooks/
        └── services/
```

---

## Running Tests

```bash
# Backend
cd backend && pytest -v --cov=app

# Frontend
cd frontend && npm run test
```

---

## Deployment

- **Backend:** Railway.app — connect GitHub repo, set env vars in dashboard
- **Frontend:** Vercel — connect GitHub repo, set `VITE_API_URL` to your Railway backend URL

See `docs/deployment.md` for step-by-step instructions.

---

## Privacy & Legal

- Collects minimum necessary data (email + hashed password only)
- Reviews are moderated before publication
- Users can delete their account and all associated data
- All data sources used under Open Government Licence v3.0
- See `PRIVACY.md` for full privacy policy

---

## Roadmap

- [x] Data pipelines (EPC, HMO, crime)
- [x] ML rent fairness model
- [x] Core API (properties, scores, auth)
- [x] Frontend (search, map, property detail)
- [x] Review system with moderation
- [ ] Email verification on registration
- [ ] Landlord verified badge system
- [ ] Expand to other Surrey towns (Woking, Farnham)
- [ ] Mobile PWA enhancements

---

## Contributing

This is currently a solo project. Issues and suggestions welcome via GitHub Issues.

---

## License

MIT — see `LICENSE`
