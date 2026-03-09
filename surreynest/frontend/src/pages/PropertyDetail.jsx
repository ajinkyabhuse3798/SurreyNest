/**
 * PropertyDetail v4 — Premium Stitch-inspired property page.
 *
 * Desktop: 2-column layout (left = data sections, right = sticky map/reviews/rights)
 * Mobile: single-column scroll with all sections stacked.
 *
 * This file is now a thin ORCHESTRATOR — visual sections are extracted into
 * focused sub-components under components/property/.
 *
 * Data: parallel fetch ① property + ② safety + ③ HMO.
 */
import { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom'
import {
    Shield, PoundSterling, Home, MapPin, Star, Scale,
    AlertTriangle, Building2, Droplets, ChevronRight, CheckCircle2
} from 'lucide-react'
import Navbar from '../components/Navbar'
import InfoTip from '../components/InfoTip'
import ReviewList from '../components/ReviewList'
import ReviewForm from '../components/ReviewForm'
import { useCompare } from '../hooks/useCompare'
import api from '../services/api'

// ── Extracted sub-components ─────────────────────────────────────────────────
import PropertyHero from '../components/property/PropertyHero'
import SafetySection from '../components/property/SafetySection'
import CostSection from '../components/property/CostSection'
import PropertyDetailsSection from '../components/property/PropertyDetailsSection'
import HmoSection from '../components/property/HmoSection'
import FloodRiskSection from '../components/property/FloodRiskSection'
import LocationSidebar from '../components/property/LocationSidebar'

// ── Extracted utilities ──────────────────────────────────────────────────────
import {
    CARD, KEY_LOCATIONS,
    haversine, walkingTime, cyclingTime,
    estimateEnergy, epcImpact, safetyVerdict, floorAreaContext,
} from '../utils/propertyUtils'


// ── Section wrapper (Premium) ────────────────────────────────────────────────
function Section({ id, icon: Icon, title, infoTip, children, className = '' }) {
    return (
        <section id={id} className={`glass-card-solid ${className}`}>
            <div className="flex items-center gap-3 mb-6">
                {Icon && (
                    <div className="w-9 h-9 rounded-xl bg-indigo-50/80 flex items-center justify-center flex-shrink-0 border border-indigo-100 shadow-sm">
                        <Icon size={17} className="text-indigo-600 drop-shadow-sm" />
                    </div>
                )}
                <h2 className="text-[19px] font-extrabold text-slate-900 tracking-tight">{title}</h2>
                {infoTip && <InfoTip text={infoTip} />}
            </div>
            {children}
        </section>
    )
}

function SectionSkeleton({ lines = 3 }) {
    return (
        <div className="animate-pulse space-y-3 py-2">
            {Array.from({ length: lines }).map((_, i) => (
                <div key={i} className="h-4 bg-slate-100/50 rounded-lg" style={{ width: `${85 - i * 15}%` }} />
            ))}
        </div>
    )
}


// ── Main component ───────────────────────────────────────────────────────────

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
    const navigate = useNavigate()

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
            <main className="min-h-screen bg-[#f8f9fc] relative overflow-hidden">
                {/* Background decorative blobs */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-50/50 rounded-full blur-[100px] pointer-events-none" />
                <Navbar />
                <div className="max-w-5xl mx-auto px-4 py-8 relative z-10">
                    <div className="animate-pulse space-y-8">
                        <div className="space-y-4">
                            <div className="h-8 bg-slate-200/50 rounded-lg w-3/4 max-w-xl" />
                            <div className="h-4 bg-slate-200/50 rounded w-1/3" />
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-white/40 rounded-2xl border border-white/50 shadow-sm" />)}
                        </div>
                        <div className="grid lg:grid-cols-[1fr_380px] gap-6 mt-8">
                            <div className="space-y-6">
                                {[1, 2, 3].map(i => <div key={i} className="glass-card-solid h-56"><SectionSkeleton lines={4} /></div>)}
                            </div>
                            <div className="space-y-6">
                                <div className="glass-card-solid h-80" />
                                <div className="glass-card-solid h-48"><SectionSkeleton lines={3} /></div>
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
                    <div className="glass-card-solid max-w-md mx-auto py-12">
                        <AlertTriangle size={48} className="mx-auto text-amber-500 mb-5" />
                        <p className="text-lg font-extrabold text-slate-900 mb-2">{error || 'Property not found'}</p>
                        <button onClick={() => navigate(-1)} className="text-sm font-bold bg-indigo-50 text-indigo-600 px-6 py-2.5 rounded-xl mt-4 inline-flex items-center hover:bg-indigo-100 transition-colors">
                            Search again
                        </button>
                    </div>
                </div>
            </main>
        )
    }

    // ── Derived values ───────────────────────────────────────────────
    const p = property
    const weeklyRent = p.rent_prediction?.predicted_weekly_rent
    const monthlyRent = weeklyRent ? Math.round((weeklyRent * 52) / 12) : null
    const energyCost = estimateEnergy(p.energy_rating)
    const totalMonthly = monthlyRent ? monthlyRent + energyCost + 30 + 25 : null
    const perPerson = totalMonthly && p.num_rooms >= 2 ? Math.round(totalMonthly / p.num_rooms) : null
    const annualCost = totalMonthly ? totalMonthly * 12 : null
    const verdict = safetyVerdict(p.safety_score)
    const areaCtx = floorAreaContext(p.floor_area_m2, p.num_rooms)
    const epcCtx = epcImpact(p.energy_rating)
    const hasCoords = p.lat && p.lng
    const hmoStatus = hmoDetail?.status || (p.hmo?.is_hmo ? (p.hmo.is_active ? 'licensed' : 'expired') : 'not_found')

    // ── Render ───────────────────────────────────────────────────────
    return (
        <main className="min-h-screen bg-[#f8f9fc] pb-16 relative overflow-x-hidden">
            {/* Ambient Background Accents */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-50/60 rounded-full blur-[100px] pointer-events-none -z-10" />
            <div className="absolute top-[800px] left-[-200px] w-[600px] h-[600px] bg-slate-100/40 rounded-full blur-[120px] pointer-events-none -z-10" />

            <Navbar />

            <div className="max-w-[1100px] mx-auto px-4 py-6 lg:py-10 relative z-10">

                {/* 1. HERO */}
                <PropertyHero
                    property={p}
                    weeklyRent={weeklyRent}
                    areaCtx={areaCtx}
                    compared={compared}
                    onToggleCompare={() => compared ? removeFromCompare(p.uprn) : addToCompare(p.uprn)}
                    onGoBack={() => navigate(-1)}
                />

                {/* 2-COLUMN LAYOUT (desktop) */}
                <div className="mt-8 grid lg:grid-cols-[1fr_390px] gap-6 lg:gap-8">

                    {/* ── LEFT COLUMN ──────────────────────────────────── */}
                    <div className="space-y-6 lg:space-y-8">

                        {/* 2. SAFETY */}
                        <Section id="safety" icon={Shield} title="Area Safety Profile"
                            infoTip="Safety scores are based on reported crime from police.uk data for this postcode sector. Higher = safer. Updated monthly.">
                            <SafetySection property={p} verdict={verdict} />
                        </Section>

                        {/* 3. COST + 3b. RENT RADAR */}
                        <Section id="cost" icon={PoundSterling} title="Estimated Costs">
                            <CostSection
                                property={p}
                                weeklyRent={weeklyRent}
                                monthlyRent={monthlyRent}
                                energyCost={energyCost}
                                totalMonthly={totalMonthly}
                                perPerson={perPerson}
                                annualCost={annualCost}
                            />
                        </Section>

                        {/* 4. PROPERTY DETAILS */}
                        <Section id="details" icon={Building2} title="Property specifics">
                            <PropertyDetailsSection property={p} areaCtx={areaCtx} epcCtx={epcCtx} />
                        </Section>

                        {/* 5. HMO */}
                        <Section id="hmo" icon={Home} title="HMO Compliance"
                            infoTip="House in Multiple Occupation — a property rented by 3+ people from different households, like a typical student house share.">
                            <HmoSection hmoStatus={hmoStatus} hmoDetail={hmoDetail} hmoLoading={hmoLoading} property={p} />
                        </Section>

                        {/* 6b. FLOOD RISK */}
                        <Section id="flood-risk" icon={Droplets} title="Environmental">
                            <FloodRiskSection floodRisk={p.flood_risk} />
                        </Section>

                    </div>
                    {/* END LEFT COLUMN */}

                    {/* ── RIGHT COLUMN (sticky on desktop) ─────────── */}
                    <div className="space-y-6 lg:space-y-8 lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto lg:pr-1 pb-4 no-scrollbar">

                        {/* 6. LOCATION */}
                        {hasCoords && (
                            <Section id="location" icon={MapPin} title="Location">
                                <LocationSidebar property={p} distances={distances} />
                            </Section>
                        )}

                        {/* 7. REVIEWS */}
                        <Section id="reviews" icon={Star} title="Student Reviews">
                            {p.reviews?.review_count > 0 ? (
                                <div className="space-y-5">
                                    <div className="grid grid-cols-2 gap-3">
                                        {[
                                            { label: 'Overall', value: p.reviews.avg_overall },
                                            { label: 'Landlord', value: p.reviews.avg_landlord },
                                            { label: 'Condition', value: p.reviews.avg_condition },
                                            { label: 'Value', value: p.reviews.avg_value },
                                        ].map((r) => (
                                            <div key={r.label} className="bg-white border border-slate-100/80 rounded-2xl px-4 py-4 text-center hover:shadow-sm transition-shadow">
                                                <p className="text-[22px] font-extrabold text-slate-800">{r.value ? r.value.toFixed(1) : '—'}</p>
                                                <div className="flex justify-center my-1">
                                                    {[1, 2, 3, 4, 5].map(i => (
                                                        <Star key={i} size={10} className={i <= Math.round(r.value || 0) ? 'text-amber-400 fill-amber-400' : 'text-slate-200'} />
                                                    ))}
                                                </div>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{r.label}</p>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-xs text-slate-400 font-medium text-center bg-slate-50/50 py-2 rounded-lg">Based on {p.reviews.review_count} verified review{p.reviews.review_count !== 1 ? 's' : ''}</p>

                                    {!showReviews ? (
                                        <button onClick={() => setShowReviews(true)} className="w-full text-sm text-indigo-700 font-extrabold bg-indigo-50/80 hover:bg-indigo-100 border border-indigo-200/60 rounded-xl py-3.5 transition-all duration-300 flex items-center justify-center gap-1.5 hover:shadow-sm">
                                            Read all student reviews <ChevronRight size={16} />
                                        </button>
                                    ) : (
                                        <div className="space-y-6 border-t border-slate-100 pt-4">
                                            <ReviewList uprn={uprn} />
                                            <div className="border-t border-slate-100 pt-4">
                                                <ReviewForm uprn={uprn} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="bg-slate-50/80 border border-slate-100/60 rounded-2xl p-5 text-center">
                                        <Star size={24} className="mx-auto text-slate-300 mb-2" />
                                        <p className="text-sm font-medium text-slate-500">No reviews yet. Be the first to share your experience living here!</p>
                                    </div>
                                    {!showReviews ? (
                                        <button onClick={() => setShowReviews(true)} className="w-full text-sm text-indigo-700 font-extrabold bg-indigo-50/80 hover:bg-indigo-100 border border-indigo-200/60 rounded-xl py-3.5 transition-all duration-300 flex items-center justify-center gap-1.5 hover:shadow-sm">
                                            Write the first review <ChevronRight size={16} />
                                        </button>
                                    ) : (
                                        <ReviewForm uprn={uprn} />
                                    )}
                                </div>
                            )}
                        </Section>

                        {/* 8. YOUR RIGHTS */}
                        <Section id="rights" icon={Scale} title="Your tenant rights">
                            <div className="space-y-3.5">
                                {[
                                    { title: 'Deposit protection', text: "Your landlord must protect your deposit in a government-approved scheme within 30 days. If they don\u2019t, you can claim up to 3\u00d7 out." },
                                    { title: 'Repairs & maintenance', text: "Your landlord must keep the property in good repair. If they refuse, contact Guildford Borough Council\u2019s housing team." },
                                    { title: 'HMO requirements', text: 'If renting as 3+ individuals, the landlord must ensure fire safety, proper facilities, and meet occupancy limits.' },
                                ].map((item) => (
                                    <div key={item.title} className="relative overflow-hidden bg-white/40 border border-slate-200/60 rounded-xl px-4 py-4 hover:bg-white hover:shadow-sm transition-all">
                                        {/* Subtle indigo left border */}
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-300 opacity-60" />
                                        <div className="flex items-center gap-2 mb-1.5 pl-1">
                                            <CheckCircle2 size={13} className="text-indigo-400" />
                                            <h4 className="text-xs font-extrabold text-slate-800">{item.title}</h4>
                                        </div>
                                        <p className="text-[11px] text-slate-500 leading-relaxed font-medium pl-5">{item.text}</p>
                                    </div>
                                ))}
                            </div>
                            <Link to="/rights" className="group flex items-center justify-between mt-5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-5 py-3.5 transition-colors shadow-md">
                                <span className="text-[13px] font-extrabold tracking-wide">Read the full UK Rights Guide</span>
                                <div className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                                    <ChevronRight size={14} className="text-white" />
                                </div>
                            </Link>
                        </Section>

                    </div>
                    {/* END RIGHT COLUMN */}

                </div>
            </div>
        </main>
    )
}

