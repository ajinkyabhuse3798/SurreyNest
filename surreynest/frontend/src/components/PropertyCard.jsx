/**
 * PropertyCard — summary card for search results.
 * Per design-system.md: border, rounded-xl, score dots, HMO badge, "View →".
 *
 * @param {{ property: object, onClick?: Function }} props
 */
import { Link } from 'react-router-dom'
import ScoreBadge from './ScoreBadge'
import HMOBadge from './HMOBadge'

export default function PropertyCard({ property }) {
    const {
        uprn,
        address,
        postcode,
        property_type,
        num_rooms,
        energy_rating,
        fairness_score,
        safety_score,
        hmo_status,
    } = property

    return (
        <Link
            to={`/property/${uprn}`}
            className="block border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors"
        >
            <p className="text-sm font-medium text-[#0A0A0A]">{address}</p>
            <p className="text-xs text-gray-500 mt-0.5">
                {postcode} · {property_type || 'Property'}
            </p>

            {/* Score row */}
            <div className="border-t border-gray-100 mt-3 pt-3 flex flex-wrap gap-3">
                <ScoreBadge score={fairness_score} label="Fair Rent" />
                <ScoreBadge score={safety_score} label="Safety" />
                <HMOBadge status={hmo_status || 'not_found'} />
            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 mt-3 pt-3 flex items-center justify-between">
                <span className="text-xs text-gray-500">
                    {num_rooms ? `${num_rooms} bed` : '—'} · {property_type || '—'} ·
                    EPC: {energy_rating || '—'}
                </span>
                <span className="text-xs font-medium text-indigo-600">View →</span>
            </div>
        </Link>
    )
}
