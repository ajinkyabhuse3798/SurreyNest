/**
 * HolidayAlert — Holiday break-in risk warning.
 */
import { AlertTriangle, CheckCircle2 } from 'lucide-react'

export default function HolidayAlert({ risk }) {
    if (!risk) return null

    const isHigh = risk.risk_level === 'high' || risk.risk_level === 'moderate'

    return (
        <div className="space-y-3">
            <div className={`flex items-start gap-3 rounded-xl p-4 ${isHigh ? 'bg-amber-50 border border-amber-200' : 'bg-emerald-50 border border-emerald-200'
                }`}>
                {isHigh
                    ? <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    : <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                }
                <div>
                    <p className={`text-sm font-bold ${isHigh ? 'text-amber-800' : 'text-emerald-800'}`}>
                        {risk.risk_level === 'high' ? 'Higher break-in risk during holidays' :
                            risk.risk_level === 'moderate' ? 'Moderate holiday risk' :
                                'Low holiday break-in risk'}
                    </p>
                    {risk.explanation && (
                        <p className={`text-xs mt-1.5 leading-relaxed ${isHigh ? 'text-amber-700' : 'text-emerald-700'}`}>
                            {risk.explanation}
                        </p>
                    )}
                </div>
            </div>

            {risk.tips?.length > 0 && (
                <div className="space-y-1.5">
                    <h4 className="text-xs font-bold text-slate-500">Before you leave:</h4>
                    {risk.tips.map((tip, i) => (
                        <p key={i} className="text-xs text-slate-600 flex items-start gap-2">
                            <span className="text-indigo-500">•</span>{tip}
                        </p>
                    ))}
                </div>
            )}
        </div>
    )
}
