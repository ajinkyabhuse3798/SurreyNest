/**
 * MonthlyChart — Monthly crime bar chart + trend indicator.
 *
 * Bugs fixed:
 *  - Bars were invisible because CSS `height: X%` inside a flex child
 *    without explicit height resolves to 0. Now uses pixel-based height.
 *  - Trend badge checked 'decreasing'/'increasing' but API returns
 *    'improving'/'worsening'. Now handles both vocabularies.
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
    const BAR_CONTAINER_PX = 128 // matches h-32

    // Normalise trend direction — API may return 'improving'/'worsening'
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

            {/* Bar chart — uses pixel heights to avoid CSS % height bug */}
            <div className="flex items-end gap-1" style={{ height: `${BAR_CONTAINER_PX}px` }}>
                {data.map((d, i) => {
                    const hPx = Math.max(6, (d.count / maxCount) * BAR_CONTAINER_PX)
                    return (
                        <div
                            key={i}
                            className="flex-1 flex flex-col items-center justify-end group"
                            style={{ height: '100%' }}
                            title={`${getMonth(d.month)}: ${d.count} crimes`}
                        >
                            <span className="text-[9px] font-bold text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity mb-1 bg-white px-1.5 py-0.5 rounded shadow-sm relative bottom-1">{d.count}</span>
                            <div
                                className="w-full bg-indigo-500 rounded-t-lg group-hover:bg-indigo-600 shadow-[0_4px_10px_-2px_rgba(99,102,241,0.3)] transition-all duration-300"
                                style={{ height: `${hPx}px`, minHeight: '6px' }}
                            />
                            {i % 3 === 0 && (
                                <span className="text-[8px] text-slate-400 font-medium mt-1">{getMonth(d.month)}</span>
                            )}
                        </div>
                    )
                })}
            </div>

            {trend?.label && (
                <p className="text-sm text-slate-600 leading-relaxed">{trend.label}</p>
            )}
        </div>
    )
}
