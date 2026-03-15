/**
 * RightsGuide — Interactive Rights Guide (Stitch-aligned).
 *
 * Layout matches Stitch screen "Interactive Rights Guide":
 *   1. Hero: "Tenant Empowerment" badge + "Your Rights, Simplified." heading
 *   2. Tool Highlight Card: Gradient CTA for Rent Increase Calculator
 *   3. Interactive Rights Grid: 4-col category cards
 *   4. FAQ + Sidebar: 3-col grid (2-col accordion + 1-col sticky sidebar)
 *
 * No API calls — static content page.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Navbar from '../components/Navbar'

// ── Rights content ───────────────────────────────────────────────────────────
const CATEGORIES = [
    {
        title: 'Deposit Protection',
        icon: 'account_balance_wallet',
        summary: 'Ensure your money is safe in a government-backed scheme within 30 days.',
        items: [
            { q: 'Does my landlord have to protect my deposit?', a: 'Yes. Your landlord must protect your deposit in a government-approved tenancy deposit scheme (TDS) within 30 days of receiving it. The three approved schemes are DPS, MyDeposits, and TDS.' },
            { q: 'What if they don\'t protect it?', a: 'You can apply to the county court for an order requiring your landlord to protect the deposit or return it to you. The court can also award you compensation of 1× to 3× the deposit amount.' },
            { q: 'How do I get my deposit back?', a: 'At the end of your tenancy, your landlord should return your deposit within 10 days. If there are disputes about deductions, contact the deposit scheme\'s free dispute resolution service.' },
        ],
    },
    {
        title: 'Repairs & Safety',
        icon: 'build',
        summary: 'Your right to a habitable home: heating, water, and structural integrity.',
        items: [
            { q: 'What repairs is my landlord responsible for?', a: 'Your landlord must keep the structure and exterior in repair, keep installations for water, gas, electricity, heating and hot water in working order, and ensure the property meets the Decent Homes Standard.' },
            { q: 'How do I report a repair?', a: 'Write to your landlord or agent — always in writing (email is fine). Keep a record of the date and what you reported. Give them a reasonable time to respond (usually 14 days for non-urgent repairs).' },
            { q: 'What if my landlord ignores repair requests?', a: 'Contact Guildford Borough Council\'s Environmental Health team. They can inspect the property and issue improvement notices. You can also contact Shelter for free legal advice.' },
        ],
    },
    {
        title: 'Eviction Defense',
        icon: 'gavel',
        summary: 'Understanding Section 21 and Section 8 notices. Know the notice periods.',
        items: [
            { q: 'Can my landlord evict me during my fixed term?', a: 'Generally, no — not unless you\'ve breached the tenancy agreement (e.g. rent arrears, anti-social behaviour). They would need to use a Section 8 notice with valid grounds.' },
            { q: 'What notice do they need to give?', a: 'For a Section 21 ("no-fault") notice: at least 2 months\' written notice, and only after the fixed term ends. For Section 8: varies by ground (as little as 2 weeks for rent arrears of 2+ months).' },
            { q: 'What should I do if I receive an eviction notice?', a: 'Don\'t panic and don\'t leave immediately. Check the notice is valid. Contact the University of Surrey Students\' Union Advice Centre or Citizens Advice for free help.' },
        ],
    },
    {
        title: 'Rent Increases',
        icon: 'payments',
        summary: 'When and how much your rent can be raised legally under your contract.',
        items: [
            { q: 'Can my landlord increase rent during a fixed term?', a: 'Only if the tenancy agreement includes a rent review clause. Otherwise, rent can only be changed at the end of a fixed term or during a periodic tenancy with a Section 13 notice.' },
            { q: 'How much notice is required for a rent increase?', a: 'At least one month\'s notice for monthly tenancies, or six months for yearly tenancies. The increase must be fair and realistic (in line with local market rents).' },
            { q: 'Can I challenge a rent increase?', a: 'Yes! You can challenge it through the First-tier Tribunal (Property Chamber). Use our Rent Increase Calculator tool to analyse whether the increase is fair.' },
        ],
    },
    {
        title: 'HMO Rights',
        icon: 'apartment',
        summary: 'If renting as 3+ individuals, the property must meet specific HMO standards.',
        items: [
            { q: 'What is an HMO?', a: 'A property is an HMO if it\'s occupied by 3 or more tenants forming 2 or more households, who share a kitchen, bathroom or toilet. If there are 5 or more tenants, a mandatory HMO licence is required.' },
            { q: 'How do I check if my HMO is licensed?', a: 'Use the HMO check feature on SurreyNest — enter your address or postcode. You can also check Guildford Borough Council\'s public HMO register.' },
            { q: 'What if my HMO isn\'t licensed?', a: 'An unlicensed HMO is an offence. You can apply for a Rent Repayment Order (RRO) to recover up to 12 months\' rent. Contact Guildford Borough Council to report unlicensed HMOs.' },
        ],
    },
    {
        title: 'Harassment & Illegal Eviction',
        icon: 'shield',
        summary: 'Landlord behaviour that crosses the line — and what to do about it.',
        items: [
            { q: 'What counts as landlord harassment?', a: 'Entering without notice or permission, cutting off utilities, removing your belongings, changing locks while you\'re out, threatening or intimidating behaviour, and frequent unnecessary visits.' },
            { q: 'Is illegal eviction a criminal offence?', a: 'Yes. It is a criminal offence under the Protection from Eviction Act 1977. Report it to Guildford Borough Council and the police. You may also be able to claim damages.' },
        ],
    },
]

// ── FAQ Accordion Item ───────────────────────────────────────────────────────
function AccordionItem({ question, answer }) {
    const [open, setOpen] = useState(false)
    return (
        <div className="overflow-hidden rounded-xl border border-primary/10 bg-white shadow-sm">
            <button
                onClick={() => setOpen(o => !o)}
                className="flex w-full items-center justify-between p-5 text-left font-semibold hover:bg-primary/5 transition-colors"
            >
                <span className="pr-4">{question}</span>
                <span className="material-symbols-outlined text-primary flex-shrink-0">
                    {open ? 'expand_less' : 'expand_more'}
                </span>
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                    >
                        <div className="px-5 pb-5 text-slate-600 text-sm leading-relaxed">
                            {answer}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function RightsGuide() {
    const [activeCategory, setActiveCategory] = useState(null)

    // Get all FAQ items from either a selected category or aggregated
    const faqItems = activeCategory
        ? CATEGORIES.find(c => c.title === activeCategory)?.items || []
        : CATEGORIES.flatMap(c => c.items.slice(0, 1)) // show 1 from each when no category selected

    return (
        <main className="min-h-screen bg-background-light">
            <Navbar />

            <div className="max-w-7xl mx-auto w-full px-4 lg:px-6 py-10">

                {/* ══════════ HERO SECTION ══════════ */}
                <section className="mb-12">
                    <div className="flex flex-col gap-4">
                        <span className="inline-flex w-fit items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
                            Tenant Empowerment
                        </span>
                        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900">
                            Your Rights, <span className="text-primary underline decoration-primary/30 decoration-wavy underline-offset-8">Simplified.</span>
                        </h1>
                        <p className="max-w-2xl text-lg text-slate-600">
                            Navigating legal jargon shouldn't be a nightmare. We've translated the complex laws into friendly, actionable guides to help you protect your home.
                        </p>
                    </div>
                </section>

                {/* ══════════ TOOL HIGHLIGHT CARD ══════════ */}
                <section className="mb-16">
                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary to-purple-600 p-1">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-8 rounded-[0.6rem] bg-white/10 backdrop-blur-xl p-8 lg:p-12">
                            <div className="flex-1 space-y-4">
                                <div className="flex items-center gap-2 text-white">
                                    <span className="material-symbols-outlined">trending_up</span>
                                    <span className="text-sm font-bold uppercase tracking-widest">Featured Tool</span>
                                </div>
                                <h3 className="text-3xl font-bold text-white">Rent Increase Calculator</h3>
                                <p className="text-purple-50 max-w-lg">
                                    Has your landlord proposed a price hike? Check if it's legally valid and generate a formal challenge letter in minutes.
                                </p>
                                <Link
                                    to="/challenge-rent-increase"
                                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-bold text-primary hover:bg-purple-50 transition-all shadow-lg"
                                >
                                    Challenge Your Rent Increase
                                    <span className="material-symbols-outlined">arrow_forward</span>
                                </Link>
                            </div>
                            <div className="relative hidden lg:block w-1/3">
                                <div className="aspect-square rounded-2xl bg-white/20 p-6 backdrop-blur-md border border-white/30 flex flex-col justify-between">
                                    <div className="h-2 w-2/3 rounded bg-white/40" />
                                    <div className="h-2 w-1/2 rounded bg-white/40" />
                                    <div className="h-12 w-full rounded-lg bg-white/60" />
                                    <div className="flex gap-2">
                                        <div className="h-8 w-8 rounded-full bg-white/40" />
                                        <div className="h-8 flex-1 rounded-full bg-white/40" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ══════════ INTERACTIVE RIGHTS GRID ══════════ */}
                <section className="mb-16">
                    <div className="flex items-end justify-between mb-8">
                        <div>
                            <h2 className="text-2xl font-bold">Interactive Rights Guide</h2>
                            <p className="text-slate-500">Explore by category to find out where you stand.</p>
                        </div>
                        <Link to="/check-contract" className="hidden sm:flex items-center gap-1 text-primary font-medium hover:underline text-sm">
                            Contract Checker <span className="material-symbols-outlined text-sm">arrow_right_alt</span>
                        </Link>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {CATEGORIES.slice(0, 4).map((cat) => (
                            <motion.div
                                key={cat.title}
                                whileHover={{ y: -4 }}
                                onClick={() => setActiveCategory(activeCategory === cat.title ? null : cat.title)}
                                className={`group cursor-pointer rounded-xl border p-6 transition-all hover:shadow-xl ${activeCategory === cat.title
                                    ? 'border-primary/40 bg-primary/5 shadow-md'
                                    : 'border-primary/10 bg-white hover:border-primary/40'
                                    }`}
                            >
                                <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-lg transition-colors ${activeCategory === cat.title
                                    ? 'bg-primary text-white'
                                    : 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white'
                                    }`}>
                                    <span className="material-symbols-outlined">{cat.icon}</span>
                                </div>
                                <h4 className="mb-2 text-lg font-bold">{cat.title}</h4>
                                <p className="text-sm text-slate-500 leading-relaxed">{cat.summary}</p>
                                <div className="mt-4 flex items-center gap-1 text-xs font-bold text-primary">
                                    {activeCategory === cat.title ? 'VIEWING' : 'LEARN MORE'}
                                    <span className="material-symbols-outlined text-sm">chevron_right</span>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                    {/* Extra categories (2-col below) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                        {CATEGORIES.slice(4).map((cat) => (
                            <motion.div
                                key={cat.title}
                                whileHover={{ y: -4 }}
                                onClick={() => setActiveCategory(activeCategory === cat.title ? null : cat.title)}
                                className={`group cursor-pointer rounded-xl border p-6 transition-all hover:shadow-xl ${activeCategory === cat.title
                                    ? 'border-primary/40 bg-primary/5 shadow-md'
                                    : 'border-primary/10 bg-white hover:border-primary/40'
                                    }`}
                            >
                                <div className="flex items-start gap-4">
                                    <div className={`flex h-12 w-12 items-center justify-center rounded-lg transition-colors flex-shrink-0 ${activeCategory === cat.title
                                        ? 'bg-primary text-white'
                                        : 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white'
                                        }`}>
                                        <span className="material-symbols-outlined">{cat.icon}</span>
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-bold">{cat.title}</h4>
                                        <p className="text-sm text-slate-500 leading-relaxed mt-1">{cat.summary}</p>
                                        <div className="mt-3 flex items-center gap-1 text-xs font-bold text-primary">
                                            {activeCategory === cat.title ? 'VIEWING' : 'LEARN MORE'}
                                            <span className="material-symbols-outlined text-sm">chevron_right</span>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </section>

                {/* ══════════ FAQ + SIDEBAR (3-col grid) ══════════ */}
                <section className="mb-16 grid grid-cols-1 lg:grid-cols-3 gap-12">
                    {/* FAQ Left (2-col) */}
                    <div className="lg:col-span-2">
                        <div className="mb-8">
                            <h2 className="text-2xl font-bold">
                                {activeCategory ? `${activeCategory} — FAQs` : 'Frequently Asked Questions'}
                            </h2>
                            <p className="text-slate-500">
                                {activeCategory
                                    ? `All questions about ${activeCategory.toLowerCase()}.`
                                    : 'Quick answers to common legal situations.'}
                            </p>
                        </div>
                        <div className="space-y-4">
                            {faqItems.map((item) => (
                                <AccordionItem key={item.q} question={item.q} answer={item.a} />
                            ))}
                        </div>
                    </div>

                    {/* Sidebar Right (1-col) */}
                    <div className="lg:col-span-1">
                        <div className="sticky top-28 space-y-6">
                            {/* Need Legal Help */}
                            <div className="rounded-2xl bg-primary/5 p-6 border border-primary/20">
                                <h4 className="text-lg font-bold mb-4">Need Legal Help?</h4>
                                <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                                    Our team of volunteer legal experts is available for 1-on-1 support for Surrey residents.
                                </p>
                                <div className="space-y-3">
                                    <a
                                        href="https://www.surrey.ac.uk/student-life/support/advice"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full block text-center rounded-lg bg-primary py-3 text-sm font-bold text-white shadow-md shadow-primary/20 transition-transform active:scale-95 hover:opacity-90"
                                    >
                                        Surrey Advice Centre
                                    </a>
                                    <a
                                        href="https://www.citizensadvice.org.uk"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full block text-center rounded-lg border border-primary/30 py-3 text-sm font-bold text-primary transition-colors hover:bg-primary/5"
                                    >
                                        Citizens Advice
                                    </a>
                                </div>
                            </div>

                            {/* Verified Information */}
                            <div className="rounded-2xl bg-slate-900 p-6 text-white overflow-hidden relative">
                                <div className="relative z-10">
                                    <span className="material-symbols-outlined text-primary mb-2">verified_user</span>
                                    <h4 className="text-lg font-bold mb-2">Verified Information</h4>
                                    <p className="text-xs text-slate-400">
                                        Our guides are reviewed to reflect current UK Housing Law including the Renters' Rights Act 2025.
                                    </p>
                                </div>
                                <div className="absolute -right-10 -bottom-10 h-32 w-32 rounded-full bg-primary/20 blur-3xl" />
                            </div>

                            {/* Contract Checker CTA */}
                            <Link
                                to="/check-contract"
                                className="block rounded-2xl bg-white border border-primary/10 p-6 hover:shadow-md transition-shadow"
                            >
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-lg">description</span>
                                    <h4 className="text-sm font-bold">Contract Checker</h4>
                                </div>
                                <p className="text-xs text-slate-500">
                                    About to sign a tenancy agreement? Run it through our AI contract checker — spots illegal clauses before you sign.
                                </p>
                                <div className="mt-3 text-xs font-bold text-primary flex items-center gap-1">
                                    Try it now <span className="material-symbols-outlined text-sm">arrow_forward</span>
                                </div>
                            </Link>
                        </div>
                    </div>
                </section>

                {/* Disclaimer */}
                <div className="border-t border-primary/10 pt-6 mb-8">
                    <p className="text-xs text-slate-400">
                        This guide is for general information only and does not constitute legal
                        advice. For specific legal issues, contact the{' '}
                        <a href="https://www.surrey.ac.uk/student-life/support/advice" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            University of Surrey Advice Centre
                        </a>{' '}
                        or{' '}
                        <a href="https://www.citizensadvice.org.uk" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            Citizens Advice
                        </a>.
                    </p>
                </div>
            </div>
        </main>
    )
}
