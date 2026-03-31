/**
 * VerdictCard — "Is this area right for you?" top-level decision card.
 * Full-width, placed prominently below the city-overview strip.
 * Answers the most important question before anything else.
 */
import { Shield, CheckCircle2, AlertTriangle, AlertOctagon } from 'lucide-react'

function getVerdict(safetyScore, diffPct) {
    if (safetyScore >= 75 || diffPct <= -30) {
        return {
            tone: 'emerald',
            headline: 'One of the calmer areas in Guildford',
            subline:
                'The data shows fewer incidents here than most nearby areas. A solid choice for students who want a quieter place to live.',
            Icon: Shield,
        }
    }
    if (diffPct <= 10) {
        return {
            tone: 'emerald',
            headline: 'This area looks fine for most students',
            subline:
                "Crime levels here are broadly in line with — or below — the Guildford average. No unusual patterns stand out in the data.",
            Icon: CheckCircle2,
        }
    }
    if (diffPct <= 50) {
        return {
            tone: 'amber',
            headline: 'This area is a bit busier than average',
            subline:
                "Incidents here run above the typical Guildford area. That doesn't make it unsafe, but it's worth reading the full breakdown carefully before you sign anything.",
            Icon: AlertTriangle,
        }
    }
    return {
        tone: 'rose',
        headline: 'This area comes up more in the data',
        subline:
            'Incidents here are significantly above the Guildford average. Read the full breakdown and talk to people who already live nearby before deciding.',
        Icon: AlertOctagon,
    }
}

const TONE = {
    emerald: {
        outer: 'bg-orange-50 border-orange-200',
        iconBg: 'bg-orange-100',
        iconColor: 'text-orange-600',
        headline: 'text-orange-900',
        badge: 'bg-orange-100 text-orange-700 border border-orange-200',
        statAccent: 'text-orange-700',
    },
    amber: {
        outer: 'bg-amber-50 border-amber-200',
        iconBg: 'bg-amber-100',
        iconColor: 'text-amber-600',
        headline: 'text-amber-900',
        badge: 'bg-amber-100 text-amber-700 border border-amber-200',
        statAccent: 'text-amber-700',
    },
    rose: {
        outer: 'bg-rose-50 border-rose-200',
        iconBg: 'bg-rose-100',
        iconColor: 'text-rose-600',
        headline: 'text-rose-900',
        badge: 'bg-rose-100 text-rose-700 border border-rose-200',
        statAccent: 'text-rose-600',
    },
}

export default function VerdictCard({ comparison, safetyScore, studentVulnerability }) {
    if (!comparison) return null

    const diffPct = comparison.difference_percent ?? 0
    const percentile = comparison.percentile ?? 50
    const verdict = getVerdict(safetyScore ?? 50, diffPct)
    const config = TONE[verdict.tone] || TONE.emerald
    const { Icon } = verdict

    const diffAbs = Math.abs(Math.round(diffPct))
    const diffValue =
        diffPct < 0
            ? `${diffAbs}% less`
            : diffPct > 0
                ? `${diffAbs}% more`
                : 'Average'
    const diffSub =
        diffPct < 0
            ? 'crime than Guildford average'
            : diffPct > 0
                ? 'crime than Guildford average'
                : 'crime than Guildford average'

    const stats = [
        {
            key: 'incidents',
            value: comparison.sector_total != null ? String(comparison.sector_total) : '—',
            label: 'incidents last year',
            sub: `Guildford avg: ${Math.round(comparison.guildford_average ?? 0)}`,
        },
        {
            key: 'vs-avg',
            value: diffValue,
            label: diffSub,
            sub: 'compared to a typical Guildford area',
        },
        {
            key: 'student',
            value:
                studentVulnerability?.student_score != null
                    ? `${studentVulnerability.student_score}`
                    : '—',
            label: 'student safety score',
            sub: studentVulnerability?.label || '/100',
        },
    ]

    return (
        <div className={`rounded-2xl border p-5 sm:p-7 shadow-sm mb-6 ${config.outer}`}>
            <div className="flex items-start gap-4 sm:gap-5">
                <div
                    className={`hidden sm:flex w-12 h-12 rounded-2xl items-center justify-center flex-shrink-0 ${config.iconBg}`}
                >
                    <Icon size={22} className={config.iconColor} />
                </div>

                <div className="flex-1 min-w-0">
                    <div
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-[0.16em] mb-3 ${config.badge}`}
                    >
                        <Icon size={11} />
                        Area verdict
                    </div>

                    <h2 className={`text-xl sm:text-2xl font-black leading-snug ${config.headline}`}>
                        {verdict.headline}
                    </h2>

                    <p className="mt-2 text-sm leading-relaxed text-slate-600 max-w-2xl">
                        {verdict.subline}
                    </p>

                    <p className="mt-2 text-xs text-slate-400">
                        Quieter than {percentile}% of Guildford areas in our data &middot; Source: police.uk
                    </p>
                </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
                {stats.map(({ key, value, label, sub }) => (
                    <div
                        key={key}
                        className="rounded-xl bg-white/70 border border-white/60 px-3 py-4 text-center"
                    >
                        <p className={`text-xl sm:text-2xl font-black leading-none ${config.statAccent}`}>
                            {value}
                        </p>
                        <p className="mt-1.5 text-xs font-semibold text-slate-700">{label}</p>
                        <p className="mt-0.5 text-[10px] text-slate-400">{sub}</p>
                    </div>
                ))}
            </div>
        </div>
    )
}
