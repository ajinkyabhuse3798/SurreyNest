/**
 * MonthlyChart, Monthly crime bar chart + trend indicator.
 */
import { TrendingDown, TrendingUp, Minus } from 'lucide-react'

export default function MonthlyChart({ data, trend }) {
    if (!data?.length) return <p className="text-sm text-slate-400">No monthly data available.</p>

    function getMonth(dateStr) {
        const [y, m] = dateStr.split('-')
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        return `${months[parseInt(m, 10) - 1]} '${y.slice(2)}`
    }

    const maxCount = Math.max(...data.map(d => d.count), 1)
    const plotHeightPx = 136
    const labelStep = data.length > 10 ? 3 : data.length > 6 ? 2 : 1

    // Normalise trend direction, API may return 'improving'/'worsening'
    // or 'decreasing'/'increasing' depending on the service version.
    const isImproving = trend?.direction === 'improving' || trend?.direction === 'decreasing'
    const isWorsening = trend?.direction === 'worsening' || trend?.direction === 'increasing'

    return (
        <div className="space-y-4">
            {/* Trend badge */}
            {trend && (
                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${isImproving ? 'bg-emerald-100 text-emerald-700' :
                    isWorsening ? 'bg-red-100 text-red-700' :
                        'bg-slate-100 text-slate-600'
                    }`}>
                    {isImproving ? <TrendingDown size={13} /> :
                        isWorsening ? <TrendingUp size={13} /> :
                            <Minus size={13} />}
                    {isImproving ? 'Improving' :
                        isWorsening ? 'Worsening' : 'Stable'}
                    {trend.change_percent != null && ` (${Math.abs(Math.round(trend.change_percent))}%)`}
                </div>
            )}

            {/* Bar chart */}
            <div className="rounded-2xl border border-slate-100 bg-slate-50/60 px-3 py-4">
                <div className="flex gap-1.5">
                    {data.map((d, i) => {
                        const hPx = d.count > 0
                            ? Math.max(8, Math.round((d.count / maxCount) * (plotHeightPx - 12)))
                            : 4
                        const showLabel = i % labelStep === 0 || i === data.length - 1
                        return (
                            <div
                                key={i}
                                className="group flex-1 min-w-0"
                                title={`${getMonth(d.month)}: ${d.count} crimes`}
                            >
                                <div className="relative flex items-end" style={{ height: `${plotHeightPx}px` }}>
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
                                    <span className={`text-[9px] font-medium text-slate-400 ${showLabel ? '' : 'invisible'}`}>
                                        {getMonth(d.month)}
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
