/**
 * GuildfordComparison — Area vs Guildford average comparison.
 */
import { TrendingDown, TrendingUp, Minus } from 'lucide-react'

export default function GuildfordComparison({ comparison }) {
    if (!comparison) return <p className="text-sm text-slate-400">No comparison data available.</p>

    const diff = comparison.difference_percent ?? 0
    const isBelow = diff < 0
    const isAbove = diff > 0

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">This area</p>
                    <p className="text-2xl font-black text-slate-900 mt-1">{comparison.sector_total ?? '—'}</p>
                    <p className="text-xs text-slate-500 mt-0.5">crimes / 12 months</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Guildford avg</p>
                    <p className="text-2xl font-black text-slate-900 mt-1">{comparison.guildford_average != null ? Math.round(comparison.guildford_average) : '—'}</p>
                    <p className="text-xs text-slate-500 mt-0.5">crimes / 12 months</p>
                </div>
            </div>

            <div className={`flex items-center gap-2 px-4 py-3 rounded-xl ${isBelow ? 'bg-emerald-50 border border-emerald-200' :
                    isAbove ? 'bg-red-50 border border-red-200' :
                        'bg-slate-50 border border-slate-200'
                }`}>
                {isBelow ? <TrendingDown size={16} className="text-emerald-600" /> :
                    isAbove ? <TrendingUp size={16} className="text-red-600" /> :
                        <Minus size={16} className="text-slate-500" />}
                <p className={`text-sm font-bold ${isBelow ? 'text-emerald-700' : isAbove ? 'text-red-700' : 'text-slate-600'}`}>
                    {Math.abs(Math.round(diff))}% {isBelow ? 'below' : isAbove ? 'above' : 'at'} the Guildford average
                </p>
            </div>

            {comparison.sentence && (
                <p className="text-sm text-slate-600 leading-relaxed">{comparison.sentence}</p>
            )}
        </div>
    )
}
