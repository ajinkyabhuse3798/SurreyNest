/**
 * StudentSafety — Student-focused safety view with 4 life-scenario cards.
 * Shows what the crime data actually means for student life day-to-day.
 */
import { AlertTriangle, CheckCircle2, GraduationCap, Star, Moon, Home, Smartphone, Volume2, Bike } from 'lucide-react'

function getOverallVerdict(score) {
    if (score >= 85) return { stars: 5, tone: 'emerald', badge: 'Looking good', verdict: 'One of the calmest areas for students', detail: 'Very little student-relevant crime shows up here. Walking home, shared housing, and day-to-day routines all look calm.' }
    if (score >= 70) return { stars: 4, tone: 'emerald', badge: 'Positive', verdict: 'Generally safe for students', detail: 'Normal precautions apply, but the student-weighted risk here is better than most Guildford areas.' }
    if (score >= 50) return { stars: 3, tone: 'amber', badge: 'Check the details', verdict: 'Fine for most, but worth checking', detail: 'This works for most students, but burglary, theft, or night-time activity is worth looking into before you sign.' }
    if (score >= 30) return { stars: 2, tone: 'orange', badge: 'Be cautious', verdict: 'This area needs more caution', detail: 'Student-relevant crime is elevated here. Check the locks, think about your routes home, and ask current tenants what it\'s actually like.' }
    return { stars: 1, tone: 'rose', badge: 'Think carefully', verdict: 'This is a tougher area for students', detail: 'The profile here is less forgiving for students. Do extra homework before committing. Talk to people who already live nearby.' }
}

const toneShell = {
    emerald: 'border-emerald-200 bg-emerald-50',
    amber: 'border-amber-200 bg-amber-50',
    orange: 'border-orange-200 bg-orange-50',
    rose: 'border-rose-200 bg-rose-50',
}
const toneText = {
    emerald: 'text-emerald-900',
    amber: 'text-amber-900',
    orange: 'text-orange-900',
    rose: 'text-rose-900',
}
const toneBadge = {
    emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    amber: 'bg-amber-100 text-amber-800 border-amber-200',
    orange: 'bg-orange-100 text-orange-800 border-orange-200',
    rose: 'bg-rose-100 text-rose-800 border-rose-200',
}
const toneAccent = {
    emerald: 'text-emerald-500',
    amber: 'text-amber-500',
    orange: 'text-orange-500',
    rose: 'text-rose-500',
}

// Life scenarios mapped to crime categories
const SCENARIOS = [
    {
        key: 'night-walks',
        title: 'Walking home at night',
        Icon: Moon,
        categories: ['violent-crime', 'robbery'],
        goodText: 'Low risk for night walks',
        cautionText: 'Take care walking home at night',
        highText: 'Be extra careful after dark',
        description: 'Based on violent incidents and robberies, the types most likely to affect you walking home after a late evening.',
    },
    {
        key: 'shared-house',
        title: 'Your shared house',
        Icon: Home,
        categories: ['burglary'],
        goodText: 'Low break-in risk',
        cautionText: 'Worth checking door/window locks',
        highText: 'Ask your landlord about security',
        description: 'Burglary data. Student houses can be soft targets, especially when left empty during holidays.',
    },
    {
        key: 'belongings',
        title: 'Personal belongings',
        Icon: Smartphone,
        categories: ['theft-from-the-person'],
        goodText: 'Low personal theft recorded',
        cautionText: 'Keep valuables out of sight',
        highText: 'High personal theft. Stay alert.',
        description: 'Phone and wallet snatching in public. Relevant on the high street, near bars, or late at night.',
    },
    {
        key: 'noise',
        title: 'Noise and atmosphere',
        Icon: Volume2,
        categories: ['anti-social-behaviour', 'public-order'],
        goodText: 'Quiet area, good for studying',
        cautionText: 'Can be noisy on weekends',
        highText: 'Quite lively. Light sleepers take note.',
        description: 'Disturbances and rowdiness. More of a quality-of-life factor than a safety one.',
    },
    {
        key: 'bike',
        title: 'Your bike',
        Icon: Bike,
        categories: ['bicycle-theft'],
        goodText: 'Low bike theft recorded',
        cautionText: 'Always lock your bike well',
        highText: 'High bike theft. Use a D-lock.',
        description: 'Bicycle theft data. Many students cycle to campus. Check how safe it is to store your bike outside.',
    },
]

function ScenarioCard({ scenario, impacts }) {
    const { Icon } = scenario

    // Sum counts for relevant categories
    const total = scenario.categories.reduce((acc, cat) => {
        const found = impacts?.find((i) => i.category === cat)
        return acc + (found?.count ?? 0)
    }, 0)

    const monthlyAvg = total / 12
    const isHigh = monthlyAvg >= 5
    const isMedium = monthlyAvg >= 1.5 && !isHigh
    const isLow = !isHigh && !isMedium

    const statusText = isHigh
        ? scenario.highText
        : isMedium
            ? scenario.cautionText
            : scenario.goodText

    const statusColor = isHigh
        ? 'text-rose-700 bg-rose-50 border-rose-200'
        : isMedium
            ? 'text-amber-700 bg-amber-50 border-amber-200'
            : 'text-emerald-700 bg-emerald-50 border-emerald-200'

    const iconColor = isHigh
        ? 'text-rose-500 bg-rose-100'
        : isMedium
            ? 'text-amber-500 bg-amber-100'
            : 'text-emerald-500 bg-emerald-100'

    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconColor}`}>
                    <Icon size={16} />
                </div>
                <p className="text-sm font-bold text-slate-800">{scenario.title}</p>
            </div>

            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold mb-2 ${statusColor}`}>
                {isLow ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                {statusText}
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">{scenario.description}</p>

            {total > 0 && (
                <p className="mt-2 text-[11px] text-slate-400">
                    {total} incident{total !== 1 ? 's' : ''} in the past year (~{monthlyAvg.toFixed(1)}/month)
                </p>
            )}
        </div>
    )
}

export default function StudentSafety({ data }) {
    if (!data || data.student_score == null) {
        return <p className="text-sm text-slate-400">No student safety data available for this area.</p>
    }

    const verdict = getOverallVerdict(data.student_score)
    const shell = toneShell[verdict.tone] || toneShell.emerald
    const textColor = toneText[verdict.tone] || toneText.emerald
    const badge = toneBadge[verdict.tone] || toneBadge.emerald
    const accent = toneAccent[verdict.tone] || toneAccent.emerald
    const scoreDiff = typeof data.score_difference === 'number' ? data.score_difference : null

    return (
        <div className="space-y-5">
            {/* Overall verdict banner */}
            <div className={`rounded-2xl border p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] ${shell}`}>
                <div className="flex items-center justify-between gap-3 mb-4">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${badge}`}>
                        {verdict.badge}
                    </span>
                    <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                                key={star}
                                size={14}
                                className={star <= verdict.stars ? accent : 'text-slate-200'}
                                fill={star <= verdict.stars ? 'currentColor' : 'none'}
                            />
                        ))}
                    </div>
                </div>

                <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/70 flex-shrink-0">
                        <GraduationCap size={19} className={accent} />
                    </div>
                    <div className="min-w-0">
                        <p className={`text-base font-black ${textColor}`}>{verdict.verdict}</p>
                        <p className="mt-1 text-sm leading-relaxed text-slate-700">{verdict.detail}</p>
                    </div>
                </div>

                {/* Score comparison */}
                <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-white/70 p-3 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                            Student safety
                        </p>
                        <p className={`mt-1 text-2xl font-black ${accent}`}>{data.student_score}</p>
                        <p className="mt-0.5 text-[10px] text-slate-400">/100</p>
                    </div>
                    <div className="rounded-xl bg-white/70 p-3 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                            General score
                        </p>
                        <p className="mt-1 text-2xl font-black text-slate-700">
                            {data.general_score ?? 'N/A'}
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-400">same area, wider lens</p>
                    </div>
                </div>

                {scoreDiff != null && (
                    <div
                        className={`mt-3 flex items-start gap-2 rounded-xl border px-4 py-3 ${scoreDiff >= 0 ? 'border-emerald-200 bg-white/60' : 'border-amber-200 bg-white/60'}`}
                    >
                        {scoreDiff >= 0 ? (
                            <CheckCircle2 size={15} className="mt-0.5 flex-shrink-0 text-emerald-600" />
                        ) : (
                            <AlertTriangle size={15} className="mt-0.5 flex-shrink-0 text-amber-600" />
                        )}
                        <p
                            className={`text-xs font-medium leading-relaxed ${scoreDiff >= 0 ? 'text-emerald-800' : 'text-amber-900'}`}
                        >
                            {scoreDiff >= 0
                                ? `Looks ${Math.abs(scoreDiff).toFixed(1)} points safer for students than the general score suggests.`
                                : `Looks ${Math.abs(scoreDiff).toFixed(1)} points more concerning for students than the general score suggests.`}
                        </p>
                    </div>
                )}
            </div>

            {/* Life scenario cards */}
            <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400 mb-3">
                    What this means for your daily life
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {SCENARIOS.map((scenario) => (
                        <ScenarioCard key={scenario.key} scenario={scenario} impacts={data.impacts} />
                    ))}
                </div>
            </div>
        </div>
    )
}
