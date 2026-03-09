/**
 * SafetySection — Safety score gauge, verdict card, and CTA to full safety report.
 *
 * Props:
 *   property — needs safety_score, postcode
 *   verdict  — result of safetyVerdict(score) or null
 */
import { Link } from 'react-router-dom'
import { Shield, ChevronRight } from 'lucide-react'
import ScoreGauge from '../ScoreGauge'

export default function SafetySection({ property: p, verdict }) {
    if (p.safety_score == null) {
        return <p className="text-sm text-slate-400">Safety data is not yet available for this area.</p>
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100/60 shadow-sm flex-shrink-0">
                    <ScoreGauge score={p.safety_score} size="lg" showLabel label="Safety" />
                </div>
                <div className="space-y-3 flex-1">
                    {verdict && (
                        <div className={`${verdict.bg}/70 backdrop-blur-sm border ${verdict.border} rounded-xl px-4 py-3.5 shadow-sm`}>
                            <p className={`text-sm font-extrabold ${verdict.colour}`}>{verdict.text}</p>
                        </div>
                    )}
                    <p className="text-sm text-slate-500 leading-relaxed font-medium">
                        Based on reported crime in the <span className="font-bold text-slate-800">{p.postcode}</span> area.
                        Covers the whole postcode sector, not just this street.
                    </p>
                </div>
            </div>

            {/* CTA to full safety report */}
            <Link
                to={`/safety/${encodeURIComponent(p.postcode)}`}
                className="group relative overflow-hidden flex items-center gap-4 bg-gradient-to-br from-indigo-900 via-indigo-800 to-violet-900 hover:from-indigo-800 hover:to-violet-800 rounded-2xl px-5 py-4 lg:py-5 border border-indigo-700/50 transition-all duration-300 shadow-[0_8px_30px_-4px_rgba(49,46,129,0.3)] hover:shadow-[0_12px_40px_-4px_rgba(49,46,129,0.4)]"
            >
                {/* Glow accent */}
                <div className="absolute -left-12 -top-12 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl group-hover:bg-indigo-500/30 transition-colors" />

                <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0 border border-white/10 backdrop-blur-sm">
                    <Shield size={20} className="text-white drop-shadow-md" />
                </div>
                <div className="flex-1 min-w-0 z-10">
                    <p className="text-[15px] font-bold text-white tracking-wide">Explore full safety report</p>
                    <p className="text-xs text-indigo-200 mt-1 font-medium">Crime breakdown, trends & area rankings</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-sm group-hover:bg-white/20 transition-colors z-10">
                    <ChevronRight size={18} className="text-white group-hover:translate-x-0.5 transition-transform" />
                </div>
            </Link>
        </div>
    )
}

