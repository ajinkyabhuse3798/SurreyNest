/**
 * AreaRankings — Safest and hotspot area rankings with position indicator.
 * Shows where the current sector sits in the Guildford spectrum.
 */
import { Link } from 'react-router-dom'

function RankList({ title, areas, emoji, color }) {
    if (!areas?.length) return null
    return (
        <div className="bg-slate-50/60 rounded-2xl p-4 border border-slate-100">
            <h3 className="text-sm font-extrabold text-slate-800 mb-3">{title}</h3>
            <div className="space-y-2">
                {areas.map((area, i) => (
                    <Link
                        key={area.postcode_sector || i}
                        to={`/safety/${encodeURIComponent(area.postcode_sector)}`}
                        className={`flex items-center justify-between px-3.5 py-3 rounded-xl text-xs transition-colors cursor-pointer ${
                            area.highlight
                                ? 'bg-primary/10 border-2 border-primary/20 font-bold shadow-sm'
                                : 'bg-white hover:bg-slate-50 border border-slate-100'
                        }`}
                    >
                        <span className="flex items-center gap-2">
                            <span className="text-base">{emoji[i] || `${i + 1}.`}</span>
                            <span className={`font-bold ${area.highlight ? 'text-primary' : 'text-slate-700'}`}>
                                {area.postcode_sector}
                                {area.highlight && (
                                    <span className="ml-1.5 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] uppercase tracking-wider">
                                        you
                                    </span>
                                )}
                            </span>
                        </span>
                        <span className={`font-black ${color}`}>
                            {area.total_crimes}{' '}
                            <span className="text-[10px] font-semibold opacity-70">crimes</span>
                        </span>
                    </Link>
                ))}
            </div>
        </div>
    )
}

function RankPositionBanner({ rankings, currentSector }) {
    if (!currentSector || !rankings) return null

    const allSectors = [
        ...(rankings.safest || []),
        ...(rankings.hotspots || []),
    ]
    const unique = Array.from(new Map(allSectors.map((s) => [s.postcode_sector, s])).values())
    const sorted = unique.sort((a, b) => a.total_crimes - b.total_crimes)
    const idx = sorted.findIndex((s) => s.postcode_sector === currentSector)

    if (idx === -1) return null

    const total = sorted.length
    const rank = idx + 1
    const pct = Math.round((idx / Math.max(total - 1, 1)) * 100)

    const isTop = rank <= Math.ceil(total * 0.33)
    const isBottom = rank > Math.ceil(total * 0.67)

    const label = isTop
        ? `Ranks ${rank} of ${total} — one of the quieter areas`
        : isBottom
            ? `Ranks ${rank} of ${total} — one of the busier areas`
            : `Ranks ${rank} of ${total} — about mid-range`

    const color = isTop ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : isBottom ? 'text-rose-700 bg-rose-50 border-rose-200' : 'text-amber-700 bg-amber-50 border-amber-200'
    const markerColor = isTop ? 'bg-emerald-500' : isBottom ? 'bg-rose-500' : 'bg-amber-500'

    return (
        <div className={`rounded-2xl border px-4 py-3 mb-4 ${color}`}>
            <p className="text-xs font-bold">{label}</p>
            <div className="mt-2 relative h-2 rounded-full bg-white/60">
                <div
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-400 to-rose-400 opacity-40"
                    style={{ width: '100%' }}
                />
                <div
                    className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow ${markerColor}`}
                    style={{ left: `calc(${pct}% - 6px)` }}
                />
            </div>
            <div className="mt-1 flex justify-between text-[10px] opacity-60">
                <span>Safest</span>
                <span>Busiest</span>
            </div>
        </div>
    )
}

export default function AreaRankings({ rankings, currentSector }) {
    if (!rankings) return <p className="text-sm text-slate-400">No ranking data available.</p>

    const annotate = (list) =>
        list?.map((a) => ({ ...a, highlight: a.postcode_sector === currentSector }))

    return (
        <div className="space-y-4">
            <RankPositionBanner rankings={rankings} currentSector={currentSector} />
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
        </div>
    )
}
