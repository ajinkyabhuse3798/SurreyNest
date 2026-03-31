"""Review routes: public read/write plus internal moderation controls."""

import logging
import math
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from app.rate_limit import limiter  # shared singleton, one instance for the whole app
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.property import Property
from app.models.review import Review
from app.schemas.review import ReviewCreate, ReviewListResponse, ReviewResponse
from app.services.internal_admin import require_internal_admin_key

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get(
    "/reviews/{uprn}",
    response_model=ReviewListResponse,
    summary="Get reviews for a property",
)
async def get_reviews(
    uprn: str,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
) -> ReviewListResponse:
    """Get paginated list of moderated, unflagged reviews for a property.

    Public endpoint, no auth required.
    """
    # Verify property exists
    prop = db.query(Property).filter(Property.uprn == uprn).first()
    if not prop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Property with UPRN {uprn} not found",
        )

    # Query moderated, unflagged reviews
    query = (
        db.query(Review)
        .filter(Review.uprn == uprn)
        .filter(Review.is_moderated == True)  # noqa: E712
        .filter(Review.is_flagged == False)  # noqa: E712
        .order_by(Review.created_at.desc())
    )

    total = query.count()
    offset = (page - 1) * per_page
    reviews = query.offset(offset).limit(per_page).all()

    return ReviewListResponse(
        reviews=[ReviewResponse.model_validate(r) for r in reviews],
        total=total,
        page=page,
        pages=math.ceil(total / per_page) if total > 0 else 0,
    )


@router.post(
    "/reviews",
    response_model=ReviewResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a review",
)
@limiter.limit(f"{settings.rate_limit_reviews}/hour")
async def create_review(
    request: Request,
    review_data: ReviewCreate,
    db: Session = Depends(get_db),
) -> ReviewResponse:
    """Create a new review for a property.

    Public endpoint. Reviews are always anonymous and start unmoderated.
    """
    # Verify property exists
    prop = db.query(Property).filter(Property.uprn == review_data.uprn).first()
    if not prop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Property with UPRN {review_data.uprn} not found",
        )

    review = Review(
        user_id=None,
        uprn=review_data.uprn,
        overall_rating=review_data.overall_rating,
        landlord_rating=review_data.landlord_rating,
        condition_rating=review_data.condition_rating,
        value_rating=review_data.value_rating,
        weekly_rent_paid=review_data.weekly_rent_paid,
        move_in_year=review_data.move_in_year,
        review_text=review_data.review_text,
        agent_name=review_data.agent_name,
    )
    db.add(review)
    db.commit()
    db.refresh(review)

    logger.info(
        "Review created: %s for UPRN %s by %s",
        review.id,
        review.uprn,
        "anonymous",
    )
    return ReviewResponse.model_validate(review)


@router.delete(
    "/reviews/{review_id}",
    status_code=status.HTTP_200_OK,
    summary="Soft-delete a review (internal only)",
)
async def delete_review(
    review_id: uuid.UUID,
    _internal_admin=Depends(require_internal_admin_key),
    db: Session = Depends(get_db),
) -> dict:
    """Soft-delete a review by setting is_flagged=True."""
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Review {review_id} not found",
        )

    review.is_flagged = True
    db.commit()

    logger.info("Review %s flagged by internal admin", review_id)
    return {"detail": f"Review {review_id} has been flagged and hidden"}


# ── Admin moderation endpoints ────────────────────────────────────────────────


@router.get(
    "/admin/reviews/queue",
    response_model=ReviewListResponse,
    summary="Get unmoderated reviews (internal only)",
)
@limiter.limit("30/minute")
async def get_moderation_queue(
    request: Request,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=50),
    _internal_admin=Depends(require_internal_admin_key),
    db: Session = Depends(get_db),
) -> ReviewListResponse:
    """Return reviews awaiting moderation.

    Internal-only endpoint returning reviews where is_moderated=False AND is_flagged=False.
    """
    query = (
        db.query(Review)
        .filter(Review.is_moderated == False)  # noqa: E712
        .filter(Review.is_flagged == False)  # noqa: E712
        .order_by(Review.created_at.asc())
    )

    total = query.count()
    offset = (page - 1) * per_page
    reviews = query.offset(offset).limit(per_page).all()

    return ReviewListResponse(
        reviews=[ReviewResponse.model_validate(r) for r in reviews],
        total=total,
        page=page,
        pages=math.ceil(total / per_page) if total > 0 else 0,
    )


@router.post(
    "/admin/reviews/{review_id}/approve",
    response_model=ReviewResponse,
    summary="Approve a review (internal only)",
)
@limiter.limit("30/minute")
async def approve_review(
    request: Request,
    review_id: uuid.UUID,
    _internal_admin=Depends(require_internal_admin_key),
    db: Session = Depends(get_db),
) -> ReviewResponse:
    """Approve a review by setting is_moderated=True.

    Internal-only endpoint that makes the review visible to public users.
    """
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Review {review_id} not found",
        )

    review.is_moderated = True
    db.commit()
    db.refresh(review)

    logger.info("Review %s approved by internal admin", review_id)
    return ReviewResponse.model_validate(review)


@router.post(
    "/admin/reviews/{review_id}/reject",
    status_code=status.HTTP_200_OK,
    summary="Reject a review (internal only)",
)
@limiter.limit("30/minute")
async def reject_review(
    request: Request,
    review_id: uuid.UUID,
    _internal_admin=Depends(require_internal_admin_key),
    db: Session = Depends(get_db),
) -> dict:
    """Reject a review by setting is_flagged=True.

    Internal-only endpoint that soft-deletes the review (never hard-deleted).
    """
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Review {review_id} not found",
        )

    review.is_flagged = True
    db.commit()

    logger.info("Review %s rejected by internal admin", review_id)
    return {"detail": f"Review {review_id} has been rejected and hidden"}
