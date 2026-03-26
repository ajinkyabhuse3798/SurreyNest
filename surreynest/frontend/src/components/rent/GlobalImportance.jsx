/**
 * GlobalImportance, Bar chart of global feature importance across all Guildford properties.
 */
export default function GlobalImportance({ importance }) {
    if (!importance?.length) return null

    const top5 = importance.slice(0, 5)
    const maxImp = Math.max(...top5.map(g => g.importance_pct), 1)

    return (
        <div>
            <p className="text-xs text-slate-400 mb-3">
                Across ALL properties in Guildford, these features matter most when predicting rent:
            </p>
            <div className="space-y-2">
                {top5.map((g) => {
                    const barW = Math.max(8, (g.importance_pct / maxImp) * 100)
                    return (
                        <div key={g.feature} className="flex items-center gap-3">
                            <span className="text-xs text-slate-600 w-36 flex-shrink-0 truncate">{g.label}</span>
                            <div className="flex-1">
                                <div
                                    className="h-5 bg-gradient-to-r from-primary-400 to-primary-400 rounded-lg flex items-center px-2 transition-all duration-700"
                                    style={{ width: `${barW}%` }}
                                >
                                    <span className="text-[10px] font-bold text-white">{g.importance_pct}%</span>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
