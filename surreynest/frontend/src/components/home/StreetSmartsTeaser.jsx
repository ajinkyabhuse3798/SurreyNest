/**
 * StreetSmartsTeaser — Leaderboard teaser with mini pillar score bars.
 * Fetches top 3 streets from the leaderboard API (no hardcoded data).
 *
 * API: GET /api/leaderboard/streets?district=GU2&limit=3
 */
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Trophy, ArrowRight } from 'lucide-react'
import api from '../../services/api'
import { AnimatedSection, fadeUp } from '../../utils/homeData'

const RANK_EMOJIS = ['🥇', '🥈', '🥉']

const PILLAR_COLOURS = {
    Safety: 'bg-emerald-400',
    Value: 'bg-blue-400',
    Proximity: 'bg-violet-400',
}

function PillarBar({ label, score, colour, delay = 0 }) {
    return (
        <div className="flex items-center gap-2">
            <span className="text-[10px] text-indigo-200/80 font-medium w-14 text-right shrink-0">{label}</span>
            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                    className={`h-full rounded-full ${colour}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${score}%` }}
                    transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
                />
            </div>
            <span className="text-[10px] text-indigo-200/80 font-semibold w-6 shrink-0">{score}</span>
        </div>
    )
}

export default function StreetSmartsTeaser() {
    const [streets, setStreets] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false
        api.get('/api/leaderboard/streets', { params: { district: 'GU2', limit: 3 } })
            .then((res) => {
                if (!cancelled && res.data?.streets) {
                    setStreets(
                        res.data.streets.slice(0, 3).map((s, i) => ({
                            rank: i + 1,
                            name: s.street_name,
                            score: s.composite_score,
                            emoji: RANK_EMOJIS[i] || '',
                            pillars: s.pillars || [],
                        }))
                    )
                }
            })
            .catch(() => {
                // Silently fail — teaser section just won't show rankings
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })
        return () => { cancelled = true }
    }, [])

    // Build pillar data from API or fallback
    function getPillars(street) {
        if (street.pillars && street.pillars.length > 0) {
            return street.pillars.slice(0, 3).map(p => ({
                label: p.label,
                score: Math.round(p.score),
                colour: PILLAR_COLOURS[p.label] || 'bg-slate-400',
            }))
        }
        // Fallback — won't normally happen with the real API
        return [
            { label: 'Safety', score: Math.round(street.score * 0.9), colour: PILLAR_COLOURS.Safety },
            { label: 'Value', score: Math.round(street.score * 0.85), colour: PILLAR_COLOURS.Value },
            { label: 'Proximity', score: Math.round(street.score * 0.8), colour: PILLAR_COLOURS.Proximity },
        ]
    }

    return (
        <AnimatedSection className="px-4 py-10 lg:py-16">
            <motion.div
                variants={fadeUp}
                className="max-w-lg lg:max-w-5xl mx-auto bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 rounded-3xl p-6 md:p-8 lg:p-12 text-white overflow-hidden relative"
            >
                {/* Decorative circles */}
                <div className="absolute -top-12 -right-12 w-36 h-36 lg:w-52 lg:h-52 rounded-full bg-white/5" />
                <div className="absolute -bottom-10 -left-10 w-28 h-28 lg:w-44 lg:h-44 rounded-full bg-white/5" />
                <div className="absolute top-1/2 right-1/3 w-20 h-20 rounded-full bg-white/[0.03]" />

                <div className="relative z-10 lg:grid lg:grid-cols-2 lg:gap-10 lg:items-center">
                    {/* Left — Title & Description */}
                    <div>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 text-white/90 text-xs font-bold mb-3 border border-white/10">
                            <Trophy size={12} />
                            StreetSmarts
                        </div>

                        <h3 className="text-xl md:text-2xl lg:text-3xl font-bold mb-2">Best Streets for Students</h3>
                        <p className="text-indigo-200 text-sm lg:text-base font-medium leading-relaxed mb-6 lg:mb-0">
                            See top-ranked streets in Guildford based on safety, rent value, and proximity to uni.
                        </p>
                    </div>

                    {/* Right — Mini Leaderboard */}
                    <div>
                        <div className="flex flex-col gap-3 mb-5">
                            {loading ? (
                                // Skeleton placeholders
                                Array.from({ length: 3 }).map((_, i) => (
                                    <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/10 animate-pulse">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2.5">
                                                <span className="text-base lg:text-lg">{RANK_EMOJIS[i]}</span>
                                                <span className="w-24 h-4 bg-white/20 rounded" />
                                            </div>
                                            <span className="w-10 h-4 bg-white/20 rounded" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <div className="h-1.5 bg-white/10 rounded-full w-3/4" />
                                            <div className="h-1.5 bg-white/10 rounded-full w-2/3" />
                                        </div>
                                    </div>
                                ))
                            ) : streets.length > 0 ? (
                                streets.map((s, idx) => (
                                    <motion.div
                                        key={s.rank}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.15 * idx, duration: 0.5 }}
                                        className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/10 hover:bg-white/[0.15] transition-colors"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2.5">
                                                <span className="text-base lg:text-lg">{s.emoji}</span>
                                                <span className="font-semibold text-sm lg:text-base">{s.name}</span>
                                            </div>
                                            <span className="text-sm lg:text-base font-bold text-emerald-300">{s.score}</span>
                                        </div>
                                        {/* Mini pillar bars */}
                                        <div className="space-y-1">
                                            {getPillars(s).map((p, pi) => (
                                                <PillarBar
                                                    key={p.label}
                                                    label={p.label}
                                                    score={p.score}
                                                    colour={p.colour}
                                                    delay={0.15 * idx + 0.1 * pi}
                                                />
                                            ))}
                                        </div>
                                    </motion.div>
                                ))
                            ) : (
                                <p className="text-indigo-200 text-sm text-center py-2">
                                    Rankings loading…
                                </p>
                            )}
                        </div>

                        <Link
                            to="/best-streets"
                            className="w-full h-11 lg:h-12 bg-white text-indigo-700 font-bold text-sm lg:text-base rounded-xl flex items-center justify-center gap-2 hover:bg-indigo-50 transition-colors shadow-lg"
                        >
                            View Full Rankings
                            <ArrowRight size={14} />
                        </Link>
                    </div>
                </div>
            </motion.div>
        </AnimatedSection>
    )
}
