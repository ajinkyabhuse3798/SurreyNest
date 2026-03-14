/**
 * AgentScoreCards — 4 cards showing rating breakdowns.
 *
 * @param {{ stats: import('../../services/agentApi').AgentReviewSummary }} props
 */

function ScoreCard({ label, value }) {
    const pct = ((value - 1) / 4) * 100
    const colour =
        pct >= 75 ? 'bg-emerald-500' :
        pct >= 50 ? 'bg-amber-400' :
        'bg-rose-400'

    return (
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
                {label}
            </p>
            <p className="text-2xl font-extrabold text-slate-900 mb-2">
                {value.toFixed(1)}<span className="text-sm font-normal text-slate-400">/5</span>
            </p>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full ${colour} transition-all duration-500`}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    )
}

export default function AgentScoreCards({ stats }) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ScoreCard label="Overall" value={stats.avg_overall_rating} />
            <ScoreCard label="Responsiveness" value={stats.avg_landlord_rating} />
            <ScoreCard label="Condition" value={stats.avg_condition_rating} />
            <ScoreCard label="Value" value={stats.avg_value_rating} />
        </div>
    )
}
