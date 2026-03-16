/**
 * AnalyticsTab — signup trend chart + subscription stats.
 */
import { useState, useEffect } from 'react'
import { getSignupTrend, getSubscriptionStats } from '../../../services/adminApi'
import SignupChart from './SignupChart'
import SubscriptionStats from './SubscriptionStats'

export default function AnalyticsTab() {
    const [days, setDays] = useState(30)
    const [chartData, setChartData] = useState([])
    const [subStats, setSubStats] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        setLoading(true)
        setError(null)
        Promise.all([getSignupTrend(days), getSubscriptionStats()])
            .then(([trend, subs]) => {
                setChartData(trend.data || [])
                setSubStats(subs)
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false))
    }, [days])

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="animate-pulse bg-slate-100 rounded-2xl h-72" />
                <div className="grid grid-cols-2 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="animate-pulse bg-slate-100 rounded-2xl h-28" />
                    ))}
                </div>
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
        <div className="space-y-6">
            <SignupChart data={chartData} days={days} onDaysChange={setDays} />
            <SubscriptionStats stats={subStats} />
        </div>
    )
}
