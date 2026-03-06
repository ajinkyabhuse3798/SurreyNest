/**
 * MarketPulse — Seasonal availability indicator for Guildford rentals.
 *
 * Static component — no API needed. Uses the current month to show
 * where students are in the Guildford rental cycle and whether now
 * is a good time to search.
 *
 * Guildford cycle:
 *   Jan–Feb: Early Bird (supply rising)
 *   Mar–Jun: Peak/High Season (widest choice)
 *   Jul–Aug: Last Chance (dropping fast)
 *   Sep:     Term Start (slim pickings)
 *   Oct–Nov: Low Season (very few listings)
 *   Dec:     Off-Season (landlords list ahead)
 */
import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Clock, TrendingUp, TrendingDown, AlertTriangle, Sparkles, Calendar } from 'lucide-react'

// ── Month data ───────────────────────────────────────────────────────────────

const MONTHS = [
    { short: 'Jan', status: 'early', colour: '#F59E0B', supply: 45 },
    { short: 'Feb', status: 'early', colour: '#F59E0B', supply: 55 },
    { short: 'Mar', status: 'peak', colour: '#10B981', supply: 85 },
    { short: 'Apr', status: 'peak', colour: '#10B981', supply: 95 },
    { short: 'May', status: 'peak', colour: '#10B981', supply: 90 },
    { short: 'Jun', status: 'high', colour: '#10B981', supply: 80 },
    { short: 'Jul', status: 'last', colour: '#F59E0B', supply: 55 },
    { short: 'Aug', status: 'last', colour: '#F59E0B', supply: 35 },
    { short: 'Sep', status: 'low', colour: '#EF4444', supply: 15 },
    { short: 'Oct', status: 'low', colour: '#EF4444', supply: 10 },
    { short: 'Nov', status: 'low', colour: '#EF4444', supply: 12 },
    { short: 'Dec', status: 'offpeak', colour: '#F59E0B', supply: 25 },
]

const STATUS_CONFIG = {
    early: {
        label: 'Early Bird Season',
        badge: 'Good time to search',
        badgeColour: 'bg-amber-50 text-amber-700 border-amber-200',
        icon: Sparkles,
        advice: 'Listings are starting to appear for September move-ins. Early birds get the best picks — start browsing now.',
        emoji: '🟡',
    },
    peak: {
        label: 'Peak Season',
        badge: 'Great time to search',
        badgeColour: 'bg-green-50 text-green-700 border-green-200',
        icon: TrendingUp,
        advice: 'The widest selection of properties is live right now. Compare, shortlist, and secure your place before the rush.',
        emoji: '🟢',
    },
    high: {
        label: 'High Season',
        badge: 'Great time to search',
        badgeColour: 'bg-green-50 text-green-700 border-green-200',
        icon: TrendingUp,
        advice: 'Plenty of properties still available. This is your window — start signing contracts for September.',
        emoji: '🟢',
    },
    last: {
        label: 'Last Chance',
        badge: 'Act quickly',
        badgeColour: 'bg-amber-50 text-amber-700 border-amber-200',
        icon: AlertTriangle,
        advice: 'Properties are being snapped up fast. If you see something you like, don\'t wait — it may be gone tomorrow.',
        emoji: '🟡',
    },
    low: {
        label: 'Low Season',
        badge: 'Tough market',
        badgeColour: 'bg-red-50 text-red-700 border-red-200',
        icon: TrendingDown,
        advice: 'Most properties for this cycle are taken. Set up alerts and check back in January for next year\'s listings.',
        emoji: '🔴',
    },
    offpeak: {
        label: 'Off-Season',
        badge: 'Early listings appearing',
        badgeColour: 'bg-amber-50 text-amber-700 border-amber-200',
        icon: Sparkles,
        advice: 'Landlords are starting to list ahead of the next cycle. Get a head start by browsing what\'s coming.',
        emoji: '🟡',
    },
}

// ── Component ────────────────────────────────────────────────────────────────

export default function MarketPulse() {
    const currentMonth = useMemo(() => new Date().getMonth(), []) // 0-indexed
    const monthData = MONTHS[currentMonth]
    const config = STATUS_CONFIG[monthData.status]
    const StatusIcon = config.icon

    return (
        <section className="px-3 py-10 md:px-4 md:py-16">
            <div className="max-w-4xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-40px' }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                >
                    {/* Header */}
                    <div className="text-center mb-6 md:mb-8">
                        <div className="inline-flex items-center gap-2 bg-indigo-50 rounded-full px-4 py-1.5 mb-3">
                            <Clock size={14} className="text-indigo-600" />
                            <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">
                                MarketPulse
                            </span>
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 md:text-2xl mb-1">
                            Is now a good time to search?
                        </h2>
                        <p className="text-sm text-gray-500 max-w-lg mx-auto">
                            The Guildford rental market follows a predictable student cycle. Here's where we are right now.
                        </p>
                    </div>

                    {/* Main card */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-lg shadow-gray-100/50 overflow-hidden">
                        {/* Status header */}
                        <div className="px-4 py-4 md:px-6 md:py-5 border-b border-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${config.badgeColour.split(' ')[0]}`}>
                                    <StatusIcon size={20} className={config.badgeColour.split(' ')[1]} />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-900">{config.label}</p>
                                    <p className="text-xs text-gray-400">{MONTHS[currentMonth].short} {new Date().getFullYear()}</p>
                                </div>
                            </div>
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${config.badgeColour}`}>
                                {config.emoji} {config.badge}
                            </span>
                        </div>

                        {/* Timeline */}
                        <div className="px-4 py-5 md:px-6 md:py-6">
                            {/* Month bars */}
                            <div className="flex items-end gap-1 md:gap-1.5 mb-2 h-16">
                                {MONTHS.map((m, i) => {
                                    const isCurrentMonth = i === currentMonth
                                    return (
                                        <div key={m.short} className="flex-1 flex flex-col items-center gap-1 relative">
                                            {/* Pulse indicator for current month */}
                                            {isCurrentMonth && (
                                                <motion.div
                                                    className="absolute -top-1.5 w-2 h-2 rounded-full"
                                                    style={{ backgroundColor: m.colour }}
                                                    animate={{
                                                        scale: [1, 1.5, 1],
                                                        opacity: [1, 0.5, 1],
                                                    }}
                                                    transition={{
                                                        duration: 2,
                                                        repeat: Infinity,
                                                        ease: 'easeInOut',
                                                    }}
                                                />
                                            )}
                                            {/* Bar */}
                                            <motion.div
                                                className="w-full rounded-t-sm"
                                                style={{
                                                    backgroundColor: isCurrentMonth ? m.colour : `${m.colour}40`,
                                                    border: isCurrentMonth ? `2px solid ${m.colour}` : 'none',
                                                }}
                                                initial={{ height: 0 }}
                                                whileInView={{ height: `${m.supply * 0.6}px` }}
                                                viewport={{ once: true }}
                                                transition={{ duration: 0.5, delay: i * 0.04 }}
                                            />
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Month labels */}
                            <div className="flex gap-1 md:gap-1.5">
                                {MONTHS.map((m, i) => (
                                    <span
                                        key={m.short}
                                        className={`flex-1 text-center text-[9px] md:text-[10px] ${i === currentMonth
                                                ? 'font-bold text-gray-900'
                                                : 'text-gray-400'
                                            }`}
                                    >
                                        {m.short}
                                    </span>
                                ))}
                            </div>

                            {/* Legend */}
                            <div className="flex items-center justify-center gap-3 mt-3 text-[9px] md:text-[10px] text-gray-400">
                                <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-sm bg-green-500" />
                                    Peak
                                </span>
                                <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-sm bg-amber-500" />
                                    Moderate
                                </span>
                                <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-sm bg-red-500" />
                                    Low
                                </span>
                            </div>
                        </div>

                        {/* Advice */}
                        <div className="px-4 py-4 md:px-6 md:py-5 bg-gray-50/60 border-t border-gray-50">
                            <p className="text-sm text-gray-600 leading-relaxed mb-3">
                                {config.advice}
                            </p>
                            <div className="flex items-center gap-4 text-[10px] md:text-xs text-gray-400">
                                <span className="flex items-center gap-1">
                                    <Calendar size={11} />
                                    Peak: Mar–Jun
                                </span>
                                <span className="w-1 h-1 rounded-full bg-gray-300" />
                                <span>🎓 Term start: Sep</span>
                                <span className="w-1 h-1 rounded-full bg-gray-300" />
                                <span>Based on Guildford rental data</span>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    )
}
