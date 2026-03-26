/**
 * StudentSafety, Student-focused safety summary aligned to the backend response.
 */
import { AlertTriangle, CheckCircle2, GraduationCap, Star } from 'lucide-react'

function getStudentVerdict(score) {
    if (score >= 85) {
        return {
            stars: 5,
            tone: 'emerald',
            badge: 'Looking good',
            verdict: 'One of the calmest areas for students',
            detail: 'Very little student-relevant crime shows up here. Walking home at night, shared housing, and day-to-day routines all look calm.',
        }
    }
    if (score >= 70) {
        return {
            stars: 4,
            tone: 'emerald',
            badge: 'Positive',
            verdict: 'Generally safe for students',
            detail: 'Normal precautions apply, but the student-weighted risk profile here is better than most Guildford areas.',
        }
    }
    if (score >= 50) {
        return {
            stars: 3,
            tone: 'amber',
            badge: 'Check the details',
            verdict: 'Fine for most, but worth checking',
            detail: 'This works for most students, but burglary, theft, or night-time activity here is worth looking into before you sign.',
        }
    }
    if (score >= 30) {
        return {
            stars: 2,
            tone: 'orange',
            badge: 'Be cautious',
            verdict: 'This area needs more caution',
            detail: 'Student-relevant crime is elevated here. Check the locks, think about your routes home, and ask current tenants what it is actually like.',
        }
    }
    return {
        stars: 1,
        tone: 'rose',
        badge: 'Think carefully',
        verdict: 'This is a tougher area for students',
        detail: 'The profile here is less forgiving for students. Do extra homework before committing, talk to people who already live nearby.',
    }
}

const toneStyles = {
    emerald: {
        shell: 'border-emerald-200 bg-emerald-50',
        text: 'text-emerald-900',
        badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        accent: 'text-emerald-500',
    },
    amber: {
        shell: 'border-amber-200 bg-amber-50',
        text: 'text-amber-900',
        badge: 'bg-amber-100 text-amber-800 border-amber-200',
        accent: 'text-amber-500',
    },
    orange: {
        shell: 'border-orange-200 bg-orange-50',
        text: 'text-orange-900',
        badge: 'bg-orange-100 text-orange-800 border-orange-200',
        accent: 'text-orange-500',
    },
    rose: {
        shell: 'border-rose-200 bg-rose-50',
        text: 'text-rose-900',
        badge: 'bg-rose-100 text-rose-800 border-rose-200',
        accent: 'text-rose-500',
    },
}

export default function StudentSafety({ data }) {
    if (!data || data.student_score == null) {
        return <p className="text-sm text-slate-400">No student safety data available for this area.</p>
    }

    const verdict = getStudentVerdict(data.student_score)
    const colors = toneStyles[verdict.tone]
    const scoreDifference = typeof data.score_difference === 'number' ? data.score_difference : null
    const impacts = data.impacts?.slice(0, 4) || []

    return (
        <div className="space-y-4">
            <div className={`rounded-2xl border p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] ${colors.shell}`}>
                <div className="flex items-center justify-between gap-3">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${colors.badge}`}>
                        {verdict.badge}
                    </span>
                    <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                                key={star}
                                size={14}
                                className={star <= verdict.stars ? colors.accent : 'text-slate-200'}
                                fill={star <= verdict.stars ? 'currentColor' : 'none'}
                            />
                        ))}
                    </div>
                </div>

                <div className="mt-4 flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/70">
                        <GraduationCap size={19} className={colors.accent} />
                    </div>
                    <div className="min-w-0">
                        <p className={`text-base font-black ${colors.text}`}>{verdict.verdict}</p>
                        <p className="mt-1 text-sm leading-relaxed text-slate-700">{verdict.detail}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 p-4 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Student safety score</p>
                    <p className="mt-1 text-2xl font-black text-slate-900">{data.student_score}</p>
                    <p className="mt-1 text-xs text-slate-500">/100</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">General area score</p>
                    <p className="mt-1 text-2xl font-black text-slate-900">{data.general_score ?? 'N/A'}</p>
                    <p className="mt-1 text-xs text-slate-500">same area, wider lens</p>
                </div>
            </div>

            {scoreDifference != null && (
                <div className={`flex items-start gap-2 rounded-xl border px-4 py-3 ${scoreDifference >= 0 ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                    {scoreDifference >= 0 ? (
                        <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0 text-emerald-600" />
                    ) : (
                        <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-amber-600" />
                    )}
                    <p className={`text-sm font-medium leading-relaxed ${scoreDifference >= 0 ? 'text-emerald-800' : 'text-amber-900'}`}>
                        {scoreDifference >= 0
                            ? `Looks ${Math.abs(scoreDifference).toFixed(1)} points safer for students than the general score suggests.`
                            : `Looks ${Math.abs(scoreDifference).toFixed(1)} points more concerning for students than the general score suggests.`}
                    </p>
                </div>
            )}

            {impacts.length > 0 && (
                <div>
                    <h4 className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">The things that matter most for students</h4>
                    <div className="space-y-2">
                        {impacts.map((impact) => (
                            <div key={impact.category} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                                {impact.student_relevance === 'high' ? (
                                    <AlertTriangle size={15} className="mt-0.5 flex-shrink-0 text-amber-500" />
                                ) : (
                                    <CheckCircle2 size={15} className="mt-0.5 flex-shrink-0 text-emerald-500" />
                                )}
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-800">{impact.label}</p>
                                    <p className="mt-0.5 text-xs text-slate-500">
                                        {impact.count} recent incidents.{' '}
                                        {impact.student_relevance === 'high'
                                            ? 'Worth paying extra attention to, this affects student life more than most.'
                                            : impact.student_relevance === 'low'
                                                ? 'Less of a concern for students than the general score might suggest.'
                                                : 'Affects students and the wider local area in a similar way.'}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
