/**
 * AreaRankings — Top 5 safest areas and top 5 crime hotspots in Guildford.
 */
import { Shield, AlertTriangle } from 'lucide-react'

function RankList({ title, areas, emoji, color }) {
    if (!areas?.length) return null
    return (
        <div className="bg-white rounded-2xl p-5 shadow-[0_2px_12px_-3px_rgba(0,0,0,0.06)] border border-slate-100">
            <h3 className="text-sm font-extrabold text-slate-800 mb-4">{title}</h3>
            <div className="space-y-2">
                {areas.map((area, i) => (
                    <div key={area.postcode_sector || i} className={`flex items-center justify-between px-3.5 py-3 rounded-xl text-xs transition-colors ${area.highlight ? 'bg-indigo-50/80 border-2 border-indigo-200 font-bold shadow-sm' : 'bg-slate-50/60 hover:bg-slate-50'
                        }`}>
                        <span className="flex items-center gap-2">
                            <span className="text-base">{emoji[i] || `${i + 1}.`}</span>
                            <span className={`font-bold ${area.highlight ? 'text-indigo-700' : 'text-slate-700'}`}>
                                {area.postcode_sector}
                                {area.highlight && <span className="ml-1.5 px-1.5 py-0.5 rounded bg-indigo-200/50 text-indigo-700 text-[10px] uppercase tracking-wider">(you)</span>}
                            </span>
                        </span>
                        <span className={`font-black ${color}`}>{area.total_crimes} <span className="text-[10px] font-semibold opacity-70">crimes</span></span>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default function AreaRankings({ rankings, currentSector }) {
    if (!rankings) return <p className="text-sm text-slate-400">No ranking data available.</p>

    // Annotate current sector
    const annotate = (list) => list?.map(a => ({ ...a, highlight: a.postcode_sector === currentSector }))

    return (
        <div className="grid sm:grid-cols-2 gap-5">
            <RankList
                title="🛡️ Safest areas"
                areas={annotate(rankings.safest)}
                emoji={['🥇', '🥈', '🥉', '4.', '5.']}
                color="text-emerald-600"
            />
            <RankList
                title="⚠️ Crime hotspots"
                areas={annotate(rankings.hotspots)}
                emoji={['1.', '2.', '3.', '4.', '5.']}
                color="text-red-600"
            />
        </div>
    )
}
