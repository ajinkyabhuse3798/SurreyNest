/**
 * HeroSection — Premium hero with gradient orbs, glassmorphism search card,
 * pill-based radius selector, and social proof.
 *
 * API connection: SearchAutocomplete → /api/properties/suggest
 */
import { motion } from 'framer-motion'
import { ArrowRight, Loader2, GraduationCap, Users } from 'lucide-react'
import SearchAutocomplete from '../SearchAutocomplete'

const RADII = [
    { value: 500, label: '500m' },
    { value: 1000, label: '1km' },
    { value: 2000, label: '2km' },
    { value: 5000, label: '5km' },
]

const QUICK_LINKS = [
    { label: 'GU1', postcode: 'GU1 1AD' },
    { label: 'GU2', postcode: 'GU2 7XH' },
    { label: 'GU3', postcode: 'GU3 1AL' },
]

export default function HeroSection({ postcode, setPostcode, radius, setRadius, error, loading, handleSearch }) {
    return (
        <section className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-indigo-50/60 to-white px-4 pt-8 pb-10 md:pt-16 md:pb-20 lg:pt-24 lg:pb-28">
            {/* ── Animated gradient orbs ──────────────────────────────────── */}
            <div className="gradient-orb gradient-orb-indigo w-[300px] h-[300px] md:w-[500px] md:h-[500px] -top-20 -right-20 md:-top-40 md:-right-40 animate-float opacity-60" />
            <div className="gradient-orb gradient-orb-blue w-[250px] h-[250px] md:w-[400px] md:h-[400px] top-1/2 -left-20 md:-left-40 animate-float-slow opacity-50" />
            <div className="gradient-orb gradient-orb-purple w-[200px] h-[200px] md:w-[350px] md:h-[350px] -bottom-10 right-1/4 animate-float-slower opacity-40" />

            <div className="relative z-10 max-w-lg lg:max-w-5xl mx-auto">
                <div className="lg:grid lg:grid-cols-2 lg:gap-14 lg:items-center">
                    {/* ── LEFT: Headline + Social Proof ──────────────────────── */}
                    <div className="text-center lg:text-left mb-8 lg:mb-0">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                        >
                            <h1 className="text-[28px] md:text-4xl lg:text-[52px] font-extrabold text-slate-900 leading-[1.15] tracking-tight mb-4 lg:mb-5">
                                Find Your Perfect{' '}
                                <span className="text-gradient">
                                    Student Home
                                </span>
                                {' '}in Guildford
                            </h1>
                            <p className="text-sm md:text-base lg:text-lg text-slate-500 font-medium leading-relaxed mb-6 max-w-md mx-auto lg:mx-0">
                                AI-powered rent predictions, safety scores, and HMO compliance — all the data you need before signing a lease.
                            </p>
                        </motion.div>

                        {/* Social proof */}
                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4, duration: 0.5 }}
                            className="flex items-center justify-center lg:justify-start gap-3"
                        >
                            <div className="flex -space-x-2.5">
                                {['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500'].map((c, i) => (
                                    <div key={i} className={`w-8 h-8 rounded-full ${c} border-[2.5px] border-white flex items-center justify-center shadow-sm`}>
                                        <Users size={12} className="text-white" />
                                    </div>
                                ))}
                                <div className="w-8 h-8 rounded-full bg-slate-200 border-[2.5px] border-white flex items-center justify-center text-[10px] font-bold text-slate-600 shadow-sm">
                                    +2k
                                </div>
                            </div>
                            <span className="text-xs text-slate-500 font-medium">
                                <GraduationCap size={13} className="inline mr-1 text-indigo-500" />
                                Trusted by 2,000+ Surrey students
                            </span>
                        </motion.div>
                    </div>

                    {/* ── RIGHT: Search Card (Glassmorphism) ─────────────────── */}
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ delay: 0.3, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                        className="glass-card-solid rounded-2xl p-5 md:p-7 text-left shadow-indigo-glow"
                    >
                        {/* Location input */}
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                            Location
                        </label>
                        <SearchAutocomplete
                            value={postcode}
                            onChange={setPostcode}
                            onSelect={handleSearch}
                            placeholder="Enter postcode (e.g. GU2 7XH)"
                        />

                        {/* Radius — pill buttons */}
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-5 mb-2.5">
                            Search Radius
                        </label>
                        <div className="flex gap-2">
                            {RADII.map(({ value, label }) => (
                                <button
                                    key={value}
                                    onClick={() => setRadius(value)}
                                    className={`flex-1 h-11 rounded-xl text-sm font-bold transition-all duration-200 ${radius === value
                                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>

                        {/* Error */}
                        {error && (
                            <p className="text-red-500 text-xs mt-3 font-medium">{error}</p>
                        )}

                        {/* Search button */}
                        <button
                            onClick={() => handleSearch()}
                            disabled={loading}
                            className="w-full h-12 mt-5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.98] disabled:opacity-50"
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

                        {/* Quick links */}
                        <div className="flex items-center gap-2 mt-4 justify-center">
                            <span className="text-[10px] text-slate-400 font-medium">Quick look:</span>
                            {QUICK_LINKS.map(({ label, postcode: pc }) => (
                                <button
                                    key={label}
                                    onClick={() => handleSearch(pc)}
                                    className="px-3.5 py-1.5 bg-indigo-50 text-indigo-600 text-[11px] font-bold rounded-full hover:bg-indigo-100 transition-colors"
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    )
}
