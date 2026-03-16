"""ORM model for the `auth_tokens` table.

Stores one-time tokens for email verification and password reset.
Raw tokens are NEVER stored — only their SHA-256 hash.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AuthToken(Base):
    """One-time auth token for email verification or password reset.

    Attributes:
        id: UUID primary key.
        user_id: FK to the user this token belongs to. Cascade-deleted.
        token_hash: SHA-256 hex digest of the raw token. Never the raw value.
        token_type: Either "reset" or "verify".
        expires_at: UTC expiry timestamp. Validated before use.
        used_at: Set when token is consumed. Prevents replay attacks.
        created_at: UTC creation timestamp.
    """

    __tablename__ = "auth_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token_hash: Mapped[str] = mapped_column(
        String(64),  # SHA-256 hex digest = 64 chars
        unique=True,
        index=True,
        nullable=False,
    )
    token_type: Mapped[str] = mapped_column(
        String(20),  # "reset" | "verify"
        nullable=False,
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    def __repr__(self) -> str:
        return f"<AuthToken type={self.token_type} user_id={self.user_id} used={self.used_at is not None}>"
