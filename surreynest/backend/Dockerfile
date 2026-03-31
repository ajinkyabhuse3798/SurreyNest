# ─── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /build

# Install system deps needed for compilation (psycopg2, geospatial libs)
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps into a clean prefix
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ─── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM python:3.11-slim

WORKDIR /app

# Install only runtime system libraries (no gcc)
RUN apt-get update && apt-get install -y \
    curl \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Copy pre-built Python packages from builder
COPY --from=builder /install /usr/local

# Copy application code (excludes tests, dev files via .dockerignore)
COPY app/ ./app/
COPY alembic/ ./alembic/
COPY alembic.ini .
COPY start-render.sh ./start-render.sh

# Create data directories (for pipeline outputs and ML models)
RUN mkdir -p data/raw data/processed app/ml/models app/ml/plots \
    && chmod +x /app/start-render.sh

# Non-root user for security
RUN useradd --create-home appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 10000

# Run migrations before starting the app on Render.
CMD ["./start-render.sh"]
