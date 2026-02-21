"""Review routes: GET/POST /reviews, DELETE /reviews/{id}.

GET is public (moderated reviews only). POST requires auth.
DELETE requires admin role (soft-deletes via is_flagged=True).
"""

import logging
import math
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.property import Property
from app.models.review import Review
from app.models.user import User
from app.schemas.review import ReviewCreate, ReviewListResponse, ReviewResponse
from app.services.auth_service import get_current_user, require_admin

logger = logging.getLogger(__name__)

router = APIRouter()

limiter = Limiter(key_func=get_remote_address)


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

    Public endpoint — no auth required.
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
    summary="Submit a review (requires auth)",
)
@limiter.limit(f"{settings.rate_limit_reviews}/hour")
async def create_review(
    request: Request,
    review_data: ReviewCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReviewResponse:
    """Create a new review for a property.

    Requires authentication. One review per user per property.
    Reviews start as unmoderated (not visible until admin approves).
    """
    # Verify property exists
    prop = db.query(Property).filter(Property.uprn == review_data.uprn).first()
    if not prop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Property with UPRN {review_data.uprn} not found",
        )

    # Check for existing review by this user for this property
    existing = (
        db.query(Review)
        .filter(Review.user_id == current_user.id)
        .filter(Review.uprn == review_data.uprn)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already reviewed this property",
        )

    review = Review(
        user_id=current_user.id,
        uprn=review_data.uprn,
        overall_rating=review_data.overall_rating,
        landlord_rating=review_data.landlord_rating,
        condition_rating=review_data.condition_rating,
        value_rating=review_data.value_rating,
        weekly_rent_paid=review_data.weekly_rent_paid,
        move_in_year=review_data.move_in_year,
        review_text=review_data.review_text,
    )
    db.add(review)
    db.commit()
    db.refresh(review)

    logger.info("Review created: %s for UPRN %s by user %s", review.id, review.uprn, current_user.id)
    return ReviewResponse.model_validate(review)


@router.delete(
    "/reviews/{review_id}",
    status_code=status.HTTP_200_OK,
    summary="Soft-delete a review (admin only)",
)
async def delete_review(
    review_id: uuid.UUID,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    """Soft-delete a review by setting is_flagged=True.

    Admin only — never hard-deletes reviews.
    """
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Review {review_id} not found",
        )

    review.is_flagged = True
    db.commit()

    logger.info("Review %s flagged by admin %s", review_id, current_user.id)
    return {"detail": f"Review {review_id} has been flagged and hidden"}
