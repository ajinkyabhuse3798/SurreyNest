/**
 * CheckListing — paste a SpareRoom/Rightmove/OpenRent URL to see SurreyNest analysis.
 *
 * Flow: user pastes URL → POST /api/listings/check → display area analysis
 * (safety score, rent predictions, HMO data, flood risk, nearby properties).
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
    LinkIcon, Loader2, Shield, PoundSterling, Home, AlertTriangle,
    Droplets, MapPin, ExternalLink, CheckCircle2, ArrowRight, Info, Hash,
} from 'lucide-react'
import Navbar from '../components/Navbar'
import api from '../services/api'

// ── Supported platforms ─────────────────────────────────────────────────────
const PLATFORMS = [
    { name: 'SpareRoom', domain: 'spareroom.co.uk', color: '#5B2D8E' },
    { name: 'Rightmove', domain: 'rightmove.co.uk', color: '#00DEB6' },
    { name: 'OpenRent', domain: 'openrent.com', color: '#1A73E8' },
    { name: 'Zoopla', domain: 'zoopla.co.uk', color: '#8046F3' },
]

// ── Score colour helper ─────────────────────────────────────────────────────
function scoreColor(score) {
    if (score >= 70) return { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200' }
    if (score >= 50) return { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200' }
    return { bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-200' }
}

export default function CheckListing() {
    const [url, setUrl] = useState('')
    const [postcode, setPostcode] = useState('')
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState(null)
    const [error, setError] = useState('')

    async function handleCheck(e) {
        e?.preventDefault()
        setError('')
        setResult(null)

        const trimmed = url.trim()
        const pc = postcode.trim().toUpperCase()

        if (!trimmed) {
            setError('Please paste a listing URL.')
            return
        }

        // Basic URL validation
        try {
            const parsed = new URL(trimmed)
            const supported = PLATFORMS.some(p => parsed.hostname.includes(p.domain))
            if (!supported) {
                setError('Unsupported website. We support SpareRoom, Rightmove, OpenRent, and Zoopla.')
                return
            }
        } catch {
            setError('Please enter a valid URL.')
            return
        }

        setLoading(true)
        try {
            const body = { url: trimmed }
            if (pc) body.postcode = pc
            const res = await api.post('/api/listings/check', body)
            setResult(res.data)
        } catch (err) {
            const detail = err?.response?.data?.detail
            setError(detail || 'Something went wrong. Please check the URL and try again.')
        } finally {
            setLoading(false)
        }
    }

    // Handle paste event
    function handlePaste(e) {
        setTimeout(() => {
            const pasted = e.target.value?.trim()
            if (pasted && pasted.startsWith('http')) {
                setUrl(pasted)
            }
        }, 0)
    }

    const r = result // shorthand

    return (
        <>
            <Navbar />
            <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
                {/* ── Hero ──────────────────────────────────────────────── */}
                <section className="relative px-4 pt-10 pb-8 md:pt-16 md:pb-12">
                    <div className="max-w-2xl mx-auto text-center">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                        >
                            <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-full px-4 py-1.5 mb-5">
                                <LinkIcon size={14} className="text-indigo-600" />
                                <span className="text-xs font-medium text-indigo-700">Listing Checker</span>
                            </div>

                            <h1 className="text-3xl font-bold text-gray-900 mb-3 md:text-4xl tracking-tight">
                                Check any{' '}
                                <span className="bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
                                    rental listing
                                </span>
                            </h1>

                            <p className="text-gray-500 mb-8 max-w-lg mx-auto">
                                Paste a listing URL from SpareRoom, Rightmove, OpenRent, or Zoopla — we'll analyse the area's safety, rent fairness, and HMO status.
                            </p>
                        </motion.div>

                        {/* ── Input ─────────────────────────────────────── */}
                        <motion.form
                            onSubmit={handleCheck}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.15 }}
                            className="bg-white rounded-2xl border border-gray-200 shadow-lg shadow-gray-200/50 p-4 md:p-5"
                        >
                            <div className="flex flex-col gap-3">
                                {/* URL row */}
                                <div className="flex flex-col gap-3 sm:flex-row">
                                    <div className="relative flex-1">
                                        <LinkIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="text"
                                            value={url}
                                            onChange={(e) => { setUrl(e.target.value); if (error) setError('') }}
                                            onPaste={handlePaste}
                                            placeholder="Paste listing URL here..."
                                            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
                                            id="listing-url-input"
                                        />
                                    </div>
                                </div>
                                {/* Postcode + submit row */}
                                <div className="flex flex-col gap-3 sm:flex-row">
                                    <div className="relative sm:w-44">
                                        <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="text"
                                            value={postcode}
                                            onChange={(e) => { setPostcode(e.target.value.toUpperCase()); if (error) setError('') }}
                                            placeholder="Area e.g. GU1 or GU1 3JT"
                                            maxLength={8}
                                            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow uppercase"
                                            id="listing-postcode-input"
                                        />
                                    </div>
                                    <p className="hidden sm:flex items-center text-xs text-gray-400 font-medium">
                                        Rightmove/Zoopla show GU1, GU2 etc. — that works too
                                    </p>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="sm:ml-auto bg-indigo-600 text-white rounded-xl px-6 py-3 text-sm font-semibold hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 sm:px-8"
                                    >
                                        {loading ? (
                                            <><Loader2 size={16} className="animate-spin" /> Analysing...</>
                                        ) : (
                                            <><CheckCircle2 size={16} /> Check Listing</>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <div className="mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                                    <AlertTriangle size={14} />
                                    {error}
                                </div>
                            )}

                            {/* Supported platforms */}
                            <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-400">
                                <span>Supported:</span>
                                {PLATFORMS.map(p => (
                                    <span key={p.name} className="font-medium" style={{ color: p.color }}>
                                        {p.name}
                                    </span>
                                ))}
                            </div>
                        </motion.form>
                    </div>
                </section>

                {/* ── Results ───────────────────────────────────────────── */}
                <AnimatePresence>
                    {r && (
                        <motion.section
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.5 }}
                            className="px-4 pb-16"
                        >
                            <div className="max-w-3xl mx-auto">
                                {/* Header */}
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900">
                                            Area Analysis: {r.postcode}
                                        </h2>
                                        <p className="text-sm text-gray-500 mt-0.5">{r.message}</p>
                                    </div>
                                    <a
                                        href={r.original_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1.5 text-xs text-indigo-600 font-medium hover:text-indigo-800 bg-indigo-50 rounded-lg px-3 py-2"
                                    >
                                        <ExternalLink size={12} />
                                        Original listing
                                    </a>
                                </div>

                                {/* ── Score cards ──────────────────────────── */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                                    {/* Safety */}
                                    <ScoreCard
                                        icon={Shield}
                                        iconColor="text-emerald-600"
                                        label="Safety Score"
                                        value={r.safety_score ? Math.round(r.safety_score) : '—'}
                                        subtitle={r.safety_label || 'No data'}
                                        score={r.safety_score}
                                    />

                                    {/* Rent */}
                                    <ScoreCard
                                        icon={PoundSterling}
                                        iconColor="text-blue-600"
                                        label="Avg. Rent"
                                        value={r.avg_predicted_rent_weekly ? `£${Math.round(r.avg_predicted_rent_weekly)}/wk` : '—'}
                                        subtitle={r.avg_predicted_rent_monthly ? `≈ £${Math.round(r.avg_predicted_rent_monthly)}/mo` : 'No prediction'}
                                    />

                                    {/* Properties */}
                                    <ScoreCard
                                        icon={Home}
                                        iconColor="text-indigo-600"
                                        label="Properties"
                                        value={r.properties_in_area}
                                        subtitle="in this postcode"
                                    />

                                    {/* Flood Risk */}
                                    <ScoreCard
                                        icon={Droplets}
                                        iconColor="text-cyan-600"
                                        label="Flood Risk"
                                        value={r.flood_risk_severity || 'None'}
                                        subtitle="EA assessment"
                                    />
                                </div>

                                {/* ── HMO info ─────────────────────────────── */}
                                {(r.hmo_total_count > 0 || r.hmo_licensed_count > 0) && (
                                    <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Info size={16} className="text-amber-600" />
                                            <h3 className="text-sm font-semibold text-gray-900">HMO Status in {r.postcode}</h3>
                                        </div>
                                        <p className="text-sm text-gray-600">
                                            {r.hmo_licensed_count} licensed HMO{r.hmo_licensed_count !== 1 ? 's' : ''} out of {r.hmo_total_count} total in this postcode area.
                                            {r.hmo_licensed_count > 0 && (
                                                <span className="text-emerald-600 font-medium"> Properties with valid licences meet safety standards.</span>
                                            )}
                                        </p>
                                    </div>
                                )}

                                {/* ── Nearby properties ────────────────────── */}
                                {r.nearby_properties?.length > 0 && (
                                    <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
                                        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                            <MapPin size={16} className="text-indigo-600" />
                                            Properties at {r.postcode} in our database
                                        </h3>
                                        <div className="space-y-2">
                                            {r.nearby_properties.map(p => (
                                                <Link
                                                    key={p.uprn}
                                                    to={`/property/${p.uprn}`}
                                                    className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors group"
                                                >
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-medium text-gray-900 truncate">{p.address}</p>
                                                        <p className="text-xs text-gray-500">
                                                            {p.property_type || 'Property'}
                                                            {p.num_rooms ? ` · ${p.num_rooms} bed` : ''}
                                                            {p.tenure && (
                                                                <span className={`ml-1.5 inline-flex items-center text-[10px] font-medium rounded px-1.5 py-0.5 leading-none ${p.tenure.includes('rental') || p.tenure.includes('rented')
                                                                        ? 'bg-emerald-50 text-emerald-700'
                                                                        : 'bg-gray-100 text-gray-500'
                                                                    }`}>
                                                                    {p.tenure.includes('rental') || p.tenure.includes('rented') ? 'Rental' : 'Owner'}
                                                                </span>
                                                            )}
                                                        </p>
                                                    </div>
                                                    <ArrowRight size={14} className="text-gray-300 group-hover:text-indigo-500 transition-colors flex-shrink-0" />
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* ── CTA ───────────────────────────────────── */}
                                <div className="text-center">
                                    <Link
                                        to={`/search?postcode=${encodeURIComponent(r.postcode)}&radius=1000`}
                                        className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors"
                                    >
                                        View full area analysis
                                        <ArrowRight size={16} />
                                    </Link>
                                </div>
                            </div>
                        </motion.section>
                    )}
                </AnimatePresence>

                {/* ── How it works (when no results) ────────────────────── */}
                {!r && !loading && (
                    <motion.section
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="px-4 pb-16"
                    >
                        <div className="max-w-2xl mx-auto">
                            <h3 className="text-center text-sm font-semibold text-gray-400 uppercase tracking-wider mb-6">How it works</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {[
                                    { step: '1', title: 'Paste URL', desc: 'Copy any listing URL from SpareRoom, Rightmove, OpenRent, or Zoopla' },
                                    { step: '2', title: 'We analyse', desc: 'We extract the postcode and cross-reference our Guildford property database' },
                                    { step: '3', title: 'Get insights', desc: 'See safety scores, rent fairness, HMO status, and flood risk for the area' },
                                ].map(s => (
                                    <div key={s.step} className="text-center">
                                        <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 font-bold text-sm flex items-center justify-center mx-auto mb-3">
                                            {s.step}
                                        </div>
                                        <h4 className="text-sm font-semibold text-gray-900 mb-1">{s.title}</h4>
                                        <p className="text-xs text-gray-500 leading-relaxed">{s.desc}</p>
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


// ── ScoreCard sub-component ─────────────────────────────────────────────────
function ScoreCard({ icon: Icon, iconColor, label, value, subtitle, score }) {
    const colors = score ? scoreColor(score) : { bg: 'bg-gray-50', text: 'text-gray-700', ring: 'ring-gray-200' }

    return (
        <div className={`${colors.bg} border border-gray-100 rounded-xl p-4 ring-1 ${colors.ring}`}>
            <Icon size={18} className={`${iconColor} mb-2`} />
            <p className="text-xs text-gray-500 mb-0.5">{label}</p>
            <p className={`text-xl font-bold ${colors.text}`}>{value}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>
        </div>
    )
}
