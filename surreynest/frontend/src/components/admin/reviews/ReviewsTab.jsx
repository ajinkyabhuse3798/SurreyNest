/**
 * ReviewsTab — paginated review moderation queue.
 * Enhanced from the original ModerationQueue in AdminDashboard.jsx.
 */
import { useState, useEffect } from 'react'
import { Star } from 'lucide-react'
import { getReviewQueue, approveReview, rejectReview } from '../../../services/adminApi'

function StarRating({ value }) {
    return (
        <div className="flex gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
                <Star
                    key={i}
                    size={12}
                    className={i < value ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200'}
                />
            ))}
        </div>
    )
}

export default function ReviewsTab() {
    const [reviews, setReviews] = useState([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [pages, setPages] = useState(1)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [actionErrors, setActionErrors] = useState({})

    function load(p = page) {
        setLoading(true)
        setError(null)
        getReviewQueue({ page: p, per_page: 20 })
            .then((data) => {
                setReviews(data.reviews || [])
                setTotal(data.total || 0)
                setPages(data.pages || 1)
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false))
    }

    useEffect(() => { load(page) }, [page])

    async function handleApprove(id) {
        try {
            await approveReview(id)
            setReviews((prev) => prev.filter((r) => r.id !== id))
            setTotal((t) => t - 1)
        } catch (e) {
            setActionErrors((prev) => ({ ...prev, [id]: e.message }))
        }
    }

    async function handleReject(id) {
        try {
            await rejectReview(id)
            setReviews((prev) => prev.filter((r) => r.id !== id))
            setTotal((t) => t - 1)
        } catch (e) {
            setActionErrors((prev) => ({ ...prev, [id]: e.message }))
        }
    }

    if (loading) {
        return (
            <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="animate-pulse bg-slate-100 rounded-2xl h-36" />
                ))}
            </div>
        )
    }

    if (error) {
        return (
            <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm text-rose-700">
                {error}
            </div>
        )
    }

    if (reviews.length === 0) {
        return (
            <div className="py-16 text-center">
                <p className="text-sm font-semibold text-slate-800 mb-1">Queue is empty</p>
                <p className="text-sm text-slate-400">No reviews awaiting moderation</p>
            </div>
        )
    }

    return (
        <div>
            <p className="text-sm text-slate-500 mb-4">
                {total} review{total !== 1 ? 's' : ''} awaiting moderation
            </p>

            <div className="space-y-4">
                {reviews.map((review) => (
                    <div key={review.id} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                        <p className="text-xs text-slate-400 mb-2">UPRN: {review.uprn}</p>

                        <div className="flex flex-wrap gap-4 text-xs text-slate-600 mb-3">
                            <span className="flex items-center gap-1.5">
                                Overall <StarRating value={review.overall_rating} />
                            </span>
                            <span className="flex items-center gap-1.5">
                                Landlord <StarRating value={review.landlord_rating} />
                            </span>
                            <span className="flex items-center gap-1.5">
                                Condition <StarRating value={review.condition_rating} />
                            </span>
                            <span className="flex items-center gap-1.5">
                                Value <StarRating value={review.value_rating} />
                            </span>
                        </div>

                        {review.agent_name && (
                            <p className="text-xs text-slate-500 mb-2">Agent: {review.agent_name}</p>
                        )}

                        {review.review_text && (
                            <p className="text-sm text-slate-700 leading-relaxed mb-3">
                                {review.review_text}
                            </p>
                        )}

                        {actionErrors[review.id] && (
                            <p className="text-xs text-rose-600 mb-2">{actionErrors[review.id]}</p>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={() => handleApprove(review.id)}
                                className="bg-primary text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
                            >
                                Approve
                            </button>
                            <button
                                onClick={() => handleReject(review.id)}
                                className="text-rose-600 text-sm font-medium hover:text-rose-700 transition-colors px-4 py-2"
                            >
                                Reject
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Pagination */}
            {pages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-6">
                    <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="text-sm text-slate-500 hover:text-slate-800 disabled:opacity-40 transition-colors"
                    >
                        Previous
                    </button>
                    <span className="text-sm text-slate-600">Page {page} of {pages}</span>
                    <button
                        onClick={() => setPage((p) => Math.min(pages, p + 1))}
                        disabled={page === pages}
                        className="text-sm text-slate-500 hover:text-slate-800 disabled:opacity-40 transition-colors"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    )
}
