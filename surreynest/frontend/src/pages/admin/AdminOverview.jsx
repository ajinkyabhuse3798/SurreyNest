import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Users, Crown, CreditCard, Flag, TrendingUp, ArrowRight } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { adminApi } from '../../services/adminApi'

function MetricCard({ title, value, icon: Icon, to, trend }) {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-5">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
                        <p className="text-2xl font-bold text-slate-900">{value}</p>
                    </div>
                    <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-primary">
                        <Icon size={24} />
                    </div>
                </div>
                {trend && (
                    <div className="mt-4 flex items-center text-sm">
                        <TrendingUp size={16} className="text-emerald-500 mr-1.5" />
                        <span className="text-emerald-600 font-medium">{trend}</span>
                        <span className="text-slate-500 ml-1.5">vs last month</span>
                    </div>
                )}
            </div>
            {to && (
                <div className="bg-slate-50 px-5 py-3 border-t border-slate-100">
                    <Link to={to} className="text-sm font-medium text-primary hover:text-primary/80 flex items-center">
                        View details <ArrowRight size={16} className="ml-1.5" />
                    </Link>
                </div>
            )}
        </div>
    )
}

export default function AdminOverview() {
    const [stats, setStats] = useState(null)
    const [chartData, setChartData] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        let mounted = true
        setLoading(true)

        Promise.all([
            adminApi.getOverviewStats(),
            adminApi.getSignupTrends(30)
        ])
            .then(([overviewRes, chartRes]) => {
                if (!mounted) return
                setStats(overviewRes)
                
                // Format dates for chart e.g "2026-03-15" -> "Mar 15"
                const formattedData = chartRes.data.map(d => {
                    const date = new Date(d.date)
                    return {
                        ...d,
                        displayDate: date.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })
                    }
                })
                setChartData(formattedData)
            })
            .catch(err => {
                if (mounted) setError('Failed to load dashboard data.')
                console.error(err)
            })
            .finally(() => {
                if (mounted) setLoading(false)
            })

        return () => { mounted = false }
    }, [])

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center">
                    <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
                    <p className="text-sm text-slate-500 font-medium">Loading dashboard...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl m-6">
                {error}
            </div>
        )
    }

    // Monthly revenue approximation based on pro_users (at £5.99/mo)
    const monthlyRevenue = `£${(stats.pro_users * 5.99).toFixed(2)}`

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Overview</h1>
                    <p className="text-sm text-slate-500 mt-1">Platform metrics and recent activity.</p>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard 
                    title="Total Users" 
                    value={stats.total_users.toLocaleString()} 
                    icon={Users} 
                    to="/admin/users"
                />
                <MetricCard 
                    title="Active Pro Subs" 
                    value={stats.pro_users.toLocaleString()} 
                    icon={Crown} 
                    to="/admin/subscriptions"
                />
                <MetricCard 
                    title="Estimated MRR" 
                    value={monthlyRevenue} 
                    icon={CreditCard} 
                    to="/admin/subscriptions"
                />
                <MetricCard 
                    title="Pending Reviews" 
                    value={stats.reviews_pending.toLocaleString()} 
                    icon={Flag} 
                    to="/admin/reviews"
                />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Signups Chart */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200">
                    <div className="px-6 py-5 border-b border-slate-100">
                        <h2 className="text-lg font-semibold text-slate-900">Signups (Last 30 Days)</h2>
                    </div>
                    <div className="p-6 h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ea871d" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#ea871d" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                <XAxis 
                                    dataKey="displayDate" 
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748B', fontSize: 12 }}
                                    dy={10}
                                    minTickGap={30}
                                />
                                <YAxis 
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748B', fontSize: 12 }}
                                    allowDecimals={false}
                                />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    itemStyle={{ color: '#0F172A', fontWeight: 600 }}
                                    formatter={(value) => [value, 'Signups']}
                                />
                                <Area 
                                    type="monotone" 
                                    dataKey="count" 
                                    stroke="#ea871d" 
                                    strokeWidth={3}
                                    fillOpacity={1} 
                                    fill="url(#colorCount)" 
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Platform Summary List */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                    <div className="px-6 py-5 border-b border-slate-100">
                        <h2 className="text-lg font-semibold text-slate-900">Platform Summary</h2>
                    </div>
                    <div className="p-0">
                        <ul className="divide-y divide-slate-100">
                            <li className="px-6 py-4 flex items-center justify-between">
                                <span className="text-sm text-slate-600">Total Properties</span>
                                <span className="text-sm font-bold text-slate-900">{stats.total_properties.toLocaleString()}</span>
                            </li>
                            <li className="px-6 py-4 flex items-center justify-between">
                                <span className="text-sm text-slate-600">Total Approved Reviews</span>
                                <span className="text-sm font-bold text-slate-900">{stats.reviews_approved.toLocaleString()}</span>
                            </li>
                            <li className="px-6 py-4 flex items-center justify-between">
                                <span className="text-sm text-slate-600">Total Flagged/Rejected</span>
                                <span className="text-sm font-bold text-slate-900">{stats.reviews_flagged.toLocaleString()}</span>
                            </li>
                        </ul>
                    </div>
                </div>

            </div>
        </div>
    )
}
