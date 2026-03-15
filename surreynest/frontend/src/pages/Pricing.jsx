/**
 * Pricing page — SurreyNest Free vs Pro comparison.
 * Route: /pricing
 *
 * Payment is stubbed — "Upgrade" CTA is wired to a coming-soon message.
 * When Stripe is added, replace handleUpgrade with the checkout redirect.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, X, Crown, Zap, Shield, FileSearch, Scale, Building2, Map } from 'lucide-react'
import Navbar from '../components/Navbar'
import { useAuth } from '../hooks/useAuth'

const FREE_FEATURES = [
    { icon: Map, label: 'Property search (up to 10 results)' },
    { icon: Zap, label: 'Rent fairness score (Fair / Overpriced label)' },
    { icon: Shield, label: 'HMO licence status check' },
    { icon: Shield, label: 'Safety score & crime type breakdown' },
    { icon: Check, label: 'Rights Guide (full)' },
    { icon: Check, label: 'Street Smarts leaderboard (top 10)' },
    { icon: Check, label: 'Compare up to 2 properties' },
    { icon: Check, label: 'Submit & read property reviews' },
]

const PRO_FEATURES = [
    { icon: Zap, label: 'Unlimited property search results' },
    { icon: Zap, label: 'Full Rent XAI breakdown — waterfall chart, SHAP factors, deep-dive' },
    { icon: Shield, label: 'Full Safety Intelligence — monthly trends, area rankings, student insights' },
    { icon: FileSearch, label: 'AI Contract Checker — unlimited tenancy agreement scans' },
    { icon: Scale, label: 'Section 13 Rent Challenge — full verdict + Tribunal brief' },
    { icon: Building2, label: 'Agent reputation scores & full directory' },
    { icon: Map, label: 'Compare up to 5 properties' },
    { icon: Crown, label: 'Priority support' },
]

function FeatureRow({ icon: Icon, label, included }) {
    return (
        <li className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
            <span className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                included ? 'bg-emerald-100' : 'bg-slate-100'
            }`}>
                {included ? (
                    <Check size={11} className="text-emerald-600" strokeWidth={3} />
                ) : (
                    <X size={11} className="text-slate-400" strokeWidth={3} />
                )}
            </span>
            <span className={`text-sm ${included ? 'text-slate-700' : 'text-slate-400'}`}>{label}</span>
        </li>
    )
}

export default function Pricing() {
    const { user } = useAuth()
    const [billing, setBilling] = useState('monthly') // 'monthly' | 'yearly'
    const [upgradeClicked, setUpgradeClicked] = useState(false)

    const monthlyPrice = 5.99
    const yearlyPrice = 39
    const yearlySaving = Math.round(100 - (yearlyPrice / (monthlyPrice * 12)) * 100)

    function handleUpgrade() {
        // Stub — replace with Stripe checkout redirect when payment is wired up
        setUpgradeClicked(true)
    }

    return (
        <main className="min-h-screen bg-[#f8f9fc]">
            <Navbar />

            <div className="max-w-5xl mx-auto px-4 py-12 space-y-12">

                {/* Header */}
                <div className="text-center space-y-3">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                        <Crown size={13} className="text-primary" />
                        <span className="text-xs font-bold uppercase tracking-wider text-primary">Simple pricing</span>
                    </div>
                    <h1 className="text-4xl font-extrabold text-slate-900">
                        Know your rights. Know your rent.
                    </h1>
                    <p className="text-slate-500 max-w-xl mx-auto">
                        SurreyNest Free gives you the essentials. Upgrade to Pro to unlock every tool —
                        built specifically to protect Guildford students.
                    </p>

                    {/* Billing toggle */}
                    <div className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 mt-4">
                        <button
                            onClick={() => setBilling('monthly')}
                            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                                billing === 'monthly'
                                    ? 'bg-primary text-white shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            Monthly
                        </button>
                        <button
                            onClick={() => setBilling('yearly')}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                                billing === 'yearly'
                                    ? 'bg-primary text-white shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            Yearly
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                                billing === 'yearly' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'
                            }`}>
                                Save {yearlySaving}%
                            </span>
                        </button>
                    </div>
                </div>

                {/* Plan cards */}
                <div className="grid md:grid-cols-2 gap-6 items-start">

                    {/* Free plan */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-7 shadow-sm">
                        <div className="mb-6">
                            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Free</p>
                            <div className="flex items-end gap-1">
                                <span className="text-4xl font-extrabold text-slate-900">£0</span>
                                <span className="text-slate-400 text-sm mb-1">/ forever</span>
                            </div>
                            <p className="text-sm text-slate-500 mt-2">
                                The essentials to start your property search with confidence.
                            </p>
                        </div>

                        {user ? (
                            <div className="w-full text-center py-2.5 rounded-xl bg-slate-100 text-sm font-semibold text-slate-500 mb-6">
                                Your current plan
                            </div>
                        ) : (
                            <Link
                                to="/register"
                                className="block w-full text-center py-2.5 rounded-xl border border-primary text-primary text-sm font-semibold hover:bg-primary/5 transition-colors mb-6"
                            >
                                Get started free
                            </Link>
                        )}

                        <ul>
                            {FREE_FEATURES.map((f) => (
                                <FeatureRow key={f.label} icon={f.icon} label={f.label} included />
                            ))}
                            {PRO_FEATURES.map((f) => (
                                <FeatureRow key={f.label} icon={f.icon} label={f.label} included={false} />
                            ))}
                        </ul>
                    </div>

                    {/* Pro plan */}
                    <div className="bg-gradient-to-b from-primary to-indigo-700 rounded-2xl p-7 shadow-xl shadow-primary/20 relative overflow-hidden">
                        {/* Background decoration */}
                        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />

                        <div className="relative mb-6">
                            <div className="flex items-center gap-2 mb-2">
                                <p className="text-xs font-bold uppercase tracking-widest text-white/70">Pro</p>
                                <span className="text-xs font-bold bg-amber-400 text-amber-900 px-2 py-0.5 rounded-full">
                                    Most popular
                                </span>
                            </div>
                            <div className="flex items-end gap-1">
                                <span className="text-4xl font-extrabold text-white">
                                    {billing === 'monthly' ? `£${monthlyPrice}` : `£${yearlyPrice}`}
                                </span>
                                <span className="text-white/60 text-sm mb-1">
                                    {billing === 'monthly' ? '/ month' : '/ year'}
                                </span>
                            </div>
                            {billing === 'yearly' && (
                                <p className="text-white/70 text-xs mt-1">
                                    Just £{(yearlyPrice / 12).toFixed(2)}/month — save £{((monthlyPrice * 12) - yearlyPrice).toFixed(2)} a year
                                </p>
                            )}
                            <p className="text-white/80 text-sm mt-2">
                                Every tool you need to never overpay for rent again.
                            </p>
                        </div>

                        {upgradeClicked ? (
                            <div className="relative w-full text-center py-3 rounded-xl bg-white/20 text-white text-sm font-semibold mb-6 border border-white/30">
                                <Crown size={14} className="inline mr-2" />
                                Payments coming soon — you'll be first to know!
                            </div>
                        ) : user?.is_pro ? (
                            <div className="relative w-full text-center py-3 rounded-xl bg-white/20 text-white text-sm font-semibold mb-6">
                                <Crown size={14} className="inline mr-2" />
                                You're on Pro
                            </div>
                        ) : (
                            <button
                                onClick={handleUpgrade}
                                className="relative w-full py-3 rounded-xl bg-white text-primary text-sm font-extrabold shadow-lg hover:bg-white/95 transition-all active:scale-[0.98] mb-6 flex items-center justify-center gap-2"
                            >
                                <Crown size={15} />
                                Upgrade to Pro
                            </button>
                        )}

                        <ul>
                            {FREE_FEATURES.map((f) => (
                                <li key={f.label} className="flex items-start gap-3 py-2.5 border-b border-white/10 last:border-0">
                                    <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                                        <Check size={11} className="text-white" strokeWidth={3} />
                                    </span>
                                    <span className="text-sm text-white/80">{f.label}</span>
                                </li>
                            ))}
                            {PRO_FEATURES.map((f) => (
                                <li key={f.label} className="flex items-start gap-3 py-2.5 border-b border-white/10 last:border-0">
                                    <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-emerald-400/30 flex items-center justify-center">
                                        <Check size={11} className="text-emerald-300" strokeWidth={3} />
                                    </span>
                                    <span className="text-sm text-white font-medium">{f.label}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* FAQ / trust note */}
                <div className="text-center text-sm text-slate-400 space-y-1 pb-8">
                    <p>No credit card required for Free. Cancel Pro anytime.</p>
                    <p>SurreyNest is built for University of Surrey students — student pricing coming soon.</p>
                </div>
            </div>
        </main>
    )
}
