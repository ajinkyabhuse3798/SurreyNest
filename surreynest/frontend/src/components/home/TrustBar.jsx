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
                <div className="flex items-center justify-between gap-4 lg:gap-8">
                    {items ? items.map(({ icon, label, desc }, i) => (
                        <motion.div
                            key={desc}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 * i, duration: 0.4 }}
                            className="flex items-center gap-2.5 lg:gap-3 flex-shrink-0"
                        >
                            <div className="w-9 h-9 lg:w-11 lg:h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                                <span className="material-symbols-outlined text-primary text-base lg:text-xl">{icon}</span>
                            </div>
                            <div>
                                <p className="text-sm lg:text-base font-extrabold text-slate-900 leading-none">{label}</p>
                                <p className="text-[10px] lg:text-xs text-slate-400 font-medium mt-0.5">{desc}</p>
                            </div>
                        </motion.div>
                    )) : (
                        // Skeleton while loading
                        Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-2.5 lg:gap-3 flex-shrink-0">
                                <div className="w-9 h-9 lg:w-11 lg:h-11 rounded-xl bg-slate-100 animate-pulse" />
                                <div className="space-y-1.5">
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
