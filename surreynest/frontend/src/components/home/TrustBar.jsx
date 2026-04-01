/**
 * TrustBar, real platform statistics fetched live from /api/stats.
 * Shows skeleton placeholders while loading, real numbers once ready.
 */
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import api from '../../services/api'

function fmt(n) {
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K+'
    return n.toLocaleString()
}

export default function TrustBar() {
    const [stats, setStats] = useState(null)

    useEffect(() => {
        api.get('/api/stats')
            .then(r => setStats(r.data))
            .catch(() => setStats(null)) // fail silently, don't break the page
    }, [])

    const items = stats ? [
        { icon: 'home_work',  label: fmt(stats.properties_indexed), desc: 'Properties indexed' },
        { icon: 'map',        label: `${stats.districts_covered} districts`, desc: 'Guildford areas covered' },
        { icon: 'source',     label: `${stats.data_sources} sources`, desc: 'Official UK data sources' },
    ] : null

    return (
        <section className="bg-white border-b border-slate-100/80">
            <div className="max-w-lg lg:max-w-5xl mx-auto px-4 py-4 lg:py-5">
                <div
                    data-testid="trust-bar-grid"
                    className="grid grid-cols-3 gap-2 sm:gap-4 lg:gap-8"
                >
                    {items ? items.map(({ icon, label, desc }, i) => (
                        <motion.div
                            key={desc}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 * i, duration: 0.4 }}
                            className="flex min-w-0 flex-col items-start gap-2 rounded-2xl bg-slate-50/80 p-3 sm:flex-row sm:items-center sm:bg-transparent sm:p-0 lg:gap-3"
                        >
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 lg:h-11 lg:w-11">
                                <span className="material-symbols-outlined text-sm text-primary lg:text-xl">{icon}</span>
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-extrabold leading-none text-slate-900 sm:text-sm lg:text-base">
                                    {label}
                                </p>
                                <p className="mt-0.5 text-[10px] font-medium leading-snug text-slate-400 lg:text-xs">
                                    {desc}
                                </p>
                            </div>
                        </motion.div>
                    )) : (
                        // Skeleton while loading
                        Array.from({ length: 3 }).map((_, i) => (
                            <div
                                key={i}
                                className="flex min-w-0 flex-col items-start gap-2 rounded-2xl bg-slate-50/80 p-3 sm:flex-row sm:items-center sm:bg-transparent sm:p-0 lg:gap-3"
                            >
                                <div className="h-9 w-9 rounded-xl bg-slate-100 animate-pulse lg:h-11 lg:w-11" />
                                <div className="min-w-0 space-y-1.5">
                                    <div className="h-3.5 w-16 bg-slate-100 rounded animate-pulse" />
                                    <div className="h-2.5 w-24 bg-slate-100 rounded animate-pulse" />
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </section>
    )
}
