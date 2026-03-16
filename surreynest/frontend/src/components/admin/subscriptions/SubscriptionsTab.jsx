/**
 * SubscriptionsTab — read-only list of Pro subscribers.
 */
import { useState, useEffect } from 'react'
import { getSubscriptions } from '../../../services/adminApi'

function statusBadge(proExpiresAt) {
    if (!proExpiresAt) return { label: 'Active', cls: 'bg-emerald-100 text-emerald-700' }
    const expires = new Date(proExpiresAt)
    const now = new Date()
    if (expires < now) return { label: 'Expired', cls: 'bg-rose-100 text-rose-700' }
    const sevenDays = new Date(now.getTime() + 7 * 86400000)
    if (expires < sevenDays) return { label: 'Expiring soon', cls: 'bg-amber-100 text-amber-700' }
    return { label: 'Active', cls: 'bg-emerald-100 text-emerald-700' }
}

function fmt(iso) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-GB')
}

export default function SubscriptionsTab() {
    const [subscribers, setSubscribers] = useState([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [pages, setPages] = useState(1)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    function load(p = page) {
        setLoading(true)
        setError(null)
        getSubscriptions({ page: p, per_page: 20 })
            .then((data) => {
                setSubscribers(data.subscribers || [])
                setTotal(data.total || 0)
                setPages(data.pages || 1)
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false))
    }

    useEffect(() => { load(page) }, [page])

    if (loading) {
        return <div className="animate-pulse bg-slate-100 rounded-2xl h-64" />
    }

    if (error) {
        return (
            <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm text-rose-700">
                {error}
            </div>
        )
    }

    return (
        <div>
            {/* Summary bar */}
            <div className="bg-white rounded-2xl border border-slate-100 px-5 py-3 shadow-sm mb-4 flex items-center gap-2 text-sm text-slate-600">
                <span className="font-semibold text-slate-900">{total}</span> Pro subscribers
                <span className="text-slate-300 mx-1">·</span>
                Est.{' '}
                <span className="font-semibold text-emerald-700">
                    £{(total * 5.99).toFixed(2)}/mo
                </span>
            </div>

            {subscribers.length === 0 ? (
                <div className="py-16 text-center text-sm text-slate-400">No Pro subscribers yet.</div>
            ) : (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 text-left">
                                <th className="px-4 py-3 text-xs font-semibold text-slate-500">Email</th>
                                <th className="px-4 py-3 text-xs font-semibold text-slate-500">Pro Since</th>
                                <th className="px-4 py-3 text-xs font-semibold text-slate-500">Expires</th>
                                <th className="px-4 py-3 text-xs font-semibold text-slate-500">Last Login</th>
                                <th className="px-4 py-3 text-xs font-semibold text-slate-500">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {subscribers.map((s) => {
                                const badge = statusBadge(s.pro_expires_at)
                                return (
                                    <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-4 py-3 text-slate-800 font-medium">{s.email}</td>
                                        <td className="px-4 py-3 text-slate-500">{fmt(s.created_at)}</td>
                                        <td className="px-4 py-3 text-slate-500">{fmt(s.pro_expires_at)}</td>
                                        <td className="px-4 py-3 text-slate-500">{fmt(s.last_login)}</td>
                                        <td className="px-4 py-3">
                                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${badge.cls}`}>
                                                {badge.label}
                                            </span>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {pages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-6">
                    <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="text-sm text-slate-500 hover:text-slate-800 disabled:opacity-40 transition-colors"
                    >
                        Previous
                    </button>
                    <span className="text-sm text-slate-600">Page {page} of {pages}</span>
                    <button
                        onClick={() => setPage((p) => Math.min(pages, p + 1))}
                        disabled={page === pages}
                        className="text-sm text-slate-500 hover:text-slate-800 disabled:opacity-40 transition-colors"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    )
}
