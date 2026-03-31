#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${1:-$ROOT_DIR/.env.production}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE"
  echo "Copy $ROOT_DIR/.env.production.example to .env.production first."
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

required_vars=(
  POSTGRES_PASSWORD
  REDIS_PASSWORD
  SECRET_KEY
  INTERNAL_ADMIN_KEY
  ALLOWED_ORIGINS
  FRONTEND_URL
)

missing=()
for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    missing+=("$var_name")
  fi
done

if (( ${#missing[@]} > 0 )); then
  echo "Missing required production variables:"
  printf ' - %s\n' "${missing[@]}"
  exit 1
fi

cd "$ROOT_DIR"

echo "==> Validating production compose config"
docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" config >/dev/null

echo "==> Building production images"
docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" build backend frontend

echo "==> Running backend test suite"
ALLOWED_ORIGINS="http://localhost:5173" \
FRONTEND_URL="http://localhost:5173" \
ENVIRONMENT="test" \
pytest -q

echo "==> Running frontend tests"
(cd frontend && npm test)

echo "==> Building frontend bundle"
(cd frontend && npm run build)

echo "Production preflight passed."
