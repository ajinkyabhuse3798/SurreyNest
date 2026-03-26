# Deployment Guide

> Step-by-step instructions for deploying SurreyNest to production.
> Uses Railway.app (backend + database) + Vercel (frontend) — both free tiers.

---

## Architecture

```
Internet
    │
    ├── Vercel (React frontend, static CDN)
    │       │
    │       └── API calls to →
    │
    └── Railway.app (FastAPI backend)
            │
            └── Connected to →
                    │
                    └── Railway PostgreSQL (database)
```

---

## Pre-Deployment Checklist

- [ ] All tests passing: `pytest -v` exits 0
- [ ] Frontend builds without errors: `npm run build`
- [ ] No secrets in code (grep for hardcoded passwords, API keys)
- [ ] `.env` is in `.gitignore` and NOT committed
- [ ] Privacy policy page is live (required before real users)
- [ ] `alembic upgrade head` works cleanly on a fresh DB

---

## Step 1: Deploy Backend to Railway.app

### 1.1 Create Railway account
- Go to railway.app
- Sign up with GitHub (easiest — enables auto-deploy)

### 1.2 Create new project
- Click "New Project"
- Select "Deploy from GitHub repo"
- Select your `surreynest` repository
- Set root directory to: `backend`

### 1.3 Add PostgreSQL database
- In your Railway project, click "New"
- Select "Database" → "PostgreSQL"
- Railway automatically sets `DATABASE_URL` in your backend service

### 1.4 Set environment variables
In the Railway backend service → Variables tab, add:
```
SECRET_KEY=<your 64-char hex — generate fresh, never reuse dev key>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_DAYS=30
ENVIRONMENT=production
ALLOWED_ORIGINS=https://your-app.vercel.app
FRONTEND_URL=https://your-app.vercel.app
ML_MODEL_VERSION=v7.0.0
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM="SurreyNest <noreply@surreynest.com>"
```

### 1.5 Configure start command
In Railway service settings → Start Command:
```
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```
(Railway injects `$PORT` automatically)

The backend can still run multiple workers for request concurrency; only one
worker will acquire the APScheduler lock and register cron jobs.

### 1.6 Run database migrations
In Railway → your backend service → "Open shell" (or use Railway CLI):
```bash
alembic upgrade head
```

### 1.7 Enable PostGIS
```bash
# Connect to Railway PostgreSQL shell and run:
CREATE EXTENSION IF NOT EXISTS postgis;
```

### 1.8 Verify
- Open `https://your-app.railway.app/docs`
- You should see the FastAPI Swagger UI
- Test `GET /properties` returns a valid response (empty array initially)

---

## Step 2: Deploy Frontend to Vercel

### 2.1 Create Vercel account
- Go to vercel.com
- Sign up with GitHub

### 2.2 Import project
- Click "New Project"
- Import your `surreynest` repository
- Set Root Directory to: `frontend`
- Framework Preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`

### 2.3 Set environment variables
In Vercel project → Settings → Environment Variables:
```
VITE_API_URL=https://your-app.railway.app
VITE_APP_VERSION=0.1.0
```

### 2.4 Deploy
Click "Deploy". Vercel builds and deploys automatically.

### 2.5 Update Railway ALLOWED_ORIGINS
Once you have the Vercel URL (`https://surreynest.vercel.app`):
- Update Railway environment variable: `ALLOWED_ORIGINS=https://surreynest.vercel.app`
- Update Railway environment variable: `FRONTEND_URL=https://surreynest.vercel.app`
- Railway auto-redeploys

---

## Step 3: Load Data (Production)

Run pipelines on production backend via Railway shell or Railway CLI:

```bash
# EPC pipeline (large — takes ~10 minutes)
python -m app.data_pipelines.epc_pipeline

# HMO pipeline
python -m app.data_pipelines.hmo_pipeline

# Crime pipeline (takes ~20 minutes — hits police.uk for all postcodes)
python -m app.data_pipelines.crime_pipeline

# Land Registry
python -m app.data_pipelines.land_registry_pipeline

# Train ML model
python -m app.ml.train
```

---

## Step 4: Verify End-to-End

1. Open your Vercel URL
2. Search for postcode `GU2 7XH`
3. Verify properties appear on map
4. Click a property — verify scores show
5. Register a new account
6. Log in
7. Submit a test review (check it enters moderation queue)
8. Log in with admin account — verify moderation queue shows the review

---

## Auto-Deploy Setup

Both Railway and Vercel auto-deploy on push to `main` branch:
- Push code → GitHub → Railway rebuilds backend → Vercel rebuilds frontend
- Database migrations do NOT run automatically — run manually after schema changes

---

## Monitoring

### Railway
- View logs: Railway dashboard → service → "Logs" tab
- Set up alerts: Railway → project → "Notifications" → email on deploy failure

### Vercel
- View function logs: Vercel dashboard → project → "Functions" tab
- Build logs: automatically shown during deploy

### Application-level
- Pipeline run history: query `pipeline_runs` table in production DB
- Error monitoring: check backend logs for ERROR-level entries

---

## Rollback Procedure

### Backend rollback (Railway)
1. Railway dashboard → service → "Deployments"
2. Find previous working deployment
3. Click "Redeploy" on that version

### Database rollback
```bash
# Roll back last migration
alembic downgrade -1

# Roll back to specific revision
alembic downgrade <revision_id>
```

### Frontend rollback (Vercel)
1. Vercel dashboard → project → "Deployments"
2. Find previous working deployment
3. Click "..." → "Promote to Production"

---

## Custom Domain (Optional)

### Vercel
- Vercel project → Settings → Domains → Add domain
- Add CNAME record at your DNS provider pointing to `cname.vercel-dns.com`

### Railway
- Railway service → Settings → Networking → Custom Domain
- Add CNAME record pointing to your Railway domain

After adding custom domain, update `ALLOWED_ORIGINS` in Railway to include the new domain.

---

## Cost Monitoring

Both Railway and Vercel have free tiers. Watch:
- **Railway:** $5/month credit included. PostgreSQL is the main usage. Monitor in Railway billing dashboard.
- **Vercel:** 100GB bandwidth/month free. Monitor in Vercel dashboard.

If approaching limits: Railway paid plan is $20/month, Vercel Pro is $20/month. Well within budget for a startup.
