# Release Tonight

This is the fastest safe path to deploy SurreyNest on a zero-budget setup.

## 1. Prepare production environment

Copy the template and fill in real values:

```bash
cp .env.production.example .env.production
```

Required values:

- `POSTGRES_PASSWORD`
- `REDIS_PASSWORD`
- `SECRET_KEY`
- `INTERNAL_ADMIN_KEY`
- `ALLOWED_ORIGINS`
- `FRONTEND_URL`

Recommended:

- keep `VITE_API_URL=` blank so the frontend uses same-origin `/api`
- use your public server IP or a free hosting subdomain if you do not have a custom domain yet
- set `INTERNAL_ADMIN_KEY` to a separate strong secret used for internal moderation and pipeline routes
- add SMTP settings only if you plan to enable outbound email in your deployment
- if you do, set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM`
- add EPC credentials only if you are using the EPC pipeline in production

Generate strong secrets with:

```bash
openssl rand -hex 32
```

## 2. Public app behavior

The current SurreyNest web app is public and account-free:

- legacy `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, and `/admin/*` URLs redirect back to `/`
- internal moderation and pipeline endpoints stay protected behind `X-Internal-Admin-Key`
- `INTERNAL_ADMIN_KEY` must be set before the production backend will boot

## 3. Run release preflight

From the repo root:

```bash
./scripts/preflight_prod.sh
```

This validates production compose config, builds the production images, runs the backend tests, runs the frontend tests, and builds the frontend bundle.

## 4. Deploy

```bash
./scripts/deploy_prod.sh
```

This will:

- build production images
- start Postgres and Redis
- run `alembic upgrade head`
- start backend and frontend
- wait for backend health
- verify the frontend responds on port `80`

The backend image still uses multiple Uvicorn workers, but only one worker
claims the scheduler lock, so cron jobs do not duplicate.

The frontend nginx container also proxies `/health` to the backend, so
`curl http://YOUR_SERVER_IP/health` should return the FastAPI health JSON.

## 5. Post-deploy checks

Open these in your browser or with `curl`:

```bash
curl http://YOUR_SERVER_IP/health
curl http://YOUR_SERVER_IP/api/properties?postcode=GU2%207XH
curl http://YOUR_SERVER_IP/api/scores/safety?postcode=GU2%207XH
```

In the UI, check:

- home page loads
- search works
- property detail loads
- safety page loads
- rights guide loads
- agent tracker loads
- rent challenge page loads

## 6. If something fails

Check service state:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production ps
```

Check logs:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail=150 backend
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail=150 frontend
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail=150 postgres
```

## 7. One important note

This release path assumes Docker and Docker Compose are installed on the server and that port `80` is open.
