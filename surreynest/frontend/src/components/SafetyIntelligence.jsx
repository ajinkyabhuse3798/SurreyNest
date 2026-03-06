/**
 * SafetyIntelligence v2 — plain-English crime analytics.
 *
 * Every metric is explained so a 15-year-old can understand it.
 * No percentiles, no indices, no jargon. Just stories and stars.
 *
 * @param {{ postcode: string, lat?: number, lng?: number }} props
 */
import { useState, useEffect } from 'react'
import {
    TrendingDown, TrendingUp, Minus, ShieldAlert,
    Lock, AlertTriangle, Volume2, Car, ShoppingBag,
    AlertOctagon, Pill, Users, Lightbulb, GraduationCap,
    Home, ChevronDown, Train, Star,
} from 'lucide-react'
import { getSafetyIntelligence } from '../services/safetyApi'

/* ── Category meta ───────────────────────────────────────────────────────── */
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

/* ── Train stations ──────────────────────────────────────────────────────── */
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

/* ══════════════════════════════════════════════════════════════════════════
 * DONUT CHART — with total centre + friendly sentence
 * ══════════════════════════════════════════════════════════════════════════ */
function CrimeDonut({ breakdown }) {
    const total = breakdown.reduce((s, b) => s + b.count, 0)
    if (!total) return null

    const size = 130, stroke = 24, r = (size - stroke) / 2, circ = 2 * Math.PI * r
    let offset = 0

    // Plain English summary
    const perMonth = (total / 12).toFixed(1)
    const summaryText = total <= 3
        ? `Only ${total} crime${total === 1 ? '' : 's'} reported in the whole year — almost nothing!`
        : total <= 10
            ? `About ${perMonth} crimes per month — that's fairly quiet.`
            : total <= 30
                ? `Around ${perMonth} crimes per month — about average for Guildford.`
                : `About ${perMonth} crimes per month — busier than most areas.`

    return (
        <div className="bg-white rounded-xl border border-slate-200/60 p-4">
            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                What type of crime happens here?
            </h3>
            <p className="text-sm text-slate-500 mb-4">{summaryText}</p>

            <div className="flex flex-col sm:flex-row items-center gap-5">
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
                        <span className="text-2xl font-black text-slate-800">{total}</span>
                        <span className="text-[10px] text-slate-400">per year</span>
                    </div>
                </div>

                {/* Legend with plain names */}
                <div className="grid grid-cols-1 gap-2 flex-1">
                    {breakdown.map((b) => {
                        const meta = CAT_META[b.category] || { name: b.category, color: '#94a3b8' }
                        return (
                            <div key={b.category} className="flex items-center gap-2 text-sm">
                                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: meta.color }} />
                                <span className="text-slate-600">{meta.name}</span>
                                <span className="ml-auto font-bold text-slate-800">{b.count}</span>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

/* ══════════════════════════════════════════════════════════════════════════
 * MONTHLY CHART — with actual numbers on each bar
 * ══════════════════════════════════════════════════════════════════════════ */
function MonthlyChart({ data, trend }) {
    if (!data?.length) return null

    const max = Math.max(...data.map(d => d.count), 1)
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    // Get month name from date string
    const getMonth = (dateStr) => {
        try {
            const month = parseInt(dateStr.split('-')[1], 10)
            return monthNames[month - 1] || ''
        } catch { return '' }
    }

    // Trend config
    const trendConfig = {
        improving: { emoji: '📉', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
        worsening: { emoji: '📈', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
        stable: { emoji: '➡️', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
    }
    const tc = trendConfig[trend?.direction] || trendConfig.stable

    // Plain English trend WITH specific percentage
    const pct = Math.abs(Math.round(trend?.change_percent || 0))
    let trendSentence = ''
    if (trend?.direction === 'improving') {
        trendSentence = `Good news! Crime has gone down by about ${pct}% compared to earlier in the year.`
    } else if (trend?.direction === 'worsening') {
        trendSentence = `Heads up — crime has gone up by about ${pct}% compared to earlier in the year.`
    } else {
        trendSentence = 'Crime has been about the same every month — no big changes.'
    }

    // Bar heights: use fixed pixel max so proportions are clear
    const BAR_AREA_PX = 70 // max bar height in pixels

    return (
        <div className="space-y-3">
            {/* Trend sentence */}
            <div className={`${tc.bg} border ${tc.border} rounded-xl px-4 py-3 flex items-start gap-3`}>
                <span className="text-lg">{tc.emoji}</span>
                <div>
                    <p className={`text-sm font-bold ${tc.text}`}>{trendSentence}</p>
                </div>
            </div>

            {/* Bar chart with numbers */}
            <div className="bg-white rounded-xl border border-slate-200/60 p-4">
                <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Crimes each month
                </h3>
                <p className="text-xs text-slate-400 mb-3">Each bar shows how many crimes were reported that month</p>

                <div className="flex items-end gap-1.5">
                    {data.map((d, i) => {
                        // Pixel-based bar height: proportional to value
                        const barPx = d.count > 0 ? Math.max(8, Math.round((d.count / max) * BAR_AREA_PX)) : 2
                        return (
                            <div key={i} className="flex-1 flex flex-col items-center">
                                {/* Number above bar */}
                                <span className="text-[10px] font-bold text-slate-600 mb-0.5">{d.count}</span>
                                {/* Bar — fixed pixel height */}
                                <div
                                    className={`w-full rounded-t-sm transition-all duration-500 ${d.count > 0 ? 'bg-indigo-400' : 'bg-slate-200'}`}
                                    style={{ height: `${barPx}px`, transitionDelay: `${i * 50}ms` }}
                                />
                                {/* Month label */}
                                <span className="text-[8px] text-slate-400 mt-1">{getMonth(d.month)}</span>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

/* ══════════════════════════════════════════════════════════════════════════
 * GUILDFORD COMPARISON — 5-dot safety rating + plain sentence
 * ══════════════════════════════════════════════════════════════════════════ */
function SafetyRating({ comparison }) {
    if (!comparison) return null

    const diff = comparison.difference_percent
    const sectorTotal = comparison.sector_total
    const avgTotal = comparison.guildford_average

    // 5-dot rating: 5 = much safer than average, 1 = much more crime
    let dots = 3 // average
    if (diff <= -60) dots = 5
    else if (diff <= -30) dots = 4
    else if (diff <= 10) dots = 3
    else if (diff <= 50) dots = 2
    else dots = 1

    // Plain English sentence
    let sentence = ''
    if (dots === 5) sentence = `This is one of the safest areas in Guildford. Only ${sectorTotal} crime${sectorTotal === 1 ? '' : 's'} were reported here last year — most areas had around ${Math.round(avgTotal)}.`
    else if (dots === 4) sentence = `This area is safer than most of Guildford. It had ${sectorTotal} crimes last year, while the average area had ${Math.round(avgTotal)}.`
    else if (dots === 3) sentence = `This area is about average for Guildford — not the safest, not the worst. It had ${sectorTotal} crimes last year, similar to the average of ${Math.round(avgTotal)}.`
    else if (dots === 2) sentence = `This area has more crime than most of Guildford. It had ${sectorTotal} crimes last year, while the average area had ${Math.round(avgTotal)}.`
    else sentence = `This is a higher-crime area. It had ${sectorTotal} crimes last year — much more than the Guildford average of ${Math.round(avgTotal)}.`

    const dotColors = {
        5: 'text-emerald-500',
        4: 'text-emerald-400',
        3: 'text-amber-400',
        2: 'text-orange-400',
        1: 'text-red-400',
    }

    return (
        <div className="bg-gradient-to-br from-slate-50 to-slate-100/60 rounded-xl p-4 border border-slate-200/60">
            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                How does this compare to the rest of Guildford?
            </h3>

            {/* 5-dot rating */}
            <div className="flex items-center gap-1.5 mb-3">
                {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                        key={n}
                        size={22}
                        className={`transition-all ${n <= dots ? dotColors[dots] : 'text-slate-200'}`}
                        fill={n <= dots ? 'currentColor' : 'none'}
                    />
                ))}
                <span className="text-sm font-bold text-slate-700 ml-2">
                    {dots === 5 ? 'Very safe' : dots === 4 ? 'Safer than most' : dots === 3 ? 'Average' : dots === 2 ? 'Below average' : 'Higher crime'}
                </span>
            </div>

            {/* Plain sentence */}
            <p className="text-sm text-slate-600 leading-relaxed">{sentence}</p>
        </div>
    )
}

/* ══════════════════════════════════════════════════════════════════════════
 * HOLIDAY BURGLARY ALERT — already clear, just polish
 * ══════════════════════════════════════════════════════════════════════════ */
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

/* ══════════════════════════════════════════════════════════════════════════
 * STUDENT SAFETY — emoji rating + one plain sentence, NO numbers
 * ══════════════════════════════════════════════════════════════════════════ */
function StudentSafety({ data }) {
    if (!data || data.student_score == null) return null

    const score = data.student_score

    // Convert to 5-star + emoji + plain sentence
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
        <div className="bg-gradient-to-br from-indigo-50 to-violet-50/60 rounded-xl p-4 border border-indigo-200/60">
            <div className="flex items-center gap-2 mb-3">
                <GraduationCap size={16} className="text-indigo-600" />
                <span className="text-xs font-bold text-indigo-800 uppercase tracking-wider">Is this area good for students?</span>
            </div>

            {/* Emoji + verdict */}
            <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{emoji}</span>
                <div>
                    <p className="text-base font-bold text-slate-800">{verdict}</p>
                    <div className="flex items-center gap-0.5 mt-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                            <Star key={n} size={14} className={n <= stars ? starColor : 'text-slate-200'} fill={n <= stars ? 'currentColor' : 'none'} />
                        ))}
                    </div>
                </div>
            </div>

            {/* Plain detail */}
            <p className="text-sm text-slate-600 leading-relaxed">{detail}</p>

            {/* Category tags with plain labels */}
            {data.impacts?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-indigo-200/40">
                    <p className="text-[10px] text-slate-500 mb-1.5">What matters for students specifically:</p>
                    <div className="flex flex-wrap gap-1.5">
                        {data.impacts.slice(0, 4).map((imp) => (
                            <span
                                key={imp.category}
                                className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${imp.student_relevance === 'high'
                                    ? 'bg-red-100 text-red-700'
                                    : imp.student_relevance === 'low'
                                        ? 'bg-emerald-100 text-emerald-700'
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

/* ══════════════════════════════════════════════════════════════════════════
 * TRAIN STATION PROXIMITY
 * ══════════════════════════════════════════════════════════════════════════ */
function TrainStations({ lat, lng }) {
    if (!lat || !lng) return null

    const stations = TRAIN_STATIONS.map((s) => ({
        ...s,
        distance: haversineKm(lat, lng, s.lat, s.lng),
    })).sort((a, b) => a.distance - b.distance)

    return (
        <div className="bg-white rounded-xl border border-slate-200/60 p-4">
            <div className="flex items-center gap-2 mb-3">
                <Train size={16} className="text-indigo-600" />
                <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Nearest Train Stations</h3>
            </div>
            <div className="space-y-3">
                {stations.map((s) => {
                    const walkMin = Math.round(s.distance / 5 * 60) // ~5 km/h walking
                    return (
                        <div key={s.name} className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                <Train size={14} className="text-indigo-600" />
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
        </div>
    )
}

/* ══════════════════════════════════════════════════════════════════════════
 * SAFETY TIPS — already clear, keep as-is
 * ══════════════════════════════════════════════════════════════════════════ */
function SafetyTips({ tips }) {
    if (!tips?.length) return null

    const typeConfig = {
        positive: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
        warning: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
        info: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
    }

    return (
        <div className="space-y-2">
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <Lightbulb size={13} className="text-amber-500" />
                What we know about this area
            </p>
            <div className="grid gap-2">
                {tips.map((tip, i) => {
                    const c = typeConfig[tip.type] || typeConfig.info
                    return (
                        <div key={i} className={`${c.bg} border ${c.border} rounded-lg px-3 py-2 flex items-start gap-2`}>
                            <span className="text-sm flex-shrink-0">{tip.icon}</span>
                            <p className={`text-xs ${c.text} font-medium`}>{tip.text}</p>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

/* ══════════════════════════════════════════════════════════════════════════
 * MAIN COMPONENT
 * ══════════════════════════════════════════════════════════════════════════ */
export default function SafetyIntelligence({ postcode, lat, lng }) {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [expanded, setExpanded] = useState(false)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (!postcode) return
        setLoading(true)
        setError(null)
        getSafetyIntelligence(postcode)
            .then(setData)
            .catch((err) => {
                console.warn('Safety intelligence fetch failed:', err)
                setError('Could not load safety data')
            })
            .finally(() => setLoading(false))
    }, [postcode])

    if (loading) {
        return (
            <div className="space-y-3 animate-pulse">
                <div className="h-32 bg-slate-100 rounded-xl" />
                <div className="h-16 bg-slate-100 rounded-xl" />
                <div className="h-24 bg-slate-100 rounded-xl" />
            </div>
        )
    }

    if (error || !data) return null

    const { crime_breakdown, crime_trend, compared_to_average, holiday_burglary_risk, student_vulnerability, safety_tips } = data

    return (
        <div className="space-y-4">
            {/* ── Donut Chart + Plain Summary ───────────────────────────── */}
            {crime_breakdown?.length > 0 && (
                <CrimeDonut breakdown={crime_breakdown} />
            )}

            {/* ── Monthly Chart (with numbers!) + Trend ─────────────────── */}
            {crime_trend && (
                <MonthlyChart data={crime_trend.monthly_data} trend={crime_trend} />
            )}

            {/* ── Star Rating vs Guildford ───────────────────────────────── */}
            <SafetyRating comparison={compared_to_average} />

            {/* ── Train Stations ─────────────────────────────────────────── */}
            <TrainStations lat={lat} lng={lng} />

            {/* ── Expandable: Student-specific insights ──────────────────── */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between bg-indigo-50/60 hover:bg-indigo-50 rounded-xl px-4 py-3.5 border border-indigo-200/60 transition-colors"
            >
                <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1.5">
                    <GraduationCap size={14} className="text-indigo-500" />
                    Is this area good for students?
                </span>
                <ChevronDown size={16} className={`text-indigo-400 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
            </button>

            {expanded && (
                <div className="space-y-4">
                    {/* Holiday burglary risk */}
                    <HolidayAlert risk={holiday_burglary_risk} />

                    {/* Student safety */}
                    <StudentSafety data={student_vulnerability} />

                    {/* Tips */}
                    <SafetyTips tips={safety_tips} />
                </div>
            )}
        </div>
    )
}
