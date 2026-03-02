/**
 * PropertyDetail v2 — comprehensive student-focused property page.
 *
 * 8 sections in single scroll (no tabs):
 *   1. Hero: address, stat cards (rent, safety, rooms)
 *   2. Safety: ScoreGauge + verdict + crime breakdown (lazy)
 *   3. Cost: rent, bills estimate, per-person, annual context
 *   4. Property Details: grid + EPC band
 *   5. HMO: explainer + status + licence details
 *   6. Location: map + walking distances to uni/town/station
 *   7. Reviews: summary + lazy list
 *   8. Rights: tenant info cards
 *
 * Data: parallel fetch ① property detail + ② safety breakdown + ③ HMO detail.
 * Error isolation: each section handles its own null state.
 */
import { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import {
    Shield, PoundSterling, Bed, Home, CheckCircle2, XCircle,
    AlertTriangle, MapPin, Star, Scale, ArrowLeft, Building2,
    Ruler, Zap, GraduationCap, TrainFront, ShoppingBag, Moon,
    Wifi, Droplets, Landmark, Info as InfoIcon, ArrowLeftRight,
} from 'lucide-react'
import Navbar from '../components/Navbar'
import ScoreGauge from '../components/ScoreGauge'
import MapView from '../components/MapView'
import EpcBand from '../components/EpcBand'
import CrimeBreakdown from '../components/CrimeBreakdown'
import InfoTip from '../components/InfoTip'
import ReviewList from '../components/ReviewList'
import ReviewForm from '../components/ReviewForm'
import { useCompare } from '../hooks/useCompare'
import api from '../services/api'

// ── constants ────────────────────────────────────────────────────────────────

const UNI_SURREY = { lat: 51.2430, lng: -0.5890, label: 'University of Surrey', icon: GraduationCap }
const TOWN_CENTRE = { lat: 51.2362, lng: -0.5704, label: 'Town Centre', icon: ShoppingBag }
const TRAIN_STATION = { lat: 51.2372, lng: -0.5617, label: 'Train Station', icon: TrainFront }
const KEY_LOCATIONS = [UNI_SURREY, TOWN_CENTRE, TRAIN_STATION]

// Stable Guildford transit facts — hardcoded (no API), update if services change
const GUILDFORD_TRANSIT_FACTS = [
    {
        icon: TrainFront,
        title: 'Guildford → London Waterloo',
        detail: 'Direct service ~35 min · every 15–30 min off-peak · no changes',
        colour: 'text-blue-700',
        bg: 'bg-blue-50',
    },
    {
        icon: GraduationCap,
        title: 'Bus to Surrey campus',
        detail: 'Arriva routes 5 and X1 — town centre to Stag Hill campus',
        colour: 'text-indigo-700',
        bg: 'bg-indigo-50',
    },
]

// ── helpers ──────────────────────────────────────────────────────────────────

function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function walkingTime(km) {
    return Math.round((km / 5) * 60)
}

function cyclingTime(km) {
    return Math.round((km / 15) * 60)
}

function proximityBadge(km, type) {
    const thresholds = {
        uni:     { excellent: 0.8, good: 1.5, moderate: 3.0 },
        station: { excellent: 0.5, good: 1.2, moderate: 2.5 },
        town:    { excellent: 0.6, good: 1.5, moderate: 3.0 },
    }
    const t = thresholds[type] || thresholds.town
    if (km <= t.excellent) return { label: 'Excellent', colour: 'bg-green-100 text-green-700' }
    if (km <= t.good)      return { label: 'Good',      colour: 'bg-blue-100 text-blue-700' }
    if (km <= t.moderate)  return { label: 'Moderate',  colour: 'bg-amber-100 text-amber-700' }
    return                        { label: 'Far',        colour: 'bg-red-100 text-red-700' }
}

function computeRentFactors(p, distances) {
    const factors = []
    if (!distances || distances.length === 0) return factors

    const stationDist = distances.find(d => d.label === 'Train Station')
    const uniDist     = distances.find(d => d.label === 'University of Surrey')
    const epc         = p.energy_rating?.toUpperCase()

    if (stationDist && stationDist.km <= 0.6) {
        factors.push({ text: 'Right by the station', positive: true })
    } else if (stationDist && stationDist.km >= 2.5) {
        factors.push({ text: 'Far from the station', positive: false })
    }

    if (uniDist && uniDist.km <= 1.2) {
        factors.push({ text: 'Walking distance to Surrey', positive: true })
    } else if (uniDist && uniDist.km >= 3.0) {
        factors.push({ text: 'Long commute to campus', positive: false })
    }

    if (epc === 'A' || epc === 'B') {
        factors.push({ text: 'Excellent EPC — low bills', positive: true })
    } else if (epc === 'F' || epc === 'G') {
        factors.push({ text: 'Poor EPC — high bills', positive: false })
    }

    if (p.safety_score != null && p.safety_score >= 75) {
        factors.push({ text: 'Very safe area', positive: true })
    } else if (p.safety_score != null && p.safety_score < 35) {
        factors.push({ text: 'Higher crime area', positive: false })
    }

    if (p.property_type === 'Detached') {
        factors.push({ text: 'Detached — space premium', positive: true })
    } else if (p.property_type === 'Flat') {
        factors.push({ text: 'Flat — compact pricing', positive: false })
    }

    const positive = factors.filter(f => f.positive).slice(0, 2)
    const negative = factors.filter(f => !f.positive).slice(0, 2)
    return [...positive, ...negative]
}

function estimateEnergy(epc) {
    const map = { A: 35, B: 45, C: 55, D: 65, E: 80, F: 95, G: 120 }
    return map[epc?.toUpperCase()] || 65
}

function epcImpact(epc) {
    const r = epc?.toUpperCase()
    if (r === 'A' || r === 'B') return { text: 'Great rating — expect low energy bills', colour: 'text-green-700' }
    if (r === 'C') return { text: 'Decent rating — average energy costs', colour: 'text-gray-600' }
    if (r === 'D') return { text: 'Below average — heating could be pricey in winter', colour: 'text-amber-700' }
    return { text: 'Poor rating — expect high energy bills', colour: 'text-red-700' }
}

function safetyVerdict(score) {
    if (score == null) return null
    if (score >= 80) return { text: 'This area has very low crime — great for walking home', colour: 'text-green-700', bg: 'bg-green-50' }
    if (score >= 60) return { text: 'This area is above average for safety in Guildford', colour: 'text-green-600', bg: 'bg-green-50' }
    if (score >= 40) return { text: 'Average safety — stick to well-lit routes at night', colour: 'text-amber-700', bg: 'bg-amber-50' }
    return { text: 'Higher than average crime — walk in groups at night', colour: 'text-red-700', bg: 'bg-red-50' }
}

function floorAreaContext(area, rooms) {
    if (!area || !rooms) return null
    const perRoom = area / rooms
    if (perRoom > 20) return 'Spacious for a student house'
    if (perRoom >= 15) return 'Good-sized rooms'
    if (perRoom >= 10) return 'Average size'
    return 'Compact — check room sizes before signing'
}

// ── skeleton ─────────────────────────────────────────────────────────────────

function SectionSkeleton({ lines = 3 }) {
    return (
        <div className="animate-pulse space-y-3 py-2">
            {Array.from({ length: lines }).map((_, i) => (
                <div key={i} className="h-4 bg-gray-100 rounded" style={{ width: `${80 - i * 15}%` }} />
            ))}
        </div>
    )
}

// ── stat card ────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, colour = 'text-indigo-600' }) {
    return (
        <div className="flex-1 min-w-[100px] bg-gray-50 rounded-xl p-3 sm:p-4 text-center">
            <Icon size={18} className={`mx-auto mb-1.5 ${colour}`} />
            <p className={`text-lg sm:text-xl font-bold ${colour} leading-tight`}>{value}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">{label}</p>
            {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
        </div>
    )
}

// ── section wrapper ──────────────────────────────────────────────────────────

function Section({ id, icon: Icon, title, infoTip, children }) {
    return (
        <section id={id} className="border-t border-gray-100 pt-8 pb-2">
            <div className="flex items-center gap-2 mb-4">
                {Icon && <Icon size={18} className="text-indigo-600" />}
                <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
                {infoTip && <InfoTip text={infoTip} />}
            </div>
            {children}
        </section>
    )
}

// ── main component ───────────────────────────────────────────────────────────

export default function PropertyDetail() {
    const { uprn } = useParams()
    const [searchParams] = useSearchParams()

    // ── State: property (endpoint ①) ─────────────────────────────────
    const [property, setProperty] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    // ── State: safety breakdown (endpoint ②) ─────────────────────────
    const [safetyDetail, setSafetyDetail] = useState(null)
    const [safetyLoading, setSafetyLoading] = useState(true)

    // ── State: HMO detail (endpoint ③) ───────────────────────────────
    const [hmoDetail, setHmoDetail] = useState(null)
    const [hmoLoading, setHmoLoading] = useState(true)

    // ── State: UI ────────────────────────────────────────────────────
    const [showReviews, setShowReviews] = useState(false)

    // ── Compare ──────────────────────────────────────────────────────
    const { addToCompare, removeFromCompare, isInCompare } = useCompare()
    const compared = isInCompare(uprn)

    // ── Parallel fetch ───────────────────────────────────────────────
    useEffect(() => {
        // ① Property detail
        setLoading(true)
        setError(null)
        api.get(`/api/properties/${uprn}`)
            .then((res) => {
                setProperty(res.data)
                // ② Safety breakdown (needs postcode from ①)
                setSafetyLoading(true)
                api.get('/api/scores/safety', { params: { postcode: res.data.postcode } })
                    .then((r) => setSafetyDetail(r.data))
                    .catch(() => { }) // silently fail — section still shows basic score from ①
                    .finally(() => setSafetyLoading(false))
            })
            .catch(() => setError('Property not found.'))
            .finally(() => setLoading(false))

        // ③ HMO detail (can start immediately)
        setHmoLoading(true)
        api.get('/api/hmo/check', { params: { uprn } })
            .then((res) => setHmoDetail(res.data))
            .catch(() => { }) // silently fail — basic HMO from ① still shows
            .finally(() => setHmoLoading(false))
    }, [uprn])

    // ── Derived ──────────────────────────────────────────────────────
    const backTo = searchParams.get('from') || '/search'

    const distances = useMemo(() => {
        if (!property?.lat || !property?.lng) return []
        const typeMap = {
            'University of Surrey': 'uni',
            'Town Centre': 'town',
            'Train Station': 'station',
        }
        return KEY_LOCATIONS.map((loc) => {
            const km = haversine(property.lat, property.lng, loc.lat, loc.lng)
            return {
                ...loc,
                km,
                walkMin: walkingTime(km),
                cycleMin: cyclingTime(km),
                proximityType: typeMap[loc.label] || 'town',
            }
        })
    }, [property])

    // ── Loading ──────────────────────────────────────────────────────
    if (loading) {
        return (
            <main className="min-h-screen bg-white">
                <Navbar />
                <div className="max-w-2xl mx-auto px-4 py-8">
                    <div className="animate-pulse space-y-6">
                        <div className="h-3 bg-gray-100 rounded w-24" />
                        <div className="h-8 bg-gray-100 rounded w-3/4" />
                        <div className="h-4 bg-gray-100 rounded w-1/3" />
                        <div className="flex gap-3">
                            <div className="flex-1 h-24 bg-gray-50 rounded-xl" />
                            <div className="flex-1 h-24 bg-gray-50 rounded-xl" />
                            <div className="flex-1 h-24 bg-gray-50 rounded-xl" />
                        </div>
                        <SectionSkeleton lines={4} />
                        <SectionSkeleton lines={3} />
                        <SectionSkeleton lines={5} />
                    </div>
                </div>
            </main>
        )
    }

    // ── Error ────────────────────────────────────────────────────────
    if (error || !property) {
        return (
            <main className="min-h-screen bg-white">
                <Navbar />
                <div className="max-w-2xl mx-auto px-4 py-12 text-center">
                    <AlertTriangle size={40} className="mx-auto text-red-300 mb-3" />
                    <p className="text-sm font-medium text-gray-900 mb-1">{error || 'Property not found'}</p>
                    <Link to="/search" className="text-sm text-indigo-600 font-medium mt-4 inline-flex items-center gap-1">
                        <ArrowLeft size={14} /> Back to search
                    </Link>
                </div>
            </main>
        )
    }

    const p = property
    const weeklyRent = p.rent_prediction?.predicted_weekly_rent
    const monthlyRent = weeklyRent ? Math.round((weeklyRent * 52) / 12) : null
    const energyCost = estimateEnergy(p.energy_rating)
    const waterCost = 30
    const internetCost = 25
    const totalMonthly = monthlyRent ? monthlyRent + energyCost + waterCost + internetCost : null
    const perPerson = totalMonthly && p.num_rooms >= 2 ? Math.round(totalMonthly / p.num_rooms) : null
    const annualCost = totalMonthly ? totalMonthly * 12 : null
    const verdict = safetyVerdict(p.safety_score)
    const areaCtx = floorAreaContext(p.floor_area_m2, p.num_rooms)
    const epcCtx = epcImpact(p.energy_rating)
    const hasCoords = p.lat && p.lng
    const rentFactors = weeklyRent ? computeRentFactors(p, distances) : []

    // Use HMO detail from ③ if available, else embedded from ①
    const hmo = hmoDetail?.record || p.hmo || {}
    const hmoStatus = hmoDetail?.status || (p.hmo?.is_hmo ? (p.hmo.is_active ? 'licensed' : 'expired') : 'not_found')

    return (
        <main className="min-h-screen bg-white pb-16">
            <Navbar />

            <div className="max-w-2xl mx-auto px-4 py-6 md:py-10">
                {/* ── Breadcrumb ───────────────────────────────────────── */}
                <Link to={backTo} className="text-xs text-gray-400 hover:text-gray-700 transition-colors inline-flex items-center gap-1">
                    <ArrowLeft size={12} /> Search Results
                </Link>

                {/* ═══════════════════════════════════════════════════════
                    1. HERO
                ═══════════════════════════════════════════════════════ */}
                <h1 className="text-2xl font-bold text-gray-900 mt-3 md:text-3xl leading-tight">
                    {p.address}
                </h1>
                <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                    <span>{p.postcode} · {p.property_type || 'Property'}{p.built_form ? ` · ${p.built_form}` : ''}</span>
                    {p.tenure && (
                        <span className={`inline-flex items-center text-[10px] font-medium rounded px-1.5 py-0.5 leading-none ${p.tenure.includes('rental') || p.tenure.includes('rented')
                            ? 'bg-emerald-50 text-emerald-700'
                            : p.tenure.includes('owner')
                                ? 'bg-gray-100 text-gray-500'
                                : 'bg-gray-50 text-gray-400'
                            }`}>
                            {p.tenure.includes('rental') || p.tenure.includes('rented') ? 'Rental' : p.tenure.includes('owner') ? 'Owner' : 'Unknown'}
                        </span>
                    )}
                </p>

                <div className="flex gap-3 mt-5">
                    <StatCard
                        icon={PoundSterling}
                        label="Est. rent"
                        value={weeklyRent ? `£${Math.round(weeklyRent * 0.92)}–${Math.round(weeklyRent * 1.08)}` : '—'}
                        sub={weeklyRent ? '/wk range' : 'Not available'}
                    />
                    <StatCard
                        icon={Shield}
                        label="Safety"
                        value={p.safety_score != null ? Math.round(p.safety_score) : '—'}
                        sub={p.safety_score != null ? '/100' : 'No data'}
                        colour={p.safety_score >= 60 ? 'text-green-600' : p.safety_score >= 40 ? 'text-amber-600' : p.safety_score != null ? 'text-red-600' : 'text-gray-400'}
                    />
                    <StatCard
                        icon={Bed}
                        label="Rooms"
                        value={p.num_rooms || '—'}
                        sub={p.floor_area_m2 ? `${p.floor_area_m2}m²` : null}
                        colour="text-gray-700"
                    />
                </div>

                {/* Compare button */}
                <button
                    onClick={() => compared ? removeFromCompare(p.uprn) : addToCompare(p.uprn)}
                    className={`mt-3 w-full flex items-center justify-center gap-2 text-sm font-medium py-2.5 rounded-lg border transition-colors ${compared
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                >
                    <ArrowLeftRight size={14} />
                    {compared ? 'Added to Compare ✓' : 'Add to Compare'}
                </button>

                {/* ═══════════════════════════════════════════════════════
                    2. SAFETY
                ═══════════════════════════════════════════════════════ */}
                <Section
                    id="safety"
                    icon={Shield}
                    title="Is this area safe?"
                    infoTip="Safety scores are based on reported crime from police.uk data for this postcode sector. Higher = safer. Updated monthly."
                >
                    {p.safety_score != null ? (
                        <div className="space-y-5">
                            <div className="flex flex-col sm:flex-row items-start gap-5">
                                <ScoreGauge score={p.safety_score} size="lg" showLabel label="Safety" className="flex-shrink-0 mx-auto sm:mx-0" />
                                <div className="space-y-3 flex-1">
                                    {verdict && (
                                        <div className={`${verdict.bg} rounded-lg px-4 py-3`}>
                                            <p className={`text-sm font-medium ${verdict.colour}`}>{verdict.text}</p>
                                        </div>
                                    )}
                                    <p className="text-sm text-gray-500 leading-relaxed">
                                        Based on reported crime in the <span className="font-medium">{p.postcode}</span> area.
                                        Covers the whole postcode sector, not just this street.
                                    </p>
                                </div>
                            </div>

                            {/* Crime breakdown from endpoint ② */}
                            {safetyLoading ? (
                                <SectionSkeleton lines={4} />
                            ) : safetyDetail?.breakdown?.length > 0 ? (
                                <>
                                    <h3 className="text-sm font-semibold text-gray-700 mt-2">Crime breakdown (last 12 months)</h3>
                                    <CrimeBreakdown breakdown={safetyDetail.breakdown} />
                                </>
                            ) : null}

                            {/* Walking safety note */}
                            <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-4 py-3">
                                <Moon size={14} className="text-indigo-400 flex-shrink-0" />
                                {p.safety_score >= 60
                                    ? 'Students generally feel safe walking here at night'
                                    : 'Consider well-lit routes and walking with friends at night'}
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-gray-400">Safety data is not yet available for this area.</p>
                    )}
                </Section>

                {/* ═══════════════════════════════════════════════════════
                    3. COST
                ═══════════════════════════════════════════════════════ */}
                <Section id="cost" icon={PoundSterling} title="What will it cost?">
                    {weeklyRent ? (
                        <div className="space-y-4">
                            {/* Rent confidence band */}
                            <div className="rounded-2xl border border-gray-100 p-5 sm:p-6">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                                    Typical rent range · {p.postcode}
                                </p>

                                {/* 3-zone bar */}
                                <div className="flex rounded-lg overflow-hidden h-12 text-xs font-medium">
                                    <div className="flex-1 flex flex-col items-center justify-center bg-green-50 text-green-700 border-r-2 border-white">
                                        <span>Less typical</span>
                                        <span className="font-bold">&lt;£{Math.round(weeklyRent * 0.92)}/wk</span>
                                    </div>
                                    <div className="flex-[2] flex flex-col items-center justify-center bg-indigo-100 text-indigo-800">
                                        <span>Typical market</span>
                                        <span className="font-bold">
                                            £{Math.round(weeklyRent * 0.92)}–£{Math.round(weeklyRent * 1.08)}/wk
                                        </span>
                                    </div>
                                    <div className="flex-1 flex flex-col items-center justify-center bg-amber-50 text-amber-700 border-l-2 border-white">
                                        <span>More typical</span>
                                        <span className="font-bold">&gt;£{Math.round(weeklyRent * 1.08)}/wk</span>
                                    </div>
                                </div>

                                {/* Monthly range */}
                                <p className="text-sm text-gray-500 mt-3">
                                    ≈ <span className="font-semibold text-gray-800">
                                        £{Math.round(weeklyRent * 0.92 * 52 / 12)}–£{Math.round(weeklyRent * 1.08 * 52 / 12)}
                                    </span> /month typical range
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                    Range = ±8% of ML estimate (based on model accuracy). Actual rent varies by condition, floor, and landlord.
                                </p>
                            </div>

                            {/* What drives this estimate */}
                            {rentFactors.length > 0 && (
                                <div className="border border-gray-100 rounded-xl p-4">
                                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                                        What drives this estimate
                                    </h3>
                                    <div className="flex flex-wrap gap-2">
                                        {rentFactors.map((factor) => (
                                            <span
                                                key={factor.text}
                                                className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${
                                                    factor.positive
                                                        ? 'bg-green-50 text-green-700'
                                                        : 'bg-amber-50 text-amber-700'
                                                }`}
                                            >
                                                {factor.positive ? '✓' : '⚠'} {factor.text}
                                            </span>
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-2">
                                        Factors derived from property data — not ML model internals.
                                    </p>
                                </div>
                            )}

                            {/* Bills estimate */}
                            <div className="border border-gray-100 rounded-xl p-4 space-y-3">
                                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                                    Estimated monthly bills
                                    <InfoTip text="These are rough estimates for a Guildford student property. Your actual costs will vary depending on usage and provider." />
                                </h3>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="flex items-center gap-2 text-gray-600"><Zap size={14} className="text-amber-500" /> Energy</span>
                                        <span className="font-medium text-gray-900">~£{energyCost}/mo</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="flex items-center gap-2 text-gray-600"><Droplets size={14} className="text-blue-500" /> Water</span>
                                        <span className="font-medium text-gray-900">~£{waterCost}/mo</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="flex items-center gap-2 text-gray-600"><Wifi size={14} className="text-indigo-500" /> Internet</span>
                                        <span className="font-medium text-gray-900">~£{internetCost}/mo</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="flex items-center gap-2 text-gray-600">
                                            <Landmark size={14} className="text-green-600" /> Council tax
                                            <InfoTip text="Full-time students are exempt from council tax. You don't pay this! You'll need to register your exemption with Guildford council." />
                                        </span>
                                        <span className="font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded text-xs">£0 — Students exempt ✓</span>
                                    </div>
                                </div>
                            </div>

                            {/* Total + per-person */}
                            {totalMonthly && (
                                <div className="bg-gray-50 rounded-xl p-4">
                                    <div className="flex items-baseline justify-between">
                                        <span className="text-sm font-semibold text-gray-700">Total estimated monthly</span>
                                        <span className="text-xl font-bold text-gray-900">~£{totalMonthly}</span>
                                    </div>
                                    {perPerson && (
                                        <p className="text-sm text-indigo-600 font-medium mt-2">
                                            Across {p.num_rooms} habitable rooms: ~£{perPerson}/room per month
                                        </p>
                                    )}
                                    {annualCost && (
                                        <div className="border-t border-gray-200 mt-3 pt-3 space-y-1">
                                            <p className="text-xs text-gray-500">
                                                12-month contract: ~£{annualCost.toLocaleString()} total
                                            </p>
                                            <p className="text-xs text-gray-400">
                                                💡 Average student maintenance loan: ~£9,978/year (2024/25)
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-400">Rent prediction is not available for this property yet.</p>
                    )}
                </Section>

                {/* ═══════════════════════════════════════════════════════
                    4. PROPERTY DETAILS
                ═══════════════════════════════════════════════════════ */}
                <Section id="details" icon={Building2} title="Property details">
                    <div className="space-y-5">
                        {/* Grid */}
                        <div className="grid gap-3 sm:grid-cols-2">
                            {[
                                { icon: Home, label: 'Type', value: p.property_type },
                                { icon: Bed, label: 'Habitable rooms', value: p.num_rooms },
                                { icon: Ruler, label: 'Floor area', value: p.floor_area_m2 ? `${p.floor_area_m2} m²` : null },
                                { icon: Building2, label: 'Built form', value: p.built_form },
                            ].filter(d => d.value).map(d => (
                                <div key={d.label} className="flex items-center justify-between border border-gray-100 rounded-lg px-4 py-3">
                                    <span className="flex items-center gap-2 text-xs text-gray-500"><d.icon size={14} />{d.label}</span>
                                    <span className="text-sm font-medium text-gray-900">{d.value}</span>
                                </div>
                            ))}
                        </div>

                        {/* Floor area context */}
                        {areaCtx && (
                            <p className="text-xs text-gray-500 -mt-2 flex items-center gap-1">
                                <Ruler size={12} className="text-gray-400" /> {areaCtx}
                            </p>
                        )}

                        {/* EPC band */}
                        {p.energy_rating && (
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                                    Energy rating (EPC)
                                    <InfoTip text="Energy Performance Certificate — rates how energy-efficient the property is. A is best (cheapest to heat), G is worst (most expensive)." />
                                </h3>
                                <EpcBand rating={p.energy_rating} />
                                {epcCtx && (
                                    <p className={`text-xs font-medium ${epcCtx.colour}`}>
                                        {epcCtx.text}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </Section>

                {/* ═══════════════════════════════════════════════════════
                    5. HMO
                ═══════════════════════════════════════════════════════ */}
                <Section
                    id="hmo"
                    icon={Home}
                    title="HMO status"
                    infoTip="House in Multiple Occupation — a property rented by 3+ people from different households, like a typical student house share."
                >
                    <div className="space-y-4">
                        {/* What is an HMO? */}
                        <div className="bg-blue-50 rounded-xl p-4 flex items-start gap-3">
                            <InfoIcon size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-blue-800 leading-relaxed">
                                An <strong>HMO</strong> (House in Multiple Occupation) is a property rented by 3+ people from different households — like a typical student house share.
                            </p>
                        </div>

                        {/* Status */}
                        {hmoLoading && !p.hmo ? (
                            <SectionSkeleton lines={3} />
                        ) : hmoStatus === 'licensed' ? (
                            <div className="space-y-3">
                                <div className="flex items-start gap-3 bg-green-50 rounded-xl p-4">
                                    <CheckCircle2 size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-semibold text-green-800">Licensed HMO ✓</p>
                                        <p className="text-xs text-green-700 mt-1 leading-relaxed">
                                            This property has a valid HMO licence — your landlord has met safety requirements including fire alarms, escape routes, and minimum room sizes.
                                        </p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    {(hmo.licence_number || p.hmo?.licence_number) && (
                                        <div className="bg-gray-50 rounded-lg px-3 py-2">
                                            <span className="text-gray-400">Licence #</span>
                                            <p className="font-medium text-gray-700">{hmo.licence_number || p.hmo?.licence_number}</p>
                                        </div>
                                    )}

                                    {(hmo.max_occupants || p.hmo?.max_occupants) && (
                                        <div className="bg-gray-50 rounded-lg px-3 py-2">
                                            <span className="text-gray-400">Max occupants</span>
                                            <p className="font-medium text-gray-700">{hmo.max_occupants || p.hmo?.max_occupants}</p>
                                        </div>
                                    )}
                                    {(hmo.expiry_date || p.hmo?.expiry_date) && (
                                        <div className="bg-gray-50 rounded-lg px-3 py-2">
                                            <span className="text-gray-400">Expires</span>
                                            <p className="font-medium text-gray-700">
                                                {new Date(hmo.expiry_date || p.hmo?.expiry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : hmoStatus === 'expired' ? (
                            <div className="flex items-start gap-3 bg-amber-50 rounded-xl p-4">
                                <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-semibold text-amber-800">HMO licence expired ⚠</p>
                                    <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                                        This property's HMO licence has expired. Contact the landlord or Guildford Borough Council before signing a tenancy.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-start gap-3 bg-gray-50 rounded-xl p-4">
                                <AlertTriangle size={18} className="text-gray-400 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-gray-700">Not on the HMO register</p>
                                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                        If you're renting as a group of 3+, ask the landlord whether the property needs an HMO licence.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Why it matters */}
                        <p className="text-xs text-gray-400 leading-relaxed">
                            An HMO licence means the council has inspected the property for fire safety, escape routes, and living standards.
                            It protects you as a tenant.
                        </p>
                    </div>
                </Section>

                {/* ═══════════════════════════════════════════════════════
                    6. LOCATION
                ═══════════════════════════════════════════════════════ */}
                {hasCoords && (
                    <Section id="location" icon={MapPin} title="Location">
                        <MapView
                            markers={[{ id: p.uprn, lat: p.lat, lng: p.lng, label: p.address, score: p.safety_score }]}
                            singleMode
                            zoom={15}
                            height="h-[250px] sm:h-[300px]"
                            className="rounded-xl overflow-hidden border border-gray-200"
                        />

                        {distances.length > 0 && (
                            <div className="mt-4 space-y-2">
                                {distances.map((d) => {
                                    const badge = proximityBadge(d.km, d.proximityType)
                                    return (
                                        <div key={d.label} className="bg-gray-50 rounded-lg px-4 py-3">
                                            <div className="flex items-center justify-between">
                                                <span className="flex items-center gap-2 text-sm text-gray-700">
                                                    <d.icon size={16} className="text-indigo-500" />
                                                    {d.label}
                                                </span>
                                                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${badge.colour}`}>
                                                    {badge.label}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1.5 pl-6">
                                                {d.km.toFixed(1)} km · ~{d.walkMin} min walk · ~{d.cycleMin} min cycle
                                            </p>
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        {/* Getting Around — Guildford-specific transit context */}
                        <div className="mt-4 border border-gray-100 rounded-xl p-4 space-y-3">
                            <h3 className="text-sm font-semibold text-gray-700">Getting Around Guildford</h3>
                            {GUILDFORD_TRANSIT_FACTS.map((fact) => (
                                <div key={fact.title} className={`flex items-start gap-3 ${fact.bg} rounded-lg px-3 py-2.5`}>
                                    <fact.icon size={15} className={`${fact.colour} flex-shrink-0 mt-0.5`} />
                                    <div>
                                        <p className={`text-xs font-semibold ${fact.colour}`}>{fact.title}</p>
                                        <p className="text-xs text-gray-600 mt-0.5">{fact.detail}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Section>
                )}

                {/* ═══════════════════════════════════════════════════════
                    6b. FLOOD RISK
                ═══════════════════════════════════════════════════════ */}
                <Section id="flood-risk" icon={Droplets} title="Flood Risk">
                    {p.flood_risk ? (
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                {p.flood_risk.current_severity ? (
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${p.flood_risk.current_severity === 1 ? 'bg-red-100 text-red-700' :
                                        p.flood_risk.current_severity === 2 ? 'bg-orange-100 text-orange-700' :
                                            p.flood_risk.current_severity === 3 ? 'bg-yellow-100 text-yellow-700' :
                                                'bg-green-100 text-green-700'
                                        }`}>
                                        <AlertTriangle size={12} />
                                        {p.flood_risk.severity_label}
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                                        <CheckCircle2 size={12} />
                                        No Active Warnings
                                    </span>
                                )}
                            </div>

                            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                                <h4 className="text-sm font-semibold text-gray-800">
                                    Nearest Flood Area
                                </h4>
                                <p className="text-sm text-gray-700">{p.flood_risk.label}</p>
                                {p.flood_risk.description && (
                                    <p className="text-xs text-gray-500">{p.flood_risk.description}</p>
                                )}
                                <div className="flex flex-wrap gap-3 pt-1">
                                    {p.flood_risk.river_or_sea && (
                                        <span className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 rounded px-2 py-0.5">
                                            <Droplets size={12} />
                                            {p.flood_risk.river_or_sea}
                                        </span>
                                    )}
                                    {p.flood_risk.distance_km != null && (
                                        <span className="text-xs text-gray-500">
                                            {p.flood_risk.distance_km.toFixed(1)} km away
                                        </span>
                                    )}
                                </div>
                            </div>

                            {p.flood_risk.message && (
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                    <p className="text-xs text-amber-800">{p.flood_risk.message}</p>
                                </div>
                            )}

                            <p className="text-[10px] text-gray-400">
                                Data: Environment Agency flood and river level data (Open Government Licence v3)
                            </p>
                        </div>
                    ) : (
                        <p className="text-sm text-gray-400">No flood risk data available for this area.</p>
                    )}
                </Section>

                {/* ═══════════════════════════════════════════════════════
                    7. REVIEWS
                ═══════════════════════════════════════════════════════ */}
                <Section id="reviews" icon={Star} title="Reviews">
                    {p.reviews?.review_count > 0 ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {[
                                    { label: 'Overall', value: p.reviews.avg_overall },
                                    { label: 'Landlord', value: p.reviews.avg_landlord },
                                    { label: 'Condition', value: p.reviews.avg_condition },
                                    { label: 'Value', value: p.reviews.avg_value },
                                ].map((r) => (
                                    <div key={r.label} className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                                        <p className="text-lg font-bold text-gray-900">{r.value ? r.value.toFixed(1) : '—'}</p>
                                        <p className="text-[10px] text-gray-400">{r.label}</p>
                                    </div>
                                ))}
                            </div>
                            <p className="text-xs text-gray-500">Based on {p.reviews.review_count} review{p.reviews.review_count !== 1 ? 's' : ''}</p>
                            {!showReviews ? (
                                <button onClick={() => setShowReviews(true)} className="text-sm text-indigo-600 font-medium hover:text-indigo-800">
                                    Show all reviews →
                                </button>
                            ) : (
                                <div className="space-y-6 border-t border-gray-100 pt-4">
                                    <ReviewList uprn={uprn} />
                                    <div className="border-t border-gray-100 pt-4"><ReviewForm uprn={uprn} /></div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <p className="text-sm text-gray-400">No reviews yet. Be the first to share your experience!</p>
                            {!showReviews ? (
                                <button onClick={() => setShowReviews(true)} className="text-sm text-indigo-600 font-medium hover:text-indigo-800">
                                    Write a review →
                                </button>
                            ) : (
                                <ReviewForm uprn={uprn} />
                            )}
                        </div>
                    )}
                </Section>

                {/* ═══════════════════════════════════════════════════════
                    8. YOUR RIGHTS
                ═══════════════════════════════════════════════════════ */}
                <Section id="rights" icon={Scale} title="Your rights as a tenant">
                    <div className="space-y-3">
                        {[
                            { title: 'Deposit protection', text: "Your landlord must protect your deposit in a government-approved scheme within 30 days. If they don\u2019t, you can claim up to 3\u00d7 the deposit." },
                            { title: 'Repairs & maintenance', text: "Your landlord must keep the property in good repair. If they refuse, contact Guildford Borough Council\u2019s housing team." },
                            { title: 'HMO requirements', text: 'A property with 3+ tenants from 2+ households needs an HMO licence. The landlord must ensure fire safety, proper facilities, and meet occupancy limits.' },
                            { title: 'Eviction protection', text: "Your landlord must give at least 2 months\u2019 notice (Section 21) or follow Section 8 grounds. You cannot be evicted without a court order." },
                        ].map((item) => (
                            <div key={item.title} className="border border-gray-100 rounded-xl p-4">
                                <h4 className="text-sm font-semibold text-gray-900">{item.title}</h4>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{item.text}</p>
                            </div>
                        ))}
                    </div>
                    <Link to="/rights" className="text-sm text-indigo-600 font-medium inline-block mt-4 hover:text-indigo-800">
                        Read the full Rights Guide →
                    </Link>
                </Section>
            </div>
        </main>
    )
}
