/**
 * CrimeDonut — SVG donut chart with plain-English "what this means" summary.
 * Shows the top 2 crime categories with human-readable explanations.
 */
import { CAT_META } from '../../utils/safetyConstants'

const CAT_PLAIN_ENGLISH = {
    'violent-crime':
        'Fights, assaults, or harassment. The higher this is, the more care you should take when walking home at night or on busy weekend evenings.',
    'anti-social-behaviour':
        'Noise, rowdiness, and public disturbances. Common in student areas — annoying to live near, but usually not a physical danger to you.',
    'burglary':
        'Break-ins to homes or outbuildings. Highly relevant for students in shared housing. Ask your landlord about door and window locks before you move in.',
    'theft-from-the-person':
        'Phone or wallet snatching in public. Keep valuables out of sight on busy streets and at night — especially after bars close.',
    'public-order':
        'Threatening or disruptive behaviour in public spaces. Higher counts often indicate a livelier, rowdier area rather than a genuinely dangerous one.',
    'vehicle-crime':
        'Car or bike theft and damage. Less of a concern if you don\'t own a car, but relevant for cyclists — always lock your bike.',
    'drugs':
        'Drug-related incidents logged by police. Presence in the data doesn\'t necessarily affect your daily safety, but it\'s worth knowing.',
    'robbery':
        'Theft using force or threat of force. More serious than ordinary theft — worth noting if the count is elevated.',
    'bicycle-theft':
        'Bikes stolen from outside homes, racks, or in the street. Very relevant for students who cycle to campus — always use a D-lock and bring your bike inside overnight if you can.',
}

export default function CrimeDonut({ breakdown }) {
    if (!breakdown?.length) return null

    const total = breakdown.reduce((s, c) => s + c.count, 0)
    const sorted = [...breakdown].sort((a, b) => b.count - a.count)
    const topTwo = sorted.slice(0, 2).filter((c) => c.count > 0)

    const R = 50
    const CX = 60
    const CY = 60
    const STROKE = 14
    const CIRC = 2 * Math.PI * R
    let offset = 0

    return (
        <div className="space-y-5">
            {/* Chart + legend */}
            <div className="flex flex-col sm:flex-row items-center gap-6">
                <svg width="120" height="120" viewBox="0 0 120 120" className="flex-shrink-0">
                    {sorted.map((cat) => {
                        const meta = CAT_META[cat.category] || { color: '#94a3b8' }
                        const pct = cat.count / total
                        const dash = pct * CIRC
                        const seg = (
                            <circle
                                key={cat.category}
                                cx={CX}
                                cy={CY}
                                r={R}
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
                    <text
                        x={CX}
                        y={CY - 4}
                        textAnchor="middle"
                        className="text-xl font-black fill-slate-800"
                    >
                        {total}
                    </text>
                    <text
                        x={CX}
                        y={CY + 12}
                        textAnchor="middle"
                        className="text-[9px] font-medium fill-slate-400"
                    >
                        incidents
                    </text>
                </svg>

                <div className="flex-1 grid grid-cols-2 gap-x-5 gap-y-3 w-full">
                    {sorted.map((cat) => {
                        const meta = CAT_META[cat.category] || {
                            name: cat.category,
                            color: '#94a3b8',
                        }
                        const pct = ((cat.count / total) * 100).toFixed(0)
                        return (
                            <div
                                key={cat.category}
                                className="flex items-center gap-2.5 text-xs bg-slate-50/50 hover:bg-slate-50 px-3 py-2 rounded-xl transition-colors"
                            >
                                <span
                                    className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm"
                                    style={{ backgroundColor: meta.color }}
                                />
                                <span className="text-slate-600 truncate font-medium">{meta.name}</span>
                                <span className="ml-auto font-black text-slate-800">{pct}%</span>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Plain-English "what this means" */}
            {topTwo.length > 0 && (
                <div className="space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                        What this means for you
                    </p>
                    {topTwo.map((cat) => {
                        const meta = CAT_META[cat.category] || {
                            name: cat.category,
                            color: '#94a3b8',
                        }
                        const explanation = CAT_PLAIN_ENGLISH[cat.category]
                        if (!explanation) return null
                        const monthlyAvg = (cat.count / 12).toFixed(1)
                        return (
                            <div
                                key={cat.category}
                                className="flex items-start gap-3 rounded-xl bg-slate-50 border border-slate-100 px-4 py-3"
                            >
                                <span
                                    className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0"
                                    style={{ backgroundColor: meta.color }}
                                />
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-700">
                                        {meta.name} &mdash;{' '}
                                        <span className="text-slate-500 font-normal">
                                            {cat.count} incidents over the past year (~{monthlyAvg}/month)
                                        </span>
                                    </p>
                                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                                        {explanation}
                                    </p>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
