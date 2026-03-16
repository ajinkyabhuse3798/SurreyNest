/**
 * SubscriptionStats — 4 subscription metric cards.
 */
import { Crown, Clock, PoundSterling, TrendingUp } from 'lucide-react'

const CARDS = [
    {
        key: 'active_pro',
        label: 'Active Pro',
        icon: Crown,
        bg: 'bg-amber-50',
        text: 'text-amber-600',
        format: (v) => v.toLocaleString(),
    },
    {
        key: 'expiring_soon',
        label: 'Expiring in 7 days',
        icon: Clock,
        bg: 'bg-amber-50',
        text: 'text-amber-600',
        format: (v) => v.toLocaleString(),
    },
    {
        key: 'total_revenue_monthly',
        label: 'Est. Monthly Revenue',
        icon: PoundSterling,
        bg: 'bg-emerald-50',
        text: 'text-emerald-600',
        format: (v) => `£${v.toFixed(2)}/mo`,
    },
    {
        key: 'recent_conversions',
        label: 'Conversions (30d)',
        icon: TrendingUp,
        bg: 'bg-indigo-50',
        text: 'text-indigo-600',
        format: (v) => v.toLocaleString(),
    },
]

export default function SubscriptionStats({ stats }) {
    if (!stats) return null

    return (
        <div className="grid grid-cols-2 gap-4">
            {CARDS.map(({ key, label, icon: Icon, bg, text, format }) => (
                <div key={key} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                    <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center mb-3`}>
                        <Icon size={16} className={text} />
                    </div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-1">
                        {label}
                    </p>
                    <p className="text-2xl font-black text-slate-900">
                        {format(stats[key] ?? 0)}
                    </p>
                </div>
            ))}
        </div>
    )
}
