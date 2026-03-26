/**
 * GuildfordAttractions, "Things to Do in Guildford" card grid.
 * Static content showcasing why Guildford is a great place to live.
 * Shown at the bottom of the SafetyDetail page.
 */
import { motion } from 'framer-motion'

const ATTRACTIONS = [
    {
        icon: 'castle',
        name: 'Guildford Castle',
        description: 'Walk up to the 12th-century Norman keep for sweeping views over the town. Entry to the grounds is free.',
        tag: 'Heritage',
        gradient: 'from-amber-500 to-orange-500',
        tagBg: 'bg-amber-100 text-amber-700',
    },
    {
        icon: 'water',
        name: 'River Wey',
        description: 'A National Trust waterway winding right through town. Great for a morning run, afternoon cycle, or punting in summer.',
        tag: 'Nature',
        gradient: 'from-teal-500 to-cyan-500',
        tagBg: 'bg-teal-100 text-teal-700',
    },
    {
        icon: 'school',
        name: 'University of Surrey',
        description: 'Consistently top-10 in the UK, with a proper campus feel just 10 minutes from the high street.',
        tag: 'Education',
        gradient: 'from-orange-500 to-amber-500',
        tagBg: 'bg-orange-100 text-orange-700',
    },
    {
        icon: 'theater_comedy',
        name: 'G Live',
        description: "Guildford's main venue for live comedy, music, and theatre. There's always something on.",
        tag: 'Entertainment',
        gradient: 'from-pink-500 to-rose-500',
        tagBg: 'bg-pink-100 text-pink-700',
    },
    {
        icon: 'shopping_bag',
        name: 'The Friary & High Street',
        description: 'A cobbled high street with independent cafés, pubs, and restaurants, plus the usual big names in the Friary shopping centre.',
        tag: 'Shopping',
        gradient: 'from-violet-500 to-purple-600',
        tagBg: 'bg-violet-100 text-violet-700',
    },
    {
        icon: 'church',
        name: 'Guildford Cathedral',
        description: 'Sits just above the university on Stag Hill. The gardens are quiet and the views are worth the walk up.',
        tag: 'Landmark',
        gradient: 'from-slate-500 to-slate-700',
        tagBg: 'bg-slate-100 text-slate-700',
    },
]

const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }

export default function GuildfordAttractions() {
    return (
        <div>
            <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-primary text-base">explore</span>
                </div>
                <div>
                    <h2 className="text-base font-bold text-slate-800">There's more to Guildford than the stats</h2>
                    <p className="text-xs text-slate-400">A few reasons why students enjoy living here</p>
                </div>
            </div>

            <motion.div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-40px' }}
                variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
            >
                {ATTRACTIONS.map(({ icon, name, description, tag, gradient, tagBg }) => (
                    <motion.div
                        key={name}
                        variants={fadeUp}
                        className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                    >
                        {/* Gradient banner */}
                        <div className={`h-24 bg-gradient-to-br ${gradient} flex items-center justify-center relative overflow-hidden`}>
                            <div className="absolute inset-0 bg-black/10" />
                            <span className="material-symbols-outlined text-5xl text-white/80 relative z-10">{icon}</span>
                        </div>
                        <div className="p-4">
                            <div className="flex items-center justify-between mb-1.5">
                                <h3 className="text-sm font-bold text-slate-800">{name}</h3>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tagBg}`}>{tag}</span>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
                        </div>
                    </motion.div>
                ))}
            </motion.div>
        </div>
    )
}
