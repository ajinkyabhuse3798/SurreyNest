/**
 * PropertyDetail v3 — Premium Stitch-inspired property page.
 *
 * Desktop: 2-column layout (left = data sections, right = sticky map/reviews/rights)
 * Mobile: single-column scroll with all 9 sections stacked.
 *
 * Sections:
 *   1. Hero: address, stat cards, compare button
 *   2. Safety: ScoreGauge + verdict + crime breakdown
 *   3. Cost: rent band + factors + bills + total
 *   3b. RentRadar: trend chart
 *   4. Property Details: specs grid + EPC
 *   5. HMO: explainer + licence status
 *   6. Location: map + distances + transit
 *   6b. Flood Risk
 *   7. Reviews: scores + list
 *   8. Rights: tenant cards
 *
 * Data: parallel fetch ① property + ② safety + ③ HMO.
 */
import { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom'
import {
    Shield, PoundSterling, Bed, Home, CheckCircle2, XCircle,
    AlertTriangle, MapPin, Star, Scale, ArrowLeft, Building2,
    Ruler, Zap, GraduationCap, TrainFront, ShoppingBag, Moon,
    Wifi, Droplets, Landmark, Info as InfoIcon, ArrowLeftRight, TrendingUp,
    ChevronRight, Maximize2,
} from 'lucide-react'
import Navbar from '../components/Navbar'
import ScoreGauge from '../components/ScoreGauge'
import MapView from '../components/MapView'
import EpcBand from '../components/EpcBand'
import CrimeBreakdown from '../components/CrimeBreakdown'
import SafetyIntelligence from '../components/SafetyIntelligence'
import InfoTip from '../components/InfoTip'
import ReviewList from '../components/ReviewList'
import ReviewForm from '../components/ReviewForm'
import { useCompare } from '../hooks/useCompare'
import api from '../services/api'
import RentRadarChart from '../components/RentRadarChart'

// ── constants ────────────────────────────────────────────────────────────────

const UNI_SURREY = { lat: 51.2430, lng: -0.5890, label: 'University of Surrey', icon: GraduationCap }
const TOWN_CENTRE = { lat: 51.2362, lng: -0.5704, label: 'Town Centre', icon: ShoppingBag }
const TRAIN_STATION = { lat: 51.2372, lng: -0.5617, label: 'Train Station', icon: TrainFront }
const KEY_LOCATIONS = [UNI_SURREY, TOWN_CENTRE, TRAIN_STATION]

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

function walkingTime(km) { return Math.round((km / 5) * 60) }
function cyclingTime(km) { return Math.round((km / 15) * 60) }

function proximityBadge(km, type) {
    const thresholds = {
        uni: { excellent: 0.8, good: 1.5, moderate: 3.0 },
        station: { excellent: 0.5, good: 1.2, moderate: 2.5 },
        town: { excellent: 0.6, good: 1.5, moderate: 3.0 },
    }
    const t = thresholds[type] || thresholds.town
    if (km <= t.excellent) return { label: 'Excellent', colour: 'bg-emerald-100 text-emerald-700' }
    if (km <= t.good) return { label: 'Good', colour: 'bg-blue-100 text-blue-700' }
    if (km <= t.moderate) return { label: 'Moderate', colour: 'bg-amber-100 text-amber-700' }
    return { label: 'Far', colour: 'bg-red-100 text-red-700' }
}

function computeRentFactors(p, distances) {
    const factors = []
    if (!distances || distances.length === 0) return factors
    const stationDist = distances.find(d => d.label === 'Train Station')
    const uniDist = distances.find(d => d.label === 'University of Surrey')
    const epc = p.energy_rating?.toUpperCase()
    if (stationDist && stationDist.km <= 0.6) factors.push({ text: 'Right by the station', positive: true })
    else if (stationDist && stationDist.km >= 2.5) factors.push({ text: 'Far from the station', positive: false })
    if (uniDist && uniDist.km <= 1.2) factors.push({ text: 'Walking distance to Surrey', positive: true })
    else if (uniDist && uniDist.km >= 3.0) factors.push({ text: 'Long commute to campus', positive: false })
    if (epc === 'A' || epc === 'B') factors.push({ text: 'Excellent EPC — low bills', positive: true })
    else if (epc === 'F' || epc === 'G') factors.push({ text: 'Poor EPC — high bills', positive: false })
    if (p.safety_score != null && p.safety_score >= 75) factors.push({ text: 'Very safe area', positive: true })
    else if (p.safety_score != null && p.safety_score < 35) factors.push({ text: 'Higher crime area', positive: false })
    if (p.property_type === 'Detached') factors.push({ text: 'Detached — space premium', positive: true })
    else if (p.property_type === 'Flat') factors.push({ text: 'Flat — compact pricing', positive: false })
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
    if (r === 'A' || r === 'B') return { text: 'Great rating — expect low energy bills', colour: 'text-emerald-700' }
    if (r === 'C') return { text: 'Decent rating — average energy costs', colour: 'text-slate-600' }
    if (r === 'D') return { text: 'Below average — heating could be pricey in winter', colour: 'text-amber-700' }
    return { text: 'Poor rating — expect high energy bills', colour: 'text-red-700' }
}

function safetyVerdict(score) {
    if (score == null) return null
    if (score >= 80) return { text: 'This area has very low crime — great for walking home at night', colour: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' }
    if (score >= 60) return { text: 'This area is above average for safety in Guildford', colour: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' }
    if (score >= 40) return { text: 'Average safety — stick to well-lit routes at night', colour: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' }
    return { text: 'Higher than average crime — walk in groups at night', colour: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' }
}

function floorAreaContext(area, rooms) {
    if (!area || !rooms) return null
    const perRoom = area / rooms
    if (perRoom > 20) return 'Spacious for a student house'
    if (perRoom >= 15) return 'Good-sized rooms'
    if (perRoom >= 10) return 'Average size'
    return 'Compact — check room sizes before signing'
}

// ── card styles ──────────────────────────────────────────────────────────────

const CARD = 'bg-white rounded-2xl p-5 sm:p-6 shadow-[0_4px_20px_-2px_rgba(80,72,229,0.08)] border border-slate-100/80'
const CARD_SM = 'bg-white rounded-xl p-4 shadow-[0_2px_10px_-2px_rgba(80,72,229,0.06)] border border-slate-100/60'

// ── skeleton ─────────────────────────────────────────────────────────────────

function SectionSkeleton({ lines = 3 }) {
    return (
        <div className="animate-pulse space-y-3 py-2">
            {Array.from({ length: lines }).map((_, i) => (
                <div key={i} className="h-4 bg-slate-100 rounded-lg" style={{ width: `${85 - i * 15}%` }} />
            ))}
        </div>
    )
}

// ── stat card ────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, colour = 'text-indigo-600' }) {
    return (
        <div className="flex-1 min-w-[80px] bg-white rounded-2xl p-3.5 sm:p-4 text-center shadow-[0_4px_20px_-2px_rgba(80,72,229,0.08)] border border-slate-100/80 hover:shadow-[0_8px_30px_-4px_rgba(80,72,229,0.12)] transition-shadow duration-300">
            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center mx-auto mb-2">
                <Icon size={16} className={colour} />
            </div>
            <p className={`text-lg sm:text-xl font-extrabold ${colour} leading-tight`}>{value}</p>
            <p className="text-[11px] text-slate-500 mt-1 font-semibold uppercase tracking-wider">{label}</p>
            {sub && <p className="text-[10px] text-slate-400 mt-0.5 font-medium">{sub}</p>}
        </div>
    )
}

// ── section wrapper ──────────────────────────────────────────────────────────

function Section({ id, icon: Icon, title, infoTip, children, className = '' }) {
    return (
        <section id={id} className={`${CARD} ${className}`}>
            <div className="flex items-center gap-3 mb-6">
                {Icon && (
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0 border border-indigo-100/50">
                        <Icon size={17} className="text-indigo-600" />
                    </div>
                )}
                <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">{title}</h2>
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

    // ── Derived ──────────────────────────────────────────────────────
    const navigate = useNavigate()

    const distances = useMemo(() => {
        if (!property?.lat || !property?.lng) return []
        const typeMap = { 'University of Surrey': 'uni', 'Town Centre': 'town', 'Train Station': 'station' }
        return KEY_LOCATIONS.map((loc) => {
            const km = haversine(property.lat, property.lng, loc.lat, loc.lng)
            return { ...loc, km, walkMin: walkingTime(km), cycleMin: cyclingTime(km), proximityType: typeMap[loc.label] || 'town' }
        })
    }, [property])

    // ── Loading ──────────────────────────────────────────────────────
    if (loading) {
        return (
            <main className="min-h-screen bg-[#f8f9fc]">
                <Navbar />
                <div className="max-w-5xl mx-auto px-4 py-8">
                    <div className="animate-pulse space-y-6">
                        <div className="h-3 bg-slate-100 rounded w-24" />
                        <div className="h-8 bg-slate-100 rounded-lg w-3/4" />
                        <div className="h-4 bg-slate-100 rounded w-1/3" />
                        <div className="flex gap-3">
                            {[1, 2, 3, 4].map(i => <div key={i} className="flex-1 h-24 bg-white rounded-2xl shadow-sm" />)}
                        </div>
                        <div className="grid lg:grid-cols-[1fr_380px] gap-6">
                            <div className="space-y-6">
                                {[1, 2, 3].map(i => <div key={i} className={`${CARD} h-56`}><SectionSkeleton lines={4} /></div>)}
                            </div>
                            <div className="space-y-6">
                                <div className={`${CARD} h-72`} />
                                <div className={`${CARD} h-40`}><SectionSkeleton lines={3} /></div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        )
    }

    // ── Error ────────────────────────────────────────────────────────
    if (error || !property) {
        return (
            <main className="min-h-screen bg-[#f8f9fc]">
                <Navbar />
                <div className="max-w-5xl mx-auto px-4 py-16 text-center">
                    <div className={CARD + ' max-w-md mx-auto py-12'}>
                        <AlertTriangle size={44} className="mx-auto text-red-300 mb-4" />
                        <p className="text-base font-semibold text-slate-900 mb-1">{error || 'Property not found'}</p>
                        <button onClick={() => navigate(-1)} className="text-sm text-indigo-600 font-medium mt-4 inline-flex items-center gap-1 hover:text-indigo-800 transition-colors">
                            <ArrowLeft size={14} /> Go back
                        </button>
                    </div>
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
    const hmo = hmoDetail?.record || p.hmo || {}
    const hmoStatus = hmoDetail?.status || (p.hmo?.is_hmo ? (p.hmo.is_active ? 'licensed' : 'expired') : 'not_found')

    // ── Render ───────────────────────────────────────────────────────
    return (
        <main className="min-h-screen bg-[#f8f9fc] pb-16">
            <Navbar />

            <div className="max-w-5xl mx-auto px-4 py-6 lg:py-10">

                {/* ══════════════════════════════════════════════════════════
                    HERO SECTION
                ══════════════════════════════════════════════════════════ */}
                <button onClick={() => navigate(-1)} className="text-xs text-slate-400 hover:text-indigo-600 transition-colors inline-flex items-center gap-1.5 font-semibold bg-white/60 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/50">
                    <ArrowLeft size={13} /> Search Results
                </button>

                <div className="mt-4 flex flex-col lg:flex-row lg:items-start lg:justify-between lg:gap-6">
                    <div className="flex-1">
                        <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 leading-tight tracking-tight">{p.address}</h1>
                        <p className="text-sm text-slate-500 mt-2 flex items-center gap-2.5 flex-wrap">
                            <span>{p.postcode} · {p.property_type || 'Property'}{p.built_form ? ` · ${p.built_form}` : ''}</span>
                            {p.tenure && (
                                <span className={`inline-flex items-center text-[10px] font-semibold rounded-full px-2.5 py-1 leading-none ${p.tenure.includes('rental') || p.tenure.includes('rented')
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : p.tenure.includes('owner')
                                        ? 'bg-slate-100 text-slate-500'
                                        : 'bg-slate-50 text-slate-400'
                                    }`}>
                                    {p.tenure.includes('rental') || p.tenure.includes('rented') ? 'Rental' : p.tenure.includes('owner') ? 'Owner' : 'Unknown'}
                                </span>
                            )}
                        </p>
                    </div>

                    {/* Compare button — desktop: right-aligned */}
                    <button
                        onClick={() => compared ? removeFromCompare(p.uprn) : addToCompare(p.uprn)}
                        className={`mt-3 lg:mt-0 flex items-center justify-center gap-2 text-sm font-bold py-2.5 px-6 rounded-xl border-2 transition-all duration-300 ${compared
                            ? 'bg-indigo-50 border-indigo-300 text-indigo-700 hover:bg-indigo-100 shadow-[0_2px_8px_-2px_rgba(80,72,229,0.15)]'
                            : 'border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 hover:shadow-[0_2px_8px_-2px_rgba(80,72,229,0.15)]'
                            }`}
                    >
                        <ArrowLeftRight size={15} />
                        {compared ? 'Added to Compare ✓' : 'Add to Compare'}
                    </button>
                </div>

                {/* Stat cards */}
                <div className="flex gap-3 mt-6 overflow-x-auto pb-1 -mx-1 px-1">
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
                        colour={p.safety_score >= 60 ? 'text-emerald-600' : p.safety_score >= 40 ? 'text-amber-600' : p.safety_score != null ? 'text-red-600' : 'text-slate-400'}
                    />
                    <StatCard
                        icon={Bed}
                        label="Rooms"
                        value={p.num_rooms || '—'}
                        sub={p.floor_area_m2 ? `${p.floor_area_m2}m²` : null}
                        colour="text-slate-700"
                    />
                    <StatCard
                        icon={Maximize2}
                        label="Floor area"
                        value={p.floor_area_m2 ? `${p.floor_area_m2}m²` : '—'}
                        sub={areaCtx || null}
                        colour="text-slate-700"
                    />
                </div>

                {/* ══════════════════════════════════════════════════════════
                    2-COLUMN LAYOUT (desktop)
                ══════════════════════════════════════════════════════════ */}
                <div className="mt-8 grid lg:grid-cols-[1fr_380px] gap-6">

                    {/* ── LEFT COLUMN ──────────────────────────────────── */}
                    <div className="space-y-6">

                        {/* 2. SAFETY ──────────────────────────────────── */}
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
                                                <div className={`${verdict.bg} border ${verdict.border} rounded-xl px-4 py-3.5 shadow-sm`}>
                                                    <p className={`text-sm font-bold ${verdict.colour}`}>{verdict.text}</p>
                                                </div>
                                            )}
                                            <p className="text-sm text-slate-500 leading-relaxed">
                                                Based on reported crime in the <span className="font-semibold text-slate-700">{p.postcode}</span> area.
                                                Covers the whole postcode sector, not just this street.
                                            </p>
                                        </div>
                                    </div>

                                    {/* ── Brief CTA to full safety report ── */}
                                    <Link
                                        to={`/safety/${encodeURIComponent(p.postcode)}`}
                                        className="group flex items-center gap-4 bg-gradient-to-r from-indigo-50 to-violet-50 hover:from-indigo-100 hover:to-violet-100 rounded-xl px-5 py-4 border border-indigo-200/60 transition-all duration-200 shadow-sm hover:shadow-md"
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-200 transition-colors">
                                            <Shield size={18} className="text-indigo-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-indigo-800">Explore full safety report</p>
                                            <p className="text-xs text-indigo-500 mt-0.5">Crime breakdown, trends, student safety, area rankings & more</p>
                                        </div>
                                        <ChevronRight size={18} className="text-indigo-400 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
                                    </Link>
                                </div>
                            ) : (
                                <p className="text-sm text-slate-400">Safety data is not yet available for this area.</p>
                            )}
                        </Section>

                        {/* 3. COST ────────────────────────────────────── */}
                        <Section id="cost" icon={PoundSterling} title="What will it cost?">
                            {weeklyRent ? (
                                <div className="space-y-5">
                                    {/* Rent confidence band */}
                                    <div className="rounded-xl border border-slate-100/80 p-5 bg-slate-50/30">
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                                            Typical rent range · {p.postcode}
                                        </p>
                                        <div className="flex rounded-xl overflow-hidden h-14 text-xs font-semibold">
                                            <div className="flex-1 flex flex-col items-center justify-center bg-emerald-50 text-emerald-700 border-r-2 border-white">
                                                <span className="text-[10px] font-medium">Less typical</span>
                                                <span className="font-bold">&lt;£{Math.round(weeklyRent * 0.92)}/wk</span>
                                            </div>
                                            <div className="flex-[2] flex flex-col items-center justify-center bg-indigo-100 text-indigo-800">
                                                <span className="text-[10px] font-medium">Typical market</span>
                                                <span className="font-bold">
                                                    £{Math.round(weeklyRent * 0.92)}–£{Math.round(weeklyRent * 1.08)}/wk
                                                </span>
                                            </div>
                                            <div className="flex-1 flex flex-col items-center justify-center bg-amber-50 text-amber-700 border-l-2 border-white">
                                                <span className="text-[10px] font-medium">More typical</span>
                                                <span className="font-bold">&gt;£{Math.round(weeklyRent * 1.08)}/wk</span>
                                            </div>
                                        </div>
                                        <p className="text-sm text-slate-500 mt-3">
                                            ≈ <span className="font-bold text-slate-800">
                                                £{Math.round(weeklyRent * 0.92 * 52 / 12)}–£{Math.round(weeklyRent * 1.08 * 52 / 12)}
                                            </span> /month typical range
                                        </p>
                                        <p className="text-xs text-slate-400 mt-1.5">
                                            Range = ±8% of ML estimate. Actual rent varies by condition, floor, and landlord.
                                        </p>
                                    </div>

                                    {/* What drives this estimate */}
                                    {rentFactors.length > 0 && (
                                        <div className="border border-slate-100/80 rounded-xl p-4 bg-slate-50/30">
                                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                                                What drives this estimate
                                            </h3>
                                            <div className="flex flex-wrap gap-2">
                                                {rentFactors.map((factor) => (
                                                    <span
                                                        key={factor.text}
                                                        className={`inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-full shadow-sm ${factor.positive
                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                                                            }`}
                                                    >
                                                        {factor.positive ? '✓' : '⚠'} {factor.text}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Bills estimate */}
                                    <div className="border border-slate-100/80 rounded-xl p-4 space-y-3 bg-slate-50/30">
                                        <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                                            Estimated monthly bills
                                            <InfoTip text="These are rough estimates for a Guildford student property. Your actual costs will vary depending on usage and provider." />
                                        </h3>
                                        <div className="space-y-2.5">
                                            {[
                                                { icon: Zap, colour: 'text-amber-500', label: 'Energy', value: `~£${energyCost}/mo` },
                                                { icon: Droplets, colour: 'text-blue-500', label: 'Water', value: `~£${waterCost}/mo` },
                                                { icon: Wifi, colour: 'text-indigo-500', label: 'Internet', value: `~£${internetCost}/mo` },
                                            ].map(b => (
                                                <div key={b.label} className="flex items-center justify-between text-sm">
                                                    <span className="flex items-center gap-2.5 text-slate-600">
                                                        <b.icon size={15} className={b.colour} />{b.label}
                                                    </span>
                                                    <span className="font-semibold text-slate-900">{b.value}</span>
                                                </div>
                                            ))}
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="flex items-center gap-2.5 text-slate-600">
                                                    <Landmark size={15} className="text-emerald-600" />
                                                    Council tax
                                                    <InfoTip text="Full-time students are exempt from council tax. You don't pay this! Register your exemption with Guildford council." />
                                                </span>
                                                <span className="font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full text-xs border border-emerald-200">£0 — Students exempt ✓</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Total + per-person */}
                                    {totalMonthly && (
                                        <div className="bg-gradient-to-br from-slate-50 to-indigo-50/30 rounded-xl p-5 border border-slate-100/80 shadow-sm">
                                            <div className="flex items-baseline justify-between">
                                                <span className="text-sm font-bold text-slate-700">Total estimated monthly</span>
                                                <span className="text-2xl font-extrabold text-slate-900">~£{totalMonthly}</span>
                                            </div>
                                            {perPerson && (
                                                <p className="text-sm text-indigo-600 font-bold mt-2.5 bg-indigo-50 rounded-lg px-3.5 py-2.5 inline-block border border-indigo-100 shadow-sm">
                                                    ÷ {p.num_rooms} rooms = ~£{perPerson}/room per month
                                                </p>
                                            )}
                                            {annualCost && (
                                                <div className="border-t border-slate-200/60 mt-3.5 pt-3.5 space-y-1.5">
                                                    <p className="text-xs text-slate-500 font-medium">
                                                        12-month contract: <span className="font-bold text-slate-800">
                                                            ~£{annualCost.toLocaleString()}
                                                        </span> total
                                                    </p>
                                                    <p className="text-xs text-slate-400">
                                                        💡 Average student maintenance loan: ~£9,978/year (2024/25)
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className="text-sm text-slate-400">Rent prediction is not available for this property yet.</p>
                            )}
                        </Section>

                        {/* 3b. RENT RADAR ─────────────────────────────── */}
                        {p.postcode && (() => {
                            const parts = p.postcode.trim().toUpperCase().split(/\s+/)
                            const sector = parts.length === 2 && parts[1].length >= 1
                                ? `${parts[0]} ${parts[1][0]}`
                                : null
                            return sector ? (
                                <Section id="rent-trends" icon={TrendingUp} title="RentRadar"
                                    infoTip="Shows how median implied rents have changed in this postcode sector over the last 5 years, plus a 2-year forecast based on ONS house price growth.">
                                    <RentRadarChart postcodeSector={sector} />
                                </Section>
                            ) : null
                        })()}

                        {/* 4. PROPERTY DETAILS ────────────────────────── */}
                        <Section id="details" icon={Building2} title="Property details">
                            <div className="space-y-5">
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {[
                                        { icon: Home, label: 'Type', value: p.property_type },
                                        { icon: Bed, label: 'Habitable rooms', value: p.num_rooms },
                                        { icon: Ruler, label: 'Floor area', value: p.floor_area_m2 ? `${p.floor_area_m2} m²` : null },
                                        { icon: Building2, label: 'Built form', value: p.built_form },
                                    ].filter(d => d.value).map(d => (
                                        <div key={d.label} className="flex items-center justify-between bg-slate-50/80 border border-slate-100/80 rounded-xl px-4 py-3.5 hover:bg-slate-50 transition-colors">
                                            <span className="flex items-center gap-2.5 text-xs text-slate-500 font-semibold uppercase tracking-wider"><d.icon size={15} className="text-indigo-400" />{d.label}</span>
                                            <span className="text-sm font-extrabold text-slate-900">{d.value}</span>
                                        </div>
                                    ))}
                                </div>

                                {areaCtx && (
                                    <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5 bg-slate-50/50 rounded-lg px-3 py-2">
                                        <Ruler size={12} className="text-indigo-400" /> {areaCtx}
                                    </p>
                                )}

                                {p.energy_rating && (
                                    <div className="space-y-3">
                                        <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                                            Energy rating (EPC)
                                            <InfoTip text="Energy Performance Certificate — rates how energy-efficient the property is. A is best (cheapest to heat), G is worst (most expensive)." />
                                        </h3>
                                        <EpcBand rating={p.energy_rating} />
                                        {epcCtx && (
                                            <p className={`text-xs font-bold ${epcCtx.colour}`}>{epcCtx.text}</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </Section>

                        {/* 5. HMO ─────────────────────────────────────── */}
                        <Section
                            id="hmo"
                            icon={Home}
                            title="HMO status"
                            infoTip="House in Multiple Occupation — a property rented by 3+ people from different households, like a typical student house share."
                        >
                            <div className="space-y-4">
                                <div className="bg-indigo-50/80 border border-indigo-100 rounded-xl p-4 flex items-start gap-3">
                                    <InfoIcon size={16} className="text-indigo-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-xs text-indigo-800 leading-relaxed font-medium">
                                        An <strong>HMO</strong> (House in Multiple Occupation) is a property rented by 3+ people from different households — like a typical student house share.
                                    </p>
                                </div>

                                {hmoLoading && !p.hmo ? (
                                    <SectionSkeleton lines={3} />
                                ) : hmoStatus === 'licensed' ? (
                                    <div className="space-y-3">
                                        <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4 shadow-sm">
                                            <CheckCircle2 size={20} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                                            <div>
                                                <p className="text-sm font-bold text-emerald-800">Licensed HMO ✓</p>
                                                <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
                                                    This property has a valid HMO licence — your landlord has met safety requirements including fire alarms, escape routes, and minimum room sizes.
                                                </p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                                            {(hmo.licence_number || p.hmo?.licence_number) && (
                                                <div className="bg-slate-50/80 border border-slate-100/80 rounded-xl px-3 py-3">
                                                    <span className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">Licence #</span>
                                                    <p className="font-bold text-slate-700 mt-0.5">{hmo.licence_number || p.hmo?.licence_number}</p>
                                                </div>
                                            )}
                                            {(hmo.max_occupants || p.hmo?.max_occupants) && (
                                                <div className="bg-slate-50/80 border border-slate-100/80 rounded-xl px-3 py-3">
                                                    <span className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">Max occupants</span>
                                                    <p className="font-bold text-slate-700 mt-0.5">{hmo.max_occupants || p.hmo?.max_occupants}</p>
                                                </div>
                                            )}
                                            {(hmo.expiry_date || p.hmo?.expiry_date) && (
                                                <div className="bg-slate-50/80 border border-slate-100/80 rounded-xl px-3 py-3">
                                                    <span className="text-slate-400 text-[10px] font-medium">Expires</span>
                                                    <p className="font-bold text-slate-700 mt-0.5">
                                                        {new Date(hmo.expiry_date || p.hmo?.expiry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : hmoStatus === 'expired' ? (
                                    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                                        <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-bold text-amber-800">HMO licence expired ⚠</p>
                                            <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                                                This property's HMO licence has expired. Contact the landlord or Guildford Borough Council before signing a tenancy.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-start gap-3 bg-slate-50 border border-slate-100 rounded-xl p-4">
                                        <AlertTriangle size={18} className="text-slate-400 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-semibold text-slate-700">Not on the HMO register</p>
                                            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                                If you're renting as a group of 3+, ask the landlord whether the property needs an HMO licence.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <p className="text-xs text-slate-400 leading-relaxed">
                                    An HMO licence means the council has inspected the property for fire safety, escape routes, and living standards. It protects you as a tenant.
                                </p>
                            </div>
                        </Section>

                        {/* 6b. FLOOD RISK (in left column on desktop) ── */}
                        <Section id="flood-risk" icon={Droplets} title="Flood Risk">
                            {p.flood_risk ? (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        {p.flood_risk.current_severity ? (
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${p.flood_risk.current_severity === 1 ? 'bg-red-100 text-red-700 border border-red-200' :
                                                p.flood_risk.current_severity === 2 ? 'bg-orange-100 text-orange-700 border border-orange-200' :
                                                    p.flood_risk.current_severity === 3 ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' :
                                                        'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                                }`}>
                                                <AlertTriangle size={12} />
                                                {p.flood_risk.severity_label}
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                                                <CheckCircle2 size={12} />
                                                No Active Warnings
                                            </span>
                                        )}
                                    </div>

                                    <div className="bg-slate-50/80 border border-slate-100/80 rounded-xl p-4 space-y-2">
                                        <h4 className="text-sm font-bold text-slate-800">Nearest Flood Area</h4>
                                        <p className="text-sm text-slate-700">{p.flood_risk.label}</p>
                                        {p.flood_risk.description && (
                                            <p className="text-xs text-slate-500">{p.flood_risk.description}</p>
                                        )}
                                        <div className="flex flex-wrap gap-3 pt-1">
                                            {p.flood_risk.river_or_sea && (
                                                <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-2.5 py-1">
                                                    <Droplets size={12} />{p.flood_risk.river_or_sea}
                                                </span>
                                            )}
                                            {p.flood_risk.distance_km != null && (
                                                <span className="text-xs text-slate-500">{p.flood_risk.distance_km.toFixed(1)} km away</span>
                                            )}
                                        </div>
                                    </div>

                                    {p.flood_risk.message && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                                            <p className="text-xs text-amber-800">{p.flood_risk.message}</p>
                                        </div>
                                    )}

                                    <p className="text-[10px] text-slate-400">
                                        Data: Environment Agency flood and river level data (Open Government Licence v3)
                                    </p>
                                </div>
                            ) : (
                                <p className="text-sm text-slate-400">No flood risk data available for this area.</p>
                            )}
                        </Section>

                    </div>
                    {/* END LEFT COLUMN */}

                    {/* ── RIGHT COLUMN (sticky on desktop) ─────────── */}
                    <div className="space-y-6 lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto lg:pr-1">

                        {/* 6. LOCATION ────────────────────────────────── */}
                        {hasCoords && (
                            <Section id="location" icon={MapPin} title="Location">
                                <MapView
                                    markers={[{ id: p.uprn, lat: p.lat, lng: p.lng, label: p.address, score: p.safety_score }]}
                                    singleMode
                                    zoom={15}
                                    height="h-[250px] lg:h-[300px]"
                                    className="rounded-xl overflow-hidden border-2 border-slate-100 shadow-sm"
                                />

                                {distances.length > 0 && (
                                    <div className="mt-4 space-y-2">
                                        {distances.map((d) => {
                                            const badge = proximityBadge(d.km, d.proximityType)
                                            return (
                                                <div key={d.label} className="bg-slate-50/80 border border-slate-100/80 rounded-xl px-4 py-3 hover:bg-slate-50 transition-colors">
                                                    <div className="flex items-center justify-between">
                                                        <span className="flex items-center gap-2.5 text-sm text-slate-700 font-semibold">
                                                            <d.icon size={16} className="text-indigo-500" />
                                                            {d.label}
                                                        </span>
                                                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full shadow-sm ${badge.colour}`}>
                                                            {badge.label}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 mt-1.5 pl-[26px] font-medium">
                                                        {d.km.toFixed(1)} km · ~{d.walkMin} min walk · ~{d.cycleMin} min cycle
                                                    </p>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}

                                <div className="mt-4 border border-slate-100/80 rounded-xl p-4 space-y-2.5 bg-slate-50/30">
                                    <h3 className="text-sm font-bold text-slate-700">Getting Around Guildford</h3>
                                    {GUILDFORD_TRANSIT_FACTS.map((fact) => (
                                        <div key={fact.title} className={`flex items-start gap-3 ${fact.bg} rounded-xl px-3.5 py-3 border border-slate-50 shadow-sm`}>
                                            <fact.icon size={15} className={`${fact.colour} flex-shrink-0 mt-0.5`} />
                                            <div>
                                                <p className={`text-xs font-bold ${fact.colour}`}>{fact.title}</p>
                                                <p className="text-xs text-slate-600 mt-0.5 font-medium">{fact.detail}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Section>
                        )}

                        {/* 7. REVIEWS ──────────────────────────────────── */}
                        <Section id="reviews" icon={Star} title="Student Reviews">
                            {p.reviews?.review_count > 0 ? (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-2.5">
                                        {[
                                            { label: 'Overall', value: p.reviews.avg_overall },
                                            { label: 'Landlord', value: p.reviews.avg_landlord },
                                            { label: 'Condition', value: p.reviews.avg_condition },
                                            { label: 'Value', value: p.reviews.avg_value },
                                        ].map((r) => (
                                            <div key={r.label} className="bg-slate-50/80 border border-slate-100/80 rounded-xl px-3 py-3.5 text-center hover:bg-slate-50 transition-colors">
                                                <p className="text-xl font-extrabold text-slate-900">{r.value ? r.value.toFixed(1) : '—'}</p>
                                                <p className="text-[10px] text-slate-400 font-semibold mt-0.5 uppercase tracking-wider">{r.label}</p>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-xs text-slate-500 font-medium">Based on {p.reviews.review_count} review{p.reviews.review_count !== 1 ? 's' : ''}</p>
                                    {!showReviews ? (
                                        <button onClick={() => setShowReviews(true)} className="w-full text-sm text-indigo-600 font-bold bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-xl py-2.5 transition-all duration-300 flex items-center justify-center gap-1 hover:shadow-sm">
                                            Show all reviews <ChevronRight size={14} />
                                        </button>
                                    ) : (
                                        <div className="space-y-6 border-t border-slate-100 pt-4">
                                            <ReviewList uprn={uprn} />
                                            <div className="border-t border-slate-100 pt-4"><ReviewForm uprn={uprn} /></div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <p className="text-sm text-slate-400">No reviews yet. Be the first to share your experience!</p>
                                    {!showReviews ? (
                                        <button onClick={() => setShowReviews(true)} className="w-full text-sm text-indigo-600 font-bold bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-xl py-2.5 transition-all duration-300 flex items-center justify-center gap-1 hover:shadow-sm">
                                            Write a review <ChevronRight size={14} />
                                        </button>
                                    ) : (
                                        <ReviewForm uprn={uprn} />
                                    )}
                                </div>
                            )}
                        </Section>

                        {/* 8. YOUR RIGHTS ──────────────────────────────── */}
                        <Section id="rights" icon={Scale} title="Your tenant rights">
                            <div className="space-y-3">
                                {[
                                    { title: 'Deposit protection', text: "Your landlord must protect your deposit in a government-approved scheme within 30 days. If they don\u2019t, you can claim up to 3\u00d7 the deposit." },
                                    { title: 'Repairs & maintenance', text: "Your landlord must keep the property in good repair. If they refuse, contact Guildford Borough Council\u2019s housing team." },
                                    { title: 'HMO requirements', text: 'A property with 3+ tenants from 2+ households needs an HMO licence. The landlord must ensure fire safety, proper facilities, and meet occupancy limits.' },
                                    { title: 'Eviction protection', text: "Your landlord must give at least 2 months\u2019 notice (Section 21) or follow Section 8 grounds. You cannot be evicted without a court order." },
                                ].map((item) => (
                                    <div key={item.title} className="border-l-4 border-indigo-400 bg-slate-50/80 rounded-r-xl px-4 py-3.5 hover:bg-slate-50 transition-colors">
                                        <h4 className="text-sm font-bold text-slate-900">{item.title}</h4>
                                        <p className="text-xs text-slate-500 mt-1 leading-relaxed font-medium">{item.text}</p>
                                    </div>
                                ))}
                            </div>
                            <Link to="/rights" className="text-sm text-indigo-600 font-bold inline-flex items-center gap-1.5 mt-5 hover:text-indigo-800 transition-all duration-300 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 hover:shadow-sm">
                                Read the full Rights Guide <ChevronRight size={14} />
                            </Link>
                        </Section>

                    </div>
                    {/* END RIGHT COLUMN */}

                </div>
            </div>
        </main>
    )
}
