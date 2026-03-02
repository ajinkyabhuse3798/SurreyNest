"""FastAPI application entry point.

Configures CORS, mounts all routers under /api, loads the ML model on startup,
starts APScheduler for background jobs, and provides a global exception handler
and health check endpoint.
"""

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.config import settings
from app.rate_limit import limiter  # shared singleton — one instance for the whole app

logger = logging.getLogger(__name__)


# ── Lifespan context manager ─────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Manage startup and shutdown lifecycle.

    Startup:
        1. Load ML model into memory (non-fatal if missing).
        2. Start APScheduler (jobs added in Phase 5).

    Shutdown:
        1. Gracefully shut down APScheduler.
    """
    logger.info("SurreyNest API starting up (environment=%s)", settings.environment)

    # ── Load ML model ─────────────────────────────────────────────────────
    try:
        from app.ml.predict import load_model

        load_model()
        logger.info("ML model loaded successfully")
    except Exception:
        logger.warning(
            "ML model could not be loaded — predictions unavailable",
            exc_info=True,
        )

    # ── Start APScheduler ─────────────────────────────────────────────────
    from app.data_pipelines.scheduler import register_jobs

    scheduler = AsyncIOScheduler()
    scheduler.start()
    register_jobs(scheduler)
    app.state.scheduler = scheduler
    logger.info("APScheduler started with %d jobs", len(scheduler.get_jobs()))

    logger.info("Startup complete")

    yield

    # ── Shutdown ──────────────────────────────────────────────────────────
    scheduler.shutdown(wait=False)
    logger.info("APScheduler shut down")
    logger.info("SurreyNest API shutdown complete")


# ── App instance ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="SurreyNest API",
    description="Guildford student rental intelligence platform",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Attach limiter to app state (required by slowapi)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS middleware ───────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Import and mount routers ─────────────────────────────────────────────────
from app.routers import auth, hmo, listings, pipelines, properties, reviews, scores  # noqa: E402

app.include_router(auth.router, prefix="/api", tags=["Auth"])
app.include_router(properties.router, prefix="/api", tags=["Properties"])
app.include_router(hmo.router, prefix="/api", tags=["HMO"])
app.include_router(scores.router, prefix="/api", tags=["Scores"])
app.include_router(reviews.router, prefix="/api", tags=["Reviews"])
app.include_router(pipelines.router, prefix="/api", tags=["Pipelines (Admin)"])
app.include_router(listings.router, prefix="/api", tags=["Listings"])


# ── Global exception handler ─────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch all unhandled exceptions, log them, return clean 500 JSON.

    Args:
        request: The incoming request.
        exc: The unhandled exception.

    Returns:
        JSONResponse with 500 status and generic error detail.
    """
    logger.error(
        "Unhandled exception on %s %s: %s",
        request.method,
        request.url.path,
        str(exc),
        exc_info=True,
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
    )


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health_check() -> dict:
    """Health check endpoint.

    Returns:
        dict with status and environment.
    """
    return {
        "status": "ok",
        "environment": settings.environment,
    }
