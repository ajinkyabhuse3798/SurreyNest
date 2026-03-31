/**
 * HolidayAlert — Holiday break-in risk card.
 * Always renders (even for low risk), so students always get useful information.
 * Shows a visual bar comparing holiday vs term-time burglary averages.
 */
import { AlertTriangle, CheckCircle2, Home } from 'lucide-react'

export default function HolidayAlert({ risk }) {
    // Always render — even with no data, show a reassuring message
    if (!risk) {
        return (
            <div className="flex items-start gap-3 rounded-2xl bg-slate-50 border border-slate-200 p-4">
                <CheckCircle2 size={18} className="text-slate-400 flex-shrink-0 mt-0.5" />
                <div>
                    <p className="text-sm font-bold text-slate-600">No holiday burglary data available</p>
                    <p className="text-xs text-slate-400 mt-1">
                        We don't have enough data to analyse holiday patterns for this area yet.
                    </p>
                </div>
            </div>
        )
    }

    const isHigh = risk.risk_level === 'high'
    const isMedium = risk.risk_level === 'moderate'
    const isLow = !isHigh && !isMedium

    const config = isHigh
        ? { shell: 'bg-rose-50 border-rose-200', icon: 'text-rose-600', title: 'text-rose-800', sub: 'text-rose-700', bar: 'bg-rose-500', iconBg: 'bg-rose-100' }
        : isMedium
            ? { shell: 'bg-amber-50 border-amber-200', icon: 'text-amber-600', title: 'text-amber-800', sub: 'text-amber-700', bar: 'bg-amber-500', iconBg: 'bg-amber-100' }
            : { shell: 'bg-emerald-50 border-emerald-200', icon: 'text-emerald-600', title: 'text-emerald-800', sub: 'text-emerald-700', bar: 'bg-emerald-400', iconBg: 'bg-emerald-100' }

    const headlineText = isHigh
        ? 'Higher break-in risk when students leave'
        : isMedium
            ? 'Some increase in break-ins during holidays'
            : 'No unusual break-in pattern during holidays'

    // Build bar chart values for holiday vs term
    const holidayAvg = risk.holiday_count > 0 && risk.holiday_months_found
        ? (risk.holiday_count / Math.max(risk.holiday_months_found ?? 6, 1)).toFixed(1)
        : (risk.holiday_count / 6).toFixed(1)
    const termAvg = risk.term_count > 0 && risk.term_months_found
        ? (risk.term_count / Math.max(risk.term_months_found ?? 6, 1)).toFixed(1)
        : (risk.term_count / 6).toFixed(1)

    const maxAvg = Math.max(parseFloat(holidayAvg), parseFloat(termAvg), 0.1)
    const holidayBarPct = Math.round((parseFloat(holidayAvg) / maxAvg) * 100)
    const termBarPct = Math.round((parseFloat(termAvg) / maxAvg) * 100)

    return (
        <div className={`rounded-2xl border p-5 ${config.shell}`}>
            {/* Header */}
            <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${config.iconBg}`}>
                    {isLow ? (
                        <CheckCircle2 size={17} className={config.icon} />
                    ) : (
                        <AlertTriangle size={17} className={config.icon} />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <p className={`text-sm font-black ${config.title}`}>{headlineText}</p>
                    {risk.spike_percent != null && !isLow && (
                        <p className={`text-xs mt-1 ${config.sub}`}>
                            Burglaries are ~{risk.spike_percent}% higher during holiday months
                        </p>
                    )}
                </div>
            </div>

            {/* Bar comparison */}
            {(risk.holiday_count > 0 || risk.term_count > 0) && (
                <div className="mt-4 space-y-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                        Burglaries per month on average
                    </p>
                    <div className="space-y-2">
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-slate-600 font-medium">During holidays</span>
                                <span className="text-xs font-black text-slate-700">{holidayAvg}/month</span>
                            </div>
                            <div className="h-2 bg-white/60 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-700 ${config.bar}`}
                                    style={{ width: `${holidayBarPct}%` }}
                                />
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-slate-600 font-medium">During term time</span>
                                <span className="text-xs font-black text-slate-700">{termAvg}/month</span>
                            </div>
                            <div className="h-2 bg-white/60 rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-700 bg-slate-300"
                                    style={{ width: `${termBarPct}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Tip */}
            {risk.tip && (
                <div className="mt-4 flex items-start gap-2 rounded-xl bg-white/60 border border-white/40 px-4 py-3">
                    <Home size={14} className={`flex-shrink-0 mt-0.5 ${config.icon}`} />
                    <p className={`text-xs leading-relaxed ${config.sub}`}>{risk.tip}</p>
                </div>
            )}
        </div>
    )
}
