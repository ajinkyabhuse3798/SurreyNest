/**
 * FeaturesSection, "Everything you need" 3-column card grid.
 * Matches Stitch Benefit Section: icon container, hover border, learn-more links.
 */
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }

const FEATURES = [
    {
        icon: 'trending_up',
        title: 'Rent Transparency',
        description: 'Our proprietary ML model analyzes thousands of local listings to give you an accurate fairness score for any property.',
        link: '/search',
        linkLabel: 'Learn more',
    },
    {
        icon: 'verified_user',
        title: 'Listing Compliance',
        description: 'Scan advert wording for likely bidding, upfront-rent, pet, and discrimination issues, then cross-check it against Guildford area data.',
        link: '/check-listing',
        linkLabel: 'Scan a listing',
    },
    {
        icon: 'menu_book',
        title: 'Rights Guide',
        description: "Plain-English legal advice tailored specifically for student renters. Know your rights regarding deposits, repairs, and evictions.",
        link: '/rights',
        linkLabel: 'Read the guide',
    },
]

export default function FeaturesSection() {
    return (
        <section className="py-16 md:py-24 border-y border-slate-200 bg-white">
            <div className="max-w-7xl mx-auto px-4 md:px-6">
                <motion.div
                    className="text-center max-w-2xl mx-auto mb-12 md:mb-16"
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: '-60px' }}
                    variants={fadeUp}
                >
                    <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-4">
                        Everything you need to find the perfect home
                    </h2>
                    <p className="text-slate-600">
                        We bridge the gap between landlords and students using data-driven insights and legal expertise.
                    </p>
                </motion.div>

                <div className="grid md:grid-cols-3 gap-6 md:gap-8">
                    {FEATURES.map(({ icon, title, description, link, linkLabel }, i) => (
                        <motion.div
                            key={title}
                            className="group p-6 md:p-8 rounded-2xl border border-slate-200 bg-white hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-300"
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true, margin: '-40px' }}
                            variants={fadeUp}
                            transition={{ delay: i * 0.1 }}
                        >
                            <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-primary group-hover:text-white transition-colors">
                                <span className="material-symbols-outlined text-3xl">{icon}</span>
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
                            <p className="text-slate-600 leading-relaxed mb-6">{description}</p>
                            <Link
                                to={link}
                                className="text-primary font-bold flex items-center gap-1 text-sm hover:gap-2 transition-all"
                            >
                                {linkLabel}
                                <span className="material-symbols-outlined text-sm">chevron_right</span>
                            </Link>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}
