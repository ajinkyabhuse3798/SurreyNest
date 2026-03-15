/**
 * StreetSmarts — Best Streets & Comparison (Stitch-aligned).
 *
 * Layout matches Stitch screen "Best Streets & Comparison":
 *   1. Header: "Guildford Student Living"
 *   2. View Toggle (List / Map) + Filter Chips
 *   3. Side-by-Side Comparison (3-col)
 *   4. Top Rated Streets (4-col card grid)
 *   5. Map Section (interactive placeholder)
 *
 * API: GET /api/leaderboard/streets?district={district}&limit=15
 */
import { useState, useEffect, useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import api from '../services/api'

const DISTRICTS = ['GU1', 'GU2']

// ── helpers ──────────────────────────────────────────────────────────────────
function scoreColour(score) {
    if (score >= 70) return 'text-emerald-600'
    if (score >= 50) return 'text-amber-600'
    return 'text-red-500'
}

// ── Score bar (animated) ─────────────────────────────────────────────────────
function ScoreBar({ label, score, index = 0 }) {
    const ref = useRef(null)
    const inView = useInView(ref, { once: true })
    return (
        <div ref={ref}>
            <div className="flex justify-between items-center mb-1">
                <span className="text-xs uppercase tracking-wider font-bold text-slate-400">{label}</span>
                <span className="text-lg font-bold text-primary">{(score / 10).toFixed(1)}/10</span>
            </div>
            <div className="w-full bg-primary/10 h-1.5 rounded-full overflow-hidden">
                <motion.div
                    className="bg-primary h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={inView ? { width: `${score}%` } : { width: 0 }}
                    transition={{ duration: 0.8, delay: index * 0.1 }}
                />
            </div>
        </div>
    )
}

// ── ComparisonCard ───────────────────────────────────────────────────────────
function ComparisonCard({ street, label, badgeClass = 'bg-primary text-white' }) {
    if (!street) return null
    return (
        <div className="space-y-6">
            {/* Image placeholder */}
            <div className="relative aspect-video rounded-xl overflow-hidden bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center group">
                <span className="material-symbols-outlined text-6xl text-primary/20">home</span>
                <div className={`absolute top-3 left-3 px-3 py-1 ${badgeClass} text-xs font-bold rounded-full`}>
                    {label}
                </div>
            </div>
            <div>
                <h4 className="text-lg font-bold">{street.street_name}</h4>
                <p className="text-sm text-slate-500">{street.district}</p>
            </div>
            <div className="space-y-4">
                {/* Fair Rent Score */}
                <div className="p-4 bg-primary/5 rounded-xl">
                    <ScoreBar label="Fair Rent Score" score={street.composite_score} />
                </div>
                {/* HMO Status */}
                <div className="flex items-center justify-between p-4 border border-primary/10 rounded-xl">
                    <span className="text-sm font-medium">Safety Score</span>
                    <span className={`flex items-center gap-1 text-sm font-bold ${street.pillars?.find(p => p.label === 'Safety')?.score >= 70 ? 'text-green-500' : 'text-amber-500'}`}>
                        <span className="material-symbols-outlined text-base">
                            {street.pillars?.find(p => p.label === 'Safety')?.score >= 70 ? 'check_circle' : 'pending'}
                        </span>
                        {street.pillars?.find(p => p.label === 'Safety')?.score || '—'}
                    </span>
                </div>
                {/* Tenant Rating / Properties */}
                <div className="flex items-center justify-between p-4 border border-primary/10 rounded-xl">
                    <span className="text-sm font-medium">Properties</span>
                    <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-primary text-base">apartment</span>
                        <span className="font-bold">{street.property_count || '—'}</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ── Street Card (Top Rated Streets grid) ─────────────────────────────────────
function StreetCard({ street, index }) {
    const iconMap = ['verified', 'apartment', 'directions_walk', 'school', 'home_work', 'location_city']
    const iconBgMap = [
        'bg-green-500/10 text-green-600',
        'bg-primary/10 text-primary',
        'bg-primary/10 text-primary',
        'bg-primary/10 text-primary',
        'bg-primary/10 text-primary',
        'bg-primary/10 text-primary',
    ]

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: index * 0.06 }}
            className="bg-white border border-primary/10 rounded-xl p-5 hover:shadow-md transition-shadow"
        >
            <div className="flex justify-between items-start mb-4">
                <div>
                    <p className="text-primary font-bold text-lg">#{street.rank} Rank</p>
                    <h5 className="font-bold text-slate-900">{street.street_name}</h5>
                </div>
                <div className={`h-10 w-10 rounded-lg ${iconBgMap[index % iconBgMap.length]} flex items-center justify-center`}>
                    <span className="material-symbols-outlined">{iconMap[index % iconMap.length]}</span>
                </div>
            </div>
            <div className="space-y-3">
                <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Composite Score</span>
                    <span className={`font-bold ${scoreColour(street.composite_score)}`}>{street.composite_score}/100</span>
                </div>
                {street.avg_weekly_rent && (
                    <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Avg. Rent</span>
                        <span className="font-bold">£{Math.round(street.avg_weekly_rent * 52 / 12)} /mo</span>
                    </div>
                )}
                <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Distance to Uni</span>
                    <span className="font-bold">{street.distance_to_uni_km}km</span>
                </div>
                <div className="pt-2 border-t border-primary/5 flex items-center gap-2">
                    <div className="flex -space-x-2">
                        {[20, 40, 60].slice(0, Math.min(3, Math.ceil((street.property_count || 1) / 3))).map((opacity, i) => (
                            <div key={i} className={`w-6 h-6 rounded-full border border-white bg-primary/${opacity}`} />
                        ))}
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">
                        {street.property_count || 0} properties
                    </span>
                </div>
            </div>
        </motion.div>
    )
}

// ── Expanded Row Card (ranks beyond top grid) ────────────────────────────────
function ExpandableRowCard({ street, index }) {
    const [expanded, setExpanded] = useState(false)
    const filteredPillars = street.pillars?.filter(p => p.label !== 'HMO') || []

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: index * 0.05 }}
            className="bg-white border border-primary/10 rounded-xl hover:shadow-md transition-all overflow-hidden"
        >
            <div className="px-5 py-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-sm text-slate-600 flex-shrink-0">
                    #{street.rank}
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 truncate">{street.street_name}</h3>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5 flex-wrap">
                        <span>{street.district}</span>
                        <span className="w-0.5 h-0.5 rounded-full bg-slate-300" />
                        <span>{street.property_count} properties</span>
                        <span className="w-0.5 h-0.5 rounded-full bg-slate-300" />
                        <span>{street.distance_to_uni_km}km to uni</span>
                    </div>
                </div>
                <div className="flex flex-col items-center flex-shrink-0">
                    <span className={`text-xl font-extrabold ${scoreColour(street.composite_score)}`}>
                        {street.composite_score}
                    </span>
                    <span className="text-[9px] text-slate-400 font-medium">/100</span>
                </div>
            </div>
            {/* Quick tags */}
            <div className="px-5 pb-2 flex items-center gap-2 flex-wrap">
                {street.avg_weekly_rent && (
                    <span className="inline-flex items-center gap-1 text-[10px] bg-primary/5 text-primary px-2.5 py-1 rounded-full font-semibold border border-primary/10">
                        <span className="material-symbols-outlined text-xs">payments</span>
                        £{Math.round(street.avg_weekly_rent)}/wk
                    </span>
                )}
                {street.avg_rooms && (
                    <span className="inline-flex items-center gap-1 text-[10px] bg-slate-50 text-slate-600 px-2.5 py-1 rounded-full font-semibold border border-slate-100">
                        <span className="material-symbols-outlined text-xs">bed</span>
                        {street.avg_rooms} rooms
                    </span>
                )}
            </div>
            {/* Expand toggle */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full px-5 py-2.5 text-[11px] text-primary font-semibold flex items-center justify-center gap-1 hover:bg-primary/5 transition-colors border-t border-slate-50"
            >
                {expanded ? 'Hide' : 'Show'} score breakdown
                <span className="material-symbols-outlined text-sm">{expanded ? 'expand_less' : 'expand_more'}</span>
            </button>
            {expanded && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className="px-5 pb-4 border-t border-slate-50 pt-3"
                >
                    <div className="grid gap-3 sm:grid-cols-3">
                        {filteredPillars.map((p, i) => {
                            const gradients = {
                                Safety: 'bg-emerald-500',
                                Value: 'bg-blue-500',
                                Proximity: 'bg-primary/90',
                            }
                            return (
                                <div key={p.label} className="flex items-center gap-2.5">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-0.5">
                                            <span className="text-[11px] font-semibold text-slate-600">{p.label}</span>
                                            <span className={`text-[11px] font-bold ${scoreColour(p.score)}`}>{p.score}</span>
                                        </div>
                                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <motion.div
                                                className={`h-full rounded-full ${gradients[p.label] || 'bg-primary'}`}
                                                initial={{ width: 0 }}
                                                animate={{ width: `${p.score}%` }}
                                                transition={{ duration: 0.8, delay: i * 0.12 }}
                                            />
                                        </div>
                                        {p.detail && <p className="text-[9px] text-slate-400 mt-0.5">{p.detail}</p>}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </motion.div>
            )}
        </motion.div>
    )
}

// ── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton() {
    return (
        <div className="animate-pulse space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="bg-white border border-primary/10 rounded-xl p-5 h-56" />
                ))}
            </div>
        </div>
    )
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function StreetSmarts() {
    const [district, setDistrict] = useState('GU2')
    const [streets, setStreets] = useState([])
    const [totalStreets, setTotalStreets] = useState(0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [viewMode, setViewMode] = useState('list')

    useEffect(() => {
        let cancelled = false
        setLoading(true)
        setError('')

        api.get(`/api/leaderboard/streets?district=${district}&limit=15`)
            .then((r) => {
                if (!cancelled) {
                    setStreets(r.data.streets || [])
                    setTotalStreets(r.data.total_streets || 0)
                    setLoading(false)
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    setError(err.message)
                    setLoading(false)
                }
            })
        return () => { cancelled = true }
    }, [district])

    const top4 = streets.slice(0, 4)
    const rest = streets.slice(4)
    // Pick 2 streets for comparison
    const compareA = streets[0] || null
    const compareB = streets[1] || null

    return (
        <main className="min-h-screen bg-background-light">
            <Navbar />

            <div className="max-w-7xl mx-auto px-4 lg:px-6 py-8">

                {/* Header Section */}
                <div className="mb-10">
                    <h2 className="text-3xl font-bold mb-2">Guildford Student Living</h2>
                    <p className="text-slate-500">Discover the best streets and compare property metrics for your next home.</p>
                </div>

                {/* View Toggle & Filters */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    {/* View Toggle */}
                    <div className="flex p-1 bg-primary/5 rounded-xl self-start">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'list'
                                ? 'bg-white shadow-sm text-primary'
                                : 'text-slate-500 hover:text-primary'
                                }`}
                        >
                            <span className="material-symbols-outlined text-lg">format_list_bulleted</span> List View
                        </button>
                        <button
                            onClick={() => setViewMode('map')}
                            className={`px-6 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${viewMode === 'map'
                                ? 'bg-white shadow-sm text-primary font-bold'
                                : 'text-slate-500 hover:text-primary'
                                }`}
                        >
                            <span className="material-symbols-outlined text-lg">map</span> Map View
                        </button>
                    </div>

                    {/* Filters */}
                    <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
                        {DISTRICTS.map((d) => (
                            <button
                                key={d}
                                onClick={() => setDistrict(d)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors border whitespace-nowrap ${district === d
                                    ? 'bg-primary text-white border-primary shadow-md shadow-primary/20'
                                    : 'bg-primary/5 hover:bg-primary/10 border-primary/10'
                                    }`}
                            >
                                {d} District
                            </button>
                        ))}
                        <button className="flex items-center gap-2 px-4 py-2 bg-primary/5 hover:bg-primary/10 rounded-xl text-sm font-medium transition-colors border border-primary/10 whitespace-nowrap">
                            Distance to Uni <span className="material-symbols-outlined text-sm">expand_more</span>
                        </button>
                    </div>
                </div>

                {/* ══════════ SIDE-BY-SIDE COMPARISON ══════════ */}
                {!loading && compareA && compareB && (
                    <section className="mb-16">
                        <div className="flex items-center gap-3 mb-6">
                            <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-lg">compare_arrows</span>
                            <h3 className="text-xl font-bold">Side-by-Side Comparison</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white p-6 rounded-xl border border-primary/10 shadow-sm">
                            <ComparisonCard street={compareA} label="Street A" badgeClass="bg-primary text-white" />
                            {/* VS Labels (desktop vertical center) */}
                            <div className="hidden md:flex flex-col justify-center items-center gap-8 py-20">
                                <div className="h-12 flex items-center">
                                    <span className="text-xs font-bold text-slate-300 tracking-widest uppercase">vs</span>
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-bold text-primary mb-12">Composite Score</p>
                                    <p className="text-sm font-bold text-primary mb-12">Safety Score</p>
                                    <p className="text-sm font-bold text-primary">Properties</p>
                                </div>
                            </div>
                            <ComparisonCard street={compareB} label="Street B" badgeClass="bg-slate-800 text-white" />
                        </div>
                    </section>
                )}

                {/* ══════════ TOP RATED STREETS ══════════ */}
                <section>
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-lg">trending_up</span>
                            <h3 className="text-xl font-bold">Top Rated Streets</h3>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">
                                Showing {streets.length} of {totalStreets} streets
                            </span>
                        </div>
                    </div>

                    {loading && <Skeleton />}

                    {error && (
                        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-sm text-red-700 max-w-md mx-auto">
                            <span className="material-symbols-outlined">error</span>
                            {error}
                        </div>
                    )}

                    {!loading && !error && streets.length === 0 && (
                        <div className="text-center py-20">
                            <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">search_off</span>
                            <p className="text-slate-400 text-sm">No streets found for {district}.</p>
                        </div>
                    )}

                    {!loading && !error && streets.length > 0 && (
                        <>
                            {/* Top 4 card grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                                {top4.map((s, i) => (
                                    <StreetCard key={`${s.street_name}-${s.district}`} street={s} index={i} />
                                ))}
                            </div>

                            {/* Rest of leaderboard */}
                            {rest.length > 0 && (
                                <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
                                    {rest.map((s, i) => (
                                        <ExpandableRowCard key={`${s.street_name}-${s.district}`} street={s} index={i} />
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </section>

                {/* ══════════ MAP SECTION ══════════ */}
                <section className="mt-16">
                    <div className="relative w-full h-[400px] rounded-2xl overflow-hidden border border-primary/20 bg-primary/5">
                        {/* Map legend overlay */}
                        <div className="absolute top-6 left-6 p-4 bg-white/90 backdrop-blur rounded-xl shadow-xl max-w-xs z-10">
                            <h6 className="font-bold text-sm mb-2">Guildford Hotspots</h6>
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
                                <span className="text-xs">High Demand Areas</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-green-500" />
                                <span className="text-xs">High Rent Value Streets</span>
                            </div>
                        </div>
                        {/* Center pin */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="flex flex-col items-center">
                                <div className="bg-primary text-white p-3 rounded-full shadow-lg animate-bounce">
                                    <span className="material-symbols-outlined">home</span>
                                </div>
                                <div className="mt-2 px-3 py-1 bg-white border border-primary/20 rounded-lg shadow-sm text-xs font-bold">
                                    {district} Area
                                </div>
                            </div>
                        </div>
                        {/* Zoom controls */}
                        <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-10">
                            <button className="w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center text-primary">
                                <span className="material-symbols-outlined">add</span>
                            </button>
                            <button className="w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center text-primary">
                                <span className="material-symbols-outlined">remove</span>
                            </button>
                        </div>
                        {/* Scatter some pins */}
                        {!loading && streets.slice(0, 4).map((s, i) => {
                            const positions = [
                                { top: '35%', left: '25%' },
                                { top: '55%', left: '65%' },
                                { top: '40%', left: '50%' },
                                { top: '60%', left: '35%' },
                            ]
                            return (
                                <div key={s.street_name} className="absolute group/pin cursor-pointer" style={positions[i]}>
                                    <div className="bg-primary text-white p-1.5 rounded-full shadow-lg group-hover/pin:scale-110 transition-transform">
                                        <span className="material-symbols-outlined text-sm">location_on</span>
                                    </div>
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 opacity-0 group-hover/pin:opacity-100 transition-opacity whitespace-nowrap bg-slate-900 text-white text-[10px] px-2 py-1 rounded z-20">
                                        {s.street_name}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </section>

                {/* Data source note */}
                <p className="text-center text-[10px] lg:text-xs text-slate-400 mt-8">
                    Scores based on police.uk crime data and Land Registry pricing. Updated weekly.
                </p>
            </div>
        </main>
    )
}
