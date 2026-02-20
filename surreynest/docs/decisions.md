# Architecture Decision Log

> Every significant technical decision recorded with reasoning.
> Read this before suggesting architectural changes.

---

## ADR-001: Python + FastAPI for backend (not Node.js/Express)

**Decision:** Use Python 3.11 + FastAPI

**Reasoning:**
- The ML model (scikit-learn, pandas, joblib) is Python — keeping ML and API in the same language eliminates serialisation overhead and simplifies deployment
- FastAPI auto-generates OpenAPI docs at `/docs` — invaluable during development
- Async support handles concurrent API requests efficiently
- Strong type safety via Pydantic schemas

**Rejected alternatives:**
- Node.js/Express: would require calling Python ML service separately, adds deployment complexity
- Django: too heavyweight, too opinionated for a REST API

---

## ADR-002: PostgreSQL + PostGIS (not MongoDB, not SQLite)

**Decision:** PostgreSQL 15 with PostGIS extension

**Reasoning:**
- `ST_DWithin` spatial queries ("find all properties within 500m of this postcode") are the core search feature — PostGIS handles this natively and efficiently
- Relational structure is natural: users → reviews → properties → EPC data
- UPRN is a reliable join key across all datasets
- Alembic migrations provide safe, versioned schema changes

**Rejected alternatives:**
- MongoDB: no natural spatial index for radius queries; less suitable for relational data
- SQLite: no PostGIS, no concurrent writes, not suitable for production

---

## ADR-003: scikit-learn (not PyTorch/TensorFlow)

**Decision:** scikit-learn GradientBoostingRegressor

**Reasoning:**
- Tabular rent prediction with ~10,000 rows doesn't need deep learning
- scikit-learn Pipeline is easy to serialise (joblib) and serve
- Faster training, no GPU requirement, simpler deployment
- Interpretable: feature_importances_ helps explain the model to users

**When to revisit:** If dataset grows beyond 100,000 rows with rich text features (review sentiment), consider XGBoost or LightGBM

---

## ADR-004: JWT (not server-side sessions)

**Decision:** JWT tokens stored in localStorage

**Reasoning:**
- SPA architecture (React) pairs naturally with JWT — no server-side session store needed
- Stateless: backend doesn't need to track sessions
- Simpler deployment: no Redis session store required

**Security trade-offs acknowledged:**
- localStorage is vulnerable to XSS — mitigated by strict CSP headers and no user-controlled HTML rendering
- Tokens can't be truly revoked until expiry — mitigated by 30-day expiry and logout clearing localStorage
- Alternative (httpOnly cookies) would be better for high-security app — acceptable risk for MVP

**When to revisit:** If we add high-value transactions (payments, sensitive data), switch to httpOnly cookies

---

## ADR-005: APScheduler (not Celery + Redis)

**Decision:** APScheduler running in-process inside FastAPI

**Reasoning:**
- Celery requires Redis as message broker — adds another service to run, deploy, and monitor
- Our jobs are simple: run once per day/week/month, low volume
- APScheduler runs in the same Python process — simpler debugging, no separate worker process
- If a job fails, it's logged in `pipeline_runs` table — no complex task queue needed

**When to revisit:** If jobs become long-running (>5 minutes) or need to be retried with complex logic, migrate to Celery

---

## ADR-006: Soft-delete reviews (not hard delete)

**Decision:** `is_flagged=true` instead of DELETE FROM reviews

**Reasoning:**
- Audit trail: if a landlord complains a review was unfair, we need to see the original content
- Safety: if a review contains a genuine safeguarding concern (e.g., reports harassment), we must not lose it
- Analytics: moderation statistics require knowing what was rejected, not just what was approved

**Implementation:** Admin "delete" sets `is_flagged=true`. Reviews with `is_flagged=true` are never returned in public API responses.

---

## ADR-007: One review per user per property

**Decision:** Unique constraint on `(user_id, uprn)`

**Reasoning:**
- Prevents gaming the review system (one user leaving 10 five-star reviews for their own property)
- Students typically rent one property per year — one review is the natural use case
- If someone moves out and back in, they can ask admin to reset their review

---

## ADR-008: Aggregate crime data to postcode sector (not street level)

**Decision:** Store and score crime at postcode sector level (e.g., `GU2 7`) not full postcode

**Reasoning:**
- Street-level data is sparse — `GU2 7XH` might have 0 crimes in a month due to sample size, not safety
- Postcode sector covers ~500–2000 properties — sufficient sample for reliable scoring
- Reduces data volume significantly in the `crime_data` table
- police.uk acknowledges location data is approximate anyway

---

## ADR-009: No TypeScript for MVP frontend

**Decision:** Plain JavaScript with JSDoc comments

**Reasoning:**
- TypeScript adds build complexity and debugging friction during rapid prototyping
- For a solo developer with Claude Code assistance, the type safety benefit is lower
- JSDoc provides IDE hints without compilation step
- Can migrate to TypeScript post-MVP if team grows

---

## ADR-010: Leaflet.js + OpenStreetMap (not Google Maps)

**Decision:** Leaflet.js with OpenStreetMap tiles

**Reasoning:**
- Google Maps API requires billing account, charges after free tier (10k loads/month)
- OpenStreetMap is completely free with attribution
- react-leaflet integrates cleanly with React 18
- Map features needed (markers, popups, radius circles) are well-supported

**Limitation acknowledged:** OSM tiles can be slower than Google Maps in some regions — acceptable for MVP

---

## ADR-011: No email verification on registration (MVP)

**Decision:** Skip email verification for launch

**Reasoning:**
- Requires SMTP setup, email template, token storage — adds complexity
- Students want to try the product immediately
- Risk: fake email accounts submitting fake reviews — mitigated by moderation system

**Post-MVP:** Add email verification. Use `is_verified` column (already in schema). Block review submission until verified.

---

## ADR-012: VOA median bands as initial ML training target

**Decision:** Use VOA Private Rental Market Statistics as rent target for v1 model

**Reasoning:**
- No actual rent data in EPC register
- Rightmove scraping is legally grey for production use
- VOA data is official, free, under OGL, and updated quarterly
- Sufficient for MVP fairness scoring (identifies gross overpricing even if predictions aren't precise)

**Migration path:** When 50+ user-submitted rents are collected via reviews, retrain with real data as v2 model
