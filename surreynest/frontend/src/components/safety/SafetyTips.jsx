/**
 * SafetyTips, Data-driven safety tips.
 */
import { Lightbulb } from 'lucide-react'

export default function SafetyTips({ tips }) {
    if (!tips?.length) return null

    return (
        <div className="space-y-2.5">
            {tips.map((tip, i) => {
                const text = typeof tip === 'string' ? tip : tip.text
                const icon = typeof tip === 'string' ? null : tip.icon
                return (
                    <div key={i} className="flex items-start gap-3 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                        {icon
                            ? <span className="text-base flex-shrink-0 mt-0.5">{icon}</span>
                            : <Lightbulb size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
                        }
                        <p className="text-sm text-slate-700 leading-relaxed">{text}</p>
                    </div>
                )
            })}
        </div>
    )
}
