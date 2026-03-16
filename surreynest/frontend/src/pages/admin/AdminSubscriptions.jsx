import { useState, useEffect, useCallback } from 'react'
import { Crown, CreditCard, Clock, Activity, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { adminApi } from '../../services/adminApi'

function StatCard({ title, value, subtitle, icon: Icon, trend }) {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                    <Icon size={20} />
                </div>
                {trend && (
                    <span className="text-xs font-semibold px-2 py-1 bg-emerald-50 text-emerald-600 rounded-full">
                        {trend}
                    </span>
                )}
            </div>
            <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
            <p className="text-sm font-medium text-slate-900 mt-1">{title}</p>
            {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
        </div>
    )
}

export default function AdminSubscriptions() {
    const [stats, setStats] = useState(null)
    const [subscribers, setSubscribers] = useState([])
    const [loadingStats, setLoadingStats] = useState(true)
    const [loadingSubs, setLoadingSubs] = useState(true)
    
    const [page, setPage] = useState(1)
    const [total, setTotal] = useState(0)
    const [pages, setPages] = useState(1)

    useEffect(() => {
        adminApi.getSubscriptionStats()
            .then(res => setStats(res))
            .catch(err => console.error(err))
            .finally(() => setLoadingStats(false))
    }, [])

    const fetchSubscribers = useCallback(async () => {
        setLoadingSubs(true)
        try {
            const res = await adminApi.getSubscribers({ page, per_page: 20 })
            setSubscribers(res.subscribers)
            setTotal(res.total)
            setPages(res.pages)
        } catch (err) {
            console.error(err)
        } finally {
            setLoadingSubs(false)
        }
    }, [page])

    useEffect(() => {
        fetchSubscribers()
    }, [fetchSubscribers])

    function exportCSV() {
        if (!subscribers.length) return
        const headers = "id,email,is_pro,pro_expires_at,created_at\n"
        const rows = subscribers.map(s => `${s.id},${s.email},${s.is_pro},${s.pro_expires_at || ''},${s.created_at}`).join("\n")
        const blob = new Blob([headers + rows], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `pro_subscribers_${new Date().toISOString().split('T')[0]}.csv`
        a.click()
    }

    if (loadingStats) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="w-8 h-8 border-4 border-amber-200 border-t-amber-500 rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Pro Subscriptions</h1>
                <p className="text-sm text-slate-500 mt-1">Monitor revenue, active subscribers, and churn.</p>
            </div>

            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                    title="Active Pro Users"
                    value={stats?.active_pro?.toLocaleString() || '0'}
                    subtitle="Currently paying or comped"
                    icon={Crown}
                />
                <StatCard 
                    title="Monthly Revenue"
                    value={`£${stats?.total_revenue_monthly?.toFixed(2) || '0.00'}`}
                    subtitle="Estimated recurring (MRR)"
                    icon={CreditCard}
                />
                <StatCard 
                    title="Recent Conversions"
                    value={`+${stats?.recent_conversions || 0}`}
                    subtitle="Upgraded in last 30 days"
                    icon={Activity}
                    trend="Up"
                />
                <StatCard 
                    title="Expiring Soon"
                    value={stats?.expiring_soon || 0}
                    subtitle="Within next 7 days"
                    icon={Clock}
                />
            </div>

            {/* Subscriber List */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-8">
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-4">
                    <h2 className="text-lg font-semibold text-slate-900">Active Subscribers Overview</h2>
                    <button 
                        onClick={exportCSV}
                        className="flex items-center text-sm font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-4 py-2 transition-colors"
                    >
                        <Download size={16} className="mr-2 text-slate-400" />
                        Export CSV
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4">User Email</th>
                                <th className="px-6 py-4">Joined Platform</th>
                                <th className="px-6 py-4">Last Login</th>
                                <th className="px-6 py-4">Pro Expiry</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loadingSubs ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-12 text-center text-slate-500">
                                        Loading subscriber list...
                                    </td>
                                </tr>
                            ) : subscribers.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-12 text-center text-slate-500">
                                        No active Pro subscribers found.
                                    </td>
                                </tr>
                            ) : (
                                subscribers.map((sub) => (
                                    <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-slate-900">
                                            {sub.email}
                                        </td>
                                        <td className="px-6 py-4">
                                            {new Date(sub.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            {sub.last_login ? new Date(sub.last_login).toLocaleDateString() : '—'}
                                        </td>
                                        <td className="px-6 py-4">
                                            {sub.pro_expires_at ? (
                                                <span className={`${new Date(sub.pro_expires_at) < new Date() ? 'text-red-600 font-medium' : ''}`}>
                                                    {new Date(sub.pro_expires_at).toLocaleDateString()}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400 italic">Lifetime / Indefinite</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {!loadingSubs && pages > 1 && (
                    <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                        <span className="text-sm text-slate-500">
                            Showing page <span className="font-medium text-slate-900">{page}</span> of <span className="font-medium text-slate-900">{pages}</span> (Total {total})
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                disabled={page === 1}
                                onClick={() => setPage(p => p - 1)}
                                className="p-1 border border-slate-200 rounded-md text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <button
                                disabled={page === pages}
                                onClick={() => setPage(p => p + 1)}
                                className="p-1 border border-slate-200 rounded-md text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
