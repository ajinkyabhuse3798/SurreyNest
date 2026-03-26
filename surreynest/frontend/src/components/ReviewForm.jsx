/**
 * ReviewForm, submit a review for a property.
 * 4 rating selectors (1-5) + text + optional rent.
 * Open submission with moderation before publication.
 *
 * @param {{ uprn: string, onSubmitted?: Function }} props
 */
import { useState, useRef } from 'react'
import api from '../services/api'
import { suggestAgents } from '../services/agentApi'

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
                                ? 'bg-primary text-white'
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
    const [overall, setOverall] = useState(0)
    const [landlord, setLandlord] = useState(0)
    const [condition, setCondition] = useState(0)
    const [valueMoney, setValueMoney] = useState(0)
    const [text, setText] = useState('')
    const [rent, setRent] = useState('')
    const [moveInYear, setMoveInYear] = useState('')
    const [agentName, setAgentName] = useState('')
    const [suggestions, setSuggestions] = useState([])
    const [showSuggestions, setShowSuggestions] = useState(false)
    const debounceRef = useRef(null)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(false)

    if (success) {
        return (
            <div className="border border-green-200 bg-green-50 rounded-lg px-4 py-3 text-sm text-green-700">
                Review submitted successfully. It will appear after moderation.
            </div>
        )
    }

    function handleAgentInput(value) {
        setAgentName(value)
        clearTimeout(debounceRef.current)
        if (value.trim().length >= 2) {
            debounceRef.current = setTimeout(() => {
                suggestAgents(value.trim())
                    .then(setSuggestions)
                    .catch(() => setSuggestions([]))
            }, 300)
        } else {
            setSuggestions([])
        }
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
                agent_name: agentName.trim() || undefined,
            }
            await api.post('/api/reviews', body)
            setSuccess(true)
            if (onSubmitted) onSubmitted()
        } catch (err) {
            setError(
                err.detail || err.message || 'Failed to submit review. Please try again.'
            )
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <h3 className="text-base font-semibold text-[#0A0A0A]">Write a review</h3>
            <p className="text-sm text-slate-500">
                You can submit a review without an account. Every review is moderated before it appears publicly.
            </p>

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
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm placeholder:text-gray-400 focus:outline-none focus:border-primary-600 transition-colors resize-none"
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
                        className="border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary-600 transition-colors"
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
                        className="border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary-600 transition-colors"
                    />
                </div>
            </div>

            <div className="flex flex-col gap-1.5 relative">
                <label className="text-xs font-medium text-gray-700">
                    Letting agent (optional)
                </label>
                <input
                    type="text"
                    value={agentName}
                    onChange={e => handleAgentInput(e.target.value)}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    placeholder="e.g. Cavenders"
                    autoComplete="off"
                    className="border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary-600 transition-colors"
                />
                {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-md z-20 mt-1 max-h-48 overflow-y-auto">
                        {suggestions.map(s => (
                            <button
                                key={s.name}
                                type="button"
                                onMouseDown={() => {
                                    setAgentName(s.display_name)
                                    setSuggestions([])
                                    setShowSuggestions(false)
                                }}
                                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between"
                            >
                                <span>{s.display_name}</span>
                                <span className="text-xs text-gray-400">{s.review_count} reviews</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <button
                type="submit"
                disabled={submitting}
                className="bg-primary text-white rounded-lg px-6 py-3 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
                {submitting ? 'Submitting...' : 'Submit review'}
            </button>
        </form>
    )
}
