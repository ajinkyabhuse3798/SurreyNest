/**
 * RentComparison, Predicted rent vs sector and Guildford median.
 */
export default function RentComparison({ predicted, comparison }) {
    if (!comparison) return null

    const items = []

    if (comparison.sector_median) {
        const diff = comparison.vs_sector_pct || 0
        items.push({
            label: `${comparison.sector} median`,
            value: `£${Math.round(comparison.sector_median)}/wk`,
            diff,
            sentence: diff > 5
                ? `This property is about ${Math.abs(Math.round(diff))}% above the ${comparison.sector} average, it is a bigger or better-located property.`
                : diff < -5
                    ? `This is about ${Math.abs(Math.round(diff))}% below average for ${comparison.sector}, a more affordable option in this area.`
                    : `Right around average for ${comparison.sector}.`,
        })
    }

    if (comparison.guildford_median) {
        const diff = comparison.vs_guildford_pct || 0
        items.push({
            label: 'Guildford median',
            value: `£${Math.round(comparison.guildford_median)}/wk`,
            diff,
            sentence: diff > 10
                ? `Higher than the Guildford average, this tends to be a more expensive area or property type.`
                : diff < -10
                    ? `Lower than the Guildford average, one of the more affordable options in the borough.`
                    : `Close to the overall Guildford average.`,
        })
    }

    return (
        <div className="space-y-4">
            {/* Predicted rent highlight */}
            <div className="text-center bg-gradient-to-r from-primary-50 to-primary-50 rounded-xl px-4 py-4 border border-primary/20/60">
                <p className="text-xs text-primary/80 font-medium">Our AI predicts</p>
                <p className="text-3xl font-black text-primary/90">£{Math.round(predicted)}<span className="text-base font-medium text-primary-400">/week</span></p>
                <p className="text-xs text-primary-400 mt-1">£{Math.round(predicted * 52 / 12)}/month</p>
            </div>

            {/* Comparison bars */}
            <div className="grid gap-3">
                {items.map((item) => {
                    const isAbove = item.diff > 0
                    return (
                        <div key={item.label} className="bg-slate-50/50 rounded-xl px-4 py-3 border border-slate-100">
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{item.label}</span>
                                <span className="text-sm font-bold text-slate-800">{item.value}</span>
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isAbove ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                    {isAbove ? '↑' : '↓'} {Math.abs(Math.round(item.diff))}%
                                </span>
                                <span className="text-xs text-slate-400">{isAbove ? 'above' : 'below'} median</span>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed">{item.sentence}</p>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
