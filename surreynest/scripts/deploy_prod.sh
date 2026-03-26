#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${1:-$ROOT_DIR/.env.production}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE"
  echo "Copy $ROOT_DIR/.env.production.example to .env.production first."
  exit 1
fi

cd "$ROOT_DIR"

echo "==> Validating production compose config"
docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" config >/dev/null

echo "==> Building production images"
docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" build backend frontend

echo "==> Starting database and Redis"
docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" up -d postgres redis

echo "==> Running database migrations"
docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" run --rm backend alembic upgrade head

echo "==> Starting backend and frontend"
docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" up -d backend frontend

echo "==> Waiting for backend health"
backend_healthy=0
for attempt in {1..30}; do
  if docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" exec -T backend curl -fsS http://localhost:8000/health >/dev/null; then
    backend_healthy=1
    break
  fi
  sleep 2
done

if [[ "$backend_healthy" -ne 1 ]]; then
  echo "Backend did not become healthy in time."
  docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" logs --tail=120 backend
  exit 1
fi

echo "==> Verifying frontend responds"
frontend_healthy=0
for attempt in {1..30}; do
  if curl -fsS http://127.0.0.1/ >/dev/null; then
    frontend_healthy=1
    break
  fi
  sleep 2
done

if [[ "$frontend_healthy" -ne 1 ]]; then
  echo "Frontend did not respond in time."
  docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" logs --tail=120 frontend
  exit 1
fi

echo "==> Current service status"
docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" ps

echo "Production deployment completed."
