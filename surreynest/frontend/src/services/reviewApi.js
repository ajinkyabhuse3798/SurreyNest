/**
 * Review API, CRUD for reviews + admin moderation.
 *
 * Endpoints:
 *   GET    /api/reviews/{uprn}                   , public
 *   POST   /api/reviews                          , auth required
 *   DELETE /api/reviews/{reviewId}                , author or admin
 *   GET    /api/admin/reviews/queue               , admin only
 *   POST   /api/admin/reviews/{reviewId}/approve  , admin only
 *   POST   /api/admin/reviews/{reviewId}/reject   , admin only
 */
import api from './api'

// ── Public ───────────────────────────────────────────────────────────────────

/**
 * Get paginated reviews for a property.
 * Returns only moderated, unflagged reviews.
 * @param {string} uprn - Property UPRN
 * @param {number} [page=1]
 * @param {number} [perPage=10]
 * @returns {Promise<{ reviews: Array, total: number, page: number, pages: number }>}
 */
export async function getReviews(uprn, page = 1, perPage = 10) {
    const res = await api.get(`/api/reviews/${uprn}`, {
        params: { page, per_page: perPage },
    })
    return res.data
}

// ── Auth required ────────────────────────────────────────────────────────────

/**
 * Submit a new review for a property.
 * @param {{ uprn: string, overall_rating: number, landlord_rating: number,
 *   condition_rating: number, value_rating: number, weekly_rent_paid?: number,
 *   move_in_year?: number, review_text: string }} data
 * @returns {Promise<Object>} Created review
 */
export async function createReview(data) {
    const res = await api.post('/api/reviews', data)
    return res.data
}

/**
 * Soft-delete a review (author or admin).
 * @param {string} reviewId - Review UUID
 * @returns {Promise<{ detail: string }>}
 */
export async function deleteReview(reviewId) {
    const res = await api.delete(`/api/reviews/${reviewId}`)
    return res.data
}

// ── Admin moderation ─────────────────────────────────────────────────────────

/**
 * Get unmoderated reviews queue (admin only).
 * @param {number} [page=1]
 * @param {number} [perPage=20]
 * @returns {Promise<{ reviews: Array, total: number, page: number, pages: number }>}
 */
export async function getModerationQueue(page = 1, perPage = 20) {
    const res = await api.get('/api/admin/reviews/queue', {
        params: { page, per_page: perPage },
    })
    return res.data
}

/**
 * Approve a review (admin only).
 * @param {string} reviewId - Review UUID
 * @returns {Promise<Object>} Approved review
 */
export async function approveReview(reviewId) {
    const res = await api.post(`/api/admin/reviews/${reviewId}/approve`)
    return res.data
}

/**
 * Reject a review (admin only).
 * @param {string} reviewId - Review UUID
 * @returns {Promise<{ detail: string }>}
 */
export async function rejectReview(reviewId) {
    const res = await api.post(`/api/admin/reviews/${reviewId}/reject`)
    return res.data
}
