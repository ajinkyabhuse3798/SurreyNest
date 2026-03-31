"""ORM model for the `letting_agents` table.

Stores verified letting agent profiles. Agent reputation is built from
reviews (via agent_name on reviews table), not from this table.
This table is only for verified/premium agent profiles.
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.types import JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class LettingAgent(Base):
    """Verified letting agent profile.

    Attributes:
        id: Integer primary key.
        name: Normalised slug (e.g. "cavenders-guildford"), lowercase, unique.
        display_name: Human-readable name (e.g. "Cavenders Guildford").
        postcode_sectors: JSON list of postcode sectors the agent operates in.
        website: Agent website URL (optional).
        is_verified: True when we've manually verified the agent.
        created_at: UTC timestamp when profile was created.
        updated_at: UTC timestamp of last update.
    """

    __tablename__ = "letting_agents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    postcode_sectors: Mapped[Optional[list]] = mapped_column(
        JSON, nullable=True, default=list
    )
    website: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    is_verified: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    def __repr__(self) -> str:
        return f"<LettingAgent name={self.name} verified={self.is_verified}>"
