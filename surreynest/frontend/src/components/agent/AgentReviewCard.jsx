/**
 * AgentReviewCard — single review card on an agent's profile.
 *
 * @param {{ review: object }} props
 */
import { Link } from 'react-router-dom'

function Stars({ value }) {
    return (
        <span className="text-amber-400 text-xs">
            {'★'.repeat(value)}{'☆'.repeat(5 - value)}
        </span>
    )
}

export default function AgentReviewCard({ review }) {
    const date = new Date(review.created_at).toLocaleDateString('en-GB', {
        month: 'short',
        year: 'numeric',
    })

    return (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-3">
            {/* Ratings row */}
            <div className="flex flex-wrap gap-3 text-xs text-slate-600">
                <span>Overall <Stars value={review.overall_rating} /></span>
                <span>Landlord <Stars value={review.landlord_rating} /></span>
                <span>Condition <Stars value={review.condition_rating} /></span>
                <span>Value <Stars value={review.value_rating} /></span>
            </div>

            {/* Review text */}
            <p className="text-sm text-slate-700 leading-relaxed">
                {review.review_text}
            </p>

            {/* Meta */}
            <div className="flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-3">
                    {review.move_in_year && <span>Moved in {review.move_in_year}</span>}
                    <Link
                        to={`/property/${review.uprn}`}
                        className="text-primary/80 hover:text-primary/90 underline underline-offset-2"
                    >
                        View property
                    </Link>
                </div>
                <span>{date}</span>
            </div>
        </div>
    )
}
