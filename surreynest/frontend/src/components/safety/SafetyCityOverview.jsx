/**
 * SafetyCityOverview, source-backed context cards for the safety page.
 * Shown at the top of the SafetyDetail page below the hero.
 */
import { motion } from 'framer-motion'

const STATS = [
    {
        icon: 'verified_user',
        title: "One of England and Wales' safest places",
        sub: 'Surrey-i Community Safety · February 2025',
        color: 'text-emerald-700',
        bg: 'bg-emerald-50',
        border: 'border-emerald-100',
        featured: true,
    },
    {
        icon: 'train',
        value: '35 min',
        label: 'To London Waterloo',
        sub: 'South Western Railway',
        color: 'text-amber-600',
        bg: 'bg-amber-50',
        border: 'border-amber-100',
    },
    {
        icon: 'school',
        value: 'Top 10',
        label: 'UK University',
        sub: 'University of Surrey',
        color: 'text-amber-600',
        bg: 'bg-amber-50',
        border: 'border-amber-100',
    },
]

const fadeUp = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }

export default function SafetyCityOverview() {
    return (
        <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mb-6"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
            variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
        >
            {STATS.map(({ icon, value, title, label, sub, color, bg, border, featured }) => (
                <motion.div
                    key={title || label}
                    variants={fadeUp}
                    className={`bg-white rounded-2xl border ${border} shadow-sm p-4 sm:p-5 flex items-center gap-3 ${featured ? 'sm:col-span-2 xl:col-span-2' : ''}`}
                >
                    <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                        <span className={`material-symbols-outlined text-xl ${color}`}>{icon}</span>
                    </div>
                    <div className="min-w-0">
                        {value ? (
                            <>
                                <p className={`text-xl font-black ${color} leading-none`}>{value}</p>
                                <p className="text-xs font-bold text-slate-700 mt-0.5 truncate">{label}</p>
                                <p className="text-[10px] text-slate-400 truncate">{sub}</p>
                            </>
                        ) : (
                            <>
                                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">About Guildford</p>
                                <p className={`mt-1 text-sm sm:text-base font-black leading-snug ${color}`}>{title}</p>
                                <p className="mt-1 text-[11px] sm:text-xs text-slate-500">{sub}</p>
                            </>
                        )}
                    </div>
                </motion.div>
            ))}
        </motion.div>
    )
}
