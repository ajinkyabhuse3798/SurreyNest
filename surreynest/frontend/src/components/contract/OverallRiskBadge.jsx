/**
 * OverallRiskBadge — large risk badge with summary and recommendation.
 *
 * @param {{ result: object }} props
 */
import { ShieldCheck, AlertTriangle, ShieldAlert } from 'lucide-react'

const RISK_CONFIG = {
    low: {
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        icon: ShieldCheck,
        iconClass: 'text-emerald-600',
        text: 'text-emerald-800',
        label: 'Low Risk',
    },
    medium: {
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        icon: AlertTriangle,
        iconClass: 'text-amber-600',
        text: 'text-amber-800',
        label: 'Medium Risk',
    },
    high: {
        bg: 'bg-rose-50',
        border: 'border-rose-200',
        icon: ShieldAlert,
        iconClass: 'text-rose-600',
        text: 'text-rose-800',
        label: 'High Risk',
    },
}

export default function OverallRiskBadge({ result }) {
    const config = RISK_CONFIG[result.overall_risk] || RISK_CONFIG.medium
    const Icon = config.icon

    return (
        <div className={`rounded-2xl border ${config.bg} ${config.border} p-6 space-y-3`}>
            <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl bg-white/60 flex items-center justify-center border ${config.border}`}>
                    <Icon size={24} className={config.iconClass} />
                </div>
                <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                        Overall Assessment
                    </p>
                    <h2 className={`text-2xl font-extrabold ${config.text}`}>
                        {config.label}
                    </h2>
                </div>
            </div>

            <p className={`text-sm leading-relaxed ${config.text} opacity-80`}>
                {result.summary}
            </p>

            <div className={`border-t ${config.border} pt-3`}>
                <p className="text-xs font-semibold text-slate-600 mb-1">Recommendation</p>
                <p className={`text-sm font-medium ${config.text}`}>
                    {result.overall_recommendation}
                </p>
            </div>
        </div>
    )
}
