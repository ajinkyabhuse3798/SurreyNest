import { useState, useEffect, useCallback } from 'react'
import { Star, CheckCircle, XCircle } from 'lucide-react'
import { adminApi } from '../../services/adminApi'

function StarRating({ value }) {
    return (
        <div className="flex gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
                <Star
                    key={i}
                    size={14}
                    className={i < value ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200'}
                />
            ))}
        </div>
    )
}

export default function AdminReviews() {
    const [reviews, setReviews] = useState([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [pages, setPages] = useState(1)
    const [loading, setLoading] = useState(true)
    const [actionErrors, setActionErrors] = useState({})

    const fetchQueue = useCallback(async () => {
        setLoading(true)
        try {
            const data = await adminApi.getModerationQueue({ page, per_page: 20 })
            setReviews(data.reviews || [])
            setTotal(data.total || 0)
            setPages(data.pages || 1)
        } catch (e) {
            console.error('Failed to load review queue', e)
        } finally {
            setLoading(false)
        }
    }, [page])

    useEffect(() => {
        fetchQueue()
    }, [fetchQueue])

    async function handleApprove(id) {
        try {
            await adminApi.approveReview(id)
            setReviews((prev) => prev.filter((r) => r.id !== id))
            setTotal((t) => Math.max(0, t - 1))
        } catch (e) {
            setActionErrors((prev) => ({ ...prev, [id]: e.message || 'Failed to approve' }))
        }
    }

    async function handleReject(id) {
        if (!confirm('Are you sure you want to reject and soft-delete this review?')) return
        try {
            await adminApi.rejectReview(id)
            setReviews((prev) => prev.filter((r) => r.id !== id))
            setTotal((t) => Math.max(0, t - 1))
        } catch (e) {
            setActionErrors((prev) => ({ ...prev, [id]: e.message || 'Failed to reject' }))
        }
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Review Moderation</h1>
                <p className="text-sm text-slate-500 mt-1">
                    {total} review{total !== 1 ? 's' : ''} awaiting moderation.
                </p>
            </div>

            {loading ? (
                <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="animate-pulse bg-white border border-slate-200 rounded-xl h-48" />
                    ))}
                </div>
            ) : reviews.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 py-16 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle size={32} className="text-emerald-500" />
                    </div>
                    <p className="text-lg font-semibold text-slate-800 mb-1">Queue is empty</p>
                    <p className="text-sm text-slate-500">All caught up! No reviews awaiting moderation.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {reviews.map((review) => (
                        <div key={review.id} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm overflow-hidden">
                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                <div className="space-y-4 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                                            Pending
                                        </span>
                                        <span className="text-xs text-slate-400 font-mono">UPRN: {review.uprn}</span>
                                    </div>

                                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
                                        <span className="flex items-center gap-1.5 font-medium text-slate-900">
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
                                        <p className="text-sm font-medium text-slate-700 bg-slate-50 inline-block px-3 py-1 rounded-lg">
                                            Agent: <span className="font-semibold text-slate-900">{review.agent_name}</span>
                                        </p>
                                    )}

                                    {review.review_text ? (
                                        <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-700 leading-relaxed border border-slate-100">
                                            "{review.review_text}"
                                        </div>
                                    ) : (
                                        <p className="text-sm text-slate-400 italic">No written review provided.</p>
                                    )}
                                </div>
                                
                                <div className="flex flex-row md:flex-col gap-3 shrink-0">
                                    <button
                                        onClick={() => handleApprove(review.id)}
                                        className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white rounded-lg px-6 py-2.5 text-sm font-medium hover:bg-emerald-700 transition-colors"
                                    >
                                        <CheckCircle size={18} /> Approve
                                    </button>
                                    <button
                                        onClick={() => handleReject(review.id)}
                                        className="flex-1 flex items-center justify-center gap-2 bg-white text-rose-600 border border-rose-200 rounded-lg px-6 py-2.5 text-sm font-medium hover:bg-rose-50 transition-colors"
                                    >
                                        <XCircle size={18} /> Reject
                                    </button>
                                </div>
                            </div>

                            {actionErrors[review.id] && (
                                <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-600">
                                    {actionErrors[review.id]}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {!loading && pages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-8 pb-8">
                    <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-40 transition-colors"
                    >
                        Previous
                    </button>
                    <span className="text-sm font-medium bg-white border border-slate-200 px-3 py-1 rounded-md text-slate-600">
                        {page} / {pages}
                    </span>
                    <button
                        onClick={() => setPage((p) => Math.min(pages, p + 1))}
                        disabled={page === pages}
                        className="text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-40 transition-colors"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    )
}
