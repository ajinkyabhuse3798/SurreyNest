/**
 * Home page — Premium mobile-first landing based on Stitch designs.
 *
 * Sections (scroll order):
 *   1. Hero — Gradient headline, glassmorphism search, social proof, trust row
 *   2. Explore — Map preview (GuildfordHeatmap) with toggle pills
 *   3. MarketPulse — Seasonal availability indicator
 *   4. Features — Why SurreyNest (3-card grid)
 *   5. How It Works — 3-step vertical timeline
 *   6. StreetSmarts — Leaderboard teaser
 *   7. CTA — Dark conversion section
 */
import { useState, useRef, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, useInView } from 'framer-motion'
import {
    Search, BarChart3, Shield, Home as HomeIcon, MapPin, CheckCircle2,
    ArrowRight, Loader2, GraduationCap, Scale, Star, Trophy, Sparkles,
    ChevronRight, Users, Database, Clock, Zap,
} from 'lucide-react'
import Navbar from '../components/Navbar'
import SearchAutocomplete from '../components/SearchAutocomplete'
import GuildfordHeatmap from '../components/GuildfordHeatmap'
import MarketPulse from '../components/MarketPulse'

const POSTCODE_RE = /^[A-Z]{1,2}\d[0-9A-Z]?\s*\d[A-Z]{2}$/i

// ── Animation variants ──────────────────────────────────────────────────────
const fadeUp = {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
}

const staggerContainer = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.12 } },
}

function AnimatedSection({ children, className = '' }) {
    const ref = useRef(null)
    const inView = useInView(ref, { once: true, margin: '-40px' })
    return (
        <motion.div
            ref={ref}
            initial="hidden"
            animate={inView ? 'visible' : 'hidden'}
            variants={staggerContainer}
            className={className}
        >
            {children}
        </motion.div>
    )
}

// ── Data ─────────────────────────────────────────────────────────────────────
const FEATURES = [
    {
        icon: Zap,
        title: 'AI Rent Predictions',
        desc: 'Our algorithms analyze historical data to tell you if a price is fair — powered by ML across 3,500+ properties.',
        colour: 'bg-indigo-50 text-indigo-600',
        iconBg: 'bg-indigo-50',
    },
    {
        icon: Shield,
        title: 'Safety Scores',
        desc: 'Comprehensive safety ratings based on official police.uk crime statistics, updated monthly.',
        colour: 'bg-emerald-50 text-emerald-600',
        iconBg: 'bg-emerald-50',
    },
    {
        icon: HomeIcon,
        title: 'HMO Verification',
        desc: 'We check Guildford Borough Council\'s official register to ensure your property is properly licensed.',
        colour: 'bg-amber-50 text-amber-600',
        iconBg: 'bg-amber-50',
    },
]

const STEPS = [
    {
        num: 1,
        icon: Search,
        title: 'Search a postcode',
        desc: 'Enter any Guildford postcode to find nearby properties within your radius.',
    },
    {
        num: 2,
        icon: BarChart3,
        title: 'Compare scores',
        desc: 'View detailed rent fairness, safety ratings, and HMO status for each property.',
    },
    {
        num: 3,
        icon: CheckCircle2,
        title: 'Make informed decisions',
        desc: 'Choose the best student home with confidence, backed by real data.',
    },
]

const TRUST_ITEMS = [
    { icon: Database, label: '3,500+', desc: 'Properties' },
    { icon: Shield, label: 'Monthly', desc: 'Safety Updates' },
    { icon: Star, label: 'Free', desc: 'Forever' },
    { icon: CheckCircle2, label: 'Official', desc: 'Data Sources' },
]

const TOP_STREETS = [
    { rank: 1, name: 'Weston Road', score: 71.9, emoji: '🥇' },
    { rank: 2, name: 'Guildford Park Ave', score: 71.4, emoji: '🥈' },
    { rank: 3, name: "St. John's Road", score: 67.4, emoji: '🥉' },
]

// ── Main component ───────────────────────────────────────────────────────────
export default function Home() {
    const navigate = useNavigate()
    const [postcode, setPostcode] = useState('')
    const [radius, setRadius] = useState(1000)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    function handleSearch(postcodeValue) {
        setError('')
        const trimmed = (postcodeValue || postcode).trim()
        if (!trimmed) { setError('Please enter a postcode.'); return }
        if (!POSTCODE_RE.test(trimmed)) { setError('Please enter a valid UK postcode (e.g. GU2 7XH).'); return }
        setPostcode(trimmed)
        setLoading(true)
        setTimeout(() => {
            navigate(`/search?postcode=${encodeURIComponent(trimmed)}&radius=${radius}`)
        }, 300)
    }

    return (
        <main className="min-h-screen bg-[#f8f9fc] font-[Manrope,sans-serif]">
            <Navbar />

            {/* ═══════════════════════════════════════════
                SECTION 1: HERO
            ═══════════════════════════════════════════ */}
            <section className="relative bg-gradient-to-br from-indigo-50 via-blue-50/80 to-white px-4 pt-6 pb-8 md:pt-14 md:pb-16 lg:pt-20 lg:pb-24">
                {/* Dot pattern */}
                <div
                    className="absolute inset-0 opacity-[0.25]"
                    style={{
                        backgroundImage: 'radial-gradient(circle, #6366F1 0.6px, transparent 0.6px)',
                        backgroundSize: '20px 20px',
                    }}
                />

                <div className="relative max-w-lg lg:max-w-5xl mx-auto">
                    {/* Desktop: 2 columns — text left, search card right */}
                    <div className="lg:grid lg:grid-cols-2 lg:gap-12 lg:items-center">
                        {/* LEFT: Headline + Social Proof */}
                        <div className="text-center lg:text-left">
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
                                <h1 className="text-[26px] md:text-4xl lg:text-[52px] font-extrabold text-slate-900 leading-tight tracking-tight mb-3 lg:mb-5">
                                    Find Your Perfect{' '}
                                    <span className="bg-gradient-to-r from-indigo-600 to-blue-500 bg-clip-text text-transparent">
                                        Student Home
                                    </span>
                                    {' '}in Guildford
                                </h1>
                                <p className="text-sm md:text-base lg:text-lg text-slate-500 font-medium leading-relaxed mb-4 max-w-md mx-auto lg:mx-0">
                                    AI-powered rent predictions, safety scores, and HMO verification for 3,500+ properties.
                                </p>
                            </motion.div>

                            {/* Social proof */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.3 }}
                                className="flex items-center justify-center lg:justify-start gap-2 mb-6 lg:mb-0"
                            >
                                <div className="flex -space-x-2">
                                    {['bg-indigo-400', 'bg-emerald-400', 'bg-amber-400'].map((c, i) => (
                                        <div key={i} className={`w-7 h-7 rounded-full ${c} border-2 border-white flex items-center justify-center`}>
                                            <Users size={12} className="text-white" />
                                        </div>
                                    ))}
                                    <div className="w-7 h-7 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-600">
                                        +2k
                                    </div>
                                </div>
                                <span className="text-xs text-slate-500 font-medium">
                                    <GraduationCap size={12} className="inline mr-1" />
                                    Trusted by 2,000+ Surrey students
                                </span>
                            </motion.div>
                        </div>

                        {/* RIGHT: Search card */}
                        <motion.div
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4, duration: 0.6 }}
                            className="bg-white/90 backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_-4px_rgba(80,72,229,0.12)] p-5 md:p-6 text-left"
                        >
                            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                                Location
                            </label>
                            <SearchAutocomplete
                                value={postcode}
                                onChange={setPostcode}
                                onSelect={handleSearch}
                                placeholder="Enter postcode (e.g. GU2 7XH)"
                            />

                            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-4 mb-2">
                                Search Radius
                            </label>
                            <select
                                value={radius}
                                onChange={(e) => setRadius(Number(e.target.value))}
                                className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none cursor-pointer"
                            >
                                <option value={500}>Within 500m</option>
                                <option value={1000}>Within 1km</option>
                                <option value={2000}>Within 2km</option>
                                <option value={5000}>Within 5km</option>
                            </select>

                            {error && (
                                <p className="text-red-500 text-xs mt-2 font-medium">{error}</p>
                            )}

                            <button
                                onClick={() => handleSearch()}
                                disabled={loading}
                                className="w-full h-12 mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.98] disabled:opacity-50"
                            >
                                {loading ? (
                                    <Loader2 size={18} className="animate-spin" />
                                ) : (
                                    <>
                                        Search Properties
                                        <ArrowRight size={16} />
                                    </>
                                )}
                            </button>

                            <div className="flex items-center gap-2 mt-4 justify-center">
                                <span className="text-[10px] text-slate-400 font-medium">Quick look:</span>
                                {['GU1', 'GU2', 'GU3'].map((pc) => (
                                    <button
                                        key={pc}
                                        onClick={() => handleSearch(`${pc} 7XH`)}
                                        className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[11px] font-bold rounded-full hover:bg-indigo-100 transition-colors"
                                    >
                                        {pc}
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* ── Trust indicators row ────────────────────── */}
            <section className="bg-white border-b border-slate-100">
                <div className="max-w-lg lg:max-w-5xl mx-auto px-4 py-4 lg:py-5 flex items-center justify-between gap-2 lg:gap-6 overflow-x-auto">
                    {TRUST_ITEMS.map(({ icon: Icon, label, desc }) => (
                        <div key={desc} className="flex items-center gap-2 lg:gap-3 flex-shrink-0">
                            <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-indigo-50 flex items-center justify-center">
                                <Icon size={14} className="text-indigo-600 lg:w-5 lg:h-5" />
                            </div>
                            <div>
                                <p className="text-sm lg:text-base font-extrabold text-slate-900 leading-none">{label}</p>
                                <p className="text-[10px] lg:text-xs text-slate-400 font-medium">{desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ═══════════════════════════════════════════
                SECTION 2: EXPLORE MAP
            ═══════════════════════════════════════════ */}
            <AnimatedSection className="pt-8 pb-6 lg:pt-14 lg:pb-10">
                <div className="px-6 mb-4 max-w-lg lg:max-w-5xl mx-auto">
                    <motion.div variants={fadeUp} className="flex items-center gap-2 mb-2 text-indigo-600">
                        <MapPin size={16} />
                        <span className="text-xs font-bold uppercase tracking-wider">Local Insights</span>
                    </motion.div>
                    <motion.h2 variants={fadeUp} className="text-[22px] md:text-3xl font-bold text-slate-900 leading-tight mb-1">
                        Explore Guildford Neighbourhoods
                    </motion.h2>
                    <motion.p variants={fadeUp} className="text-slate-500 text-sm lg:text-base font-medium">
                        Tap to discover rent, safety, and HMO data for each area.
                    </motion.p>
                </div>

                <motion.div variants={fadeUp} className="px-4 max-w-lg lg:max-w-5xl mx-auto">
                    <GuildfordHeatmap />
                </motion.div>
            </AnimatedSection>

            <div className="h-px bg-slate-200 max-w-lg lg:max-w-5xl mx-auto" />

            {/* ═══════════════════════════════════════════
                SECTION 3: MARKET PULSE
            ═══════════════════════════════════════════ */}
            <AnimatedSection className="px-4 py-8 lg:py-12 max-w-lg lg:max-w-3xl mx-auto">
                <motion.div variants={fadeUp}>
                    <MarketPulse />
                </motion.div>
            </AnimatedSection>

            {/* ═══════════════════════════════════════════
                SECTION 4: FEATURES
            ═══════════════════════════════════════════ */}
            <AnimatedSection className="px-4 py-8 lg:py-14 bg-slate-50/80">
                <div className="max-w-lg lg:max-w-5xl mx-auto">
                    <motion.div variants={fadeUp} className="mb-6 lg:mb-10 px-2 lg:text-center">
                        <div className="flex items-center gap-2 mb-1 lg:justify-center">
                            <Sparkles size={16} className="text-indigo-600" />
                            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Features</span>
                        </div>
                        <h3 className="text-xl md:text-2xl lg:text-3xl font-bold text-slate-900">Why Students Love SurreyNest</h3>
                        <p className="text-slate-500 text-sm lg:text-base mt-1 font-medium">Smarter tools for stress-free renting.</p>
                    </motion.div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
                        {FEATURES.map(({ icon: Icon, title, desc, colour, iconBg }) => (
                            <motion.div
                                key={title}
                                variants={fadeUp}
                                className="bg-white p-5 lg:p-6 rounded-2xl shadow-sm border border-slate-100 flex lg:flex-col gap-4 items-start hover:shadow-md transition-shadow"
                            >
                                <div className={`w-12 h-12 lg:w-14 lg:h-14 rounded-full ${iconBg} flex items-center justify-center flex-shrink-0`}>
                                    <Icon size={20} className={colour.split(' ')[1]} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-900 text-base lg:text-lg mb-1">{title}</h4>
                                    <p className="text-slate-500 text-sm leading-snug mb-2">{desc}</p>
                                    <span className="text-indigo-600 text-sm font-bold flex items-center gap-1 cursor-pointer hover:gap-2 transition-all">
                                        Learn more <ChevronRight size={14} />
                                    </span>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </AnimatedSection>

            {/* ═══════════════════════════════════════════
                SECTION 5: HOW IT WORKS
            ═══════════════════════════════════════════ */}
            <AnimatedSection className="px-4 py-10 lg:py-16 bg-indigo-50/40">
                <div className="max-w-lg lg:max-w-5xl mx-auto">
                    <motion.div variants={fadeUp} className="mb-8 lg:mb-12 text-center">
                        <h3 className="text-xl md:text-2xl lg:text-3xl font-bold text-slate-900 mb-1">How It Works</h3>
                        <p className="text-slate-500 text-sm lg:text-base font-medium">Three simple steps to your ideal home.</p>
                    </motion.div>

                    {/* Mobile: vertical timeline */}
                    <div className="relative pl-8 md:pl-10 lg:hidden">
                        <div className="absolute left-[15px] md:left-[19px] top-6 bottom-6 w-[2px] border-l-2 border-dashed border-indigo-200" />
                        <div className="flex flex-col gap-8">
                            {STEPS.map(({ num, icon: Icon, title, desc }) => (
                                <motion.div key={num} variants={fadeUp} className="relative flex gap-4 items-start">
                                    <div className="absolute -left-8 md:-left-10 w-8 h-8 md:w-10 md:h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm md:text-base font-bold shadow-lg shadow-indigo-600/20 z-10">
                                        {num}
                                    </div>
                                    <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-slate-100 flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Icon size={16} className="text-indigo-600" />
                                            <h4 className="font-bold text-slate-900 text-base">{title}</h4>
                                        </div>
                                        <p className="text-slate-500 text-sm leading-snug">{desc}</p>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    {/* Desktop: horizontal 3-column */}
                    <div className="hidden lg:grid lg:grid-cols-3 gap-8">
                        {STEPS.map(({ num, icon: Icon, title, desc }) => (
                            <motion.div key={num} variants={fadeUp} className="text-center">
                                <div className="w-14 h-14 rounded-full bg-indigo-600 text-white flex items-center justify-center text-lg font-bold shadow-lg shadow-indigo-600/20 mx-auto mb-4">
                                    {num}
                                </div>
                                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                                    <div className="flex items-center justify-center gap-2 mb-2">
                                        <Icon size={18} className="text-indigo-600" />
                                        <h4 className="font-bold text-slate-900 text-lg">{title}</h4>
                                    </div>
                                    <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </AnimatedSection>

            {/* ═══════════════════════════════════════════
                SECTION 6: STREETSMARTS TEASER
            ═══════════════════════════════════════════ */}
            <AnimatedSection className="px-4 py-8 lg:py-14">
                <motion.div
                    variants={fadeUp}
                    className="max-w-lg lg:max-w-5xl mx-auto bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 rounded-3xl p-6 md:p-8 lg:p-12 text-white overflow-hidden relative"
                >
                    {/* Decorative circles */}
                    <div className="absolute -top-10 -right-10 w-32 h-32 lg:w-48 lg:h-48 rounded-full bg-white/5" />
                    <div className="absolute -bottom-8 -left-8 w-24 h-24 lg:w-40 lg:h-40 rounded-full bg-white/5" />

                    <div className="relative z-10 lg:grid lg:grid-cols-2 lg:gap-10 lg:items-center">
                        <div>
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white/90 text-xs font-bold mb-3 border border-white/10">
                                <Trophy size={12} />
                                StreetSmarts
                            </div>

                            <h3 className="text-xl md:text-2xl lg:text-3xl font-bold mb-2">Best Streets for Students</h3>
                            <p className="text-indigo-200 text-sm lg:text-base font-medium leading-relaxed mb-5 lg:mb-0">
                                See top-ranked streets in Guildford based on safety, rent value, proximity to uni, and licensed HMO availability.
                            </p>
                        </div>

                        <div>
                            {/* Mini leaderboard */}
                            <div className="flex flex-col gap-2 mb-5">
                                {TOP_STREETS.map((s) => (
                                    <div key={s.rank} className="flex items-center justify-between bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2.5 lg:py-3 border border-white/10">
                                        <div className="flex items-center gap-2.5">
                                            <span className="text-base lg:text-lg">{s.emoji}</span>
                                            <span className="font-semibold text-sm lg:text-base">{s.name}</span>
                                        </div>
                                        <span className="text-sm lg:text-base font-bold text-emerald-300">{s.score}</span>
                                    </div>
                                ))}
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

            {/* ═══════════════════════════════════════════
                SECTION 7: FINAL CTA
            ═══════════════════════════════════════════ */}
            <section className="bg-slate-900 px-4 py-14 md:py-20 lg:py-24">
                <div className="max-w-lg lg:max-w-3xl mx-auto text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                    >
                        <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-3 leading-tight">
                            Ready to find your perfect student home?
                        </h2>
                        <p className="text-slate-400 text-sm md:text-base lg:text-lg font-medium mb-8 max-w-md lg:max-w-xl mx-auto">
                            Join thousands of Surrey students making smarter rental choices.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                            <Link
                                to="/search"
                                className="w-full sm:w-auto px-8 lg:px-10 py-3 lg:py-3.5 bg-white text-slate-900 font-bold text-sm lg:text-base rounded-xl hover:bg-slate-50 transition-colors shadow-lg"
                            >
                                Search Now
                            </Link>
                            <Link
                                to="/about"
                                className="w-full sm:w-auto px-8 lg:px-10 py-3 lg:py-3.5 border border-slate-600 text-slate-300 font-bold text-sm lg:text-base rounded-xl hover:border-slate-400 hover:text-white transition-colors"
                            >
                                Learn More
                            </Link>
                        </div>

                        <p className="text-[11px] lg:text-xs text-slate-500 mt-6 font-medium">
                            100% free · No sign-up required · Updated daily
                        </p>
                    </motion.div>
                </div>
            </section>
        </main>
    )
}
