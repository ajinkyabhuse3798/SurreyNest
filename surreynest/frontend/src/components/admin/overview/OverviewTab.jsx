/**
 * OverviewTab — 6 KPI cards fetched from /api/admin/stats/overview.
 */
import { useState, useEffect } from 'react'
import { Users, Crown, Home, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import { getOverviewStats } from '../../../services/adminApi'

const KPI_CONFIG = [
    { key: 'total_users',       label: 'Total Users',        icon: Users,       bg: 'bg-blue-50',   text: 'text-blue-600' },
    { key: 'pro_users',         label: 'Pro Users',          icon: Crown,       bg: 'bg-amber-50',  text: 'text-amber-600' },
    { key: 'total_properties',  label: 'Total Properties',   icon: Home,        bg: 'bg-slate-50',  text: 'text-slate-600' },
    { key: 'reviews_pending',   label: 'Pending Reviews',    icon: Clock,       bg: 'bg-amber-50',  text: 'text-amber-600', clickTab: 'reviews' },
    { key: 'reviews_approved',  label: 'Approved Reviews',   icon: CheckCircle, bg: 'bg-emerald-50',text: 'text-emerald-600' },
    { key: 'reviews_flagged',   label: 'Flagged Reviews',    icon: AlertCircle, bg: 'bg-rose-50',   text: 'text-rose-600' },
]

export default function OverviewTab({ onTabChange, onPendingCount }) {
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        getOverviewStats()
            .then((s) => {
                setStats(s)
                onPendingCount?.(s.reviews_pending ?? 0)
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false))
    }, [])

    if (loading) {
        return (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="animate-pulse bg-slate-100 rounded-2xl h-28" />
                ))}
            </div>
        )
    }

    if (error) {
        return (
            <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm text-rose-700">
                {error}
            </div>
        )
    }

    return (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {KPI_CONFIG.map(({ key, label, icon: Icon, bg, text, clickTab }) => (
                <div
                    key={key}
                    onClick={clickTab ? () => onTabChange?.(clickTab) : undefined}
                    className={`bg-white rounded-2xl border border-slate-100 p-5 shadow-sm ${
                        clickTab ? 'cursor-pointer hover:shadow-md transition-shadow' : ''
                    }`}
                >
                    <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center mb-3`}>
                        <Icon size={16} className={text} />
                    </div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-1">
                        {label}
                    </p>
                    <p className="text-3xl font-black text-slate-900">
                        {(stats[key] ?? 0).toLocaleString()}
                    </p>
                </div>
            ))}
        </div>
    )
}
