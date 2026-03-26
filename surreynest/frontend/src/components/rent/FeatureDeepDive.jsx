/**
 * FeatureDeepDive, Expandable list of ALL features with contributions.
 */
import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

function FeatureRow({ fc }) {
    const isUp = fc.direction === 'up'
    return (
        <div className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
            <span className="text-base w-7 text-center">{fc.icon}</span>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700">{fc.label}</p>
                <p className="text-xs text-slate-400 truncate">{fc.explanation}</p>
            </div>
            <div className="text-right flex-shrink-0">
                <p className={`text-sm font-bold ${isUp ? 'text-emerald-600' : fc.direction === 'down' ? 'text-rose-600' : 'text-slate-400'}`}>
                    {isUp ? '↑' : fc.direction === 'down' ? '↓' : '→'} {fc.contribution_pct}%
                </p>
                <p className="text-[10px] text-slate-400">{fc.value_display}</p>
            </div>
        </div>
    )
}

export default function FeatureDeepDive({ contributions }) {
    const [expanded, setExpanded] = useState(false)
    if (!contributions?.length) return null

    const major = contributions.filter(c => c.contribution_pct >= 3)
    const minor = contributions.filter(c => c.contribution_pct < 3)

    return (
        <div>
            <div className="divide-y divide-slate-50">
                {major.map(fc => <FeatureRow key={fc.feature} fc={fc} />)}
            </div>

            {minor.length > 0 && (
                <>
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="flex items-center gap-2 text-xs text-primary font-medium mt-3 hover:text-primary/90 transition-colors"
                    >
                        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        {expanded ? 'Hide' : 'Show'} {minor.length} smaller factors
                    </button>

                    {expanded && (
                        <div className="mt-2 divide-y divide-slate-50 bg-slate-50/50 rounded-lg px-2">
                            {minor.map(fc => <FeatureRow key={fc.feature} fc={fc} />)}
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
