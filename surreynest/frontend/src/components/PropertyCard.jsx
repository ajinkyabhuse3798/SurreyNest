/**
 * PropertyCard, Stitch-inspired premium card for search results.
 * Supports hover highlighting for bidirectional card↔map interaction.
 * Optional compare checkbox for side-by-side comparison workflow.
 */
import { Link } from 'react-router-dom'
import { MapPin, Bed, Maximize2, Zap, ChevronRight, CheckCircle2 } from 'lucide-react'
import HMOBadge from './HMOBadge'

function formatDistance(m) {
    if (!m && m !== 0) return null
    if (m < 1000) return `${Math.round(m)}m`
    return `${(m / 1000).toFixed(1)}km`
}

function scoreColor(score) {
    if (!score && score !== 0) return 'bg-slate-100 text-slate-400'
    if (score >= 70) return 'bg-emerald-50 text-emerald-700 border-emerald-100'
    if (score >= 40) return 'bg-amber-50 text-amber-700 border-amber-100'
    return 'bg-rose-50 text-rose-700 border-rose-100'
}

function scoreDot(score) {
    if (!score && score !== 0) return 'bg-slate-300'
    if (score >= 70) return 'bg-emerald-500'
    if (score >= 40) return 'bg-amber-500'
    return 'bg-rose-500'
}

export default function PropertyCard({
    property,
    isHighlighted = false,
    onMouseEnter,
    onMouseLeave,
    showCompare = false,
    isCompared = false,
    onToggleCompare,
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
        tenure,
    } = property

    const distLabel = formatDistance(distance_m)

    const isRental = tenure?.includes('rental') || tenure?.includes('rented')

    return (
        <div
            className={`relative bg-white/70 backdrop-blur-md rounded-2xl border transition-all duration-300 overflow-hidden group ${isHighlighted
                ? 'border-primary-400 ring-2 ring-primary-100 shadow-[0_8px_30px_-4px_rgba(80,72,229,0.2)] lg:-translate-y-1'
                : 'border-white/50 hover:border-primary/20 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_30px_-4px_rgba(80,72,229,0.15)] lg:hover:-translate-y-1'
                }`}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            {/* Compare checkbox */}
            {showCompare && (
                <button
                    onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        onToggleCompare?.(uprn)
                    }}
                    className={`absolute top-3 right-3 z-10 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isCompared
                        ? 'bg-primary border-primary-600 text-white shadow-sm'
                        : 'border-slate-300 hover:border-primary-400 bg-white/80 backdrop-blur-sm'
                        }`}
                    title={isCompared ? 'Remove from compare' : 'Add to compare'}
                >
                    {isCompared && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    )}
                </button>
            )}

            <Link to={`/property/${uprn}`} className="block p-4 lg:p-5">
                {/* Top: Distance + Availability badges */}
                <div className="flex items-center gap-2 mb-2">
                    {distLabel && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary bg-primary/10 rounded-full px-2.5 py-0.5 border border-primary/10">
                            <MapPin size={10} />
                            {distLabel}
                        </span>
                    )}
                    {isRental && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 rounded-full px-2.5 py-0.5 border border-emerald-100">
                            <CheckCircle2 size={10} />
                            Rental
                        </span>
                    )}
                </div>

                {/* Address */}
                <h3 className="text-[15px] font-bold text-slate-900 leading-snug mb-0.5 pr-6">
                    {address}
                </h3>
                <p className="text-xs text-slate-500 font-medium mb-3">
                    {postcode} · {property_type || 'Property'}
                </p>

                {/* Divider */}
                <div className="h-px bg-slate-100 mb-3" />

                {/* Score pills */}
                <div className="flex flex-wrap gap-2 mb-3">
                    {/* Fair Rent */}
                    <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border ${scoreColor(fairness_score)}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${scoreDot(fairness_score)}`} />
                        Fair Rent: {fairness_score ?? 'N/A'}
                    </div>
                    {/* Safety */}
                    <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border ${scoreColor(safety_score)}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${scoreDot(safety_score)}`} />
                        Safety: {safety_score ?? 'N/A'}
                    </div>
                    {/* HMO */}
                    <HMOBadge status={hmo_status || 'not_found'} />
                </div>

                {/* Divider */}
                <div className="h-px bg-slate-100 mb-3" />

                {/* Footer: specs + View CTA */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                        {num_rooms && (
                            <span className="flex items-center gap-1">
                                <Bed size={12} className="text-slate-400" />
                                {num_rooms} bed
                            </span>
                        )}
                        {floor_area_m2 && (
                            <span className="flex items-center gap-1">
                                <Maximize2 size={12} className="text-slate-400" />
                                {floor_area_m2}m²
                            </span>
                        )}
                        {energy_rating && (
                            <span className="flex items-center gap-1">
                                <Zap size={12} className="text-slate-400" />
                                EPC {energy_rating}
                            </span>
                        )}
                    </div>
                    <span className="text-xs font-bold text-primary flex items-center gap-0.5 group-hover:gap-1.5 transition-all">
                        View details <ChevronRight size={13} />
                    </span>
                </div>
            </Link>
        </div>
    )
}
