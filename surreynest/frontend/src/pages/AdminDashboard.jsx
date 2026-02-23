/**
 * AdminDashboard — moderation queue for admin users.
 * Protected by RequireAuth + admin role check.
 * Fetches from GET /api/admin/reviews/queue.
 */
import { useState, useEffect } from 'react'
import Navbar from '../components/Navbar'
import { RequireAuth } from '../hooks/useAuth'
import api from '../services/api'

function ModerationQueue() {
    const [reviews, setReviews] = useState([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    function loadQueue() {
        setLoading(true)
        setError(null)
        api
            .get('/api/admin/reviews/queue', { params: { per_page: 50 } })
            .then((res) => {
                setReviews(res.data.reviews || [])
                setTotal(res.data.total || 0)
            })
            .catch(() => setError('Failed to load moderation queue.'))
            .finally(() => setLoading(false))
    }

    useEffect(() => {
        loadQueue()
    }, [])

    async function handleApprove(reviewId) {
        try {
            await api.post(`/api/admin/reviews/${reviewId}/approve`)
            setReviews((prev) => prev.filter((r) => r.id !== reviewId))
            setTotal((t) => t - 1)
        } catch {
            alert('Failed to approve review.')
        }
    }

    async function handleReject(reviewId) {
        try {
            await api.post(`/api/admin/reviews/${reviewId}/reject`)
            setReviews((prev) => prev.filter((r) => r.id !== reviewId))
            setTotal((t) => t - 1)
        } catch {
            alert('Failed to reject review.')
        }
    }

    if (loading) {
        return (
            <p className="text-sm text-gray-400 text-center py-12">
                Loading moderation queue...
            </p>
        )
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
            <div className="py-16 text-center">
                <p className="text-sm font-medium text-gray-900 mb-1">
                    Queue is empty
                </p>
                <p className="text-sm text-gray-500">
                    No reviews awaiting moderation
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <p className="text-sm text-gray-500">
                {total} review{total !== 1 ? 's' : ''} awaiting moderation
            </p>

            {reviews.map((review) => (
                <div
                    key={review.id}
                    className="border border-gray-200 rounded-xl p-4"
                >
                    {/* Property info */}
                    <p className="text-xs text-gray-500 mb-2">
                        UPRN: {review.uprn}
                    </p>

                    {/* Ratings */}
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

                    {/* Actions */}
                    <div className="flex gap-3 mt-4">
                        <button
                            onClick={() => handleApprove(review.id)}
                            className="bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 transition-colors"
                        >
                            Approve
                        </button>
                        <button
                            onClick={() => handleReject(review.id)}
                            className="text-red-600 text-sm font-medium hover:text-red-700 transition-colors px-4 py-2"
                        >
                            Reject
                        </button>
                    </div>
                </div>
            ))}
        </div>
    )
}

export default function AdminDashboard() {
    return (
        <main className="min-h-screen bg-white">
            <Navbar />
            <RequireAuth adminOnly>
                <div className="max-w-2xl mx-auto px-4 py-8 md:py-12">
                    <h1 className="text-2xl font-semibold text-[#0A0A0A] mb-6 md:text-4xl">
                        Admin Dashboard
                    </h1>
                    <ModerationQueue />
                </div>
            </RequireAuth>
        </main>
    )
}
