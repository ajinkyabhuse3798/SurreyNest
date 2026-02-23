/**
 * ReviewForm — submit a review for a property.
 * 4 rating selectors (1-5) + text + optional rent.
 * Requires auth — shows prompt if not logged in.
 *
 * @param {{ uprn: string, onSubmitted?: Function }} props
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import api from '../services/api'

/** Rating selector row */
function RatingSelect({ label, value, onChange }) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-700">{label}</label>
            <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                    <button
                        key={n}
                        type="button"
                        onClick={() => onChange(n)}
                        className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${value === n
                                ? 'bg-indigo-600 text-white'
                                : 'border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                    >
                        {n}
                    </button>
                ))}
            </div>
        </div>
    )
}

export default function ReviewForm({ uprn, onSubmitted }) {
    const { user } = useAuth()
    const [overall, setOverall] = useState(0)
    const [landlord, setLandlord] = useState(0)
    const [condition, setCondition] = useState(0)
    const [valueMoney, setValueMoney] = useState(0)
    const [text, setText] = useState('')
    const [rent, setRent] = useState('')
    const [moveInYear, setMoveInYear] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(false)

    if (!user) {
        return (
            <div className="border border-gray-200 rounded-xl p-5 text-center">
                <p className="text-sm text-gray-700 mb-3">
                    Sign in to leave a review
                </p>
                <Link
                    to="/login"
                    className="text-sm bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors inline-block"
                >
                    Sign in
                </Link>
            </div>
        )
    }

    if (success) {
        return (
            <div className="border border-green-200 bg-green-50 rounded-lg px-4 py-3 text-sm text-green-700">
                Review submitted successfully. It will appear after moderation.
            </div>
        )
    }

    async function handleSubmit(e) {
        e.preventDefault()
        if (!overall || !landlord || !condition || !valueMoney) {
            setError('Please rate all four categories.')
            return
        }

        setSubmitting(true)
        setError(null)

        try {
            const body = {
                uprn,
                overall_rating: overall,
                landlord_rating: landlord,
                condition_rating: condition,
                value_rating: valueMoney,
                review_text: text || undefined,
                weekly_rent_paid: rent ? parseFloat(rent) : undefined,
                move_in_year: moveInYear ? parseInt(moveInYear, 10) : undefined,
            }
            await api.post('/api/reviews', body)
            setSuccess(true)
            if (onSubmitted) onSubmitted()
        } catch (err) {
            setError(
                err.response?.data?.detail || 'Failed to submit review. Please try again.'
            )
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <h3 className="text-base font-semibold text-[#0A0A0A]">Write a review</h3>

            {error && (
                <div className="border border-red-200 bg-red-50 rounded-lg px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-2 gap-4">
                <RatingSelect label="Overall" value={overall} onChange={setOverall} />
                <RatingSelect label="Landlord" value={landlord} onChange={setLandlord} />
                <RatingSelect label="Condition" value={condition} onChange={setCondition} />
                <RatingSelect label="Value" value={valueMoney} onChange={setValueMoney} />
            </div>

            <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-700">
                    Review (optional)
                </label>
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={3}
                    maxLength={2000}
                    placeholder="Share your experience..."
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm placeholder:text-gray-400 focus:outline-none focus:border-indigo-600 transition-colors resize-none"
                />
            </div>

            <div className="flex gap-4">
                <div className="flex flex-col gap-1.5 flex-1">
                    <label className="text-xs font-medium text-gray-700">
                        Weekly rent paid (£, optional)
                    </label>
                    <input
                        type="number"
                        value={rent}
                        onChange={(e) => setRent(e.target.value)}
                        min="0"
                        step="0.01"
                        placeholder="e.g. 150"
                        className="border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-indigo-600 transition-colors"
                    />
                </div>
                <div className="flex flex-col gap-1.5 flex-1">
                    <label className="text-xs font-medium text-gray-700">
                        Move-in year (optional)
                    </label>
                    <input
                        type="number"
                        value={moveInYear}
                        onChange={(e) => setMoveInYear(e.target.value)}
                        min="2000"
                        max="2030"
                        placeholder="e.g. 2024"
                        className="border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-indigo-600 transition-colors"
                    />
                </div>
            </div>

            <button
                type="submit"
                disabled={submitting}
                className="bg-indigo-600 text-white rounded-lg px-6 py-3 text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
                {submitting ? 'Submitting...' : 'Submit review'}
            </button>
        </form>
    )
}
