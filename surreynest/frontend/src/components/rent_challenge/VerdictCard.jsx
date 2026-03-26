/**
 * VerdictCard, colour-coded verdict display for rent challenge results.
 *
 * @param {{ result: object }} props
 */

const VERDICT_CONFIG = {
    FAIR: {
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        text: 'text-emerald-800',
        badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        label: 'Fair',
    },
    BORDERLINE: {
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        text: 'text-amber-800',
        badge: 'bg-amber-100 text-amber-700 border-amber-200',
        label: 'Borderline',
    },
    ABOVE_MARKET: {
        bg: 'bg-orange-50',
        border: 'border-orange-200',
        text: 'text-orange-800',
        badge: 'bg-orange-100 text-orange-700 border-orange-200',
        label: 'Above Market',
    },
    SIGNIFICANTLY_ABOVE_MARKET: {
        bg: 'bg-rose-50',
        border: 'border-rose-200',
        text: 'text-rose-800',
        badge: 'bg-rose-100 text-rose-700 border-rose-200',
        label: 'Significantly Above Market',
    },
}

const STRENGTH_LABEL = {
    STRONG: 'Strong grounds to challenge',
    MODERATE: 'Moderate grounds to challenge',
    WEAK: 'Weak grounds to challenge',
    NOT_RECOMMENDED: 'Challenge not recommended',
}

export default function VerdictCard({ result }) {
    const config = VERDICT_CONFIG[result.verdict] || VERDICT_CONFIG.FAIR
    const fmtDate = (value) => (
        value
            ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
            : null
    )

    const noticeLabel = result.minimum_notice_ok == null
        ? 'Add notice dates to check this'
        : result.minimum_notice_ok
            ? 'Looks valid'
            : 'Needs a second look'

    const annualLabel = result.annual_limit_ok == null
        ? 'Add the last increase date to check this'
        : result.annual_limit_ok
            ? 'Looks valid'
            : 'Looks too soon'

    return (
        <div className={`rounded-2xl border ${config.bg} ${config.border} p-6 space-y-4`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">
                        Verdict
                    </p>
                    <h2 className={`text-2xl font-extrabold ${config.text}`}>
                        {config.label}
                    </h2>
                    <p className={`text-sm mt-1 ${config.text} opacity-80`}>
                        {result.verdict_detail}
                    </p>
                </div>
                <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold border ${config.badge} self-start sm:self-center`}>
                    {STRENGTH_LABEL[result.challenge_strength]}
                </span>
            </div>

            {/* Rent figures */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-current/10">
                <div>
                    <p className="text-xs text-slate-500">Current rent</p>
                    <p className="font-extrabold text-slate-900">£{result.current_weekly_rent}/wk</p>
                </div>
                <div>
                    <p className="text-xs text-slate-500">Proposed rent</p>
                    <p className="font-extrabold text-slate-900">£{result.proposed_weekly_rent}/wk</p>
                </div>
                <div>
                    <p className="text-xs text-slate-500">ML market estimate</p>
                    <p className="font-extrabold text-slate-900">£{result.ml_predicted_rent}/wk</p>
                </div>
                <div>
                    <p className="text-xs text-slate-500">Above market</p>
                    <p className={`font-extrabold ${result.is_above_market ? config.text : 'text-emerald-700'}`}>
                        {result.market_excess_pct.toFixed(1)}%
                    </p>
                </div>
            </div>

            <div className="grid gap-3 pt-2 border-t border-current/10 md:grid-cols-2">
                <div className="rounded-xl bg-white/70 border border-white/80 p-4 space-y-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                        Legal timing
                    </p>
                    <p className="text-sm text-slate-700 leading-relaxed">
                        {result.legal_summary}
                    </p>
                    {result.apply_before_date && (
                        <p className="text-sm font-semibold text-slate-900">
                            If you challenge it, apply before {fmtDate(result.apply_before_date)}.
                        </p>
                    )}
                </div>

                <div className="rounded-xl bg-white/70 border border-white/80 p-4 space-y-3">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                        Quick checks
                    </p>
                    <div>
                        <p className="text-sm font-semibold text-slate-900">2-month notice: {noticeLabel}</p>
                        <p className="text-xs text-slate-500 mt-1">
                            {result.minimum_notice_detail || 'We can check this once you add the notice and start dates.'}
                        </p>
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-slate-900">Once a year: {annualLabel}</p>
                        <p className="text-xs text-slate-500 mt-1">
                            {result.annual_limit_detail || 'We can check this once you add the previous increase date.'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
