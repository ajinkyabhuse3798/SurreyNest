"""ORM model for the `reviews` table.

Tenant-submitted property reviews. Never hard-deleted, soft-deleted via
is_flagged=True when an admin rejects. Anonymised (user_id set to NULL) when
a user deletes their account.
"""


import uuid
from typing import Optional

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Review(Base):
    """Tenant review of a property.

    Attributes:
        id: UUID primary key.
        user_id: FK to users.id. NULL when the account has been deleted.
        uprn: FK to properties.uprn, the reviewed property.
        overall_rating: 1 to 5 star overall rating.
        landlord_rating: 1 to 5, landlord responsiveness and professionalism.
        condition_rating: 1 to 5, property condition and maintenance.
        value_rating: 1 to 5, rent value for money.
        weekly_rent_paid: Self-reported weekly rent in £ (optional, helps the ML model).
        move_in_year: Year tenancy started (optional, temporal context).
        review_text: Free text 50 to 1000 characters.
        created_at: UTC timestamp.
        is_moderated: False until an admin approves, not shown until True.
        is_flagged: True when admin rejects, soft-delete mechanism.
    """

    __tablename__ = "reviews"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    uprn: Mapped[str] = mapped_column(
        String(20),
        ForeignKey("properties.uprn", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    overall_rating: Mapped[int] = mapped_column(Integer, nullable=False)
    landlord_rating: Mapped[int] = mapped_column(Integer, nullable=False)
    condition_rating: Mapped[int] = mapped_column(Integer, nullable=False)
    value_rating: Mapped[int] = mapped_column(Integer, nullable=False)
    weekly_rent_paid: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    move_in_year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    agent_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    review_text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    is_moderated: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )
    is_flagged: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )

    __table_args__ = (
        # One review per user per property
        UniqueConstraint("user_id", "uprn", name="uq_reviews_user_uprn"),
        # Enforce 1 to 5 star range on all rating columns
        CheckConstraint("overall_rating >= 1 AND overall_rating <= 5", name="ck_overall_rating"),
        CheckConstraint("landlord_rating >= 1 AND landlord_rating <= 5", name="ck_landlord_rating"),
        CheckConstraint("condition_rating >= 1 AND condition_rating <= 5", name="ck_condition_rating"),
        CheckConstraint("value_rating >= 1 AND value_rating <= 5", name="ck_value_rating"),
    )

    def __repr__(self) -> str:
        return (
            f"<Review id={self.id} uprn={self.uprn} "
            f"overall={self.overall_rating} moderated={self.is_moderated}>"
        )
