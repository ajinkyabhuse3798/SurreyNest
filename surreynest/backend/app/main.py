"""FastAPI application entry point.

Configures CORS, mounts all routers under /api, loads the ML model on startup,
and provides a global exception handler and health check endpoint.
"""

import logging

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.config import settings

logger = logging.getLogger(__name__)

# ── Rate limiter singleton ────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)

# ── App instance ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="SurreyNest API",
    description="Guildford student rental intelligence platform",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
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
from app.routers import auth, hmo, properties, reviews, scores  # noqa: E402

app.include_router(properties.router, prefix="/api", tags=["Properties"])
app.include_router(scores.router, prefix="/api", tags=["Scores"])
app.include_router(hmo.router, prefix="/api", tags=["HMO"])
app.include_router(auth.router, prefix="/api", tags=["Auth"])
app.include_router(reviews.router, prefix="/api", tags=["Reviews"])


# ── Startup event ─────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup_event() -> None:
    """Run on application startup: load ML model into memory."""
    logger.info("SurreyNest API starting up (environment=%s)", settings.environment)

    # Load ML model once into memory
    try:
        from app.ml.predict import load_model

        load_model()
        logger.info("ML model loaded successfully")
    except Exception:
        logger.warning("ML model could not be loaded — predictions unavailable", exc_info=True)

    logger.info("Startup complete")


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
