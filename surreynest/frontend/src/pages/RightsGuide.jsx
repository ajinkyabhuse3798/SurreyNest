/**
 * RightsGuide, Interactive Rights Guide (Stitch-aligned).
 *
 * Layout matches Stitch screen "Interactive Rights Guide":
 *   1. Hero: "Tenant Empowerment" badge + "Your Rights, Simplified." heading
 *   2. Tool Highlight Card: Gradient CTA for Rent Increase Calculator
 *   3. Interactive Rights Grid: 4-col category cards
 *   4. FAQ + Sidebar: 3-col grid (2-col accordion + 1-col sticky sidebar)
 *
 * No API calls, static content page.
 */
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Navbar from '../components/Navbar'
import { getListingIssueContent, LISTING_RULES_TOPIC } from '../utils/listingGuidance'

// ── Rights content ───────────────────────────────────────────────────────────
const CATEGORIES = [
    {
        slug: 'deposit-protection',
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
        slug: 'repairs-safety',
        title: 'Repairs & Safety',
        icon: 'build',
        summary: 'Your right to a habitable home: heating, water, and structural integrity.',
        items: [
            { q: 'What repairs is my landlord responsible for?', a: 'Your landlord must keep the structure and exterior in repair and keep installations for water, gas, electricity, heating and hot water in working order. Private rented homes also need to be free from serious health and safety hazards.' },
            { q: 'How do I report a repair?', a: 'Write to your landlord or agent, always in writing (email is fine). Keep a record of the date and what you reported. Give them a reasonable time to respond (usually 14 days for non-urgent repairs).' },
            { q: 'What if my landlord ignores repair requests?', a: 'Contact Guildford Borough Council\'s Environmental Health team. They can inspect the property and issue improvement notices. You can also contact Shelter for free legal advice.' },
        ],
    },
    {
        slug: 'eviction-defense',
        title: 'Eviction Defense',
        icon: 'gavel',
        summary: 'Know which eviction rules apply now and what changes from 1 May 2026.',
        items: [
            { q: 'Can my landlord evict me during my fixed term?', a: 'Before 1 May 2026, fixed-term rules can still apply. From 1 May 2026 in England, most private tenancies move to assured periodic tenancies and Section 21 ends, so landlords will need a legal ground to seek possession.' },
            { q: 'What notice do they need to give?', a: 'Before 1 May 2026, current Section 21 and Section 8 rules still apply. From 1 May 2026, landlords will use the reformed Section 8 process and the notice period will depend on the ground they rely on.' },
            { q: 'What should I do if I receive an eviction notice?', a: 'Don\'t panic and don\'t leave immediately. Check the notice is valid. Contact the University of Surrey Students\' Union Advice Centre or Citizens Advice for free help.' },
        ],
    },
    {
        slug: 'rent-increases',
        title: 'Rent Increases',
        icon: 'payments',
        summary: 'How rent-rise rules work now and what changes from 1 May 2026.',
        items: [
            { q: 'Can my landlord increase rent during a fixed term?', a: 'Before 1 May 2026, that depends on your tenancy agreement and whether it contains a rent review clause. From 1 May 2026 in England, private rent increases should move onto the revised Section 13 process.' },
            { q: 'How much notice is required for a rent increase?', a: 'Under the Phase 1 Renters\' Rights Act rules starting on 1 May 2026, landlords should give at least 2 months\' notice and can usually increase the rent no more than once a year.' },
            { q: 'Can I challenge a rent increase?', a: 'Yes. If you think the proposed rent is above market level, apply to the First-tier Tribunal before the new rent start date shown on the notice. Our checker helps you compare the proposal with local market evidence.' },
        ],
    },
    {
        slug: LISTING_RULES_TOPIC,
        title: 'Listing Rules',
        icon: 'policy',
        summary: 'Spot pressure tactics, upfront-rent requests, blanket exclusions, and pet wording before you commit.',
        items: [
            { q: 'Can a landlord or agent ask for offers above the asking rent?', a: 'From 1 May 2026 in England, landlords and agents must publish one asking rent and cannot ask for, encourage, or accept bids above it. If you see wording like "offers over" or "best offers", save the advert and ask for the fixed advertised rent in writing.' },
            { q: 'Can a listing ask for several months of rent upfront?', a: 'Large upfront requests are a warning sign. From 1 May 2026 in England, landlords and agents cannot require more than 1 month of rent in advance for most private tenancies. Ask whether it is a condition or just a preference before paying anything.' },
            { q: 'What if the advert says "No DSS" or rules out families?', a: 'Blanket exclusion wording is a serious concern. From 1 May 2026 in England, landlords and agents cannot make someone less likely to rent because they receive benefits or have children. Keep screenshots and ask for the actual affordability or suitability criteria in writing.' },
            { q: 'What if the advert says "no pets"?', a: 'A blanket pet ban is worth checking carefully. From 1 May 2026 in England, landlords must consider pet requests individually and give valid reasons if they refuse. Ask for the pet policy in writing and whether any insurance or building rules apply.' },
        ],
    },
    {
        slug: 'hmo-rights',
        title: 'HMO Rights',
        icon: 'apartment',
        summary: 'If renting as 3+ individuals, the property must meet specific HMO standards.',
        items: [
            { q: 'What is an HMO?', a: 'A property is an HMO if it\'s occupied by 3 or more tenants forming 2 or more households, who share a kitchen, bathroom or toilet. If there are 5 or more tenants, a mandatory HMO licence is required.' },
            { q: 'How do I check if my HMO is licensed?', a: 'Use the HMO check feature on SurreyNest, enter your address or postcode. You can also check Guildford Borough Council\'s public HMO register.' },
            { q: 'What if my HMO isn\'t licensed?', a: 'An unlicensed HMO is an offence. You can apply for a Rent Repayment Order (RRO) to recover up to 12 months\' rent. Contact Guildford Borough Council to report unlicensed HMOs.' },
        ],
    },
    {
        slug: 'harassment-illegal-eviction',
        title: 'Harassment & Illegal Eviction',
        icon: 'shield',
        summary: 'Landlord behaviour that crosses the line, and what to do about it.',
        items: [
            { q: 'What counts as landlord harassment?', a: 'Entering without notice or permission, cutting off utilities, removing your belongings, changing locks while you\'re out, threatening or intimidating behaviour, and frequent unnecessary visits.' },
            { q: 'Is illegal eviction a criminal offence?', a: 'Yes. It is a criminal offence under the Protection from Eviction Act 1977. Report it to Guildford Borough Council and the police. You may also be able to claim damages.' },
        ],
    },
]

function categoryFromSlug(slug) {
    return CATEGORIES.find((category) => category.slug === slug) || null
}

function initialCategoryFromQuery(topic, issue) {
    if (topic) return categoryFromSlug(topic)?.title || null
    if (issue) return categoryFromSlug(LISTING_RULES_TOPIC)?.title || null
    return null
}

function toggleCategory(currentCategory, nextCategory, setActiveCategory) {
    setActiveCategory(currentCategory === nextCategory ? null : nextCategory)
}

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
    const [searchParams] = useSearchParams()
    const topic = searchParams.get('topic')
    const issue = searchParams.get('issue')
    const fromListingCheck = topic === LISTING_RULES_TOPIC || Boolean(issue)
    const issueSpotlight = getListingIssueContent(issue)
    const [activeCategory, setActiveCategory] = useState(() => initialCategoryFromQuery(topic, issue))

    useEffect(() => {
        setActiveCategory(initialCategoryFromQuery(topic, issue))
    }, [topic, issue])

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

                        {fromListingCheck && (
                            <div className="mt-8 max-w-3xl rounded-2xl border border-primary/20 bg-white shadow-sm p-6">
                                <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">
                                    From your listing check
                                </p>
                                <h2 className="text-2xl font-bold text-slate-900">
                                    {issueSpotlight?.title || 'Start with the listing rules'}
                                </h2>
                                <p className="text-sm text-slate-600 leading-relaxed mt-2 max-w-2xl">
                                    {issueSpotlight?.summary || 'This part of the guide explains bidding language, upfront rent requests, pet wording, and unfair screening in plain English so you know what is worth pushing back on.'}
                                </p>

                                <div className="mt-4 grid gap-3 md:grid-cols-3">
                                    {(issueSpotlight?.actions || [
                                        'Save the advert wording before it changes.',
                                        'Ask for the rent or screening criteria in writing.',
                                        'Compare nearby homes before committing to one listing.',
                                    ]).slice(0, 3).map((action, index) => (
                                        <div key={action} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                                            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                                                Step {index + 1}
                                            </p>
                                            <p className="text-sm text-slate-700 leading-relaxed">{action}</p>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-5 flex flex-wrap gap-3">
                                    <Link
                                        to="/check-listing"
                                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white hover:opacity-90 transition"
                                    >
                                        Check another listing
                                        <span className="material-symbols-outlined text-base">arrow_forward</span>
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={() => setActiveCategory(categoryFromSlug(LISTING_RULES_TOPIC)?.title || null)}
                                        className="inline-flex items-center gap-2 rounded-lg border border-primary/20 px-4 py-2.5 text-sm font-bold text-primary hover:bg-primary/5 transition"
                                    >
                                        Jump to Listing Rules
                                        <span className="material-symbols-outlined text-base">south</span>
                                    </button>
                                </div>
                            </div>
                        )}
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
                                    Has your landlord proposed a price hike? Compare it with the local market and sense-check the notice timing before you decide what to do next.
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
                        <Link to="/challenge-rent-increase" className="hidden sm:flex items-center gap-1 text-primary font-medium hover:underline text-sm">
                            Rent Increase Checker <span className="material-symbols-outlined text-sm">arrow_right_alt</span>
                        </Link>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {CATEGORIES.slice(0, 4).map((cat) => (
                            <motion.button
                                key={cat.title}
                                type="button"
                                whileHover={{ y: -4 }}
                                onClick={() => toggleCategory(activeCategory, cat.title, setActiveCategory)}
                                aria-pressed={activeCategory === cat.title}
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
                            </motion.button>
                        ))}
                    </div>
                    {/* Extra categories (2-col below) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                        {CATEGORIES.slice(4).map((cat) => (
                            <motion.button
                                key={cat.title}
                                type="button"
                                whileHover={{ y: -4 }}
                                onClick={() => toggleCategory(activeCategory, cat.title, setActiveCategory)}
                                aria-pressed={activeCategory === cat.title}
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
                            </motion.button>
                        ))}
                    </div>
                </section>

                {/* ══════════ FAQ + SIDEBAR (3-col grid) ══════════ */}
                <section className="mb-16 grid grid-cols-1 lg:grid-cols-3 gap-12">
                    {/* FAQ Left (2-col) */}
                    <div className="lg:col-span-2">
                        <div className="mb-8">
                            <h2 className="text-2xl font-bold">
                                {activeCategory ? `${activeCategory}, FAQs` : 'Frequently Asked Questions'}
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
                                        Updated for March 2026. We flag where Renters&apos; Rights Act tenancy reforms begin on 1 May 2026 so the timing is clear.
                                    </p>
                                </div>
                                <div className="absolute -right-10 -bottom-10 h-32 w-32 rounded-full bg-primary/20 blur-3xl" />
                            </div>

                            {/* Rent Increase Checker CTA */}
                            <Link
                                to="/challenge-rent-increase"
                                className="block rounded-2xl bg-white border border-primary/10 p-6 hover:shadow-md transition-shadow"
                            >
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-lg">trending_up</span>
                                    <h4 className="text-sm font-bold">Rent Increase Checker</h4>
                                </div>
                                <p className="text-xs text-slate-500">
                                    Check whether a proposed rent rise looks in line with the local market and whether the notice timing looks right.
                                </p>
                                <div className="mt-3 text-xs font-bold text-primary flex items-center gap-1">
                                    Open the checker <span className="material-symbols-outlined text-sm">arrow_forward</span>
                                </div>
                            </Link>

                            <Link
                                to="/check-listing"
                                className="block rounded-2xl bg-white border border-primary/10 p-6 hover:shadow-md transition-shadow"
                            >
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-lg">policy</span>
                                    <h4 className="text-sm font-bold">Listing Checker</h4>
                                </div>
                                <p className="text-xs text-slate-500">
                                    Paste an advert to scan the wording and then bring the result straight back here for the plain-English rule guide.
                                </p>
                                <div className="mt-3 text-xs font-bold text-primary flex items-center gap-1">
                                    Open the checker <span className="material-symbols-outlined text-sm">arrow_forward</span>
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
