/**
 * WaterfallChart — Feature contribution bars for rent explanation.
 */
export default function WaterfallChart({ contributions }) {
    if (!contributions?.length) return null

    const top = contributions.slice(0, 8)
    const maxPct = Math.max(...top.map(c => c.contribution_pct), 1)

    return (
        <div className="space-y-2.5">
            {top.map((fc) => {
                const barW = Math.max(8, (fc.contribution_pct / maxPct) * 100)
                const isUp = fc.direction === 'up'
                const barColor = isUp ? 'bg-gradient-to-r from-emerald-400 to-emerald-500 shadow-[0_2px_10px_-2px_rgba(16,185,129,0.4)]' : 'bg-gradient-to-r from-rose-400 to-rose-500 shadow-[0_2px_10px_-2px_rgba(244,63,94,0.4)]'
                const textColor = isUp ? 'text-emerald-700' : 'text-rose-700'
                const bgColor = isUp ? 'bg-emerald-50/80 border border-emerald-100' : 'bg-rose-50/80 border border-rose-100'

                return (
                    <div key={fc.feature} className="group hover:bg-slate-50/50 p-2 -mx-2 rounded-xl transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="w-40 flex-shrink-0 flex items-center gap-2.5">
                                <span className="text-lg drop-shadow-sm">{fc.icon}</span>
                                <span className="text-xs font-bold text-slate-700 truncate">{fc.label}</span>
                            </div>
                            <div className="flex-1 flex items-center gap-2">
                                <div className={`h-7 rounded-lg transition-all duration-700 flex items-center px-2.5 ${barColor}`}
                                    style={{ width: `${barW}%` }}
                                >
                                    <span className="text-[10px] font-bold text-white whitespace-nowrap">
                                        {fc.contribution_pct}%
                                    </span>
                                </div>
                                <span className={`text-xs font-bold ${textColor}`}>
                                    {isUp ? '↑' : '↓'}
                                </span>
                            </div>
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${bgColor} ${textColor} flex-shrink-0`}>
                                {fc.value_display}
                            </span>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
