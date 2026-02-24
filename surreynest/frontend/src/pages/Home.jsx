/**
 * Home page — premium landing with animated hero, search, features, and stats.
 *
 * Features:
 *   - Gradient hero with glassmorphism search card
 *   - UK postcode regex validation with inline error
 *   - Loading spinner on search submission
 *   - Framer-motion staggered fade-in on scroll
 *   - Lucide-react icons on feature + step cards
 */
import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useInView } from 'framer-motion'
import { Search, BarChart3, Shield, Home as HomeIcon, MapPin, CheckCircle2, ArrowRight, Loader2 } from 'lucide-react'

// UK postcode regex — allows optional space between outward and inward parts
const POSTCODE_RE = /^[A-Z]{1,2}\d[0-9A-Z]?\s*\d[A-Z]{2}$/i

// ── Animation variants ──────────────────────────────────────────────────────
const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
}

const staggerContainer = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.15 } },
}

// ── Scroll-triggered section wrapper ─────────────────────────────────────────
function AnimatedSection({ children, className = '' }) {
    const ref = useRef(null)
    const inView = useInView(ref, { once: true, margin: '-60px' })

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

// ── Feature card data ────────────────────────────────────────────────────────
const FEATURES = [
    {
        icon: BarChart3,
        title: 'Rent Fairness Scoring',
        desc: 'ML-powered predictions compare your rent against similar Guildford properties to tell you if you\u2019re paying a fair price.',
        colour: 'bg-indigo-50 text-indigo-600',
    },
    {
        icon: Shield,
        title: 'Safety Scores',
        desc: 'Crime-weighted safety ratings for every postcode sector, updated monthly from official police.uk data.',
        colour: 'bg-emerald-50 text-emerald-600',
    },
    {
        icon: HomeIcon,
        title: 'HMO Verification',
        desc: 'Instantly check if a property has a valid HMO licence from Guildford Borough Council\u2019s register.',
        colour: 'bg-amber-50 text-amber-600',
    },
]

const STEPS = [
    { num: 1, title: 'Search a postcode', desc: 'Enter any Guildford postcode to find nearby properties within your chosen radius.' },
    { num: 2, title: 'Compare scores', desc: 'See rent fairness, safety, and HMO status for each property at a glance.' },
    { num: 3, title: 'Know your rights', desc: 'Read our tenant rights guide, leave reviews, and make informed decisions.' },
]

// ── Main component ───────────────────────────────────────────────────────────
export default function Home() {
    const navigate = useNavigate()
    const [postcode, setPostcode] = useState('')
    const [radius, setRadius] = useState(1000)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    function handleSearch(e) {
        e.preventDefault()
        setError('')

        const trimmed = postcode.trim()
        if (!trimmed) {
            setError('Please enter a postcode.')
            return
        }
        if (!POSTCODE_RE.test(trimmed)) {
            setError('Please enter a valid UK postcode (e.g. GU2 7XH).')
            return
        }

        setLoading(true)
        // Small delay for visual feedback, then navigate
        setTimeout(() => {
            navigate(`/search?postcode=${encodeURIComponent(trimmed)}&radius=${radius}`)
        }, 300)
    }

    return (
        <main className="min-h-screen bg-white overflow-hidden">
            {/* ── Hero ────────────────────────────────────────────────────── */}
            <section className="relative bg-gradient-to-br from-indigo-50 via-blue-50 to-white px-4 pt-8 pb-16 md:pt-16 md:pb-24">
                {/* Dot pattern overlay */}
                <div
                    className="absolute inset-0 opacity-[0.35]"
                    style={{
                        backgroundImage: 'radial-gradient(circle, #6366F1 0.8px, transparent 0.8px)',
                        backgroundSize: '24px 24px',
                    }}
                />

                <div className="relative max-w-3xl mx-auto text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <div className="inline-flex items-center gap-2 bg-white/70 backdrop-blur-sm border border-indigo-100 rounded-full px-4 py-1.5 mb-6">
                            <MapPin size={14} className="text-indigo-600" />
                            <span className="text-xs font-medium text-indigo-700">Guildford Student Housing Intelligence</span>
                        </div>

                        <h1 className="text-3xl font-bold text-gray-900 mb-3 md:text-5xl lg:text-6xl tracking-tight">
                            Find{' '}
                            <span className="bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
                                fair rent
                            </span>{' '}
                            in Guildford
                        </h1>

                        <p className="text-gray-500 mb-8 max-w-xl mx-auto md:text-lg">
                            Check if your rent is fair, verify HMO licensing, and see safety scores for every property — completely free.
                        </p>
                    </motion.div>

                    {/* ── Search card ──────────────────────────────────────── */}
                    <motion.form
                        onSubmit={handleSearch}
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                        className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/60 shadow-xl shadow-indigo-500/5 p-5 md:p-6 max-w-2xl mx-auto"
                    >
                        <div className="flex flex-col gap-3 md:flex-row">
                            <div className="relative flex-1">
                                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    value={postcode}
                                    onChange={(e) => {
                                        setPostcode(e.target.value)
                                        if (error) setError('')
                                    }}
                                    placeholder="Enter postcode e.g. GU2 7XH"
                                    className={`w-full pl-10 pr-4 py-3 border rounded-xl text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${error ? 'border-red-300 bg-red-50/50' : 'border-gray-200 bg-white'
                                        }`}
                                    aria-label="UK postcode"
                                    aria-invalid={!!error}
                                />
                            </div>

                            <select
                                value={radius}
                                onChange={(e) => setRadius(Number(e.target.value))}
                                className="border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 md:w-40"
                                aria-label="Search radius"
                            >
                                <option value={250}>Within 250m</option>
                                <option value={500}>Within 500m</option>
                                <option value={1000}>Within 1km</option>
                                <option value={2000}>Within 2km</option>
                            </select>

                            <button
                                type="submit"
                                disabled={loading}
                                className="bg-indigo-600 text-white rounded-xl px-8 py-3 text-sm font-semibold hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        Searching...
                                    </>
                                ) : (
                                    <>
                                        Search
                                        <ArrowRight size={16} />
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Validation error */}
                        {error && (
                            <motion.p
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-xs text-red-500 mt-2 ml-1"
                            >
                                {error}
                            </motion.p>
                        )}
                    </motion.form>

                    {/* Trust strip */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.6, duration: 0.8 }}
                        className="flex items-center justify-center gap-4 mt-6 text-xs text-gray-400"
                    >
                        <span className="flex items-center gap-1">
                            <CheckCircle2 size={12} className="text-green-500" />
                            12,000+ properties
                        </span>
                        <span className="w-1 h-1 rounded-full bg-gray-300" />
                        <span>Updated monthly</span>
                        <span className="w-1 h-1 rounded-full bg-gray-300" />
                        <span>Completely free</span>
                    </motion.div>
                </div>
            </section>

            {/* ── Features ────────────────────────────────────────────────── */}
            <section className="max-w-5xl mx-auto px-4 py-16 md:py-24">
                <AnimatedSection className="text-center mb-12">
                    <motion.p variants={fadeUp} className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-2">
                        Features
                    </motion.p>
                    <motion.h2 variants={fadeUp} className="text-2xl font-bold text-gray-900 md:text-3xl">
                        Everything you need to rent smart
                    </motion.h2>
                </AnimatedSection>

                <AnimatedSection className="grid gap-6 md:grid-cols-3">
                    {FEATURES.map((f) => (
                        <motion.div
                            key={f.title}
                            variants={fadeUp}
                            className="border border-gray-100 rounded-2xl p-6 hover:border-gray-200 hover:shadow-lg hover:shadow-gray-100 transition-all duration-300 group"
                        >
                            <div className={`w-11 h-11 rounded-xl ${f.colour} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                                <f.icon size={20} />
                            </div>
                            <h3 className="text-base font-semibold text-gray-900 mb-2">{f.title}</h3>
                            <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
                        </motion.div>
                    ))}
                </AnimatedSection>
            </section>

            {/* ── How it works ────────────────────────────────────────────── */}
            <section className="bg-gray-50/70 px-4 py-16 md:py-24">
                <div className="max-w-3xl mx-auto">
                    <AnimatedSection className="text-center mb-12">
                        <motion.p variants={fadeUp} className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-2">
                            How it works
                        </motion.p>
                        <motion.h2 variants={fadeUp} className="text-2xl font-bold text-gray-900 md:text-3xl">
                            Three simple steps
                        </motion.h2>
                    </AnimatedSection>

                    <AnimatedSection className="grid gap-8 md:grid-cols-3">
                        {STEPS.map((s) => (
                            <motion.div key={s.num} variants={fadeUp} className="text-center">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-600 to-blue-600 text-white text-lg font-bold flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/20">
                                    {s.num}
                                </div>
                                <h3 className="text-sm font-semibold text-gray-900 mb-1">{s.title}</h3>
                                <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
                            </motion.div>
                        ))}
                    </AnimatedSection>
                </div>
            </section>

            {/* ── CTA ─────────────────────────────────────────────────────── */}
            <section className="px-4 py-16 md:py-24">
                <AnimatedSection className="max-w-2xl mx-auto text-center">
                    <motion.h2 variants={fadeUp} className="text-2xl font-bold text-gray-900 mb-3 md:text-3xl">
                        Ready to find fair rent?
                    </motion.h2>
                    <motion.p variants={fadeUp} className="text-gray-500 mb-6">
                        Search any Guildford postcode and get instant scores for every nearby property.
                    </motion.p>
                    <motion.button
                        variants={fadeUp}
                        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                        className="bg-indigo-600 text-white rounded-xl px-8 py-3 text-sm font-semibold hover:bg-indigo-700 active:scale-[0.98] transition-all inline-flex items-center gap-2"
                    >
                        Get started
                        <ArrowRight size={16} />
                    </motion.button>
                </AnimatedSection>
            </section>
        </main>
    )
}
