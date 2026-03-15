/**
 * TrustBar — Horizontal trust badges with count-up effect.
 * Horizontally scrollable on mobile with scroll-snap.
 * Updated for Stitch branding: amber primary, Material Symbols icons.
 */
import { motion } from 'framer-motion'

const TRUST_ITEMS = [
    { icon: 'bar_chart', label: '500+', desc: 'Properties analysed' },
    { icon: 'trending_up', label: '94%', desc: 'Accuracy rate' },
    { icon: 'group', label: '2.5K+', desc: 'Active users' },
    { icon: 'shield', label: '100%', desc: 'Data driven' },
]

export default function TrustBar() {
    return (
        <section className="bg-white border-b border-slate-100/80">
            <div className="max-w-lg lg:max-w-5xl mx-auto px-4 py-4 lg:py-5">
                <div className="flex items-center justify-between gap-4 lg:gap-8 scroll-snap-x">
                    {TRUST_ITEMS.map(({ icon, label, desc }, i) => (
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
                    ))}
                </div>
            </div>
        </section>
    )
}
