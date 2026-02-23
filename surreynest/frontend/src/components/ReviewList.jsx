/**
 * ReviewList — paginated list of moderated reviews for a property.
 * Fetches from GET /api/reviews/{uprn}.
 *
 * @param {{ uprn: string }} props
 */
import { useState, useEffect } from 'react'
import api from '../services/api'

export default function ReviewList({ uprn }) {
    const [reviews, setReviews] = useState([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        setLoading(true)
        setError(null)
        api
            .get(`/api/reviews/${uprn}`, { params: { page, per_page: 10 } })
            .then((res) => {
                setReviews(res.data.reviews)
                setTotal(res.data.total)
            })
            .catch(() => setError('Failed to load reviews.'))
            .finally(() => setLoading(false))
    }, [uprn, page])

    if (loading) {
        return <p className="text-xs text-gray-400">Loading reviews...</p>
    }

    if (error) {
        return (
            <div className="border border-red-200 bg-red-50 rounded-lg px-4 py-3 text-sm text-red-700">
                {error}
            </div>
        )
    }

    if (reviews.length === 0) {
        return (
            <div className="py-8 text-center">
                <p className="text-sm font-medium text-gray-900 mb-1">No reviews yet</p>
                <p className="text-sm text-gray-500">Be the first to review this property</p>
            </div>
        )
    }

    const totalPages = Math.ceil(total / 10)

    return (
        <div className="space-y-4">
            {reviews.map((review) => (
                <div
                    key={review.id}
                    className="border border-gray-200 rounded-xl p-4"
                >
                    {/* Rating row */}
                    <div className="flex flex-wrap gap-4 text-xs text-gray-700">
                        <span>Overall: {review.overall_rating}/5</span>
                        <span>Landlord: {review.landlord_rating}/5</span>
                        <span>Condition: {review.condition_rating}/5</span>
                        <span>Value: {review.value_rating}/5</span>
                    </div>

                    {/* Review text */}
                    {review.review_text && (
                        <p className="text-sm text-gray-700 mt-3 leading-relaxed">
                            {review.review_text}
                        </p>
                    )}

                    {/* Meta */}
                    <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
                        {review.move_in_year && <span>Moved in {review.move_in_year}</span>}
                        {review.weekly_rent_paid && (
                            <span>£{review.weekly_rent_paid}/wk</span>
                        )}
                    </div>
                </div>
            ))}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                    <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="text-sm text-gray-600 hover:text-gray-900 px-3 py-2 disabled:opacity-50"
                    >
                        ← Prev
                    </button>
                    <span className="text-xs text-gray-500">
                        Page {page} of {totalPages}
                    </span>
                    <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="text-sm text-gray-600 hover:text-gray-900 px-3 py-2 disabled:opacity-50"
                    >
                        Next →
                    </button>
                </div>
            )}
        </div>
    )
}
