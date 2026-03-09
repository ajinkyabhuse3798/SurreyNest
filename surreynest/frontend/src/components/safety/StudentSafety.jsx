/**
 * StudentSafety — Student-focused safety analysis and verdict.
 */
import { CheckCircle2, AlertTriangle, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function StudentSafety({ data }) {
    if (!data) return <p className="text-sm text-slate-400">No student safety data available.</p>

    const { risk_level, verdict, key_concerns, positive_factors, night_safety } = data

    const riskColors = {
        low: { bg: 'bg-emerald-50/50', border: 'border-emerald-200', text: 'text-emerald-800', badge: 'bg-emerald-100/80 text-emerald-800 border-emerald-200' },
        moderate: { bg: 'bg-amber-50/50', border: 'border-amber-200', text: 'text-amber-800', badge: 'bg-amber-100/80 text-amber-800 border-amber-200' },
        high: { bg: 'bg-rose-50/50', border: 'border-rose-200', text: 'text-rose-800', badge: 'bg-rose-100/80 text-rose-800 border-rose-200' },
    }
    const colors = riskColors[risk_level] || riskColors.moderate

    return (
        <div className="space-y-4">
            {/* Verdict card */}
            <div className={`${colors.bg} border ${colors.border} rounded-2xl p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]`}>
                <div className="flex items-center gap-2 mb-3">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${colors.badge}`}>
                        {risk_level === 'low' ? '✓ Low Risk' : risk_level === 'high' ? '⚠ High Risk' : '● Moderate Risk'}
                    </span>
                </div>
                <p className={`text-[15px] font-bold ${colors.text} leading-snug`}>{verdict}</p>
            </div>

            {/* Night safety */}
            {night_safety && (
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Walking home at night</h4>
                    <p className="text-sm text-slate-700 font-medium">{night_safety}</p>
                </div>
            )}

            {/* Key concerns */}
            {key_concerns?.length > 0 && (
                <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">⚠ Key concerns</h4>
                    <div className="space-y-1.5">
                        {key_concerns.map((c, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm text-slate-600">
                                <AlertTriangle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
                                <span>{c}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Positive factors */}
            {positive_factors?.length > 0 && (
                <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">✓ Positive signs</h4>
                    <div className="space-y-1.5">
                        {positive_factors.map((f, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm text-slate-600">
                                <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                                <span>{f}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
