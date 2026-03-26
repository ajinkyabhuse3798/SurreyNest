import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
    ArrowRight, BarChart3, MapPinned, Search, Shield, Info, AlertTriangle, ChevronDown,
} from 'lucide-react'

import Navbar from '../components/Navbar'
import Section from '../components/ui/Section'
import CrimeDonut from '../components/safety/CrimeDonut'
import MonthlyChart from '../components/safety/MonthlyChart'
import AreaRankings from '../components/safety/AreaRankings'
import { getGuildfordSafetyOverview } from '../services/safetyApi'

const POSTCODE_RE = /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d([A-Za-z]{2})?$/

function StatCard({ label, value, sub }) {
    return (
        <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-4 backdrop-blur-sm">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/55">{label}</p>
            <p className="mt-1 text-3xl font-black text-white">{value}</p>
            <p className="mt-1 text-sm text-orange-100/80">{sub}</p>
        </div>
    )
}

function MethodologyCard({ title, text, tone = 'slate' }) {
    const tones = {
        slate: 'border-slate-200 bg-white text-slate-700',
        amber: 'border-amber-200 bg-amber-50 text-amber-900',
        emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    }

    return (
        <div className={`rounded-2xl border p-4 shadow-sm ${tones[tone] || tones.slate}`}>
            <p className="text-xs font-bold uppercase tracking-[0.16em] opacity-60">{title}</p>
            <p className="mt-2 text-sm leading-relaxed">{text}</p>
        </div>
    )
}

function ReadMoreCard({ title, intro, children }) {
    return (
        <details className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                <div>
                    <p className="text-sm font-bold text-slate-900">{title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-500">{intro}</p>
                </div>
                <ChevronDown size={18} className="mt-0.5 flex-shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-4 space-y-3 border-t border-slate-100 pt-4 text-sm leading-relaxed text-slate-600">
                {children}
            </div>
        </details>
    )
}

function LoadingSkeleton() {
    return (
        <div className="space-y-6 px-4 py-8 sm:px-6 lg:px-8">
            <div className="mx-auto h-72 max-w-7xl animate-pulse rounded-[2rem] bg-slate-200" />
            <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[1fr_360px]">
                <div className="space-y-5">
                    <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
                    <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
                </div>
                <div className="space-y-5">
                    <div className="h-52 animate-pulse rounded-2xl bg-slate-100" />
                    <div className="h-52 animate-pulse rounded-2xl bg-slate-100" />
                </div>
            </div>
        </div>
    )
}

export default function SafetyOverview() {
    const navigate = useNavigate()
    const [overview, setOverview] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [search, setSearch] = useState('')
    const [searchError, setSearchError] = useState('')

    useEffect(() => {
        let cancelled = false
        setLoading(true)
        setError(null)

        getGuildfordSafetyOverview()
            .then((data) => {
                if (!cancelled) setOverview(data)
            })
            .catch(() => {
                if (!cancelled) setError('Could not load Guildford safety data right now.')
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })

        return () => {
            cancelled = true
        }
    }, [])

    function handleSearch(event) {
        event.preventDefault()
        const postcode = search.trim().toUpperCase()

        if (!postcode) {
            setSearchError('Type a postcode first, like GU2 7XH or GU1 3.')
            return
        }
        if (!POSTCODE_RE.test(postcode)) {
            setSearchError("That doesn't look right. Try a format like GU2 7 or GU2 7XH.")
            return
        }

        setSearchError('')
        navigate(`/safety/${encodeURIComponent(postcode)}`)
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f8f9fc]">
                <Navbar />
                <LoadingSkeleton />
            </div>
        )
    }

    if (error || !overview) {
        return (
            <div className="min-h-screen bg-[#f8f9fc]">
                <Navbar />
                <div className="mx-auto max-w-xl px-4 pt-24">
                    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                        <AlertTriangle size={40} className="mx-auto mb-4 text-amber-500" />
                        <h1 className="text-xl font-black text-slate-900">Couldn't load Guildford safety data right now</h1>
                        <p className="mt-2 text-sm text-slate-500">{error}</p>
                        <Link
                            to="/"
                            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white transition-colors hover:opacity-90"
                        >
                            Back to home
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    const safestArea = overview.safest_area?.postcode_sector || 'N/A'
    const hotspotArea = overview.hotspot_area?.postcode_sector || 'N/A'

    return (
        <div className="min-h-screen bg-[#f8f9fc]">
            <Navbar />

            <div className="relative overflow-hidden bg-gradient-to-br from-orange-600 via-orange-700 to-amber-800">
                <div className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-amber-400/25 blur-[90px]" />
                <div className="absolute -left-16 bottom-0 h-64 w-64 rounded-full bg-orange-300/20 blur-[90px]" />
                <div
                    className="absolute inset-0"
                    style={{
                        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)',
                        backgroundSize: '28px 28px',
                    }}
                />

                <div className="relative z-10 mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
                    <div className="grid gap-8 lg:grid-cols-[1.2fr_420px] lg:items-start">
                        <div>
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-white/80">
                                <Shield size={14} className="text-emerald-300" />
                                Guildford Safety
                            </div>

                            <h1 className="mt-5 max-w-3xl text-4xl font-black leading-tight text-white sm:text-5xl lg:text-6xl">
                                Guildford is one of the safest cities in England.
                                <span className="block text-orange-100">But every street is different.</span>
                            </h1>

                            <p className="mt-4 max-w-2xl text-base leading-relaxed text-orange-100/90 sm:text-lg">
                                Don't just take the landlord's word for it. See which parts of Guildford are quieter and which show up more in the data, then look up the specific street before you sign anything.
                            </p>

                            <div className="mt-6 grid gap-3 sm:grid-cols-3">
                                <StatCard
                                    label="Incidents tracked"
                                    value={overview.total_tracked_crimes_12m?.toLocaleString?.() || overview.total_tracked_crimes_12m}
                                    sub="Across all Guildford areas in the past 12 months"
                                />
                                <StatCard
                                    label="Data updated"
                                    value={overview.latest_month_label || 'N/A'}
                                    sub="Live from police.uk, refreshed every month"
                                />
                                <StatCard
                                    label="Areas covered"
                                    value={overview.sector_count || 0}
                                    sub="Postcode areas we compare side by side"
                                />
                            </div>
                        </div>

                        <div className="rounded-[2rem] border border-white/15 bg-white/10 p-5 shadow-2xl backdrop-blur-md">
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/60">Look up your postcode</p>
                            <h2 className="mt-2 text-2xl font-black text-white">Type in the area you're thinking of renting</h2>
                            <p className="mt-2 text-sm leading-relaxed text-orange-100/85">
                                You'll get a local safety score, a breakdown of what types of incidents show up, and a student-specific read, all for that one area.
                            </p>

                            <form onSubmit={handleSearch} className="mt-5 space-y-3">
                                <div className="relative">
                                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/45" />
                                    <input
                                        value={search}
                                        onChange={(event) => {
                                            setSearch(event.target.value)
                                            setSearchError('')
                                        }}
                                        placeholder="e.g. GU2 7XH or GU1 3"
                                        className="w-full rounded-2xl border border-white/20 bg-white/10 py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-orange-700 transition-colors hover:bg-orange-50"
                                >
                                    Check this area
                                    <ArrowRight size={15} />
                                </button>
                                {searchError ? (
                                    <p className="text-xs text-rose-200">{searchError}</p>
                                ) : (
                                    <p className="text-xs text-white/60">
                                        Try one of these areas: {(overview.coverage_sectors || []).slice(0, 4).join(', ')}
                                    </p>
                                )}
                            </form>

                            <div className="mt-5 grid gap-3 sm:grid-cols-2">
                                <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/50">Calmest right now</p>
                                    <p className="mt-2 text-xl font-black text-white">{safestArea}</p>
                                    <p className="mt-1 text-xs text-white/65">The quietest postcode area based on the latest data.</p>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/50">Worth a closer look</p>
                                    <p className="mt-2 text-xl font-black text-white">{hotspotArea}</p>
                                    <p className="mt-1 text-xs text-white/65">Comes up more in the data, read the detail before renting here.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#f8f9fc] to-transparent" />
            </div>

            <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
                <div className="mb-6 grid gap-4 lg:grid-cols-3">
                    <MethodologyCard
                        title="What these numbers show"
                        text="Nearby police.uk incidents around one representative point per area, filtered to the incident types that actually matter when you're deciding where to live. Updated every month."
                        tone="emerald"
                    />
                    <MethodologyCard
                        title="Why the totals here can look lower"
                        text="We keep a tighter local zone, roughly 500m around each area's representative point, so comparing area to area is genuinely fair. Wider police.uk totals cover a bigger radius and will usually look higher."
                        tone="amber"
                    />
                    <MethodologyCard
                        title="How to use this page"
                        text="Browse the city-wide trend and rankings here. When you find an area you're interested in, click it, you'll get the full local breakdown, including a student-specific read."
                    />
                </div>

                <div className="mb-6 grid gap-5 lg:grid-cols-[1fr_360px]">
                    <div className="space-y-5">
                        <Section
                            icon={BarChart3}
                            title="Is Guildford getting safer?"
                            subtitle="Month by month, is the overall picture improving?"
                        >
                            <MonthlyChart data={overview.crime_trend?.monthly_data} trend={overview.crime_trend} />
                        </Section>

                        <Section
                            icon={Shield}
                            title="What kinds of incidents happen most across Guildford?"
                            subtitle="The recent mix of crime categories, so you know what to actually think about"
                        >
                            <CrimeDonut breakdown={overview.crime_breakdown} />
                        </Section>

                        <Section
                            icon={MapPinned}
                            title="How areas compare across Guildford"
                            subtitle="Quietest to busiest, a useful starting point before you look at a specific postcode"
                        >
                            <AreaRankings rankings={overview.rankings} />
                        </Section>
                    </div>

                    <div className="space-y-5">
                        <Section
                            icon={Info}
                            title="Some useful numbers"
                            subtitle="Guildford at a glance, what a typical month and a typical area actually look like"
                        >
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-xl bg-slate-50 p-4 text-center">
                                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">On an average month</p>
                                        <p className="mt-1 text-2xl font-black text-slate-900">
                                            {Math.round(overview.average_monthly_tracked_crimes || 0)}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-500">incidents across all of Guildford</p>
                                    </div>
                                    <div className="rounded-xl bg-slate-50 p-4 text-center">
                                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Per area, per year</p>
                                        <p className="mt-1 text-2xl font-black text-slate-900">
                                            {Math.round(overview.average_sector_total_12m || 0)}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-500">incidents in a typical postcode area</p>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Pick an area to explore</p>
                                    <p className="mt-1 text-sm text-slate-500">Click any postcode below to see its local trend, student-specific read, and what kinds of incidents show up there.</p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {(overview.coverage_sectors || []).map((sector) => (
                                            <Link
                                                key={sector}
                                                to={`/safety/${encodeURIComponent(sector)}`}
                                                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-primary/30 hover:text-primary"
                                            >
                                                {sector}
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </Section>

                        <ReadMoreCard
                            title="Why do the numbers here look different to police.uk?"
                            intro="A quick note on why our totals can look smaller, and why that actually makes area-to-area comparison more useful."
                        >
                            <p>
                                Police.uk shows crime for a wide radius around a map point. We narrow that down to a tighter local zone, roughly 500m around one representative point for each area, so that comparing postcode to postcode is actually fair.
                            </p>
                            <p>
                                Think of it like this: if you're choosing between two streets, you don't want one to look safer just because it happens to sit on a quieter edge of a large data blob. We keep the view tight so nearby areas are genuinely comparable.
                            </p>
                            <p>
                                Want more detail? Click into any postcode below. That page breaks it down by category, shows whether things are improving, and gives you a student-specific read.
                            </p>
                        </ReadMoreCard>

                        <ReadMoreCard
                            title="How is the data actually put together?"
                            intro="Open this if you want to know exactly what we're tracking and why."
                        >
                            <div className="space-y-3 text-sm leading-relaxed text-slate-600">
                                <p>
                                    police.uk returns a list of street-level incidents around a latitude and longitude. We query that around one representative point per postcode area, then keep the incidents that fall within our tighter local radius and the categories that matter for everyday safety.
                                </p>
                                <p>
                                    We track eight crime types, including anti-social behaviour, burglary, theft, and violent crime, and filter out categories that are less relevant to residential life.
                                </p>
                                <p>
                                    A tighter radius means neighbouring postcodes don't bleed into each other as much. That's why raw police.uk totals for a wider area will usually look higher than what you see here.
                                </p>
                            </div>
                        </ReadMoreCard>
                    </div>
                </div>
            </div>
        </div>
    )
}
