/**
 * CrimeDonut — SVG donut chart showing crime category breakdown.
 */
import { CAT_META } from '../../utils/safetyConstants'

export default function CrimeDonut({ breakdown }) {
    if (!breakdown?.length) return null

    const total = breakdown.reduce((s, c) => s + c.count, 0)
    const sorted = [...breakdown].sort((a, b) => b.count - a.count)

    // Build arc segments
    const R = 50, CX = 60, CY = 60, STROKE = 14
    const CIRC = 2 * Math.PI * R
    let offset = 0

    return (
        <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* SVG donut */}
            <svg width="120" height="120" viewBox="0 0 120 120" className="flex-shrink-0">
                {sorted.map((cat) => {
                    const meta = CAT_META[cat.category] || { color: '#94a3b8' }
                    const pct = cat.count / total
                    const dash = pct * CIRC
                    const seg = (
                        <circle
                            key={cat.category}
                            cx={CX} cy={CY} r={R}
                            fill="none"
                            stroke={meta.color}
                            strokeWidth={STROKE}
                            strokeDasharray={`${dash} ${CIRC - dash}`}
                            strokeDashoffset={-offset}
                            transform={`rotate(-90 ${CX} ${CY})`}
                            className="transition-all duration-700"
                        />
                    )
                    offset += dash
                    return seg
                })}
                <text x={CX} y={CY - 4} textAnchor="middle" className="text-xl font-black fill-slate-800">{total}</text>
                <text x={CX} y={CY + 12} textAnchor="middle" className="text-[9px] font-medium fill-slate-400">crimes</text>
            </svg>

            {/* Legend */}
            <div className="flex-1 grid grid-cols-2 gap-x-5 gap-y-3 w-full">
                {sorted.map((cat) => {
                    const meta = CAT_META[cat.category] || { name: cat.category, color: '#94a3b8', Icon: null }
                    const pct = ((cat.count / total) * 100).toFixed(0)
                    return (
                        <div key={cat.category} className="flex items-center gap-2.5 text-xs bg-slate-50/50 hover:bg-slate-50 px-3 py-2 rounded-xl transition-colors">
                            <span className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: meta.color }} />
                            <span className="text-slate-600 truncate font-medium">{meta.name}</span>
                            <span className="ml-auto font-black text-slate-800">{pct}%</span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
