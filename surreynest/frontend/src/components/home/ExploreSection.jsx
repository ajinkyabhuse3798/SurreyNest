/**
 * ExploreSection — Heatmap section with refined styling.
 * API connection preserved: GuildfordHeatmap → fetchHeatmapSectors()
 */
import { motion } from 'framer-motion'
import { Map } from 'lucide-react'
import GuildfordHeatmap from '../GuildfordHeatmap'
import { AnimatedSection, fadeUp } from '../../utils/homeData'

export default function ExploreSection() {
    return (
        <AnimatedSection className="pt-10 pb-8 lg:pt-16 lg:pb-12">
            <div className="px-4 md:px-6 mb-5 max-w-lg lg:max-w-5xl mx-auto">
                <motion.div variants={fadeUp} className="flex items-center gap-2 mb-2 text-indigo-600">
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                        <Map size={14} />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider">Local Insights</span>
                </motion.div>
                <motion.h2 variants={fadeUp} className="text-[22px] md:text-3xl font-bold text-slate-900 leading-tight mb-1">
                    Explore Guildford's Neighbourhoods
                </motion.h2>
                <motion.p variants={fadeUp} className="text-slate-500 text-sm lg:text-base font-medium max-w-md">
                    Tap a sector to discover rent, safety, and HMO data for each area.
                </motion.p>
            </div>

            <motion.div variants={fadeUp} className="px-4 max-w-lg lg:max-w-5xl mx-auto">
                <GuildfordHeatmap />
            </motion.div>
        </AnimatedSection>
    )
}
