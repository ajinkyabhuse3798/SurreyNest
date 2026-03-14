/**
 * RightsGuide page — interactive tenant rights information.
 * Accordion-style collapsible sections. Static content, no API calls.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Scale, FileSearch } from 'lucide-react'
import Navbar from '../components/Navbar'

const SECTIONS = [
    {
        title: 'Deposit Protection',
        items: [
            {
                q: 'Does my landlord have to protect my deposit?',
                a: 'Yes. Your landlord must protect your deposit in a government-approved tenancy deposit scheme (TDS) within 30 days of receiving it. The three approved schemes are DPS, MyDeposits, and TDS.',
            },
            {
                q: 'What if they don\'t protect it?',
                a: 'You can apply to the county court for an order requiring your landlord to protect the deposit or return it to you. The court can also award you compensation of 1× to 3× the deposit amount.',
            },
            {
                q: 'How do I get my deposit back?',
                a: 'At the end of your tenancy, your landlord should return your deposit within 10 days. If there are disputes about deductions, contact the deposit scheme\'s free dispute resolution service.',
            },
        ],
    },
    {
        title: 'Repairs and Maintenance',
        items: [
            {
                q: 'What repairs is my landlord responsible for?',
                a: 'Your landlord must keep the structure and exterior in repair, keep installations for water, gas, electricity, heating and hot water in working order, and ensure the property meets the Decent Homes Standard.',
            },
            {
                q: 'How do I report a repair?',
                a: 'Write to your landlord or agent — always in writing (email is fine). Keep a record of the date and what you reported. Give them a reasonable time to respond (usually 14 days for non-urgent repairs).',
            },
            {
                q: 'What if my landlord ignores repair requests?',
                a: 'Contact Guildford Borough Council\'s Environmental Health team. They can inspect the property and issue improvement notices. You can also contact Shelter for free legal advice.',
            },
        ],
    },
    {
        title: 'HMO (House in Multiple Occupation)',
        items: [
            {
                q: 'What is an HMO?',
                a: 'A property is an HMO if it\'s occupied by 3 or more tenants forming 2 or more households, who share a kitchen, bathroom or toilet. If there are 5 or more tenants, a mandatory HMO licence is required.',
            },
            {
                q: 'How do I check if my HMO is licensed?',
                a: 'Use the HMO check feature on SurreyNest — enter your address or postcode. You can also check Guildford Borough Council\'s public HMO register.',
            },
            {
                q: 'What if my HMO isn\'t licensed?',
                a: 'An unlicensed HMO is an offence. You can apply for a Rent Repayment Order (RRO) to recover up to 12 months\' rent. Contact Guildford Borough Council to report unlicensed HMOs.',
            },
        ],
    },
    {
        title: 'Eviction',
        items: [
            {
                q: 'Can my landlord evict me during my fixed term?',
                a: 'Generally, no — not unless you\'ve breached the tenancy agreement (e.g. rent arrears, anti-social behaviour). They would need to use a Section 8 notice with valid grounds.',
            },
            {
                q: 'What notice do they need to give?',
                a: 'For a Section 21 ("no-fault") notice: at least 2 months\' written notice, and only after the fixed term ends. For Section 8: varies by ground (as little as 2 weeks for rent arrears of 2+ months).',
            },
            {
                q: 'What should I do if I receive an eviction notice?',
                a: 'Don\'t panic and don\'t leave immediately. Check the notice is valid. Contact the University of Surrey Students\' Union Advice Centre or Citizens Advice for free help.',
            },
        ],
    },
    {
        title: 'Harassment and Illegal Eviction',
        items: [
            {
                q: 'What counts as landlord harassment?',
                a: 'Entering without notice or permission, cutting off utilities, removing your belongings, changing the locks while you\'re out, threatening or intimidating behaviour, and frequent unnecessary visits.',
            },
            {
                q: 'Is illegal eviction a criminal offence?',
                a: 'Yes. It is a criminal offence under the Protection from Eviction Act 1977. Report it to Guildford Borough Council and the police. You may also be able to claim damages.',
            },
        ],
    },
]

function AccordionItem({ question, answer }) {
    const [open, setOpen] = useState(false)

    return (
        <div className="border-b border-gray-100">
            <button
                onClick={() => setOpen((o) => !o)}
                className="w-full flex items-center justify-between py-3 text-left"
            >
                <span className="text-sm text-[#0A0A0A] font-medium pr-4">
                    {question}
                </span>
                <span className="text-gray-400 text-sm flex-shrink-0">
                    {open ? '−' : '+'}
                </span>
            </button>
            {open && (
                <p className="text-sm text-gray-500 leading-relaxed pb-3">
                    {answer}
                </p>
            )}
        </div>
    )
}

export default function RightsGuide() {
    return (
        <main className="min-h-screen bg-white">
            <Navbar />

            <div className="max-w-2xl mx-auto px-4 py-8 md:py-12">
                <h1 className="text-2xl font-semibold text-[#0A0A0A] mb-2 md:text-4xl">
                    Tenant Rights Guide
                </h1>
                <p className="text-sm text-gray-500 mb-8 md:text-base">
                    Know your rights as a student renter in Guildford. Tap any question to
                    see the answer.
                </p>

                <div className="space-y-8">
                    {SECTIONS.map((section) => (
                        <div key={section.title}>
                            <h2 className="text-xl font-semibold text-[#0A0A0A] mb-3">
                                {section.title}
                            </h2>
                            <div className="border border-gray-200 rounded-xl p-4">
                                {section.items.map((item) => (
                                    <AccordionItem
                                        key={item.q}
                                        question={item.q}
                                        answer={item.a}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Tool CTAs */}
                <div className="space-y-3 mt-8">
                    <h2 className="text-lg font-semibold text-[#0A0A0A]">Useful Tools</h2>
                    <Link
                        to="/challenge-rent-increase"
                        className="flex items-center gap-4 bg-amber-50 border border-amber-200 rounded-xl p-4 hover:bg-amber-100 transition-colors"
                    >
                        <Scale size={20} className="text-amber-600 flex-shrink-0" />
                        <div>
                            <p className="text-sm font-semibold text-amber-800">Received a rent increase notice?</p>
                            <p className="text-xs text-amber-600 mt-0.5">
                                Use our Section 13 challenge tool — ML analysis + tribunal brief generator
                            </p>
                        </div>
                    </Link>
                    <Link
                        to="/check-contract"
                        className="flex items-center gap-4 bg-violet-50 border border-violet-200 rounded-xl p-4 hover:bg-violet-100 transition-colors"
                    >
                        <FileSearch size={20} className="text-violet-600 flex-shrink-0" />
                        <div>
                            <p className="text-sm font-semibold text-violet-800">About to sign a tenancy agreement?</p>
                            <p className="text-xs text-violet-600 mt-0.5">
                                Run it through our AI contract checker — spots illegal clauses before you sign
                            </p>
                        </div>
                    </Link>
                </div>

                <div className="border-t border-gray-100 mt-8 pt-6">
                    <p className="text-xs text-gray-400">
                        This guide is for general information only and does not constitute legal
                        advice. For specific legal issues, contact the{' '}
                        <a
                            href="https://www.surrey.ac.uk/student-life/support/advice"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600"
                        >
                            University of Surrey Advice Centre
                        </a>{' '}
                        or{' '}
                        <a
                            href="https://www.citizensadvice.org.uk"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600"
                        >
                            Citizens Advice
                        </a>
                        .
                    </p>
                </div>
            </div>
        </main>
    )
}
