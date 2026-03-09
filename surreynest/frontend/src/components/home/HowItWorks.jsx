/**
 * HowItWorks — 3-step timeline.
 * Mobile: vertical timeline with dashed connecting line.
 * Desktop: horizontal 3-column with connecting dashed line between circles.
 */
import { motion } from 'framer-motion'
import { AnimatedSection, fadeUp, STEPS } from '../../utils/homeData'

export default function HowItWorks() {
    return (
        <AnimatedSection className="px-4 py-10 lg:py-16 bg-gradient-to-b from-indigo-50/40 to-white">
            <div className="max-w-lg lg:max-w-5xl mx-auto">
                {/* Header */}
                <motion.div variants={fadeUp} className="mb-8 lg:mb-12 text-center">
                    <span className="inline-block text-xs font-bold uppercase tracking-wider text-indigo-600 mb-2">Get Started</span>
                    <h3 className="text-xl md:text-2xl lg:text-3xl font-bold text-slate-900 mb-1">How It Works</h3>
                    <p className="text-slate-500 text-sm lg:text-base font-medium">Three simple steps to your ideal home.</p>
                </motion.div>

                {/* Mobile: vertical timeline */}
                <div className="relative pl-8 md:pl-10 lg:hidden">
                    <div className="absolute left-[15px] md:left-[19px] top-6 bottom-6 w-[2px] border-l-2 border-dashed border-indigo-200" />
                    <div className="flex flex-col gap-8">
                        {STEPS.map(({ num, icon: Icon, title, desc }) => (
                            <motion.div key={num} variants={fadeUp} className="relative flex gap-4 items-start">
                                <div className="absolute -left-8 md:-left-10 w-9 h-9 md:w-10 md:h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm md:text-base font-bold shadow-lg shadow-indigo-600/25 z-10">
                                    {num}
                                </div>
                                <div className="glass-card rounded-2xl p-4 md:p-5 flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Icon size={16} className="text-indigo-600" />
                                        <h4 className="font-bold text-slate-900 text-base">{title}</h4>
                                    </div>
                                    <p className="text-slate-500 text-sm leading-snug">{desc}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Desktop: horizontal 3-column */}
                <div className="hidden lg:grid lg:grid-cols-3 gap-8 relative">
                    {/* Connecting dashed line */}
                    <div className="absolute top-7 left-[16.67%] right-[16.67%] h-[2px] border-t-2 border-dashed border-indigo-200 z-0" />

                    {STEPS.map(({ num, icon: Icon, title, desc }) => (
                        <motion.div key={num} variants={fadeUp} className="text-center relative z-10">
                            <div className="w-14 h-14 rounded-full bg-indigo-600 text-white flex items-center justify-center text-lg font-bold shadow-lg shadow-indigo-600/25 mx-auto mb-5">
                                {num}
                            </div>
                            <div className="glass-card rounded-2xl p-6">
                                <div className="flex items-center justify-center gap-2 mb-2">
                                    <Icon size={18} className="text-indigo-600" />
                                    <h4 className="font-bold text-slate-900 text-lg">{title}</h4>
                                </div>
                                <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </AnimatedSection>
    )
}
