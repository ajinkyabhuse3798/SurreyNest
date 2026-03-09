/**
 * TrustBar — Horizontal trust badges with count-up effect.
 * Horizontally scrollable on mobile with scroll-snap.
 */
import { motion } from 'framer-motion'
import { TRUST_ITEMS } from '../../utils/homeData'

export default function TrustBar() {
    return (
        <section className="bg-white border-b border-slate-100/80">
            <div className="max-w-lg lg:max-w-5xl mx-auto px-4 py-4 lg:py-5">
                <div className="flex items-center justify-between gap-4 lg:gap-8 scroll-snap-x">
                    {TRUST_ITEMS.map(({ icon: Icon, label, desc }, i) => (
                        <motion.div
                            key={desc}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 * i, duration: 0.4 }}
                            className="flex items-center gap-2.5 lg:gap-3 flex-shrink-0"
                        >
                            <div className="w-9 h-9 lg:w-11 lg:h-11 rounded-xl bg-indigo-50 flex items-center justify-center">
                                <Icon size={16} className="text-indigo-600 lg:w-5 lg:h-5" />
                            </div>
                            <div>
                                <p className="text-sm lg:text-base font-extrabold text-slate-900 leading-none">{label}</p>
                                <p className="text-[10px] lg:text-xs text-slate-400 font-medium mt-0.5">{desc}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}
