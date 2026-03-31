"""Shared Redis cache for multi-worker deployment.

All response caches (leaderboard, heatmap, safety normaliser) use this
module instead of module-level dicts, so cached data is shared across
all Uvicorn workers.

Graceful degradation: if Redis is unavailable, every function returns
None (cache miss). The app still works, it just hits the DB directly,
identical to the pre-Redis behaviour.
"""

import json
import logging
from typing import Any, Optional

import redis

from app.config import settings

logger = logging.getLogger(__name__)

# ── Redis connection ─────────────────────────────────────────────────────────
# Created once at module level. Connection pooling is handled internally
# by the redis-py client.

_redis: Optional[redis.Redis] = None


def _get_redis() -> Optional[redis.Redis]:
    """Lazy-initialise and return the Redis client.

    Returns:
        Redis client, or None if connection fails.
    """
    global _redis
    if _redis is not None:
        return _redis

    try:
        _redis = redis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
        # Test the connection
        _redis.ping()
        logger.info("Redis connected: %s", settings.redis_url)
        return _redis
    except Exception as e:
        logger.warning(
            "Redis unavailable (%s), caching disabled, falling back to DB", e
        )
        _redis = None
        return None


def get_json(key: str) -> Optional[Any]:
    """Read a JSON-serialised value from Redis.

    Args:
        key: Cache key (e.g. "leaderboard:GU2_10").

    Returns:
        Deserialised Python object, or None on cache miss / Redis down.
    """
    client = _get_redis()
    if client is None:
        return None

    try:
        raw = client.get(key)
        if raw is not None:
            return json.loads(raw)
    except Exception as e:
        logger.warning("Redis GET failed for key '%s': %s", key, e)

    return None


def set_json(key: str, data: Any, ttl_seconds: int = 600) -> None:
    """Write a JSON-serialisable value to Redis with TTL.

    Args:
        key: Cache key.
        data: Any JSON-serialisable Python object (dict, list, etc.).
        ttl_seconds: Time-to-live in seconds (default 10 minutes).
    """
    client = _get_redis()
    if client is None:
        return

    try:
        client.setex(key, ttl_seconds, json.dumps(data, default=str))
    except Exception as e:
        logger.warning("Redis SET failed for key '%s': %s", key, e)


def delete_pattern(pattern: str) -> int:
    """Delete all keys matching a glob pattern (e.g. 'leaderboard:*').

    Uses SCAN instead of KEYS to avoid blocking Redis on large key spaces.
    Useful for cache invalidation when pipelines refresh data.

    Args:
        pattern: Redis glob pattern.

    Returns:
        Number of keys deleted, or 0 if Redis is down.
    """
    client = _get_redis()
    if client is None:
        return 0

    try:
        deleted = 0
        for key in client.scan_iter(match=pattern, count=100):
            client.delete(key)
            deleted += 1
        return deleted
    except Exception as e:
        logger.warning("Redis DELETE failed for pattern '%s': %s", pattern, e)

    return 0
