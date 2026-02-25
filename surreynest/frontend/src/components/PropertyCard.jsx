/**
 * PropertyCard — summary card for search results.
 * Supports hover highlighting for bidirectional card↔map interaction.
 *
 * @param {{
 *   property: object,
 *   isHighlighted?: boolean,
 *   onMouseEnter?: () => void,
 *   onMouseLeave?: () => void,
 * }} props
 */
import { Link } from 'react-router-dom'
import ScoreBadge from './ScoreBadge'
import HMOBadge from './HMOBadge'

function formatDistance(m) {
    if (!m && m !== 0) return null
    if (m < 1000) return `${Math.round(m)}m away`
    return `${(m / 1000).toFixed(1)}km away`
}

export default function PropertyCard({
    property,
    isHighlighted = false,
    onMouseEnter,
    onMouseLeave,
}) {
    const {
        uprn,
        address,
        postcode,
        property_type,
        num_rooms,
        energy_rating,
        floor_area_m2,
        fairness_score,
        safety_score,
        hmo_status,
        distance_m,
    } = property

    const distLabel = formatDistance(distance_m)

    return (
        <Link
            to={`/property/${uprn}`}
            className={`block border rounded-xl p-4 transition-all duration-200 ${isHighlighted
                    ? 'border-indigo-400 ring-2 ring-indigo-100 shadow-md'
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                }`}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            {/* Header row */}
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <p className="text-sm font-medium text-[#0A0A0A] leading-tight truncate">
                        {address}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                        {postcode} · {property_type || 'Property'}
                    </p>
                </div>
                {distLabel && (
                    <span className="flex-shrink-0 text-[10px] font-medium text-indigo-600 bg-indigo-50 rounded-full px-2 py-0.5">
                        {distLabel}
                    </span>
                )}
            </div>

            {/* Score row */}
            <div className="border-t border-gray-100 mt-3 pt-3 flex flex-wrap gap-3">
                <ScoreBadge score={fairness_score} label="Fair Rent" />
                <ScoreBadge score={safety_score} label="Safety" />
                <HMOBadge status={hmo_status || 'not_found'} />
            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 mt-3 pt-3 flex items-center justify-between">
                <span className="text-xs text-gray-500">
                    {num_rooms ? `${num_rooms} bed` : '—'} ·{' '}
                    {floor_area_m2 ? `${floor_area_m2}m²` : '—'} ·{' '}
                    EPC: {energy_rating || '—'}
                </span>
                <span className="text-xs font-medium text-indigo-600">View →</span>
            </div>
        </Link>
    )
}
