/**
 * ClauseCard — expandable clause analysis card.
 * Danger clauses start expanded, others start collapsed.
 *
 * @param {{ clause: object }} props
 */
import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

const RISK_STYLES = {
    danger: {
        border: 'border-rose-200',
        bg: 'bg-rose-50',
        badge: 'bg-rose-100 text-rose-700 border-rose-200',
        label: 'Danger',
    },
    caution: {
        border: 'border-amber-200',
        bg: 'bg-amber-50/50',
        badge: 'bg-amber-100 text-amber-700 border-amber-200',
        label: 'Caution',
    },
    safe: {
        border: 'border-emerald-200',
        bg: 'bg-white',
        badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        label: 'Safe',
    },
}

export default function ClauseCard({ clause }) {
    const styles = RISK_STYLES[clause.risk_level] || RISK_STYLES.caution
    const [expanded, setExpanded] = useState(clause.risk_level === 'danger')

    return (
        <div className={`rounded-xl border ${styles.border} ${styles.bg} overflow-hidden`}>
            <button
                onClick={() => setExpanded(e => !e)}
                className="w-full flex items-start justify-between gap-3 p-4 text-left"
            >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${styles.badge}`}>
                        {styles.label}
                    </span>
                    <p className="text-sm font-medium text-slate-800 leading-snug truncate">
                        {clause.clause_text}
                    </p>
                </div>
                {expanded ? <ChevronUp size={16} className="text-slate-400 flex-shrink-0 mt-0.5" /> : <ChevronDown size={16} className="text-slate-400 flex-shrink-0 mt-0.5" />}
            </button>

            {expanded && (
                <div className="px-4 pb-4 pt-0 space-y-3 border-t border-current/10">
                    <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">
                            What this means
                        </p>
                        <p className="text-sm text-slate-700 leading-relaxed">
                            {clause.explanation}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">
                            What to do
                        </p>
                        <p className="text-sm text-slate-700 leading-relaxed font-medium">
                            {clause.recommendation}
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}
