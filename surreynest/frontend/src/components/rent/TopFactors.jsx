/**
 * TopFactors — Top 3 factors with explanation cards.
 */
export default function TopFactors({ contributions }) {
    const top3 = contributions?.slice(0, 3) || []
    if (!top3.length) return null

    const cardStyles = [
        { wrapper: 'bg-white/80 backdrop-blur-md border border-indigo-100 shadow-[0_8px_30px_-4px_rgba(79,70,229,0.15)]', badge: 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-200/50' },
        { wrapper: 'bg-white/80 backdrop-blur-md border border-emerald-100 shadow-[0_4px_20px_-4px_rgba(16,185,129,0.1)]', badge: 'bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-md shadow-emerald-200/50' },
        { wrapper: 'bg-white/80 backdrop-blur-md border border-amber-100 shadow-[0_4px_20px_-4px_rgba(245,158,11,0.1)]', badge: 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md shadow-amber-200/50' },
    ]

    return (
        <div className="grid gap-3">
            {top3.map((fc, i) => {
                const cs = cardStyles[i] || cardStyles[2]
                const isUp = fc.direction === 'up'
                return (
                    <div key={fc.feature} className={`${cs.wrapper} rounded-2xl p-5 flex items-start gap-5 transition-transform hover:-translate-y-0.5 duration-300`}>
                        <div className={`w-12 h-12 rounded-2xl ${cs.badge} flex items-center justify-center flex-shrink-0 text-xl font-black`}>
                            {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                                <span className="text-lg">{fc.icon}</span>
                                <h3 className="text-sm font-bold text-slate-800">{fc.label}</h3>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isUp ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                    {isUp ? '↑' : '↓'} {fc.contribution_pct}%
                                </span>
                            </div>
                            <p className="text-sm text-slate-600 leading-relaxed">{fc.explanation}</p>
                            <p className="text-xs text-slate-400 mt-1.5">
                                Value: <span className="font-semibold text-slate-600">{fc.value_display}</span>
                            </p>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
