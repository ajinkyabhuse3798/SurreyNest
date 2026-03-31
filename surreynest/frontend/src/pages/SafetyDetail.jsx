/**
 * SafetyDetail v4 — Story-driven safety intelligence page.
 *
 * Route: /safety/:postcode
 *
 * Layout (4-act narrative):
 *   1. VERDICT   — full-width hero + verdict card: "Is this area safe for you?"
 *   2. EVIDENCE  — crime breakdown + monthly trend + student safety (left column)
 *   3. CONTEXT   — comparison, rankings, holiday risk, tips (right column)
 *   4. LIFESTYLE — Guildford attractions + data footer
 */
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
    Shield, TrendingUp, MapPin, Award, Train,
    GraduationCap, Home, Lightbulb, AlertCircle, ArrowLeft,
} from 'lucide-react'
import Navbar from '../components/Navbar'
import Section from '../components/ui/Section'
import { getSafetyIntelligence, getSafetyRankings } from '../services/safetyApi'
import api from '../services/api'

import SafetyHero from '../components/safety/SafetyHero'
import SafetyCityOverview from '../components/safety/SafetyCityOverview'
import GuildfordAttractions from '../components/safety/GuildfordAttractions'
import VerdictCard from '../components/safety/VerdictCard'
import CrimeDonut from '../components/safety/CrimeDonut'
import MonthlyChart from '../components/safety/MonthlyChart'
import GuildfordComparison from '../components/safety/GuildfordComparison'
import AreaRankings from '../components/safety/AreaRankings'
import TrainStations from '../components/safety/TrainStations'
import StudentSafety from '../components/safety/StudentSafety'
import HolidayAlert from '../components/safety/HolidayAlert'
import SafetyTips from '../components/safety/SafetyTips'


function PageSkeleton() {
    return (
        <div className="space-y-6 animate-pulse px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto">
            <div className="h-24 w-full bg-slate-100 rounded-2xl" />
            <div className="h-32 w-full bg-slate-100 rounded-2xl" />
            <div className="grid lg:grid-cols-[3fr_2fr] gap-6">
                <div className="space-y-6">
                    <div className="h-64 bg-slate-100 rounded-2xl" />
                    <div className="h-52 bg-slate-100 rounded-2xl" />
                </div>
                <div className="space-y-6">
                    <div className="h-48 bg-slate-100 rounded-2xl" />
                    <div className="h-44 bg-slate-100 rounded-2xl" />
                    <div className="h-36 bg-slate-100 rounded-2xl" />
                </div>
            </div>
            <div className="h-72 bg-slate-100 rounded-2xl" />
            <div className="h-56 bg-slate-100 rounded-2xl" />
        </div>
    )
}


export default function SafetyDetail() {
    const { postcode } = useParams()
    const navigate = useNavigate()
    const decodedPostcode = decodeURIComponent(postcode || '')

    const [intel, setIntel] = useState(null)
    const [rankings, setRankings] = useState(null)
    const [safetyScore, setSafetyScore] = useState(null)
    const [coords, setCoords] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (!decodedPostcode) return
        setLoading(true)
        setError(null)

        Promise.all([
            getSafetyIntelligence(decodedPostcode).catch(() => null),
            getSafetyRankings().catch(() => null),
            api.get('/api/scores/safety', { params: { postcode: decodedPostcode } })
                .then((r) => r.data)
                .catch(() => null),
            fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(decodedPostcode)}`)
                .then((r) => r.json())
                .then((d) =>
                    d.status === 200 && d.result
                        ? { lat: d.result.latitude, lng: d.result.longitude }
                        : null
                )
                .catch(() => null),
        ]).then(([intelData, rankData, scoreData, coordData]) => {
            setIntel(intelData)
            setRankings(rankData)
            setSafetyScore(scoreData?.safety_score ?? null)
            setCoords(coordData)
            if (!intelData) setError('No safety data available for this area.')
        }).finally(() => setLoading(false))
    }, [decodedPostcode])

    // Derived values
    const sector = intel?.postcode_sector || ''
    const diff = intel?.compared_to_average?.difference_percent ?? 0
    const percentile = intel?.compared_to_average?.percentile ?? null
    const methodology = intel?.methodology || {}

    let overallStars = 3
    if (diff <= -60) overallStars = 5
    else if (diff <= -30) overallStars = 4
    else if (diff <= 10) overallStars = 3
    else if (diff <= 50) overallStars = 2
    else overallStars = 1

    return (
        <div className="min-h-screen bg-[#f8f9fc]">
            <Navbar />

            {loading ? (
                <>
                    <div className="h-72 bg-orange-700 animate-pulse" />
                    <PageSkeleton />
                </>
            ) : error ? (
                <div className="max-w-lg mx-auto px-4 pt-24">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-8 text-center">
                        <AlertCircle size={48} className="text-slate-300 mx-auto mb-4" />
                        <h2 className="text-lg font-bold text-slate-700 mb-2">No Data Available</h2>
                        <p className="text-sm text-slate-500 mb-4">{error}</p>
                        <button
                            onClick={() => navigate('/safety')}
                            className="flex items-center gap-1.5 text-sm text-primary font-medium hover:text-primary/80 mx-auto"
                        >
                            <ArrowLeft size={14} /> Go back
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    {/* ── ACT 1: VERDICT ── */}
                    <SafetyHero
                        sector={sector}
                        decodedPostcode={decodedPostcode}
                        safetyScore={safetyScore}
                        overallStars={overallStars}
                        sectorTotal={intel?.compared_to_average?.sector_total}
                        percentile={percentile}
                    />

                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20">
                        <button
                            onClick={() => navigate('/safety')}
                            className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-slate-500 transition-colors hover:border-primary/20 hover:text-primary"
                        >
                            <ArrowLeft size={13} />
                            All Guildford areas
                        </button>

                        {/* City context strip */}
                        <SafetyCityOverview />

                        {/* Full-width verdict card */}
                        <VerdictCard
                            comparison={intel?.compared_to_average}
                            safetyScore={safetyScore}
                            studentVulnerability={intel?.student_vulnerability}
                        />

                        {/* ── ACT 2 + 3: EVIDENCE (left) + CONTEXT (right) ── */}
                        {/* Left gets crime breakdown + trend; right gets comparison + practical info.
                            3fr/2fr gives left ~755px and right ~500px at max-w-7xl — enough for both. */}
                        <div className="grid gap-6 lg:grid-cols-[3fr_2fr] items-start">

                            {/* Left column — crime breakdown + trend */}
                            <div className="space-y-6">
                                {intel?.crime_breakdown?.length > 0 && (
                                    <Section
                                        icon={Shield}
                                        title="What types of incidents show up here?"
                                        subtitle="Every area has its own pattern. Here's what this one looks like."
                                    >
                                        <CrimeDonut breakdown={intel.crime_breakdown} />
                                    </Section>
                                )}

                                {intel?.crime_trend && (
                                    <Section
                                        icon={TrendingUp}
                                        title="Is this area getting safer?"
                                        subtitle="Month by month. Is the picture improving, stable, or worsening?"
                                    >
                                        <MonthlyChart
                                            data={intel.crime_trend.monthly_data}
                                            trend={intel.crime_trend}
                                        />
                                    </Section>
                                )}
                            </div>

                            {/* Right column — comparison + practical context */}
                            <div className="space-y-6">
                                <Section
                                    icon={MapPin}
                                    title="How does this area compare?"
                                    subtitle="This area vs the typical Guildford postcode. Above or below average?"
                                >
                                    <GuildfordComparison comparison={intel?.compared_to_average} />
                                </Section>

                                <Section
                                    icon={Home}
                                    title="Going home for the holidays?"
                                    subtitle="Some areas see more break-ins when students leave for summer or Christmas."
                                >
                                    <HolidayAlert risk={intel?.holiday_burglary_risk} />
                                </Section>

                                {intel?.safety_tips?.length > 0 && (
                                    <Section
                                        icon={Lightbulb}
                                        title="Things worth knowing"
                                        subtitle="Quick, practical tips based on what actually happens in this area."
                                    >
                                        <SafetyTips tips={intel.safety_tips} />
                                    </Section>
                                )}

                                {coords && (
                                    <Section
                                        icon={Train}
                                        title="Nearest train stations"
                                        subtitle="How far you are from the station. Useful before you commit."
                                    >
                                        <TrainStations lat={coords.lat} lng={coords.lng} />
                                    </Section>
                                )}
                            </div>
                        </div>

                        {/* ── Full-width: student safety — 5 scenario cards need horizontal room ── */}
                        <div className="mt-6">
                            <Section
                                icon={GraduationCap}
                                title="What does this mean for students?"
                                subtitle="The same data filtered through what actually matters for student life."
                            >
                                <StudentSafety data={intel?.student_vulnerability} />
                            </Section>
                        </div>

                        {/* ── Full-width: rankings — two side-by-side lists need breathing room ── */}
                        <div className="mt-6">
                            <Section
                                icon={Award}
                                title="How it ranks across Guildford"
                                subtitle="Quietest to busiest. See where this area sits."
                            >
                                <AreaRankings rankings={rankings} currentSector={sector} />
                            </Section>
                        </div>

                        {/* ── ACT 4: LIFESTYLE ── */}
                        <div className="mt-6 bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 sm:p-6">
                            <GuildfordAttractions />
                        </div>

                        {/* Data source footer */}
                        <div className="text-center text-xs text-slate-400 py-8 space-y-1">
                            <p>
                                Crime data from{' '}
                                <span className="font-medium">police.uk</span> &middot; Covers 12 months up to{' '}
                                <span className="font-medium">
                                    {methodology.latest_month_label || 'the latest available month'}
                                </span>{' '}
                                &middot; Showing:{' '}
                                <span className="font-medium">{sector}</span>
                            </p>
                            <p>
                                Tracks 8 crime categories within ~500m of this area's representative point.
                                Totals are designed for comparing Guildford areas, not official borough-wide figures.
                            </p>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
