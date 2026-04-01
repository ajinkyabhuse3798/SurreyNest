/**
 * About page, platform overview, data sources, FAQ, and policy sections.
 */
import Navbar from '../components/Navbar'
import AnalyticsConsentControls from '../components/AnalyticsConsentControls'

const OFFERINGS = [
    {
        title: 'Rent Fairness Scoring',
        description:
            'ML-powered rent estimates based on property characteristics and local market context.',
    },
    {
        title: 'Safety Scores',
        description:
            'Crime-weighted safety ratings that help you compare Guildford postcode areas more confidently.',
    },
    {
        title: 'HMO Verification',
        description:
            'Fast checks against local licensing data so you can spot potential compliance issues early.',
    },
    {
        title: 'Tenant Rights',
        description:
            'Practical guidance that helps renters understand rights, responsibilities, and next steps.',
    },
]

const DATA_SOURCES = [
    { name: 'EPC Register', desc: 'Energy performance data for thousands of local properties.' },
    { name: 'police.uk', desc: 'Monthly crime statistics used for postcode-sector safety analysis.' },
    { name: 'VOA', desc: 'Official rental market statistics used for rent context and benchmarking.' },
    { name: 'Guildford Borough Council', desc: 'HMO licensing data used for compliance checks.' },
]

const FAQS = [
    {
        question: 'Who is SurreyNest for?',
        answer:
            'SurreyNest is designed for people comparing homes, neighbourhoods, and rental decisions across Guildford.',
    },
    {
        question: 'Does SurreyNest use official data?',
        answer:
            'Yes. The platform combines public datasets such as EPC records, police.uk crime data, VOA rental statistics, and Guildford HMO registers.',
    },
    {
        question: 'Are the scores advice or guarantees?',
        answer:
            'No. SurreyNest provides decision-support signals and explanations so users can ask better questions and compare areas more clearly.',
    },
]

function SectionCard({ id, eyebrow, title, children }) {
    return (
        <section
            id={id}
            className="scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_10px_35px_-18px_rgba(15,23,42,0.22)] md:p-8"
        >
            <div className="mb-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900 md:text-3xl">{title}</h2>
            </div>
            {children}
        </section>
    )
}

export default function About() {
    return (
        <main className="min-h-screen bg-slate-50">
            <Navbar />

            <div className="px-4 py-10 md:px-6 md:py-14">
                <div className="mx-auto max-w-5xl">
                    <section
                        id="overview"
                        className="scroll-mt-24 overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-6 py-10 text-white shadow-[0_18px_60px_-24px_rgba(15,23,42,0.55)] md:px-10 md:py-14"
                    >
                        <div className="max-w-3xl">
                            <p className="text-xs font-bold uppercase tracking-[0.22em] text-orange-300">
                                About SurreyNest
                            </p>
                            <h1 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">
                                Clearer housing decisions for people living in Guildford
                            </h1>
                            <p className="mt-5 text-sm leading-7 text-slate-200 md:text-base">
                                SurreyNest brings together trusted public data to help people compare
                                properties, understand neighbourhood context, and make better rental
                                decisions across Guildford.
                            </p>
                        </div>
                    </section>

                    <div className="mt-8 grid gap-6">
                        <SectionCard id="what-we-offer" eyebrow="Platform" title="What We Offer">
                            <div className="grid gap-4 md:grid-cols-2">
                                {OFFERINGS.map(({ title, description }) => (
                                    <div
                                        key={title}
                                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                                    >
                                        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
                                        <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
                                    </div>
                                ))}
                            </div>
                        </SectionCard>

                        <SectionCard id="data-sources" eyebrow="Trust" title="Data Sources">
                            <div className="grid gap-4 md:grid-cols-2">
                                {DATA_SOURCES.map(({ name, desc }) => (
                                    <div key={name} className="rounded-2xl bg-slate-50 p-4">
                                        <p className="text-sm font-bold text-slate-900">{name}</p>
                                        <p className="mt-1 text-sm leading-6 text-slate-600">{desc}</p>
                                    </div>
                                ))}
                            </div>
                            <p className="mt-5 text-sm leading-6 text-slate-500">
                                SurreyNest uses public, open, or officially published datasets to keep
                                property and area information grounded in verifiable sources.
                            </p>
                        </SectionCard>

                        <SectionCard id="faq" eyebrow="Answers" title="Frequently Asked Questions">
                            <div className="space-y-4">
                                {FAQS.map(({ question, answer }) => (
                                    <div key={question} className="rounded-2xl border border-slate-200 p-4">
                                        <h3 className="text-sm font-bold text-slate-900">{question}</h3>
                                        <p className="mt-2 text-sm leading-6 text-slate-600">{answer}</p>
                                    </div>
                                ))}
                            </div>
                        </SectionCard>

                        <div className="grid gap-6 lg:grid-cols-3">
                            <SectionCard id="contact" eyebrow="Support" title="Contact Support">
                                <p className="text-sm leading-6 text-slate-600">
                                    Need help with a listing, a postcode check, or a data question?
                                    Reach out and we will point you in the right direction.
                                </p>
                                <a
                                    href="mailto:support@surreynest.uk"
                                    className="mt-4 inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
                                >
                                    support@surreynest.uk
                                </a>
                            </SectionCard>

                            <SectionCard id="privacy" eyebrow="Policy" title="Privacy Policy">
                                <p className="text-sm leading-6 text-slate-600">
                                    SurreyNest is designed to minimise personal data handling. Where
                                    support contact details are provided, they are only used to
                                    respond to service questions or follow-up communications.
                                </p>
                                <p className="mt-3 text-sm leading-6 text-slate-600">
                                    We may use Microsoft Clarity to understand site usage such as
                                    visits, clicks, scrolling, and session behaviour so we can
                                    improve the product. Clarity masks form and input content by
                                    default, and we do not use this setup for advertising profiles.
                                </p>
                                <AnalyticsConsentControls />
                            </SectionCard>

                            <SectionCard id="terms" eyebrow="Policy" title="Terms of Service">
                                <p className="text-sm leading-6 text-slate-600">
                                    SurreyNest provides information and decision-support tools for
                                    Guildford housing research. Users should verify key details with
                                    landlords, agents, councils, and official records before acting.
                                </p>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    )
}
