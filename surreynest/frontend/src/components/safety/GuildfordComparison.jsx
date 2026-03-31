/**
 * GuildfordComparison — Visual comparison of this area vs Guildford average.
 * Shows a horizontal bar so users can see position at a glance.
 */
import { TrendingDown, TrendingUp, Minus } from 'lucide-react'

export default function GuildfordComparison({ comparison }) {
    if (!comparison)
        return <p className="text-sm text-slate-400">No comparison data available for this area.</p>

    const diff = comparison.difference_percent ?? 0
    const isBelow = diff < 0
    const isAbove = diff > 0

    const sectorTotal = comparison.sector_total ?? 0
    const avg = comparison.guildford_average ?? 0

    // For the visual bar: position sector relative to 0..2× average
    const maxVal = Math.max(avg * 2, sectorTotal + 5, 1)
    const sectorPct = Math.min(Math.round((sectorTotal / maxVal) * 100), 100)
    const avgPct = Math.min(Math.round((avg / maxVal) * 100), 100)

    const trendIcon = isBelow ? (
        <TrendingDown size={15} className="text-emerald-600" />
    ) : isAbove ? (
        <TrendingUp size={15} className="text-red-600" />
    ) : (
        <Minus size={15} className="text-slate-500" />
    )

    const trendColor = isBelow
        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
        : isAbove
            ? 'bg-red-50 border-red-200 text-red-700'
            : 'bg-slate-50 border-slate-200 text-slate-600'

    return (
        <div className="space-y-4">
            {/* Number cards */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">This area</p>
                    <p className="text-2xl font-black text-slate-900 mt-1">{sectorTotal}</p>
                    <p className="text-xs text-slate-500 mt-0.5">incidents last year</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        Guildford average
                    </p>
                    <p className="text-2xl font-black text-slate-900 mt-1">
                        {avg != null ? Math.round(avg) : 'N/A'}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">incidents last year</p>
                </div>
            </div>

            {/* Visual bar comparison */}
            <div className="space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                    How it compares
                </p>

                <div className="space-y-2">
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-slate-700">This area</span>
                            <span className="text-xs font-black text-slate-800">{sectorTotal}</span>
                        </div>
                        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-700 ${isBelow ? 'bg-emerald-400' : isAbove ? 'bg-rose-400' : 'bg-slate-400'}`}
                                style={{ width: `${sectorPct}%` }}
                            />
                        </div>
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-slate-500">Guildford average</span>
                            <span className="text-xs font-black text-slate-500">{Math.round(avg)}</span>
                        </div>
                        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full bg-slate-300 transition-all duration-700"
                                style={{ width: `${avgPct}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Trend indicator */}
            <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border ${trendColor}`}>
                {trendIcon}
                <p className="text-sm font-bold">
                    {Math.abs(Math.round(diff))}%{' '}
                    {isBelow ? 'below' : isAbove ? 'above' : 'around'} the Guildford average
                </p>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
                {comparison.comparison_label || 'No summary available for this area.'}
            </p>
        </div>
    )
}
