/**
 * About page, project overview, data sources, and team info.
 */
import Navbar from '../components/Navbar'

export default function About() {
    return (
        <main className="min-h-screen bg-white">
            <Navbar />

            <section className="max-w-2xl mx-auto px-4 py-12 md:py-16">
                <h1 className="text-2xl font-semibold text-[#0A0A0A] mb-6 md:text-3xl">
                    About SurreyNest
                </h1>

                <div className="space-y-6 text-sm text-gray-600 leading-relaxed">
                    <p>
                        SurreyNest is a student housing transparency platform built for
                        Guildford renters. We combine official data from EPC records, police
                        crime statistics, HMO licensing registers, and VOA rental market
                        statistics to help you make informed decisions about where you live.
                    </p>

                    <div className="border border-gray-200 rounded-xl p-5">
                        <h2 className="text-base font-semibold text-[#0A0A0A] mb-3">
                            What We Offer
                        </h2>
                        <ul className="space-y-2">
                            <li className="flex items-start gap-2">
                                <span className="text-primary font-bold text-xs mt-0.5">✓</span>
                                <span><strong>Rent Fairness Scoring</strong>, ML-powered prediction of fair rent based on property characteristics</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary font-bold text-xs mt-0.5">✓</span>
                                <span><strong>Safety Scores</strong>, Crime-weighted safety ratings for every postcode sector</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary font-bold text-xs mt-0.5">✓</span>
                                <span><strong>HMO Verification</strong>, Instant check of HMO licensing status</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary font-bold text-xs mt-0.5">✓</span>
                                <span><strong>Tenant Rights</strong>, Comprehensive guide to your rights as a renter</span>
                            </li>
                        </ul>
                    </div>

                    <div className="border border-gray-200 rounded-xl p-5">
                        <h2 className="text-base font-semibold text-[#0A0A0A] mb-3">
                            Data Sources
                        </h2>
                        <div className="grid gap-3 md:grid-cols-2">
                            {[
                                { name: 'EPC Register', desc: 'Energy performance data for 12,000+ properties' },
                                { name: 'police.uk', desc: 'Monthly crime statistics by postcode' },
                                { name: 'VOA', desc: 'Official median rental prices by bedroom count' },
                                { name: 'Guildford BC', desc: 'HMO licensing register' },
                            ].map(({ name, desc }) => (
                                <div key={name} className="bg-gray-50 rounded-lg p-3">
                                    <p className="text-xs font-semibold text-[#0A0A0A]">{name}</p>
                                    <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <p className="text-xs text-gray-400">
                        SurreyNest is a final year MSc project at the University of Surrey.
                        All data is sourced from public, open-licensed APIs and datasets.
                    </p>
                </div>
            </section>
        </main>
    )
}
