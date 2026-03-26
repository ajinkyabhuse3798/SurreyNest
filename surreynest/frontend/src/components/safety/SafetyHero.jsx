/**
 * SafetyHero v2, Full-width cinematic banner with postcode search,
 * safety gauge, star rating, and quick-stat chips.
 */
import { useState } from 'react'
import { Shield, Star, Search, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ScoreGauge from '../ScoreGauge'

const starLabels = {
    5: 'One of the safest areas',
    4: 'Quieter than most',
    3: 'About average for Guildford',
    2: 'A bit busier than most',
    1: 'Worth checking carefully',
}

const POSTCODE_RE = /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d([A-Za-z]{2})?$/

export default function SafetyHero({ sector, decodedPostcode, safetyScore, overallStars, sectorTotal }) {
    const navigate = useNavigate()
    const [search, setSearch] = useState('')
    const [err, setErr] = useState('')

    function handleSearch(e) {
        e.preventDefault()
        const pc = search.trim().toUpperCase()
        if (!pc) { setErr('Type a postcode first'); return }
        if (!POSTCODE_RE.test(pc)) { setErr("That doesn't look right. Try GU2 7 or GU2 7XH."); return }
        setErr('')
        navigate(`/safety/${encodeURIComponent(pc)}`)
    }

    return (
        <div className="relative bg-gradient-to-br from-orange-600 via-orange-700 to-amber-800 overflow-hidden">
            {/* Ambient glows */}
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-amber-500 rounded-full blur-[100px] opacity-30 pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 w-72 h-72 bg-orange-400 rounded-full blur-[80px] opacity-20 pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-900 rounded-full blur-[120px] opacity-20 pointer-events-none" />

            {/* Subtle dot grid overlay */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)',
                    backgroundSize: '28px 28px',
                }}
            />

            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
                <div className="flex flex-col lg:flex-row items-start lg:items-center gap-8 lg:gap-16">

                    {/* ── Left: title + search ── */}
                    <div className="flex-1 min-w-0">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-white/80 text-xs font-bold tracking-widest uppercase mb-5">
                            <Shield size={13} className="text-emerald-400" />
                            Area Safety Report
                        </div>

                        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-3 tracking-tight leading-[1.1]">
                            {sector || decodedPostcode}
                        </h1>
                        <p className="text-orange-200 text-base sm:text-lg mb-8 max-w-lg leading-relaxed">
                            Real crime data for this area, recent, local, and put into plain English so it's actually useful.
                        </p>

                        {/* Postcode search */}
                        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2 max-w-md">
                            <div className="relative flex-1">
                                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                                <input
                                    value={search}
                                    onChange={e => { setSearch(e.target.value); setErr('') }}
                                    placeholder="Try another area, e.g. GU1 3, GU2 7…"
                                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15 transition-all"
                                />
                            </div>
                            <button
                                type="submit"
                                className="flex items-center justify-center gap-1.5 px-5 py-3 bg-white text-orange-700 rounded-xl font-bold text-sm hover:bg-orange-50 transition-colors shadow-lg shadow-black/20 whitespace-nowrap"
                            >
                                Search <ArrowRight size={14} />
                            </button>
                        </form>
                        {err && <p className="mt-2 text-xs text-rose-300">{err}</p>}
                    </div>

                    {/* ── Right: score card ── */}
                    <div className="flex-shrink-0 w-full lg:w-auto">
                        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-6 sm:p-8 shadow-2xl">
                            <div className="flex flex-row sm:flex-col lg:flex-row items-center gap-6">
                                {safetyScore != null && (
                                    <div className="flex-shrink-0">
                                        <ScoreGauge score={safetyScore} size="lg" showLabel label="Safety" />
                                    </div>
                                )}
                                <div className="text-left">
                                    <div className="flex items-center gap-0.5 mb-2">
                                        {[1, 2, 3, 4, 5].map(n => (
                                            <Star
                                                key={n}
                                                size={20}
                                                className={n <= overallStars ? 'text-amber-400 drop-shadow' : 'text-white/20'}
                                                fill={n <= overallStars ? 'currentColor' : 'none'}
                                            />
                                        ))}
                                    </div>
                                    <p className="text-lg font-bold text-white leading-tight">{starLabels[overallStars]}</p>
                                    <p className="text-sm text-white/50 mt-1">{sectorTotal ?? 0} incidents recorded in the past year</p>
                                    <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-300 font-semibold">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                        Live from police.uk
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            {/* Bottom fade */}
            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#f8f9fc] to-transparent pointer-events-none" />
        </div>
    )
}
