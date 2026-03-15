/**
 * PropertyDetail — Stitch-aligned Property Insights Dashboard.
 *
 * Layout: 12-column grid
 *   Left (4 cols): Property Specifics, Fair Rent Score gauge, HMO License, Safety
 *   Right (8 cols): EPC + Tenant Insights, Cost Breakdown, Location Intelligence, Reviews, Rights
 *
 * Data: parallel fetch ① property + ② safety + ③ HMO.
 * All API connections preserved from original implementation.
 */
import { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import ReviewList from '../components/ReviewList'
import ReviewForm from '../components/ReviewForm'
import RentRadarChart from '../components/RentRadarChart'
import { useCompare } from '../hooks/useCompare'
import api from '../services/api'
import {
    KEY_LOCATIONS,
    haversine, walkingTime, cyclingTime,
    estimateEnergy, epcImpact, safetyVerdict, floorAreaContext,
} from '../utils/propertyUtils'

// ── Stitch-style card wrapper ────────────────────────────────────────────────
function Card({ children, className = '' }) {
    return (
        <div className={`bg-white p-6 rounded-xl border border-primary/10 shadow-sm ${className}`}>
            {children}
        </div>
    )
}

function CardHeader({ icon, title, badge, badgeClass }) {
    return (
        <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">{icon}</span>
                {title}
            </h3>
            {badge && (
                <span className={`px-2 py-1 text-[10px] font-bold rounded uppercase ${badgeClass}`}>
                    {badge}
                </span>
            )}
        </div>
    )
}

// ── Skeleton ─────────────────────────────────────────────────────────────────
function DashboardSkeleton() {
    return (
        <main className="min-h-screen bg-background-light">
            <Navbar />
            <div className="max-w-7xl mx-auto px-6 py-8">
                <div className="animate-pulse space-y-8">
                    <div className="space-y-3">
                        <div className="h-4 bg-slate-200/50 rounded w-48" />
                        <div className="h-10 bg-slate-200/50 rounded-lg w-3/4 max-w-xl" />
                        <div className="h-4 bg-slate-200/50 rounded w-1/3" />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        <div className="lg:col-span-4 space-y-6">
                            {[1, 2, 3].map(i => <div key={i} className="bg-white rounded-xl border border-primary/10 h-48" />)}
                        </div>
                        <div className="lg:col-span-8 space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                {[1, 2].map(i => <div key={i} className="bg-white rounded-xl border border-primary/10 h-40" />)}
                            </div>
                            <div className="bg-white rounded-xl border border-primary/10 h-32" />
                            <div className="bg-white rounded-xl border border-primary/10 h-64" />
                        </div>
                    </div>
                </div>
            </div>
        </main>
    )
}

// ── Main component ───────────────────────────────────────────────────────────
export default function PropertyDetail() {
    const { uprn } = useParams()
    const navigate = useNavigate()

    const [property, setProperty] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [safetyDetail, setSafetyDetail] = useState(null)
    const [safetyLoading, setSafetyLoading] = useState(true)
    const [hmoDetail, setHmoDetail] = useState(null)
    const [hmoLoading, setHmoLoading] = useState(true)
    const [showReviews, setShowReviews] = useState(false)

    const { addToCompare, removeFromCompare, isInCompare } = useCompare()
    const compared = isInCompare(uprn)

    // ── Parallel fetch ───────────────────────────────────────────────
    useEffect(() => {
        setLoading(true)
        setError(null)
        api.get(`/api/properties/${uprn}`)
            .then((res) => {
                setProperty(res.data)
                setSafetyLoading(true)
                api.get('/api/scores/safety', { params: { postcode: res.data.postcode } })
                    .then((r) => setSafetyDetail(r.data))
                    .catch(() => { })
                    .finally(() => setSafetyLoading(false))
            })
            .catch(() => setError('Property not found.'))
            .finally(() => setLoading(false))

        setHmoLoading(true)
        api.get('/api/hmo/check', { params: { uprn } })
            .then((res) => setHmoDetail(res.data))
            .catch(() => { })
            .finally(() => setHmoLoading(false))
    }, [uprn])

    // ── Derived values ───────────────────────────────────────────────
    const distances = useMemo(() => {
        if (!property?.lat || !property?.lng) return []
        const typeMap = { 'University of Surrey': 'uni', 'Town Centre': 'town', 'Train Station': 'station' }
        return KEY_LOCATIONS.map((loc) => {
            const km = haversine(property.lat, property.lng, loc.lat, loc.lng)
            return { ...loc, km, walkMin: walkingTime(km), cycleMin: cyclingTime(km), proximityType: typeMap[loc.label] || 'town' }
        })
    }, [property])

    if (loading) return <DashboardSkeleton />

    if (error || !property) {
        return (
            <main className="min-h-screen bg-background-light">
                <Navbar />
                <div className="max-w-5xl mx-auto px-4 py-16 text-center">
                    <Card className="max-w-md mx-auto py-12">
                        <span className="material-symbols-outlined text-4xl text-amber-500 mb-4 block">warning</span>
                        <p className="text-lg font-bold text-slate-900 mb-2">{error || 'Property not found'}</p>
                        <button onClick={() => navigate(-1)} className="text-sm font-bold bg-primary/10 text-primary px-6 py-2.5 rounded-xl mt-4 inline-flex items-center hover:bg-primary/20 transition-colors">
                            Search again
                        </button>
                    </Card>
                </div>
            </main>
        )
    }

    // ── Derived from property ────────────────────────────────────────
    const p = property
    const weeklyRent = p.rent_prediction?.predicted_weekly_rent
    const monthlyRent = weeklyRent ? Math.round((weeklyRent * 52) / 12) : null
    const energyCost = estimateEnergy(p.energy_rating)
    const totalMonthly = monthlyRent ? monthlyRent + energyCost + 30 + 25 : null
    const perPerson = totalMonthly && p.num_rooms >= 2 ? Math.round(totalMonthly / p.num_rooms) : null
    const verdict = safetyVerdict(p.safety_score)
    const areaCtx = floorAreaContext(p.floor_area_m2, p.num_rooms)
    const epcCtx = epcImpact(p.energy_rating)
    const hasCoords = p.lat && p.lng
    const hmoStatus = hmoDetail?.status || (p.hmo?.is_hmo ? (p.hmo.is_active ? 'licensed' : 'expired') : 'not_found')

    // Rent radar sector
    const postcodeSector = (() => {
        if (!p.postcode) return null
        const parts = p.postcode.trim().toUpperCase().split(/\s+/)
        return parts.length === 2 && parts[1].length >= 1 ? `${parts[0]} ${parts[1][0]}` : null
    })()

    // EPC color mapping
    const epcColorMap = { A: 'bg-green-700', B: 'bg-green-500', C: 'bg-yellow-500', D: 'bg-orange-400', E: 'bg-orange-500', F: 'bg-red-500', G: 'bg-red-700' }
    const epcColor = epcColorMap[p.energy_rating] || 'bg-slate-400'

    // Safety badge
    const safetyScore = p.safety_score != null ? Math.round(p.safety_score) : null
    const safetyBadge = safetyScore >= 70 ? { text: 'Safe Zone', cls: 'bg-primary/10 text-primary' }
        : safetyScore >= 40 ? { text: 'Moderate', cls: 'bg-amber-100 text-amber-700' }
            : safetyScore != null ? { text: 'Caution', cls: 'bg-red-100 text-red-700' }
                : null

    // HMO badge
    const hmoBadge = hmoStatus === 'licensed' ? { text: 'Active', cls: 'bg-green-100 text-green-700' }
        : hmoStatus === 'expired' ? { text: 'Expired', cls: 'bg-red-100 text-red-700' }
            : { text: 'Not Found', cls: 'bg-slate-100 text-slate-600' }

    // ── Render ───────────────────────────────────────────────────────
    return (
        <main className="min-h-screen bg-background-light">
            <Navbar />
            <div className="max-w-7xl mx-auto w-full px-4 md:px-6 py-8">
                {/* Breadcrumbs & Title */}
                <div className="mb-8">
                    <div className="flex items-center gap-2 text-primary/60 text-sm mb-2">
                        <span>Surrey</span>
                        <span className="material-symbols-outlined text-xs">chevron_right</span>
                        <span>Guildford</span>
                        <span className="material-symbols-outlined text-xs">chevron_right</span>
                        <span className="text-primary font-semibold">{p.postcode}</span>
                    </div>
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div>
                            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900">{p.address || 'Property Insights Dashboard'}</h1>
                            <p className="text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                                {p.property_type || 'Property'}{p.built_form ? ` · ${p.built_form}` : ''}
                                {p.tenure && (
                                    <span className={`inline-flex items-center text-xs font-bold rounded-full px-3 py-1 leading-none ${p.tenure.includes('rental') || p.tenure.includes('rented')
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-slate-100 text-slate-500'
                                        }`}>
                                        {p.tenure.includes('rental') || p.tenure.includes('rented') ? 'Rental' : p.tenure.includes('owner') ? 'Owner' : 'Unknown'}
                                    </span>
                                )}
                            </p>
                        </div>
                        <div className="flex gap-3 flex-wrap">
                            <Link to="/rights" className="px-5 py-2.5 bg-white border border-primary/20 text-primary font-bold rounded-xl hover:bg-primary/5 transition-all flex items-center gap-2 text-sm">
                                <span className="material-symbols-outlined text-lg">gavel</span> Rights
                            </Link>
                            <button
                                onClick={() => compared ? removeFromCompare(p.uprn) : addToCompare(p.uprn)}
                                className={`px-5 py-2.5 border font-bold rounded-xl flex items-center gap-2 text-sm transition-all ${compared
                                    ? 'bg-primary/10 border-primary/30 text-primary'
                                    : 'bg-white border-primary/20 text-primary hover:bg-primary/5'
                                    }`}
                            >
                                <span className="material-symbols-outlined text-lg">compare_arrows</span>
                                {compared ? 'Compared ✓' : 'Compare'}
                            </button>
                            <Link to={`/rent/${p.uprn}`} className="px-5 py-2.5 bg-primary text-white font-bold rounded-xl hover:opacity-90 transition-all flex items-center gap-2 text-sm shadow-lg shadow-primary/20">
                                <span className="material-symbols-outlined text-lg">open_in_new</span> Rent XAI
                            </Link>
                        </div>
                    </div>
                </div>

                {/* ══════════ MAIN GRID ══════════ */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                    {/* ── LEFT COLUMN (4 cols) ─────────────────────────── */}
                    <div className="lg:col-span-4 space-y-6">

                        {/* Property Specifics */}
                        <Card>
                            <CardHeader icon="home_work" title="Property Specifics" />
                            <div className="grid grid-cols-2 gap-4">
                                {[
                                    { label: 'Type', value: p.property_type || 'N/A' },
                                    { label: 'Rooms', value: p.num_rooms ? `${p.num_rooms} Bedrooms` : 'N/A' },
                                    { label: 'Size', value: p.floor_area_m2 ? `${p.floor_area_m2} m²` : 'N/A' },
                                    { label: 'EPC Rating', value: p.energy_rating || 'N/A' },
                                ].map(({ label, value }) => (
                                    <div key={label} className="bg-primary/5 p-3 rounded-lg">
                                        <p className="text-[10px] font-bold text-primary uppercase">{label}</p>
                                        <p className="text-sm font-bold text-slate-800">{value}</p>
                                    </div>
                                ))}
                            </div>
                        </Card>

                        {/* Fair Rent Score */}
                        <Card className="flex flex-col items-center text-center p-8">
                            <h3 className="text-lg font-bold text-slate-800 mb-6">Fair Rent Score</h3>
                            {/* Gauge */}
                            <div className="relative w-40 h-20 overflow-hidden mb-4">
                                <div className="w-40 h-40 rounded-full border-[15px] border-primary/10" />
                                <div
                                    className="absolute top-0 left-0 w-40 h-40 rounded-full border-[15px] border-primary border-b-transparent border-l-transparent"
                                    style={{ transform: `rotate(${weeklyRent ? Math.min(45 + (p.rent_prediction?.fairness_score || 75) * 1.35, 225) : 45}deg)` }}
                                />
                                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex flex-col items-center">
                                    <span className="text-4xl font-black text-primary">{p.rent_prediction?.fairness_score || (weeklyRent ? '—' : '—')}</span>
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                        {weeklyRent ? 'Optimal' : 'N/A'}
                                    </span>
                                </div>
                            </div>
                            <p className="text-sm text-slate-500 max-w-[200px]">
                                {weeklyRent
                                    ? `Estimated fair rent: £${Math.round(weeklyRent)}/wk based on AI market analysis.`
                                    : 'Rent prediction not available for this property.'}
                            </p>
                            {weeklyRent && (
                                <div className="mt-6 w-full pt-6 border-t border-slate-100 flex justify-between">
                                    <div className="text-left">
                                        <p className="text-xs text-slate-400 font-bold uppercase">Confidence</p>
                                        <p className="text-xl font-bold text-slate-800">{p.rent_prediction?.confidence ? `${Math.round(p.rent_prediction.confidence)}%` : '—'}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-slate-400 font-bold uppercase">Est. Weekly</p>
                                        <p className="text-xl font-bold text-slate-800">£{Math.round(weeklyRent)}</p>
                                    </div>
                                </div>
                            )}
                        </Card>

                        {/* HMO License Status */}
                        <Card>
                            <CardHeader icon="verified" title="HMO License Status" badge={hmoBadge.text} badgeClass={hmoBadge.cls} />
                            {hmoLoading ? (
                                <div className="animate-pulse space-y-3">
                                    {[1, 2, 3].map(i => <div key={i} className="h-4 bg-slate-100 rounded w-full" />)}
                                </div>
                            ) : hmoDetail ? (
                                <div className="space-y-3">
                                    {[
                                        { label: 'License Reference', value: hmoDetail.license_ref || hmoDetail.licence_number || 'N/A' },
                                        { label: 'Max Occupants', value: hmoDetail.max_occupants ? `${hmoDetail.max_occupants} Persons` : 'N/A' },
                                        { label: 'Expiry Date', value: hmoDetail.expiry_date || 'N/A' },
                                    ].map(({ label, value }, i, arr) => (
                                        <div key={label} className={`flex justify-between text-sm py-2 ${i < arr.length - 1 ? 'border-b border-slate-50' : ''}`}>
                                            <span className="text-slate-500">{label}</span>
                                            <span className="font-semibold text-slate-800">{value}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-slate-500">No HMO data available for this property.</p>
                            )}
                            <p className="mt-4 text-[11px] text-slate-400 italic">Data pulled from Guildford Public Register</p>
                        </Card>

                        {/* Area Safety Profile */}
                        <Card>
                            <CardHeader
                                icon="security"
                                title="Area Safety Profile"
                                badge={safetyBadge?.text}
                                badgeClass={safetyBadge?.cls}
                            />
                            {safetyScore != null ? (
                                <>
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="text-4xl font-black text-primary">{safetyScore}<span className="text-sm text-slate-400">/100</span></div>
                                        <div className="text-xs text-slate-500">
                                            Safety score based on police.uk data for crime incidents in the {p.postcode} area.
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-500">{verdict?.text || 'Crime frequency assessment'}</span>
                                            <span className={`font-bold ${safetyScore >= 60 ? 'text-green-600' : safetyScore >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                                                {safetyScore >= 60 ? 'High Confidence' : safetyScore >= 40 ? 'Moderate' : 'Low'}
                                            </span>
                                        </div>
                                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${safetyScore}%` }} />
                                        </div>
                                    </div>
                                    <Link
                                        to={`/safety/${encodeURIComponent(p.postcode)}`}
                                        className="mt-4 text-xs font-bold text-primary flex items-center gap-1 hover:underline"
                                    >
                                        <span className="material-symbols-outlined text-sm">open_in_new</span> Full safety report
                                    </Link>
                                </>
                            ) : (
                                <p className="text-sm text-slate-500">Safety data not available for this area.</p>
                            )}
                        </Card>
                    </div>

                    {/* ── RIGHT COLUMN (8 cols) ────────────────────────── */}
                    <div className="lg:col-span-8 space-y-6">

                        {/* EPC + Tenant Insights (2-col) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Energy Efficiency */}
                            <Card>
                                <CardHeader icon="energy_savings_leaf" title="Energy Efficiency" />
                                <div className="flex items-center gap-4 mb-4">
                                    <div className={`w-16 h-16 rounded-lg ${epcColor} flex items-center justify-center text-white text-3xl font-black`}>
                                        {p.energy_rating || '?'}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-800">
                                            {epcCtx?.label || `Rating: ${p.energy_rating || 'Unknown'}`}
                                        </p>
                                        <p className="text-xs text-slate-500">{epcCtx?.detail || 'Energy performance data from EPC register.'}</p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex">
                                        <div className="bg-red-500 w-[10%]" />
                                        <div className="bg-orange-500 w-[15%]" />
                                        <div className="bg-yellow-500 w-[20%]" />
                                        <div className="bg-green-500 w-[40%]" />
                                        <div className="bg-green-700 w-[15%]" />
                                    </div>
                                </div>
                            </Card>

                            {/* Tenant Insights / Reviews */}
                            <Card>
                                <CardHeader icon="forum" title="Tenant Insights" />
                                {p.reviews?.review_count > 0 ? (
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-2 gap-2 text-center">
                                            {[
                                                { label: 'Overall', value: p.reviews.avg_overall },
                                                { label: 'Landlord', value: p.reviews.avg_landlord },
                                                { label: 'Condition', value: p.reviews.avg_condition },
                                                { label: 'Value', value: p.reviews.avg_value },
                                            ].map(r => (
                                                <div key={r.label} className="bg-primary/5 rounded-lg p-2">
                                                    <p className="text-lg font-bold text-slate-800">{r.value ? r.value.toFixed(1) : '—'}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase">{r.label}</p>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-[11px] text-slate-400 text-center">
                                            Based on {p.reviews.review_count} verified review{p.reviews.review_count !== 1 ? 's' : ''}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="flex items-start gap-3">
                                            <span className="material-symbols-outlined text-slate-300">rate_review</span>
                                            <div>
                                                <p className="text-sm font-bold text-slate-800">No reviews yet</p>
                                                <p className="text-xs text-slate-500">Be the first to share your experience.</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div className="mt-4 pt-4 border-t border-slate-50 flex justify-center">
                                    <button
                                        onClick={() => setShowReviews(true)}
                                        className="text-xs font-bold text-primary flex items-center gap-1 hover:underline"
                                    >
                                        <span className="material-symbols-outlined text-sm">rate_review</span>
                                        {p.reviews?.review_count > 0 ? 'Read all reviews' : 'Write a Review'}
                                    </button>
                                </div>
                            </Card>
                        </div>

                        {/* Cost Breakdown */}
                        <Card>
                            <CardHeader icon="payments" title="Estimated Cost Breakdown" />
                            {weeklyRent ? (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="md:border-r border-slate-100 md:pr-6">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Weekly Rent</p>
                                        <p className="text-2xl font-bold text-slate-800">£{Math.round(weeklyRent)}</p>
                                    </div>
                                    <div className="md:border-r border-slate-100 md:pr-6">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Est. Energy / Mo</p>
                                        <p className="text-2xl font-bold text-slate-800">£{energyCost}</p>
                                        <p className="text-[10px] text-green-600 font-bold">
                                            {p.energy_rating && ['A', 'B', 'C'].includes(p.energy_rating) ? `-${15 - (p.energy_rating.charCodeAt(0) - 65) * 5}% vs Avg` : ''}
                                            {p.energy_rating ? ` (EPC ${p.energy_rating})` : ''}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-primary uppercase mb-1">Total Monthly Cost</p>
                                        <p className="text-3xl font-black text-primary">£{totalMonthly?.toLocaleString() || '—'}</p>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-slate-500">Rent prediction not available for this property.</p>
                            )}
                        </Card>

                        {/* Challenge Rent CTA */}
                        {weeklyRent && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Link
                                    to={`/rent/${p.uprn}`}
                                    className="group flex items-center gap-4 bg-gradient-to-br from-primary via-amber-600 to-orange-600 rounded-xl px-5 py-4 text-white transition-all hover:shadow-xl hover:shadow-primary/20"
                                >
                                    <span className="material-symbols-outlined text-white/80">bar_chart</span>
                                    <div className="flex-1">
                                        <p className="text-sm font-bold">See rent calculation</p>
                                        <p className="text-xs text-white/70">AI explanation & market comparison</p>
                                    </div>
                                    <span className="material-symbols-outlined text-white/60">chevron_right</span>
                                </Link>
                                <Link
                                    to={`/challenge-rent-increase?postcode=${encodeURIComponent(p.postcode || '')}&uprn=${encodeURIComponent(p.uprn || '')}`}
                                    className="group flex items-center gap-4 bg-slate-900 rounded-xl px-5 py-4 text-white transition-all hover:bg-slate-800 hover:shadow-xl"
                                >
                                    <span className="material-symbols-outlined text-white/80">gavel</span>
                                    <div className="flex-1">
                                        <p className="text-sm font-bold">Challenge a rent increase</p>
                                        <p className="text-xs text-white/70">Section 13 analysis · Renters' Rights Act</p>
                                    </div>
                                    <span className="material-symbols-outlined text-white/60">chevron_right</span>
                                </Link>
                            </div>
                        )}

                        {/* Location Intelligence */}
                        {hasCoords && (
                            <Card className="overflow-hidden p-0">
                                <div className="p-6 border-b border-slate-50 flex justify-between items-center">
                                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-primary">map</span>
                                        Location Intelligence
                                    </h3>
                                    {distances[0] && (
                                        <span className="text-xs font-bold text-primary">{distances[0].label}: {distances[0].walkMin} min walk</span>
                                    )}
                                </div>
                                <div className="h-64 bg-primary/5 flex items-center justify-center relative">
                                    <div className="relative flex flex-col items-center">
                                        <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center shadow-xl animate-bounce">
                                            <span className="material-symbols-outlined text-white">home</span>
                                        </div>
                                        <div className="mt-2 px-3 py-1 bg-white border border-primary/20 rounded-lg shadow-sm text-xs font-bold">{p.postcode}</div>
                                    </div>
                                </div>
                                <div className="p-6 grid grid-cols-3 gap-4">
                                    {distances.slice(0, 3).map((loc) => (
                                        <div key={loc.label} className="text-center">
                                            <span className="material-symbols-outlined text-slate-400 mb-1">
                                                {loc.proximityType === 'uni' ? 'school' : loc.proximityType === 'station' ? 'train' : 'location_city'}
                                            </span>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">{loc.label}</p>
                                            <p className="text-xs font-bold">{loc.walkMin} min</p>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        )}

                        {/* Reviews section (expanded) */}
                        {showReviews && (
                            <Card>
                                <CardHeader icon="reviews" title="Student Reviews" />
                                <div className="space-y-6">
                                    <ReviewList uprn={uprn} />
                                    <div className="border-t border-slate-100 pt-4">
                                        <ReviewForm uprn={uprn} />
                                    </div>
                                </div>
                            </Card>
                        )}

                        {/* Tenant Rights */}
                        <Card>
                            <CardHeader icon="gavel" title="Your Tenant Rights" />
                            <div className="space-y-3">
                                {[
                                    { title: 'Deposit protection', text: "Your landlord must protect your deposit in a government-approved scheme within 30 days.", icon: 'shield' },
                                    { title: 'Repairs & maintenance', text: "Your landlord must keep the property in good repair. Contact Guildford council's housing team if they refuse.", icon: 'build' },
                                    { title: 'HMO requirements', text: 'If renting as 3+ individuals, the landlord must ensure fire safety, proper facilities, and meet occupancy limits.', icon: 'apartment' },
                                ].map((item) => (
                                    <div key={item.title} className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg border border-primary/10">
                                        <span className="material-symbols-outlined text-primary text-lg mt-0.5">{item.icon}</span>
                                        <div>
                                            <p className="text-sm font-bold text-slate-800">{item.title}</p>
                                            <p className="text-xs text-slate-500">{item.text}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <Link to="/rights" className="mt-4 w-full flex items-center justify-between bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-5 py-3.5 transition-colors">
                                <span className="text-sm font-bold">Read the full UK Rights Guide</span>
                                <span className="material-symbols-outlined text-white/60">chevron_right</span>
                            </Link>
                        </Card>

                        {/* Rent Radar (market trend chart) */}
                        {postcodeSector && (
                            <Card>
                                <CardHeader icon="trending_up" title="RentRadar — Market Price Trend" />
                                <p className="text-sm text-slate-500 mb-4">Postal area {postcodeSector} rental yield analysis</p>
                                <RentRadarChart postcodeSector={postcodeSector} />
                            </Card>
                        )}
                    </div>
                </div>
            </div>
        </main>
    )
}
