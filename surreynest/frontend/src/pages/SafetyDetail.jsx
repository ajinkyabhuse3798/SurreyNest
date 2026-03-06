/**
 * SafetyDetail — Dedicated full-page safety analytics.
 *
 * Route: /safety/:postcode
 *
 * Shows comprehensive crime data in plain English so even a
 * 9th-grader can understand whether this area is safe.
 *
 * Sections:
 *  1. Hero: postcode banner + overall safety gauge + star overview
 *  2. Crime breakdown donut + plain sentence
 *  3. Monthly chart with numbers + trend %
 *  4. Guildford comparison (5-star + sentence)
 *  5. Area rankings (safest + hotspots)
 *  6. Train stations
 *  7. Student safety verdict
 *  8. Holiday burglary risk
 *  9. Safety tips
 */
import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
    Shield, ArrowLeft, TrendingDown, TrendingUp, Minus,
    Lock, AlertTriangle, Volume2, Car, ShoppingBag,
    AlertOctagon, Pill, Users, Lightbulb, GraduationCap,
    Home, Train, Star, Award, MapPin, ChevronRight,
    AlertCircle, CheckCircle2,
} from 'lucide-react'
import Navbar from '../components/Navbar'
import ScoreGauge from '../components/ScoreGauge'
import { getSafetyIntelligence, getSafetyRankings } from '../services/safetyApi'
import api from '../services/api'

/* ── Category meta ───────────────────────────────────────────────────── */
const CAT_META = {
    'violent-crime': { name: 'Violent Crime', color: '#ef4444', Icon: AlertTriangle },
    'anti-social-behaviour': { name: 'Noise & ASB', color: '#f59e0b', Icon: Volume2 },
    'public-order': { name: 'Public Order', color: '#8b5cf6', Icon: Users },
    'burglary': { name: 'Break-ins', color: '#3b82f6', Icon: Lock },
    'drugs': { name: 'Drug Offences', color: '#6366f1', Icon: Pill },
    'vehicle-crime': { name: 'Vehicle Crime', color: '#14b8a6', Icon: Car },
    'theft-from-the-person': { name: 'Personal Theft', color: '#ec4899', Icon: ShoppingBag },
    'robbery': { name: 'Robbery', color: '#f97316', Icon: AlertOctagon },
}

/* ── Train stations ──────────────────────────────────────────────────── */
const TRAIN_STATIONS = [
    { name: 'Guildford Station', lat: 51.2370, lng: -0.5810, lines: 'South Western Railway — London Waterloo in ~35 min' },
    { name: 'London Road (Guildford)', lat: 51.2415, lng: -0.5700, lines: 'South Western Railway — local services' },
]

function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/* ── Section wrapper ─────────────────────────────────────────────────── */
function Section({ icon: Icon, title, subtitle, children, id }) {
    return (
        <section id={id} className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                    <Icon size={16} className="text-indigo-600" />
                </div>
                <div>
                    <h2 className="text-base font-bold text-slate-800">{title}</h2>
                    {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
                </div>
            </div>
            <div className="p-5">
                {children}
            </div>
        </section>
    )
}

/* ══════════════════════════════════════════════════════════════════════
 * DONUT CHART
 * ══════════════════════════════════════════════════════════════════════ */
function CrimeDonut({ breakdown }) {
    const total = breakdown.reduce((s, b) => s + b.count, 0)
    if (!total) return null

    const size = 160, stroke = 28, r = (size - stroke) / 2, circ = 2 * Math.PI * r
    let offset = 0

    const perMonth = (total / 12).toFixed(1)
    const summaryText = total <= 3
        ? `Only ${total} crime${total === 1 ? '' : 's'} reported in the whole year — almost nothing!`
        : total <= 10
            ? `About ${perMonth} crimes per month — that's fairly quiet.`
            : total <= 30
                ? `Around ${perMonth} crimes per month — about average for Guildford.`
                : `About ${perMonth} crimes per month — busier than most areas.`

    return (
        <div>
            <p className="text-sm text-slate-600 mb-5 leading-relaxed">{summaryText}</p>

            <div className="flex flex-col sm:flex-row items-center gap-6">
                {/* Donut */}
                <div className="relative flex-shrink-0">
                    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
                        {breakdown.map((b) => {
                            const pct = b.count / total
                            const dash = pct * circ
                            const gap = circ - dash
                            const seg = (
                                <circle
                                    key={b.category}
                                    cx={size / 2} cy={size / 2} r={r}
                                    fill="none"
                                    stroke={CAT_META[b.category]?.color || '#94a3b8'}
                                    strokeWidth={stroke}
                                    strokeDasharray={`${dash} ${gap}`}
                                    strokeDashoffset={-offset}
                                    strokeLinecap="butt"
                                />
                            )
                            offset += dash
                            return seg
                        })}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-black text-slate-800">{total}</span>
                        <span className="text-[10px] text-slate-400 font-medium">per year</span>
                    </div>
                </div>

                {/* Legend */}
                <div className="grid grid-cols-1 gap-2.5 flex-1 w-full">
                    {breakdown.map((b) => {
                        const meta = CAT_META[b.category] || { name: b.category, color: '#94a3b8' }
                        const pct = Math.round((b.count / total) * 100)
                        return (
                            <div key={b.category} className="flex items-center gap-2.5">
                                <span className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ background: meta.color }} />
                                <span className="text-sm text-slate-600 flex-1">{meta.name}</span>
                                <span className="text-sm font-bold text-slate-800">{b.count}</span>
                                <span className="text-xs text-slate-400 w-8 text-right">{pct}%</span>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

/* ══════════════════════════════════════════════════════════════════════
 * MONTHLY CHART + TREND
 * ══════════════════════════════════════════════════════════════════════ */
function MonthlyChart({ data, trend }) {
    if (!data?.length) return null

    const max = Math.max(...data.map(d => d.count), 1)
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    const getMonth = (dateStr) => {
        try {
            const month = parseInt(dateStr.split('-')[1], 10)
            return monthNames[month - 1] || ''
        } catch { return '' }
    }

    const pct = Math.abs(Math.round(trend?.change_percent || 0))
    const trendConfig = {
        improving: { emoji: '📉', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
        worsening: { emoji: '📈', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
        stable: { emoji: '➡️', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
    }
    const tc = trendConfig[trend?.direction] || trendConfig.stable

    let trendSentence = ''
    if (trend?.direction === 'improving') {
        trendSentence = `Good news! Crime has gone down by about ${pct}% compared to earlier in the year.`
    } else if (trend?.direction === 'worsening') {
        trendSentence = `Heads up — crime has gone up by about ${pct}% compared to earlier in the year.`
    } else {
        trendSentence = 'Crime has been about the same every month — no big changes.'
    }

    const BAR_AREA_PX = 80

    return (
        <div className="space-y-4">
            {/* Trend */}
            <div className={`${tc.bg} border ${tc.border} rounded-xl px-4 py-3.5 flex items-start gap-3`}>
                <span className="text-lg">{tc.emoji}</span>
                <p className={`text-sm font-bold ${tc.text}`}>{trendSentence}</p>
            </div>

            {/* Bar chart */}
            <div>
                <p className="text-xs text-slate-400 mb-3">Each bar shows how many crimes were reported that month</p>
                <div className="flex items-end gap-1.5">
                    {data.map((d, i) => {
                        const barPx = d.count > 0 ? Math.max(8, Math.round((d.count / max) * BAR_AREA_PX)) : 2
                        return (
                            <div key={i} className="flex-1 flex flex-col items-center">
                                <span className="text-[10px] font-bold text-slate-600 mb-0.5">{d.count}</span>
                                <div
                                    className={`w-full rounded-t-sm transition-all duration-500 ${d.count > 0 ? 'bg-indigo-400' : 'bg-slate-200'}`}
                                    style={{ height: `${barPx}px`, transitionDelay: `${i * 50}ms` }}
                                />
                                <span className="text-[9px] text-slate-400 mt-1">{getMonth(d.month)}</span>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

/* ══════════════════════════════════════════════════════════════════════
 * GUILDFORD COMPARISON — 5-star + plain sentence
 * ══════════════════════════════════════════════════════════════════════ */
function GuildfordComparison({ comparison }) {
    if (!comparison) return null

    const diff = comparison.difference_percent
    const sectorTotal = comparison.sector_total
    const avgTotal = comparison.guildford_average

    let dots = 3
    if (diff <= -60) dots = 5
    else if (diff <= -30) dots = 4
    else if (diff <= 10) dots = 3
    else if (diff <= 50) dots = 2
    else dots = 1

    let sentence = ''
    if (dots === 5) sentence = `This is one of the safest areas in Guildford. Only ${sectorTotal} crime${sectorTotal === 1 ? '' : 's'} were reported here last year — most areas had around ${Math.round(avgTotal)}.`
    else if (dots === 4) sentence = `This area is safer than most of Guildford. It had ${sectorTotal} crimes last year, while the average area had ${Math.round(avgTotal)}.`
    else if (dots === 3) sentence = `This area is about average for Guildford — not the safest, not the worst. It had ${sectorTotal} crimes last year, similar to the average of ${Math.round(avgTotal)}.`
    else if (dots === 2) sentence = `This area has more crime than most of Guildford. It had ${sectorTotal} crimes last year, while the average area had ${Math.round(avgTotal)}.`
    else sentence = `This is a higher-crime area. It had ${sectorTotal} crimes last year — much more than the Guildford average of ${Math.round(avgTotal)}.`

    const dotColors = { 5: 'text-emerald-500', 4: 'text-emerald-400', 3: 'text-amber-400', 2: 'text-orange-400', 1: 'text-red-400' }
    const labels = { 5: 'Very safe', 4: 'Safer than most', 3: 'Average', 2: 'Below average', 1: 'Higher crime' }

    return (
        <div>
            <div className="flex items-center gap-1.5 mb-3">
                {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} size={24} className={n <= dots ? dotColors[dots] : 'text-slate-200'} fill={n <= dots ? 'currentColor' : 'none'} />
                ))}
                <span className="text-base font-bold text-slate-700 ml-2">{labels[dots]}</span>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">{sentence}</p>
        </div>
    )
}

/* ══════════════════════════════════════════════════════════════════════
 * AREA RANKINGS — Safest + Hotspots
 * ══════════════════════════════════════════════════════════════════════ */
function AreaRankings({ rankings, currentSector }) {
    if (!rankings) return null

    const RankList = ({ title, areas, emoji, color }) => (
        <div>
            <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                <span>{emoji}</span> {title}
            </h3>
            <div className="space-y-2">
                {areas?.map((a, i) => {
                    const isCurrent = a.sector === currentSector
                    return (
                        <div
                            key={a.sector}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${isCurrent
                                    ? `${color === 'emerald' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'} ring-2 ${color === 'emerald' ? 'ring-emerald-300' : 'ring-red-300'}`
                                    : 'bg-slate-50/50 border-slate-100'
                                }`}
                        >
                            <span className="text-lg font-black text-slate-300 w-6 text-center">{i + 1}</span>
                            <div className="flex-1">
                                <p className="text-sm font-semibold text-slate-800">
                                    {a.sector}
                                    {isCurrent && <span className="text-xs ml-1.5 text-indigo-600 font-medium">← This area</span>}
                                </p>
                            </div>
                            <span className="text-xs font-bold text-slate-500">{a.total_crimes} crimes</span>
                        </div>
                    )
                })}
            </div>
        </div>
    )

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <RankList title="Safest Areas" areas={rankings.safest} emoji="🛡️" color="emerald" />
            <RankList title="Crime Hotspots" areas={rankings.hotspots} emoji="🔴" color="red" />
        </div>
    )
}

/* ══════════════════════════════════════════════════════════════════════
 * TRAIN STATIONS
 * ══════════════════════════════════════════════════════════════════════ */
function TrainStations({ lat, lng }) {
    if (!lat || !lng) return null

    const stations = TRAIN_STATIONS.map((s) => ({
        ...s,
        distance: haversineKm(lat, lng, s.lat, s.lng),
    })).sort((a, b) => a.distance - b.distance)

    return (
        <div className="space-y-3">
            {stations.map((s) => {
                const walkMin = Math.round(s.distance / 5 * 60)
                return (
                    <div key={s.name} className="flex items-start gap-3 bg-slate-50/50 rounded-xl px-4 py-3 border border-slate-100">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                            <Train size={15} className="text-indigo-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800">{s.name}</p>
                            <p className="text-xs text-slate-500">{s.lines}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                            <p className="text-sm font-bold text-indigo-600">{s.distance.toFixed(1)} km</p>
                            <p className="text-[10px] text-slate-400">~{walkMin} min walk</p>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

/* ══════════════════════════════════════════════════════════════════════
 * STUDENT SAFETY
 * ══════════════════════════════════════════════════════════════════════ */
function StudentSafety({ data }) {
    if (!data || data.student_score == null) return null

    const score = data.student_score
    let stars, emoji, verdict, detail

    if (score >= 85) {
        stars = 5; emoji = '🛡️'
        verdict = 'This area is excellent for students'
        detail = 'Very few crimes that affect students happen here. Your bike, laptop, and belongings are safe. Walking home at night won\'t be a worry.'
    } else if (score >= 70) {
        stars = 4; emoji = '✅'
        verdict = 'This area is good for students'
        detail = 'Most students living here feel safe. Take the usual precautions — lock your door and don\'t leave valuables in plain sight.'
    } else if (score >= 50) {
        stars = 3; emoji = '🟡'
        verdict = 'This area is okay — just be aware'
        detail = 'Some crimes that affect students happen here. Lock your house when leaving, especially during holidays. Walk with friends at night.'
    } else if (score >= 30) {
        stars = 2; emoji = '⚠️'
        verdict = 'Be careful in this area'
        detail = 'There have been break-ins and thefts that affect students. Make sure you have good locks, and avoid walking alone late at night.'
    } else {
        stars = 1; emoji = '🔴'
        verdict = 'Higher risk for students'
        detail = 'This area has had several crimes affecting students. Talk to current tenants about their experience before signing a lease.'
    }

    const starColor = stars >= 4 ? 'text-emerald-500' : stars >= 3 ? 'text-amber-500' : 'text-red-500'

    return (
        <div>
            <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">{emoji}</span>
                <div>
                    <p className="text-lg font-bold text-slate-800">{verdict}</p>
                    <div className="flex items-center gap-0.5 mt-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                            <Star key={n} size={16} className={n <= stars ? starColor : 'text-slate-200'} fill={n <= stars ? 'currentColor' : 'none'} />
                        ))}
                    </div>
                </div>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">{detail}</p>

            {data.impacts?.length > 0 && (
                <div className="pt-3 border-t border-slate-100">
                    <p className="text-xs font-medium text-slate-500 mb-2">What matters for students specifically:</p>
                    <div className="flex flex-wrap gap-1.5">
                        {data.impacts.slice(0, 5).map((imp) => (
                            <span
                                key={imp.category}
                                className={`text-xs px-2.5 py-1 rounded-full font-medium ${imp.student_relevance === 'high' ? 'bg-red-100 text-red-700'
                                        : imp.student_relevance === 'low' ? 'bg-emerald-100 text-emerald-700'
                                            : 'bg-slate-100 text-slate-600'
                                    }`}
                            >
                                {imp.label}: {imp.student_relevance === 'high' ? 'Matters more' : imp.student_relevance === 'low' ? 'Matters less' : 'Normal risk'}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

/* ══════════════════════════════════════════════════════════════════════
 * HOLIDAY ALERT
 * ══════════════════════════════════════════════════════════════════════ */
function HolidayAlert({ risk }) {
    if (!risk || risk.risk_level === 'low') return null
    const isHigh = risk.risk_level === 'high'

    const sentence = isHigh
        ? 'When students leave for holidays (summer and Christmas), empty houses in this area get broken into more often. This matters if you\'re signing a 12-month lease.'
        : 'There\'s a small increase in break-ins during holidays when student houses sit empty.'

    return (
        <div className={`rounded-xl p-4 border ${isHigh ? 'bg-orange-50 border-orange-200' : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex items-start gap-3">
                <Home size={18} className={`${isHigh ? 'text-orange-600' : 'text-amber-600'} mt-0.5 flex-shrink-0`} />
                <div>
                    <p className={`text-sm font-bold ${isHigh ? 'text-orange-800' : 'text-amber-800'}`}>
                        {isHigh ? '⚠️ Holiday Break-in Warning' : '🔒 Holiday Break-in Risk'}
                    </p>
                    <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{sentence}</p>
                    <p className="text-xs text-slate-500 mt-2.5 bg-white/60 rounded-lg px-3 py-2 border border-slate-200/60">
                        💡 <span className="font-medium">What you can do:</span> {risk.tip}
                    </p>
                </div>
            </div>
        </div>
    )
}

/* ══════════════════════════════════════════════════════════════════════
 * SAFETY TIPS
 * ══════════════════════════════════════════════════════════════════════ */
function SafetyTips({ tips }) {
    if (!tips?.length) return null

    const typeConfig = {
        positive: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
        warning: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
        info: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
    }

    return (
        <div className="grid gap-2.5">
            {tips.map((tip, i) => {
                const c = typeConfig[tip.type] || typeConfig.info
                return (
                    <div key={i} className={`${c.bg} border ${c.border} rounded-xl px-4 py-3 flex items-start gap-3`}>
                        <span className="text-base flex-shrink-0">{tip.icon}</span>
                        <p className={`text-sm ${c.text} font-medium`}>{tip.text}</p>
                    </div>
                )
            })}
        </div>
    )
}

/* ══════════════════════════════════════════════════════════════════════
 * SKELETON
 * ══════════════════════════════════════════════════════════════════════ */
function PageSkeleton() {
    return (
        <div className="space-y-6 animate-pulse">
            <div className="h-40 bg-slate-100 rounded-2xl" />
            <div className="h-64 bg-slate-100 rounded-2xl" />
            <div className="h-48 bg-slate-100 rounded-2xl" />
            <div className="h-32 bg-slate-100 rounded-2xl" />
        </div>
    )
}

/* ══════════════════════════════════════════════════════════════════════
 * MAIN PAGE
 * ══════════════════════════════════════════════════════════════════════ */
export default function SafetyDetail() {
    const { postcode } = useParams()
    const navigate = useNavigate()
    const decodedPostcode = decodeURIComponent(postcode || '')

    const [intel, setIntel] = useState(null)
    const [rankings, setRankings] = useState(null)
    const [safetyScore, setSafetyScore] = useState(null)
    const [coords, setCoords] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (!decodedPostcode) return

        setLoading(true)
        setError(null)

        // Fetch all data in parallel
        Promise.all([
            getSafetyIntelligence(decodedPostcode).catch(() => null),
            getSafetyRankings().catch(() => null),
            api.get('/api/scores/safety', { params: { postcode: decodedPostcode } }).then(r => r.data).catch(() => null),
            api.get('/api/properties', { params: { postcode: decodedPostcode, radius: 250 } }).then(r => {
                const props = r.data?.results || r.data || []
                if (props.length > 0 && props[0].lat && props[0].lng) {
                    return { lat: props[0].lat, lng: props[0].lng }
                }
                return null
            }).catch(() => null),
        ]).then(([intelData, rankData, scoreData, coordData]) => {
            setIntel(intelData)
            setRankings(rankData)
            setSafetyScore(scoreData?.score ?? null)
            setCoords(coordData)

            if (!intelData) setError('No safety data available for this area.')
        }).finally(() => setLoading(false))
    }, [decodedPostcode])

    // Extract sector for ranking highlight
    const sector = intel?.postcode_sector || ''

    // Star rating from comparison
    const diff = intel?.compared_to_average?.difference_percent ?? 0
    let overallStars = 3
    if (diff <= -60) overallStars = 5
    else if (diff <= -30) overallStars = 4
    else if (diff <= 10) overallStars = 3
    else if (diff <= 50) overallStars = 2
    else overallStars = 1

    const starLabels = { 5: 'Very Safe Area', 4: 'Safer Than Most', 3: 'Average Safety', 2: 'Below Average', 1: 'Higher Crime Area' }
    const starColors = { 5: 'text-emerald-500', 4: 'text-emerald-400', 3: 'text-amber-400', 2: 'text-orange-400', 1: 'text-red-400' }

    return (
        <div className="min-h-screen bg-[#f8f9fc]">
            <Navbar />

            <div className="max-w-3xl mx-auto px-4 pt-4 pb-20">
                {/* ── Back navigation ──────────────────────────────── */}
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 transition-colors mb-4 group"
                >
                    <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                    Back to property
                </button>

                {loading ? (
                    <PageSkeleton />
                ) : error ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-8 text-center">
                        <AlertCircle size={48} className="text-slate-300 mx-auto mb-4" />
                        <h2 className="text-lg font-bold text-slate-700 mb-2">No Data Available</h2>
                        <p className="text-sm text-slate-500">{error}</p>
                        <button onClick={() => navigate(-1)} className="mt-4 text-sm text-indigo-600 font-medium hover:text-indigo-700">
                            ← Go back
                        </button>
                    </div>
                ) : (
                    <div className="space-y-5">
                        {/* ── 1. HERO ──────────────────────────────────── */}
                        <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 rounded-2xl p-6 text-white shadow-lg shadow-indigo-200/50">
                            <div className="flex items-center gap-2 text-indigo-200 text-xs font-medium mb-3">
                                <Shield size={14} />
                                SAFETY REPORT
                            </div>
                            <h1 className="text-2xl font-black mb-1">
                                {sector || decodedPostcode}
                            </h1>
                            <p className="text-indigo-200 text-sm mb-5">
                                Full crime analysis for this postcode sector • Based on police.uk data
                            </p>

                            <div className="flex flex-col sm:flex-row items-center gap-5">
                                {safetyScore != null && (
                                    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 flex-shrink-0">
                                        <ScoreGauge score={safetyScore} size="lg" showLabel label="Safety" />
                                    </div>
                                )}
                                <div className="flex-1 text-center sm:text-left">
                                    <div className="flex items-center gap-1 justify-center sm:justify-start mb-2">
                                        {[1, 2, 3, 4, 5].map((n) => (
                                            <Star key={n} size={20} className={n <= overallStars ? 'text-amber-300' : 'text-white/20'} fill={n <= overallStars ? 'currentColor' : 'none'} />
                                        ))}
                                    </div>
                                    <p className="text-lg font-bold">{starLabels[overallStars]}</p>
                                    <p className="text-sm text-indigo-200 mt-1">
                                        {intel?.compared_to_average?.sector_total || 0} crimes reported in 12 months
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* ── 2. CRIME BREAKDOWN ────────────────────────── */}
                        {intel?.crime_breakdown?.length > 0 && (
                            <Section icon={Shield} title="What type of crime happens here?" subtitle="Breakdown of all reported crimes in the last 12 months">
                                <CrimeDonut breakdown={intel.crime_breakdown} />
                            </Section>
                        )}

                        {/* ── 3. MONTHLY TREND ─────────────────────────── */}
                        {intel?.crime_trend && (
                            <Section icon={TrendingUp} title="Crime trend over time" subtitle="Monthly crime count — is it getting better or worse?">
                                <MonthlyChart data={intel.crime_trend.monthly_data} trend={intel.crime_trend} />
                            </Section>
                        )}

                        {/* ── 4. GUILDFORD COMPARISON ──────────────────── */}
                        <Section icon={MapPin} title="How does this compare to the rest of Guildford?" subtitle="This area vs the Guildford average">
                            <GuildfordComparison comparison={intel?.compared_to_average} />
                        </Section>

                        {/* ── 5. AREA RANKINGS ─────────────────────────── */}
                        <Section icon={Award} title="Area rankings in Guildford" subtitle="Top 5 safest areas and top 5 crime hotspots">
                            <AreaRankings rankings={rankings} currentSector={sector} />
                        </Section>

                        {/* ── 6. TRAIN STATIONS ────────────────────────── */}
                        {coords && (
                            <Section icon={Train} title="Nearest train stations" subtitle="Walking distance from this area">
                                <TrainStations lat={coords.lat} lng={coords.lng} />
                            </Section>
                        )}

                        {/* ── 7. STUDENT SAFETY ────────────────────────── */}
                        <Section icon={GraduationCap} title="Is this area good for students?" subtitle="Safety analysis focused on student-relevant crime">
                            <StudentSafety data={intel?.student_vulnerability} />
                        </Section>

                        {/* ── 8. HOLIDAY RISK ──────────────────────────── */}
                        {intel?.holiday_burglary_risk && intel.holiday_burglary_risk.risk_level !== 'low' && (
                            <Section icon={Home} title="Holiday break-in risk" subtitle="What happens when students go home for holidays?">
                                <HolidayAlert risk={intel.holiday_burglary_risk} />
                            </Section>
                        )}

                        {/* ── 9. SAFETY TIPS ───────────────────────────── */}
                        {intel?.safety_tips?.length > 0 && (
                            <Section icon={Lightbulb} title="What we know about this area" subtitle="Data-driven tips based on actual crime patterns">
                                <SafetyTips tips={intel.safety_tips} />
                            </Section>
                        )}

                        {/* ── Data source ────────────────────────────── */}
                        <div className="text-center text-xs text-slate-400 pt-4 pb-8">
                            <p>Data source: <span className="font-medium">police.uk</span> • Updated monthly • Covers postcode sector <span className="font-medium">{sector}</span></p>
                            <p className="mt-1">Crime data reflects the whole postcode sector, not an individual street or building.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
