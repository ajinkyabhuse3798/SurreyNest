/**
 * StreetSmarts 🏆 — Best Streets Leaderboard v2
 *
 * Premium gamified leaderboard ranking Guildford streets for students.
 * 3 pillars: Safety, Value, Proximity (HMO removed per user request).
 *
 * Features:
 *   - Top-3 Podium (gold/silver/bronze gradient cards)
 *   - Desktop: 2-column grid for ranks 4–15
 *   - Mobile: single-column with scrollable podium
 *   - Animated score breakdown bars
 */
import { useState, useEffect, useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
    Trophy, Shield, PoundSterling, MapPin, ArrowLeft,
    Loader2, AlertCircle, ChevronDown, ChevronUp, Star,
    Bed, Ruler,
} from 'lucide-react'
import Navbar from '../components/Navbar'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const DISTRICTS = ['GU1', 'GU2']

const PILLAR_CONFIG = {
    Safety: { icon: Shield, colour: 'text-emerald-600', bg: 'bg-emerald-50', gradient: 'linear-gradient(to right, #10B981, #059669)' },
    Value: { icon: PoundSterling, colour: 'text-blue-600', bg: 'bg-blue-50', gradient: 'linear-gradient(to right, #3B82F6, #2563EB)' },
    Proximity: { icon: MapPin, colour: 'text-violet-600', bg: 'bg-violet-50', gradient: 'linear-gradient(to right, #8B5CF6, #7C3AED)' },
}

// ── helpers ──────────────────────────────────────────────────────────────────

function scoreColour(score) {
    if (score >= 70) return 'text-emerald-600'
    if (score >= 50) return 'text-amber-600'
    return 'text-red-500'
}

function rankBadgeStyle(rank) {
    if (rank === 1) return 'bg-gradient-to-br from-yellow-300 via-amber-400 to-orange-500 text-white shadow-lg shadow-amber-300/50 border border-amber-200/50'
    if (rank === 2) return 'bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400 text-slate-800 shadow-lg shadow-slate-300/40 border border-white/50'
    if (rank === 3) return 'bg-gradient-to-br from-amber-600 via-amber-700 to-orange-800 text-white shadow-lg shadow-amber-700/40 border border-amber-500/50'
    return 'bg-slate-100 text-slate-600 font-bold'
}

function podiumCardStyle(rank) {
    if (rank === 1) return 'border-amber-200/60 bg-gradient-to-b from-amber-50/50 to-white shadow-[0_8px_30px_-4px_rgba(245,158,11,0.25)] ring-4 ring-amber-100/50 relative'
    if (rank === 2) return 'border-slate-200/80 bg-gradient-to-b from-slate-50/50 to-white shadow-[0_4px_20px_-4px_rgba(100,116,139,0.15)] relative'
    if (rank === 3) return 'border-amber-200/40 bg-gradient-to-b from-orange-50/30 to-white shadow-[0_4px_20px_-4px_rgba(180,137,59,0.15)] relative'
    return ''
}

const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: (i) => ({
        opacity: 1,
        y: 0,
        transition: { duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] },
    }),
}

// ── score bar (used in breakdown) ────────────────────────────────────────────

function ScoreBar({ label, score, detail, index }) {
    const cfg = PILLAR_CONFIG[label] || PILLAR_CONFIG.Safety
    const Icon = cfg.icon
    const ref = useRef(null)
    const inView = useInView(ref, { once: true })

    return (
        <div ref={ref} className="flex items-center gap-2.5">
            <div className={`w-7 h-7 rounded-lg ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                <Icon size={14} className={cfg.colour} />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[11px] font-semibold text-slate-600">{label}</span>
                    <span className={`text-[11px] font-bold ${scoreColour(score)}`}>{score}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full rounded-full"
                        style={{ background: cfg.gradient }}
                        initial={{ width: 0 }}
                        animate={inView ? { width: `${score}%` } : { width: 0 }}
                        transition={{ duration: 0.8, delay: index * 0.12 }}
                    />
                </div>
                {detail && <p className="text-[9px] text-slate-400 mt-0.5">{detail}</p>}
            </div>
        </div>
    )
}

// ── mini score bars for podium ────────────────────────────────────────────────

function MiniScoreBars({ pillars }) {
    const filtered = pillars.filter(p => p.label !== 'HMO')
    return (
        <div className="space-y-2 mt-3">
            {filtered.map((p, i) => {
                const cfg = PILLAR_CONFIG[p.label] || PILLAR_CONFIG.Safety
                return (
                    <div key={p.label} className="flex items-center gap-2">
                        <span className="text-[9px] font-semibold text-slate-500 w-14 text-right">{p.label}</span>
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <motion.div
                                className="h-full rounded-full"
                                style={{ background: cfg.gradient }}
                                initial={{ width: 0 }}
                                whileInView={{ width: `${p.score}%` }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.7, delay: i * 0.1 }}
                            />
                        </div>
                        <span className={`text-[10px] font-bold w-6 text-right ${scoreColour(p.score)}`}>{p.score}</span>
                    </div>
                )
            })}
        </div>
    )
}

// ── podium card ──────────────────────────────────────────────────────────────

function PodiumCard({ street, isGold }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: street.rank * 0.1 }}
            className={`bg-white rounded-2xl border p-4 sm:p-5 text-center ${podiumCardStyle(street.rank)} ${isGold ? 'lg:scale-105 lg:-mt-2' : ''}`}
        >
            {/* Medal */}
            <div className={`w-12 h-12 rounded-xl mx-auto flex items-center justify-center font-bold text-lg ${rankBadgeStyle(street.rank)}`}>
                <Trophy size={isGold ? 22 : 18} />
            </div>

            {/* Street info */}
            <h3 className={`font-bold text-slate-900 mt-3 truncate ${isGold ? 'text-base lg:text-lg' : 'text-sm'}`}>
                {street.street_name}
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
                {street.district} · {street.property_count} properties
            </p>

            {/* Composite score */}
            <div className={`mt-3 inline-flex items-baseline gap-1 ${isGold ? 'text-3xl' : 'text-2xl'}`}>
                <span className={`font-extrabold ${scoreColour(street.composite_score)}`}>
                    {street.composite_score}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">/100</span>
            </div>

            {/* Mini score bars */}
            <MiniScoreBars pillars={street.pillars} />
        </motion.div>
    )
}

// ── street card (ranks 4+) ───────────────────────────────────────────────────

function StreetCard({ street, index }) {
    const [expanded, setExpanded] = useState(false)
    const filteredPillars = street.pillars.filter(p => p.label !== 'HMO')

    return (
        <motion.div
            custom={index}
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-30px' }}
            className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/50 shadow-[0_2px_12px_-3px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_30px_-4px_rgba(80,72,229,0.12)] hover:border-indigo-200 transition-all duration-300 overflow-hidden"
        >
            {/* Header */}
            <div className="px-4 py-3.5 sm:px-5 sm:py-4 flex items-center gap-3">
                {/* Rank badge */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${rankBadgeStyle(street.rank)}`}>
                    #{street.rank}
                </div>

                {/* Street info */}
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 truncate">
                        {street.street_name}
                    </h3>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5 flex-wrap">
                        <span>{street.district}</span>
                        <span className="w-0.5 h-0.5 rounded-full bg-slate-300" />
                        <span>{street.property_count} properties</span>
                        <span className="w-0.5 h-0.5 rounded-full bg-slate-300" />
                        <span>{street.distance_to_uni_km}km to uni</span>
                    </div>
                </div>

                {/* Composite score */}
                <div className="flex flex-col items-center flex-shrink-0">
                    <span className={`text-xl font-extrabold ${scoreColour(street.composite_score)}`}>
                        {street.composite_score}
                    </span>
                    <span className="text-[9px] text-slate-400 font-medium">/100</span>
                </div>
            </div>

            {/* Quick stats */}
            <div className="px-4 pb-2 sm:px-5 flex items-center gap-2 flex-wrap">
                {street.avg_weekly_rent && (
                    <span className="inline-flex items-center gap-1 text-[10px] bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-semibold border border-blue-100">
                        <PoundSterling size={10} />
                        £{Math.round(street.avg_weekly_rent)}/wk avg
                    </span>
                )}
                {street.avg_rooms && (
                    <span className="inline-flex items-center gap-1 text-[10px] bg-slate-50 text-slate-600 px-2.5 py-1 rounded-full font-semibold border border-slate-100">
                        <Bed size={10} />
                        {street.avg_rooms} rooms avg
                    </span>
                )}
                {street.distance_to_uni_km && (
                    <span className="inline-flex items-center gap-1 text-[10px] bg-violet-50 text-violet-600 px-2.5 py-1 rounded-full font-semibold border border-violet-100">
                        <MapPin size={10} />
                        {street.distance_to_uni_km}km
                    </span>
                )}
            </div>

            {/* Expand toggle */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full px-4 py-2.5 sm:px-5 text-[11px] text-indigo-600 font-semibold flex items-center justify-center gap-1 hover:bg-indigo-50/50 transition-colors border-t border-slate-50"
            >
                {expanded ? 'Hide' : 'Show'} score breakdown
                {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>

            {/* Score breakdown */}
            {expanded && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className="px-4 pb-4 sm:px-5 sm:pb-5 border-t border-slate-50 pt-3"
                >
                    <div className="grid gap-3 sm:grid-cols-3">
                        {filteredPillars.map((p, i) => (
                            <ScoreBar
                                key={p.label}
                                label={p.label}
                                score={p.score}
                                detail={p.detail}
                                index={i}
                            />
                        ))}
                    </div>
                </motion.div>
            )}
        </motion.div>
    )
}

// ── skeleton ─────────────────────────────────────────────────────────────────

function LeaderboardSkeleton() {
    return (
        <div className="animate-pulse space-y-6">
            {/* Podium skeleton */}
            <div className="flex gap-4 justify-center">
                {[1, 2, 3].map(i => (
                    <div key={i} className={`bg-white rounded-2xl border border-slate-100 p-5 text-center flex-1 max-w-[200px] ${i === 1 ? 'h-56' : 'h-48'}`}>
                        <div className="w-12 h-12 bg-slate-100 rounded-xl mx-auto" />
                        <div className="h-4 bg-slate-100 rounded mt-3 w-3/4 mx-auto" />
                        <div className="h-8 bg-slate-100 rounded mt-2 w-1/2 mx-auto" />
                    </div>
                ))}
            </div>
            {/* Card skeletons */}
            <div className="grid gap-3 lg:grid-cols-2">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="bg-white rounded-2xl border border-slate-100 h-24 p-4 flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 rounded-xl" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 bg-slate-100 rounded w-3/4" />
                            <div className="h-3 bg-slate-100 rounded w-1/2" />
                        </div>
                        <div className="h-8 w-10 bg-slate-100 rounded" />
                    </div>
                ))}
            </div>
        </div>
    )
}

// ── main page ────────────────────────────────────────────────────────────────

export default function StreetSmarts() {
    const [district, setDistrict] = useState('GU2')
    const [streets, setStreets] = useState([])
    const [totalStreets, setTotalStreets] = useState(0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        let cancelled = false
        setLoading(true)
        setError('')

        fetch(`${API}/api/leaderboard/streets?district=${district}&limit=15`)
            .then((r) => {
                if (!r.ok) throw new Error(`API error: ${r.status}`)
                return r.json()
            })
            .then((data) => {
                if (!cancelled) {
                    setStreets(data.streets || [])
                    setTotalStreets(data.total_streets || 0)
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

    const top3 = streets.slice(0, 3)
    const rest = streets.slice(3)

    return (
        <main className="min-h-screen bg-[#f8f9fc]">
            <Navbar />

            {/* ══════════════════════════════════════════════════════════
                HERO SECTION
            ══════════════════════════════════════════════════════════ */}
            <section className="relative px-4 pt-8 pb-10 lg:pt-16 lg:pb-14 overflow-hidden">
                {/* Dot pattern */}
                <div className="absolute inset-0 opacity-[0.15]" style={{
                    backgroundImage: 'radial-gradient(circle, #6366F1 0.8px, transparent 0.8px)',
                    backgroundSize: '24px 24px',
                }} />

                <div className="relative max-w-3xl mx-auto text-center">
                    <Link
                        to="/"
                        className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-600 transition-colors mb-4 font-medium"
                    >
                        <ArrowLeft size={14} /> Home
                    </Link>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-4 py-1.5 mb-4">
                            <Trophy size={14} className="text-amber-600" />
                            <span className="text-xs font-bold text-amber-700">StreetSmarts</span>
                        </div>

                        <h1 className="text-2xl font-bold text-slate-900 mb-2 lg:text-4xl tracking-tight">
                            Best Streets for{' '}
                            <span className="bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
                                Students
                            </span>
                        </h1>

                        <p className="text-sm text-slate-500 max-w-lg mx-auto mb-6 lg:text-base leading-relaxed">
                            Every Guildford street ranked by safety, rent value, and proximity to Surrey uni.
                        </p>
                    </motion.div>

                    {/* District toggle */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="inline-flex items-center gap-1 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-full p-1 shadow-sm"
                    >
                        {DISTRICTS.map((d) => (
                            <button
                                key={d}
                                onClick={() => setDistrict(d)}
                                className={`px-6 py-2 rounded-full text-xs lg:text-sm font-semibold transition-all ${district === d
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                    }`}
                            >
                                {d}
                            </button>
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════
                LEADERBOARD
            ══════════════════════════════════════════════════════════ */}
            <section className="max-w-5xl mx-auto px-4 pb-16">
                {loading && <LeaderboardSkeleton />}

                {error && (
                    <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-sm text-red-700 max-w-md mx-auto">
                        <AlertCircle size={18} />
                        {error}
                    </div>
                )}

                {!loading && !error && streets.length === 0 && (
                    <div className="text-center py-20">
                        <p className="text-slate-400 text-sm">No streets found for {district}.</p>
                    </div>
                )}

                {!loading && !error && streets.length > 0 && (
                    <>
                        {/* Count + info */}
                        <div className="flex items-center justify-between mb-6">
                            <p className="text-xs text-slate-400">
                                Showing top {streets.length} of {totalStreets} streets in {district}
                            </p>
                            <div className="flex items-center gap-1 text-[10px] text-slate-400 bg-white border border-slate-100 rounded-full px-3 py-1.5">
                                <Star size={10} className="text-amber-500" />
                                Higher = better for students
                            </div>
                        </div>

                        {/* ── Top 3 Podium ─────────────────────────── */}
                        {top3.length >= 3 && (
                            <div className="grid grid-cols-3 gap-3 lg:gap-5 mb-8 lg:mb-10">
                                {/* Show in order: #2, #1, #3 for visual podium effect */}
                                <PodiumCard street={top3[1]} isGold={false} />
                                <PodiumCard street={top3[0]} isGold={true} />
                                <PodiumCard street={top3[2]} isGold={false} />
                            </div>
                        )}

                        {/* ── Rest of leaderboard ─────────────────── */}
                        {rest.length > 0 && (
                            <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
                                {rest.map((s, i) => (
                                    <StreetCard key={`${s.street_name}-${s.district}`} street={s} index={i} />
                                ))}
                            </div>
                        )}

                        {/* Footer */}
                        <p className="text-center text-[10px] lg:text-xs text-slate-400 mt-8">
                            Scores based on police.uk crime data and Land Registry pricing. Updated weekly.
                        </p>
                    </>
                )}
            </section>
        </main>
    )
}
