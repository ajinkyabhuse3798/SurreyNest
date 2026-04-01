/**
 * GuildfordSafetySection, Safety stats teaser with live area rankings.
 * Fetches top 3 safest areas from GET /api/safety/rankings.
 * Orange/amber gradient matching app brand color.
 */
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { getSafetyRankings } from '../../services/safetyApi'

const STATIC_STATS = [
    { icon: 'verified_user', label: "One of England and Wales' safest places", sub: 'Surrey-i Community Safety · February 2025' },
    { icon: 'emoji_events', label: '4th safest place to live in the UK', sub: 'HomeViews ranking cited by Surrey-i' },
    { icon: 'verified', label: 'Live data from police.uk', sub: 'Updated monthly' },
]

const PHOTO_SLOTS = [
    { src: '/images/guildford/castle.jpg', alt: 'Guildford Castle', gradient: 'from-orange-700 to-amber-800' },
    { src: '/images/guildford/high-street.jpg', alt: 'Guildford High Street', gradient: 'from-amber-700 to-orange-800' },
    { src: '/images/guildford/river-wey.jpg', alt: 'River Wey Waterfront', gradient: 'from-orange-600 to-amber-700' },
    { src: '/images/guildford/town-centre.jpg', alt: 'Guildford Town Centre', gradient: 'from-amber-600 to-orange-700' },
]

const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }

function PhotoGrid() {
    return (
        <div className="grid grid-cols-2 gap-2 mt-6">
            {PHOTO_SLOTS.map(({ src, alt, gradient }) => (
                <div key={alt} className={`relative rounded-xl overflow-hidden h-24 bg-gradient-to-br ${gradient}`}>
                    <img
                        src={src}
                        alt={alt}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.currentTarget.style.display = 'none' }}
                    />
                    <span className="absolute bottom-1.5 left-2 text-[10px] text-white/70 font-medium">{alt}</span>
                </div>
            ))}
        </div>
    )
}

function SafetyScoreBar({ score }) {
    return (
        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <motion.div
                className="h-full rounded-full bg-emerald-400"
                initial={{ width: 0 }}
                animate={{ width: `${score}%` }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            />
        </div>
    )
}

export default function GuildfordSafetySection() {
    const [areas, setAreas] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false
        getSafetyRankings()
            .then((data) => {
                if (!cancelled && data?.safest) {
                    setAreas(data.safest.slice(0, 3))
                }
            })
            .catch(() => {})
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [])

    return (
        <motion.section
            className="px-4 py-10 lg:py-16 overflow-hidden"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={{ visible: { transition: { staggerChildren: 0.12 } } }}
        >
            <motion.div
                variants={fadeUp}
                className="max-w-lg lg:max-w-5xl mx-auto bg-primary rounded-[2rem] md:rounded-[3rem] p-6 md:p-8 lg:p-12 text-white overflow-hidden relative shadow-2xl shadow-primary/40"
            >
                {/* Decorative circles */}
                <div className="pointer-events-none absolute -top-6 -right-6 h-24 w-24 rounded-full bg-white/5 md:-top-12 md:-right-12 md:h-36 md:w-36 lg:h-52 lg:w-52" />
                <div className="pointer-events-none absolute -bottom-6 -left-6 h-20 w-20 rounded-full bg-white/5 md:-bottom-10 md:-left-10 md:h-28 md:w-28 lg:h-44 lg:w-44" />
                <div className="absolute top-1/2 right-1/3 w-20 h-20 rounded-full bg-white/[0.03]" />

                <div className="relative z-10 lg:grid lg:grid-cols-2 lg:gap-10 lg:items-start">
                    {/* Left, Stats + Photos */}
                    <div>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 text-white/90 text-xs font-bold mb-3 border border-white/10">
                            <span className="material-symbols-outlined text-sm">shield</span>
                            Safety First
                        </div>

                        <h3 className="text-xl md:text-2xl lg:text-3xl font-bold mb-2">
                            Understand Guildford safety in a way that is easy to act on
                        </h3>
                        <p className="text-white/70 text-sm lg:text-base font-medium leading-relaxed mb-4">
                            Start with a clear Guildford-wide view, then check the postcode you are actually thinking about before making a housing decision.
                        </p>

                        {/* Stat pills */}
                        <div className="flex flex-col gap-2">
                            {STATIC_STATS.map(({ icon, label, sub }) => (
                                <div key={label} className="flex items-center gap-2.5 bg-white/10 rounded-xl px-3 py-2.5 border border-white/10">
                                    <span className="material-symbols-outlined text-orange-200 text-base">{icon}</span>
                                    <div>
                                        <p className="text-xs font-semibold text-white leading-tight">{label}</p>
                                        <p className="text-[10px] text-white/50">{sub}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Photo grid */}
                        <PhotoGrid />
                    </div>

                    {/* Right, Live Rankings + CTA */}
                    <div className="mt-8 lg:mt-0">
                        <p className="text-xs font-bold text-white/60 uppercase tracking-widest mb-3">
                            Areas To Explore
                        </p>

                        <div className="flex flex-col gap-3 mb-5">
                            {loading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <div key={i} className="bg-white/10 rounded-xl px-4 py-3 border border-white/10 animate-pulse">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="w-28 h-4 bg-white/20 rounded" />
                                            <div className="w-10 h-4 bg-white/20 rounded" />
                                        </div>
                                        <div className="h-1.5 bg-white/10 rounded-full w-full" />
                                    </div>
                                ))
                            ) : areas.length > 0 ? (
                                areas.map((area, idx) => {
                                    const score = Math.round(area.safety_score ?? area.score ?? 0)
                                    const name = area.postcode_sector ?? area.area ?? area.name ?? 'N/A'
                                    return (
                                        <motion.div
                                            key={name}
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: 0.15 * idx, duration: 0.5 }}
                                            className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/10 hover:bg-white/[0.15] transition-colors"
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-bold text-orange-200">#{idx + 1}</span>
                                                    <span className="font-semibold text-sm">{name}</span>
                                                </div>
                                                <span className="text-sm font-bold text-orange-200">{score}</span>
                                            </div>
                                            <SafetyScoreBar score={score} />
                                        </motion.div>
                                    )
                                })
                            ) : (
                                <p className="text-white/60 text-sm text-center py-2">
                                    Rankings loading…
                                </p>
                            )}
                        </div>

                        <Link
                            to="/safety"
                            className="w-full h-11 lg:h-12 bg-white text-orange-700 font-bold text-sm lg:text-base rounded-xl flex items-center justify-center gap-2 hover:bg-orange-50 transition-colors shadow-lg"
                        >
                            Explore Safety Across Guildford
                            <span className="material-symbols-outlined text-sm">arrow_forward</span>
                        </Link>
                    </div>
                </div>
            </motion.div>
        </motion.section>
    )
}
