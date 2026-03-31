/**
 * HeroSection, Stitch-aligned hero with search bar, student avatars, and hero image card.
 * Receives search state + handler from Home page.
 */
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { MapPin } from 'lucide-react'
import api from '../../services/api'

const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }

export default function HeroSection({ postcode, setPostcode, error, loading, handleSearch }) {
    const navigate = useNavigate()
    const [suggestions, setSuggestions] = useState([])
    const [showDropdown, setShowDropdown] = useState(false)
    const [activeIndex, setActiveIndex] = useState(-1)
    const wrapperRef = useRef(null)
    const debounceRef = useRef(null)

    // Fetch suggestions debounced
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(async () => {
            if (!postcode || postcode.length < 2) {
                setSuggestions([])
                setShowDropdown(false)
                return
            }
            try {
                const res = await api.get('/api/properties/suggest', { params: { q: postcode, limit: 8 } })
                setSuggestions(res.data || [])
                setShowDropdown((res.data || []).length > 0)
            } catch {
                setSuggestions([])
                setShowDropdown(false)
            }
        }, 300)
        return () => clearTimeout(debounceRef.current)
    }, [postcode])

    // Close on outside click
    useEffect(() => {
        function handleClickOutside(e) {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setShowDropdown(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    function handleKeyDown(e) {
        if (showDropdown) {
            if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActiveIndex((prev) => Math.min(prev + 1, suggestions.length - 1))
                return
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActiveIndex((prev) => Math.max(prev - 1, -1))
                return
            }
            if (e.key === 'Enter' && activeIndex >= 0 && suggestions[activeIndex]) {
                e.preventDefault()
                navigate(`/property/${suggestions[activeIndex].uprn}`)
                setShowDropdown(false)
                return
            }
            if (e.key === 'Escape') {
                setShowDropdown(false)
                return
            }
        }
        if (e.key === 'Enter') handleSearch()
    }

    return (
        <section className="flex-1 max-w-7xl mx-auto px-4 md:px-6 pt-8 md:pt-12 pb-16 md:pb-24 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            {/* Left, Copy + Search */}
            <motion.div
                className="flex flex-col gap-6 md:gap-8"
                initial="hidden"
                animate="visible"
                variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
            >
                {/* Live badge */}
                <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 w-fit">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider text-primary">Live in Guildford</span>
                </motion.div>

                {/* Headline */}
                <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl md:text-7xl font-bold leading-[1.1] text-slate-900">
                    Empowering <br />
                    <span className="text-primary">Guildford</span> Students
                </motion.h1>

                {/* Subtext */}
                <motion.p variants={fadeUp} className="text-base md:text-lg text-slate-600 max-w-lg leading-relaxed">
                    Navigate the student housing market with confidence. Use our ML-powered tools to verify rent fairness, HMO compliance, and tenant rights in seconds.
                </motion.p>

                {/* Search Bar */}
                <motion.div variants={fadeUp} className="relative max-w-xl group" ref={wrapperRef}>
                    <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-primary/5 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200" />
                    <div className="relative glass rounded-xl p-2 flex flex-col sm:flex-row items-stretch sm:items-center shadow-xl border-white/50">
                        <div className="flex-1 flex items-center px-3 md:px-4 gap-3">
                            <span className="material-symbols-outlined text-primary/60">location_on</span>
                            <input
                                className="w-full bg-transparent border-none focus:ring-0 focus:outline-none text-slate-900 placeholder:text-slate-400 font-medium py-3 text-sm md:text-base"
                                placeholder="Enter Postcode (e.g. GU2 7XH)"
                                type="text"
                                value={postcode}
                                onChange={(e) => { setPostcode(e.target.value); setActiveIndex(-1) }}
                                onKeyDown={handleKeyDown}
                                onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
                                autoComplete="off"
                            />
                        </div>
                        <button
                            onClick={() => handleSearch()}
                            disabled={loading}
                            className="bg-primary text-white px-6 md:px-8 py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:shadow-xl hover:shadow-primary/30 transition-all active:scale-95 text-sm md:text-base mt-2 sm:mt-0"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>
                                    Search Now
                                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                                </>
                            )}
                        </button>
                    </div>
                    {error && <p className="text-sm text-red-500 font-medium mt-2 px-2">{error}</p>}

                    {/* Autocomplete dropdown */}
                    {showDropdown && (
                        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-72 overflow-y-auto">
                            {suggestions.map((s, i) => (
                                <button
                                    key={s.uprn}
                                    onMouseDown={(e) => {
                                        e.preventDefault()
                                        navigate(`/property/${s.uprn}`)
                                        setShowDropdown(false)
                                    }}
                                    onMouseEnter={() => setActiveIndex(i)}
                                    className={`w-full text-left px-4 py-3 flex items-start gap-3 text-sm transition-colors ${i === activeIndex ? 'bg-primary/10' : 'hover:bg-gray-50'}`}
                                >
                                    <MapPin size={14} className={`mt-0.5 flex-shrink-0 ${i === activeIndex ? 'text-primary' : 'text-gray-400'}`} />
                                    <div className="min-w-0">
                                        <p className="font-medium text-gray-900 truncate">{s.address}</p>
                                        <p className="text-xs text-gray-400">{s.postcode}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </motion.div>

                {/* Data source trust badges */}
                <motion.div variants={fadeUp} className="flex items-center gap-3 pt-2 md:pt-4 flex-wrap">
                    {['police.uk', 'EPC Register', 'Land Registry', 'GBC HMO'].map((src) => (
                        <span key={src} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                            {src}
                        </span>
                    ))}
                </motion.div>
            </motion.div>

            {/* Right, Hero image card (desktop) */}
            <motion.div
                className="relative hidden lg:block"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.3 }}
            >
                <div className="relative glass p-4 rounded-3xl shadow-2xl border-white/40 overflow-hidden group">
                    <img
                        className="rounded-2xl w-full h-[500px] object-cover transition-transform duration-700 group-hover:scale-105"
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuDCjFjq0xvCyTOAFMDH4rABIUY2cpPEB3UNcMeSENiKNWMgSpnPBetEymO0vj2TRaqNsNLwSlGD6VJzoSFRUJjKPFOvtvNy7zx4TRGCgKE4HALh4XVeru7AjDYG9j02s3e9Rw_upVqRWDJ-MXZSgtgy_Tm3no4NKfU8exSHTnSb0wz1zZ1Rv1ENKEWnsLaCiGxHXnjqnrR1SW_R29POaEcqZNC9y3dQwIRKb2bpXYS0-MZJoRkm2RcS6b5PNYHxzb9hR-cEnPFVPLg"
                        alt="Students studying together"
                    />
                    <div className="absolute bottom-10 left-10 right-10 glass p-5 md:p-6 rounded-2xl shadow-xl">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-xs font-bold text-primary uppercase">Market Trend</span>
                            <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded">+12% Fairness</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-primary w-[75%] rounded-full" />
                        </div>
                        <p className="mt-4 text-sm font-medium text-slate-700">
                            Guildford housing quality is improving. Check your property status now.
                        </p>
                    </div>
                </div>
            </motion.div>
        </section>
    )
}
