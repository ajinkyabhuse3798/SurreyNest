/**
 * CheckListing, analyse a listing reference with manual Guildford inputs.
 *
 * Flow: required postcode + optional listing wording →
 * POST /api/listings/check → display compliance scan and area analysis.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Search,
    Loader2, Shield, PoundSterling, Home,
    Droplets, MapPin, ArrowRight, AlertTriangle,
    CheckCircle2, Info, Scale, FileSearch, ShieldAlert, ShieldCheck,
    Camera, BookOpen, MessageSquare, Sparkles,
} from 'lucide-react'
import Navbar from '../components/Navbar'
import api from '../services/api'
import { buildListingActionCards } from '../utils/listingGuidance'

function scoreColor(score) {
    if (score >= 70) return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100' }
    if (score >= 50) return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100' }
    return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-100' }
}

function complianceTone(status) {
    if (status === 'HIGH_RISK') {
        return {
            shell: 'bg-rose-50 border-rose-200',
            badge: 'bg-rose-100 text-rose-700 border-rose-200',
            icon: 'bg-rose-100 text-rose-600',
        }
    }
    if (status === 'REVIEW') {
        return {
            shell: 'bg-amber-50 border-amber-200',
            badge: 'bg-amber-100 text-amber-700 border-amber-200',
            icon: 'bg-amber-100 text-amber-600',
        }
    }
    if (status === 'CLEAR') {
        return {
            shell: 'bg-emerald-50 border-emerald-200',
            badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
            icon: 'bg-emerald-100 text-emerald-600',
        }
    }
    return {
        shell: 'bg-slate-50 border-slate-200',
        badge: 'bg-slate-100 text-slate-700 border-slate-200',
        icon: 'bg-slate-100 text-slate-500',
    }
}

function formatDate(dateString) {
    if (!dateString) return null
    return new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    }).format(new Date(dateString))
}

export default function CheckListing() {
    const [postcode, setPostcode] = useState('')
    const [listingText, setListingText] = useState('')
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState(null)
    const [error, setError] = useState('')

    async function submit(e) {
        e?.preventDefault()
        setError('')
        setResult(null)

        const pc = postcode.trim().toUpperCase()
        if (!pc) {
            setError('Please enter the postcode manually.')
            return
        }

        setLoading(true)
        try {
            const body = { postcode: pc }
            if (listingText.trim()) body.listing_text = listingText.trim()
            const res = await api.post('/api/listings/check', body)
            setResult(res.data)
        } catch (err) {
            const detail = err?.response?.data?.detail || 'Something went wrong. Please try again.'
            setError(detail)
        } finally {
            setLoading(false)
        }
    }

    const r = result

    return (
        <>
            <Navbar />
            <main className="min-h-screen bg-[#f8f9fc]">

                {/* ── Hero ─────────────────────────────────────────────── */}
                <section className="px-4 pt-12 pb-10 md:pt-20 md:pb-14">
                    <div className="max-w-2xl mx-auto text-center">
                        <motion.div
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.45 }}
                        >
                            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-3 tracking-tight">
                                Check any rental listing
                            </h1>
                            <p className="text-slate-500 mb-8 text-base max-w-lg mx-auto leading-relaxed">
                                Enter the Guildford postcode manually and optionally paste the listing description. SurreyNest will scan the wording you provide and layer on Guildford area data.
                            </p>
                        </motion.div>

                        {/* ── Input card ──────────────────────────────── */}
                        <motion.div
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.45, delay: 0.1 }}
                            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3"
                        >
                            <form onSubmit={submit} className="space-y-3">
                                <div className="grid gap-3 md:grid-cols-[1.5fr,0.75fr]">
                                    <div className="relative">
                                        <FileSearch size={16} className="absolute left-3.5 top-3.5 text-slate-400 pointer-events-none" />
                                        <textarea
                                            value={listingText}
                                            onChange={(e) => setListingText(e.target.value)}
                                            rows={4}
                                            placeholder="Optional: paste the listing description here. SurreyNest will scan this text for likely Renters' Rights issues."
                                            className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-slate-900 placeholder-slate-400 bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition resize-y min-h-[112px]"
                                        />
                                    </div>

                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                                            Required postcode
                                        </label>
                                        <div className="relative">
                                            <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                            <input
                                                type="text"
                                                value={postcode}
                                                onChange={(e) => setPostcode(e.target.value.toUpperCase())}
                                                placeholder="GU1 3JT"
                                                maxLength={8}
                                                className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 uppercase"
                                            />
                                        </div>
                                        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                                            Enter the GU postcode shown on the listing. You can check an area with just the postcode, or add pasted wording for a description scan.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex justify-end">
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="bg-primary text-white px-5 py-3 rounded-xl text-sm font-semibold hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center gap-2 flex-shrink-0"
                                    >
                                        {loading
                                            ? <><Loader2 size={15} className="animate-spin" /> Checking…</>
                                            : <><CheckCircle2 size={15} /> Check</>
                                        }
                                    </button>
                                </div>
                            </form>

                            {error && (
                                <div className="mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                                    <AlertTriangle size={14} className="flex-shrink-0" />
                                    {error}
                                </div>
                            )}

                        </motion.div>
                    </div>
                </section>

                {/* ── Results ───────────────────────────────────────────── */}
                <AnimatePresence>
                    {r && (
                        <motion.section
                            initial={{ opacity: 0, y: 24 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.4 }}
                            className="px-4 pb-16"
                        >
                            <div className="max-w-2xl mx-auto space-y-4">

                                {/* Result header */}
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-900">Listing Check, {r.postcode}</h2>
                                        <p className="text-xs text-slate-400 mt-0.5">{r.message}</p>
                                    </div>
                                </div>

                                <ComplianceCard report={r.compliance_report} />
                                <ActionPlan report={r.compliance_report} postcode={r.postcode} />

                                {/* Score cards */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <ScoreCard
                                        icon={Shield}
                                        iconBg="bg-emerald-50"
                                        iconColor="text-emerald-600"
                                        label="Safety"
                                        value={r.safety_score ? Math.round(r.safety_score) : 'N/A'}
                                        sub={r.safety_label || 'No data'}
                                        score={r.safety_score}
                                    />
                                    <ScoreCard
                                        icon={PoundSterling}
                                        iconBg="bg-blue-50"
                                        iconColor="text-blue-600"
                                        label="Avg. Rent"
                                        value={r.avg_predicted_rent_weekly ? `£${Math.round(r.avg_predicted_rent_weekly)}/wk` : 'N/A'}
                                        sub={r.avg_predicted_rent_monthly ? `≈ £${Math.round(r.avg_predicted_rent_monthly)}/mo` : 'No prediction'}
                                    />
                                    <ScoreCard
                                        icon={Home}
                                        iconBg="bg-primary/10"
                                        iconColor="text-primary"
                                        label="Properties"
                                        value={r.properties_in_area}
                                        sub="in our database"
                                    />
                                    <ScoreCard
                                        icon={Droplets}
                                        iconBg="bg-cyan-50"
                                        iconColor="text-cyan-600"
                                        label="Flood Risk"
                                        value={r.flood_risk_severity || 'None'}
                                        sub="EA assessment"
                                    />
                                </div>

                                {/* HMO info */}
                                {(r.hmo_total_count > 0 || r.hmo_licensed_count > 0) && (
                                    <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
                                                <Info size={13} className="text-amber-600" />
                                            </div>
                                            <h3 className="text-sm font-semibold text-slate-800">HMO Status</h3>
                                        </div>
                                        <p className="text-sm text-slate-600">
                                            <span className="font-semibold text-slate-800">{r.hmo_licensed_count}</span> licensed HMO{r.hmo_licensed_count !== 1 ? 's' : ''} out of{' '}
                                            <span className="font-semibold text-slate-800">{r.hmo_total_count}</span> total in {r.postcode}.
                                            {r.hmo_licensed_count > 0 && (
                                                <span className="text-emerald-600 font-medium"> Licensed properties meet safety standards.</span>
                                            )}
                                        </p>
                                    </div>
                                )}

                                {/* Nearby properties */}
                                {r.nearby_properties?.length > 0 && (
                                    <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                                                <MapPin size={13} className="text-primary" />
                                            </div>
                                            <h3 className="text-sm font-semibold text-slate-800">
                                                Properties in our database at {r.postcode}
                                            </h3>
                                        </div>
                                        <div className="space-y-1.5">
                                            {r.nearby_properties.map(p => (
                                                <Link
                                                    key={p.uprn}
                                                    to={`/property/${p.uprn}`}
                                                    className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-slate-100 hover:border-primary/30 hover:bg-primary/5 transition group"
                                                >
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-medium text-slate-800 truncate">{p.address}</p>
                                                        <p className="text-xs text-slate-400">
                                                            {p.property_type || 'Property'}
                                                            {p.num_rooms ? ` · ${p.num_rooms} rooms` : ''}
                                                            {p.tenure && (
                                                                <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                                                    p.tenure.includes('rental') || p.tenure.includes('rented')
                                                                        ? 'bg-emerald-50 text-emerald-700'
                                                                        : 'bg-slate-100 text-slate-500'
                                                                }`}>
                                                                    {p.tenure.includes('rental') || p.tenure.includes('rented') ? 'Rental' : 'Owner'}
                                                                </span>
                                                            )}
                                                        </p>
                                                    </div>
                                                    <ArrowRight size={14} className="text-slate-300 group-hover:text-primary transition flex-shrink-0" />
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* CTA */}
                                <div className="text-center pt-2">
                                    <Link
                                        to={`/search?postcode=${encodeURIComponent(r.postcode)}&radius=1000`}
                                        className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
                                    >
                                        View full area search
                                        <ArrowRight size={15} />
                                    </Link>
                                </div>
                            </div>
                        </motion.section>
                    )}
                </AnimatePresence>

                {/* ── How it works ──────────────────────────────────────── */}
                {!r && !loading && (
                    <motion.section
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.25 }}
                        className="px-4 pb-16"
                    >
                        <div className="max-w-2xl mx-auto">
                            <p className="text-center text-xs font-bold uppercase tracking-widest text-slate-400 mb-6">How it works</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                                {[
                                    { step: '1', title: 'Add the listing details', desc: 'Enter the GU postcode manually and optionally paste the listing description.' },
                                    { step: '2', title: 'We scan the wording', desc: 'If you paste listing text, SurreyNest checks it for bidding, advance-rent, children or benefits discrimination, and blanket pet-ban wording.' },
                                    { step: '3', title: 'Layer on area data', desc: 'Then we show local safety, rent, HMO, and nearby-property context for the Guildford area.' },
                                ].map(s => (
                                    <div key={s.step} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm text-center">
                                        <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary font-bold text-sm flex items-center justify-center mx-auto mb-3">
                                            {s.step}
                                        </div>
                                        <h4 className="text-sm font-semibold text-slate-800 mb-1">{s.title}</h4>
                                        <p className="text-xs text-slate-500 leading-relaxed">{s.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.section>
                )}
            </main>
        </>
    )
}

function ScoreCard({ icon: Icon, iconBg, iconColor, label, value, sub, score }) {
    const colors = score ? scoreColor(score) : { bg: 'bg-white', text: 'text-slate-800', border: 'border-slate-100' }
    return (
        <div className={`${colors.bg} rounded-2xl border ${colors.border} p-4 shadow-sm`}>
            <div className={`w-8 h-8 ${iconBg} rounded-xl flex items-center justify-center mb-3`}>
                <Icon size={15} className={iconColor} />
            </div>
            <p className="text-xs text-slate-400 font-medium mb-0.5">{label}</p>
            <p className={`text-xl font-extrabold ${colors.text}`}>{value}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>
        </div>
    )
}

function ComplianceCard({ report }) {
    const tone = complianceTone(report?.status)

    return (
        <div className={`rounded-2xl border p-5 shadow-sm ${tone.shell}`}>
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tone.icon}`}>
                        {report?.status === 'CLEAR' ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">
                            Compliance scan
                        </p>
                        <h3 className="text-lg font-bold text-slate-900">{report?.headline}</h3>
                        <p className="text-sm text-slate-600 mt-1 max-w-2xl">
                            {report?.summary}
                        </p>
                    </div>
                </div>
                <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${tone.badge}`}>
                    <Scale size={13} />
                    {report?.analysed_text_source === 'manual_text'
                        ? 'Based on pasted wording'
                        : 'No wording scanned'}
                </div>
            </div>

            {report?.issues?.length > 0 && (
                <div className="mt-5 space-y-3">
                    {report.issues.map((issue) => (
                        <div key={issue.id} className="rounded-xl border border-white/70 bg-white/70 p-4">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-sm font-bold text-slate-900">{issue.title}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {issue.applies_from ? `Rule starts ${formatDate(issue.applies_from)}` : 'Guidance check'}
                                    </p>
                                </div>
                                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold border ${
                                    issue.severity === 'high'
                                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                                        : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}>
                                    <AlertTriangle size={12} />
                                    {issue.severity === 'high' ? 'Likely conflict' : 'Needs review'}
                                </span>
                            </div>
                            <p className="text-sm text-slate-700 mt-3 leading-relaxed">{issue.summary}</p>
                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                                    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">
                                        Why we flagged it
                                    </p>
                                    <p className="text-sm text-slate-700 leading-relaxed">{issue.evidence}</p>
                                </div>
                                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                                    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">
                                        What to do
                                    </p>
                                    <p className="text-sm text-slate-700 leading-relaxed">{issue.guidance}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {report?.positives?.length > 0 && (
                <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50/80 p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Sparkles size={15} className="text-emerald-600" />
                        <p className="text-sm font-bold text-emerald-900">Good signs we spotted</p>
                    </div>
                    <div className="space-y-2">
                        {report.positives.map((item) => (
                            <div key={item.id} className="rounded-lg bg-white/80 border border-emerald-100 p-3">
                                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                                <p className="text-sm text-slate-700 mt-1">{item.summary}</p>
                                <p className="text-xs text-slate-500 mt-2">{item.evidence}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="mt-4 flex items-start gap-2 text-xs text-slate-500">
                <Info size={14} className="flex-shrink-0 mt-0.5" />
                <p>
                    This is a wording scan, not a legal ruling. It is based on the Phase 1 England reforms that start on 1 May 2026 and should be checked against the full advert and tenancy paperwork.
                </p>
            </div>
        </div>
    )
}

function ActionPlan({ report, postcode }) {
    const actionCards = buildListingActionCards(report, postcode)

    if (!actionCards.length) return null

    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                    <Scale size={18} />
                </div>
                <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">
                        What to do next
                    </p>
                    <h3 className="text-lg font-bold text-slate-900">
                        A calmer next step than guessing
                    </h3>
                    <p className="text-sm text-slate-600 mt-1 max-w-2xl">
                        Use the scan as a prompt, not a panic moment. Save the advert, read the relevant rule, and then compare the area before you decide whether to keep engaging with this listing.
                    </p>
                </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
                {actionCards.map((card) => {
                    const Icon = actionIcon(card.iconKey)
                    return (
                        <Link
                            key={card.id}
                            to={card.to}
                            className="group rounded-xl border border-slate-200 bg-slate-50 p-4 hover:border-primary/30 hover:bg-primary/5 transition"
                        >
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-700 flex items-center justify-center group-hover:border-primary/20 group-hover:text-primary transition">
                                    <Icon size={18} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                                        {card.eyebrow}
                                    </p>
                                    <h4 className="text-sm font-bold text-slate-900 leading-snug">
                                        {card.title}
                                    </h4>
                                    <p className="text-xs leading-relaxed text-slate-600 mt-2">
                                        {card.description}
                                    </p>
                                    <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                                        {card.ctaLabel}
                                        <ArrowRight size={13} />
                                    </div>
                                </div>
                            </div>
                        </Link>
                    )
                })}
            </div>
        </div>
    )
}

function actionIcon(iconKey) {
    switch (iconKey) {
        case 'camera':
            return Camera
        case 'message':
            return MessageSquare
        case 'search':
            return Search
        case 'scale':
            return Scale
        case 'guide':
        default:
            return BookOpen
    }
}
