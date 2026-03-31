/**
 * ExploreSection, Guildford safety teaser with map image and feature bullets.
 * Matches the Stitch-style interactive map teaser section.
 */
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }

export default function ExploreSection() {
    return (
        <section className="py-16 md:py-24 px-4 md:px-6 overflow-hidden">
            <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
                {/* Map image */}
                <motion.div
                    className="w-full lg:w-1/2"
                    initial={{ opacity: 0, x: -30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: '-60px' }}
                    transition={{ duration: 0.6 }}
                >
                    <div className="relative glass p-2 rounded-[2rem] shadow-2xl rotate-1 lg:rotate-2">
                        <div className="rounded-[1.5rem] overflow-hidden h-[300px] md:h-[400px] w-full relative">
                            <div className="absolute inset-0 bg-slate-200 animate-pulse" />
                            <img
                                className="w-full h-full object-cover relative z-10"
                                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBez5e4rXO1U9r-yYOwiQv5Nh-mI8Stem_zk3SLMQ7ZKI8Zs7aZURUA3vOzDGw7x9XKc4aj7FyMtXu1EHOgs-vZWledhHYnjx4XpV51jjkbMtT-Sus3qPm1SQ6LXUTwYsDwNsyyRyCJ5ByovXEX2_jCM8fOxhukreqlq8SBPTALipCX_i2qpq1l1pJ63IWm8qMSUB7QLVIUw2FFpAVkEwwD-lyQ4731kBoTqO8oL1d0uZqBMDkyb140gjx6jQs-a7h_5O20IcOG_qU"
                                alt="Map view of Guildford streets with quality markers"
                            />
                            <div className="absolute top-1/2 left-1/3 z-20 w-8 h-8 bg-primary rounded-full border-4 border-white shadow-lg animate-bounce" />
                        </div>
                    </div>
                </motion.div>

                {/* Text + bullets */}
                <motion.div
                    className="w-full lg:w-1/2 flex flex-col gap-5 md:gap-6"
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: '-60px' }}
                    variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
                >
                    <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold text-slate-900">
                        Explore safety before you choose a street
                    </motion.h2>
                    <motion.p variants={fadeUp} className="text-base md:text-lg text-slate-600">
                        Start broad, understand the local pattern, then open the exact postcode you are considering for a clearer read.
                    </motion.p>

                    <div className="flex flex-col gap-3 md:gap-4">
                        {[
                            {
                                icon: 'analytics',
                                title: 'City View First',
                                text: 'See how different parts of Guildford compare before zooming into one area.',
                            },
                            {
                                icon: 'diversity_3',
                                title: 'Tenant Reviews',
                                text: 'Read first-hand tenant feedback that is moderated before it appears publicly.',
                            },
                        ].map(({ icon, title, text }) => (
                            <motion.div
                                key={title}
                                variants={fadeUp}
                                className="flex items-start gap-4 p-4 rounded-xl bg-primary/5 border border-primary/10"
                            >
                                <span className="material-symbols-outlined text-primary">{icon}</span>
                                <div>
                                    <h4 className="font-bold text-slate-900">{title}</h4>
                                    <p className="text-sm text-slate-600">{text}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    <motion.div variants={fadeUp}>
                        <Link
                            to="/safety"
                            className="w-fit mt-2 md:mt-4 px-8 py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-xl inline-flex items-center gap-2"
                        >
                            Explore Guildford Safety
                        </Link>
                    </motion.div>
                </motion.div>
            </div>
        </section>
    )
}
