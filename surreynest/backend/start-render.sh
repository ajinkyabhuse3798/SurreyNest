#!/bin/sh
set -eu

alembic upgrade head

exec python -m uvicorn app.main:app \
  --host 0.0.0.0 \
  --port "${PORT:-10000}" \
  --workers "${WEB_CONCURRENCY:-1}"
