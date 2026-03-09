/**
 * FeaturesSection — 3-column glassmorphism features grid.
 * Each card has a gradient icon background and mobile left-border accent.
 */
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Sparkles, ChevronRight } from 'lucide-react'
import { AnimatedSection, fadeUp, FEATURES } from '../../utils/homeData'

export default function FeaturesSection() {
    return (
        <AnimatedSection className="px-4 py-10 lg:py-16 bg-slate-50/60">
            <div className="max-w-lg lg:max-w-5xl mx-auto">
                {/* Section header */}
                <motion.div variants={fadeUp} className="mb-8 lg:mb-12 px-2 lg:text-center">
                    <div className="flex items-center gap-2 mb-2 lg:justify-center">
                        <Sparkles size={16} className="text-indigo-600" />
                        <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Features</span>
                    </div>
                    <h3 className="text-xl md:text-2xl lg:text-3xl font-bold text-slate-900 mb-1">
                        Why Students Love SurreyNest
                    </h3>
                    <p className="text-slate-500 text-sm lg:text-base mt-1 font-medium">
                        Smarter tools for stress-free renting.
                    </p>
                </motion.div>

                {/* Feature cards */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
                    {FEATURES.map(({ icon: Icon, title, desc, iconBg, iconText, link, linkLabel }, i) => (
                        <motion.div
                            key={title}
                            variants={fadeUp}
                            className={`glass-card rounded-2xl p-5 lg:p-7 flex lg:flex-col gap-4 items-start hover:shadow-glass-lg transition-all duration-300 group ${
                                /* Mobile: left border accent */
                                i === 0 ? 'border-l-4 border-l-emerald-400 lg:border-l-0' :
                                    i === 1 ? 'border-l-4 border-l-indigo-500 lg:border-l-0' :
                                        'border-l-4 border-l-amber-400 lg:border-l-0'
                                }`}
                        >
                            {/* Icon with gradient background */}
                            <div className={`w-12 h-12 lg:w-14 lg:h-14 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                                <Icon size={22} className={iconText || 'text-white'} />
                            </div>

                            <div className="flex-1">
                                <h4 className="font-bold text-slate-900 text-base lg:text-lg mb-1.5">{title}</h4>
                                <p className="text-slate-500 text-sm leading-relaxed mb-3">{desc}</p>
                                <Link
                                    to={link}
                                    className="text-indigo-600 text-sm font-bold flex items-center gap-1 hover:gap-2 transition-all"
                                >
                                    {linkLabel} <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                                </Link>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </AnimatedSection>
    )
}
