/**
 * SafetyTips — Data-driven safety tips styled as a visual action checklist.
 * Tips are grouped visually by type: positive (green), warning (amber), info (blue).
 */
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react'

const TYPE_CONFIG = {
    positive: {
        bg: 'bg-orange-50',
        border: 'border-orange-100',
        leftBorder: 'border-l-4 border-l-orange-400',
        icon: <CheckCircle2 size={15} className="text-orange-600 flex-shrink-0 mt-0.5" />,
        textColor: 'text-orange-900',
    },
    warning: {
        bg: 'bg-amber-50',
        border: 'border-amber-100',
        leftBorder: 'border-l-4 border-l-amber-400',
        icon: <AlertTriangle size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />,
        textColor: 'text-amber-900',
    },
    info: {
        bg: 'bg-sky-50',
        border: 'border-sky-100',
        leftBorder: 'border-l-4 border-l-sky-400',
        icon: <Info size={15} className="text-sky-600 flex-shrink-0 mt-0.5" />,
        textColor: 'text-sky-900',
    },
}

const FALLBACK_CONFIG = {
    bg: 'bg-slate-50',
    border: 'border-slate-100',
    leftBorder: 'border-l-4 border-l-slate-300',
    icon: <Info size={15} className="text-slate-400 flex-shrink-0 mt-0.5" />,
    textColor: 'text-slate-700',
}

export default function SafetyTips({ tips }) {
    if (!tips?.length) return null

    return (
        <div className="space-y-2.5">
            {tips.map((tip, i) => {
                const text = typeof tip === 'string' ? tip : tip.text
                const type = typeof tip === 'object' ? tip.type : 'info'
                const icon = typeof tip === 'object' ? tip.icon : null
                const config = TYPE_CONFIG[type] || FALLBACK_CONFIG

                return (
                    <div
                        key={i}
                        className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${config.bg} ${config.border} ${config.leftBorder}`}
                    >
                        {icon ? (
                            <span className="text-base flex-shrink-0 mt-0.5 leading-none">{icon}</span>
                        ) : (
                            config.icon
                        )}
                        <p className={`text-sm leading-relaxed ${config.textColor}`}>{text}</p>
                    </div>
                )
            })}
        </div>
    )
}
