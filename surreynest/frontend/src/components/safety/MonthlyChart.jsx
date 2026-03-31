/**
 * MonthlyChart — Monthly crime bar chart with a plain-English headline trend statement.
 * The big headline answers "is this area getting safer?" before the user looks at bars.
 */
import { TrendingDown, TrendingUp, Minus } from 'lucide-react'

function getMonthLabel(dateStr) {
    const [y, m] = dateStr.split('-')
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${months[parseInt(m, 10) - 1]} '${y.slice(2)}`
}

export default function MonthlyChart({ data, trend }) {
    if (!data?.length)
        return <p className="text-sm text-slate-400">No monthly data available.</p>

    const maxCount = Math.max(...data.map((d) => d.count), 1)
    const plotHeightPx = 136
    const labelStep = data.length > 10 ? 3 : data.length > 6 ? 2 : 1

    const isImproving =
        trend?.direction === 'improving' || trend?.direction === 'decreasing'
    const isWorsening =
        trend?.direction === 'worsening' || trend?.direction === 'increasing'

    const changePct = Math.abs(Math.round(trend?.change_percent || 0))

    const headlineText = isImproving
        ? changePct > 0
            ? `Crime has gone down ${changePct}% in recent months`
            : 'Crime levels have been improving'
        : isWorsening
            ? changePct > 0
                ? `Crime has gone up ${changePct}% in recent months`
                : 'Crime levels have been rising'
            : 'Crime levels have been broadly stable'

    const headlineColors = isImproving
        ? { bg: 'bg-emerald-50', iconBg: 'bg-emerald-100', icon: 'text-emerald-600', text: 'text-emerald-800' }
        : isWorsening
            ? { bg: 'bg-red-50', iconBg: 'bg-red-100', icon: 'text-red-600', text: 'text-red-800' }
            : { bg: 'bg-slate-50', iconBg: 'bg-slate-100', icon: 'text-slate-500', text: 'text-slate-700' }

    return (
        <div className="space-y-4">
            {/* Big headline statement */}
            {trend && (
                <div className={`rounded-2xl p-4 ${headlineColors.bg}`}>
                    <div className="flex items-center gap-3">
                        <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${headlineColors.iconBg}`}
                        >
                            {isImproving ? (
                                <TrendingDown size={20} className={headlineColors.icon} />
                            ) : isWorsening ? (
                                <TrendingUp size={20} className={headlineColors.icon} />
                            ) : (
                                <Minus size={20} className={headlineColors.icon} />
                            )}
                        </div>
                        <div>
                            <p className={`text-base font-black ${headlineColors.text}`}>
                                {headlineText}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Comparing the last 6 months to the 6 months before that
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Bar chart */}
            <div className="rounded-2xl border border-slate-100 bg-slate-50/60 px-3 py-4">
                <div className="flex gap-1.5">
                    {data.map((d, i) => {
                        const hPx =
                            d.count > 0
                                ? Math.max(8, Math.round((d.count / maxCount) * (plotHeightPx - 12)))
                                : 4
                        const showLabel = i % labelStep === 0 || i === data.length - 1
                        return (
                            <div
                                key={i}
                                className="group flex-1 min-w-0"
                                title={`${getMonthLabel(d.month)}: ${d.count} incidents`}
                            >
                                <div
                                    className="relative flex items-end"
                                    style={{ height: `${plotHeightPx}px` }}
                                >
                                    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
                                        <div className="border-t border-slate-200/70" />
                                        <div className="border-t border-slate-200/50" />
                                        <div className="border-t border-slate-200/50" />
                                        <div className="border-t border-slate-300" />
                                    </div>

                                    <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 rounded-md bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-600 shadow-sm opacity-0 transition-opacity group-hover:opacity-100">
                                        {d.count}
                                    </span>

                                    <div
                                        className="relative z-10 w-full rounded-t-lg bg-primary transition-all duration-300 group-hover:brightness-95"
                                        style={{ height: `${hPx}px`, minHeight: '4px' }}
                                    />
                                </div>

                                <div className="mt-2 h-4 text-center">
                                    <span
                                        className={`text-[9px] font-medium text-slate-400 ${showLabel ? '' : 'invisible'}`}
                                    >
                                        {getMonthLabel(d.month)}
                                    </span>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {trend?.label && (
                <p className="text-sm text-slate-600 leading-relaxed">{trend.label}</p>
            )}
        </div>
    )
}
