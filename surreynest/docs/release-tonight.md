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
- `ALLOWED_ORIGINS`
- `FRONTEND_URL`

Recommended:

- keep `VITE_API_URL=` blank so the frontend uses same-origin `/api`
- use your public server IP or a free hosting subdomain if you do not have a custom domain yet
- add SMTP settings only if you want email verification and password reset to work on day one
- if you do, set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM`
- add EPC credentials only if you are using the EPC pipeline in production

Generate a strong app secret with:

```bash
openssl rand -hex 32
```

## 2. Free-launch auth behavior

If `SMTP_HOST` is blank, the app now behaves cleanly instead of pretending email works:

- new registrations are auto-verified and signed in
- legacy unverified users are auto-verified the next time they log in
- password reset shows an honest "not configured yet" message

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
- register, sign-in, and guest login work
- admin login works with a real admin account

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
