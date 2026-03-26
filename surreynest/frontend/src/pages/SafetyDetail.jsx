/**
 * SafetyDetail v3, Full-width, two-column safety intelligence page.
 *
 * Route: /safety/:postcode
 *
 * Layout (desktop):
 *   Full-width hero → city-overview strip → [left: crime data | right: insights]
 *   → Guildford attractions → data footer
 */
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
    Shield, TrendingUp, MapPin, Award, Train,
    GraduationCap, Home, Lightbulb, AlertCircle, ArrowLeft, ChevronDown,
} from 'lucide-react'
import Navbar from '../components/Navbar'
import Section from '../components/ui/Section'
import { getSafetyIntelligence, getSafetyRankings } from '../services/safetyApi'
import api from '../services/api'

import SafetyHero from '../components/safety/SafetyHero'
import SafetyCityOverview from '../components/safety/SafetyCityOverview'
import GuildfordAttractions from '../components/safety/GuildfordAttractions'
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
            <div className="h-5 w-24 bg-slate-200 rounded" />
            <div className="grid lg:grid-cols-[1fr_360px] gap-5">
                <div className="space-y-5">
                    <div className="h-64 bg-slate-100 rounded-2xl" />
                    <div className="h-48 bg-slate-100 rounded-2xl" />
                    <div className="h-48 bg-slate-100 rounded-2xl" />
                </div>
                <div className="space-y-5">
                    <div className="h-40 bg-slate-100 rounded-2xl" />
                    <div className="h-40 bg-slate-100 rounded-2xl" />
                    <div className="h-32 bg-slate-100 rounded-2xl" />
                </div>
            </div>
        </div>
    )
}

function ReadMoreCard({ title, intro, children }) {
    return (
        <details className="group rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 shadow-sm">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700/70">{title}</p>
                    <p className="mt-2 text-sm leading-relaxed text-amber-950">{intro}</p>
                </div>
                <ChevronDown size={18} className="mt-0.5 flex-shrink-0 text-amber-700/70 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-4 space-y-3 border-t border-amber-200/70 pt-4 text-sm leading-relaxed text-amber-900/90">
                {children}
            </div>
        </details>
    )
}

function splitIntoBalancedColumns(items) {
    const columns = [[], []]
    const weights = [0, 0]

    items.forEach((item) => {
        const targetColumn = weights[0] <= weights[1] ? 0 : 1
        columns[targetColumn].push(item)
        weights[targetColumn] += item.weight || 1
    })

    return columns
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
            api.get('/api/scores/safety', { params: { postcode: decodedPostcode } }).then(r => r.data).catch(() => null),
            fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(decodedPostcode)}`)
                .then(r => r.json())
                .then(d => (d.status === 200 && d.result) ? { lat: d.result.latitude, lng: d.result.longitude } : null)
                .catch(() => null),
        ]).then(([intelData, rankData, scoreData, coordData]) => {
            setIntel(intelData)
            setRankings(rankData)
            setSafetyScore(scoreData?.safety_score ?? null)
            setCoords(coordData)
            if (!intelData) setError('No safety data available for this area.')
        }).finally(() => setLoading(false))
    }, [decodedPostcode])

    const sector = intel?.postcode_sector || ''
    const methodology = intel?.methodology || {}
    const diff = intel?.compared_to_average?.difference_percent ?? 0
    let overallStars = 3
    if (diff <= -60) overallStars = 5
    else if (diff <= -30) overallStars = 4
    else if (diff <= 10) overallStars = 3
    else if (diff <= 50) overallStars = 2
    else overallStars = 1

    const contentSections = []

    if (intel?.crime_breakdown?.length > 0) {
        contentSections.push({
            key: 'crime-breakdown',
            weight: 1.35,
            content: (
                <Section icon={Shield} title="What types of incidents show up here?" subtitle="Every area has its own pattern. Here's what this one looks like.">
                    <CrimeDonut breakdown={intel.crime_breakdown} />
                </Section>
            ),
        })
    }

    if (intel?.crime_trend) {
        contentSections.push({
            key: 'crime-trend',
            weight: 1.25,
            content: (
                <Section icon={TrendingUp} title="How this area has been changing" subtitle="Is it getting better or worse? The month-by-month view tells the story.">
                    <MonthlyChart data={intel.crime_trend.monthly_data} trend={intel.crime_trend} />
                </Section>
            ),
        })
    }

    contentSections.push({
        key: 'rankings',
        weight: 1.05,
        content: (
            <Section icon={Award} title="How it ranks across Guildford" subtitle="See which areas are calmer and which ones are busier, and where this one fits.">
                <AreaRankings rankings={rankings} currentSector={sector} />
            </Section>
        ),
    })

    contentSections.push({
        key: 'comparison',
        weight: 0.95,
        content: (
            <Section icon={MapPin} title="How does this compare?" subtitle="A straight comparison against the typical Guildford sector, is this above or below average?">
                <GuildfordComparison comparison={intel?.compared_to_average} />
            </Section>
        ),
    })

    contentSections.push({
        key: 'student-safety',
        weight: 1.4,
        content: (
            <Section icon={GraduationCap} title="What does this mean for students?" subtitle="The same data, filtered through a student lens, night walks, shared housing, and everyday routines.">
                <StudentSafety data={intel?.student_vulnerability} />
            </Section>
        ),
    })

    if (coords) {
        contentSections.push({
            key: 'train-stations',
            weight: 1,
            content: (
                <Section icon={Train} title="Nearest train stations" subtitle="How far you are from the nearest station, good to know before you commit to a property.">
                    <TrainStations lat={coords.lat} lng={coords.lng} />
                </Section>
            ),
        })
    }

    if (intel?.holiday_burglary_risk?.risk_level !== 'low' && intel?.holiday_burglary_risk) {
        contentSections.push({
            key: 'holiday-risk',
            weight: 0.95,
            content: (
                <Section icon={Home} title="Empty over the holidays?" subtitle="Some areas see more break-ins when students leave. Worth knowing before you go.">
                    <HolidayAlert risk={intel.holiday_burglary_risk} />
                </Section>
            ),
        })
    }

    if (intel?.safety_tips?.length > 0) {
        contentSections.push({
            key: 'safety-tips',
            weight: intel.safety_tips.length > 3 ? 1.1 : 0.85,
            content: (
                <Section icon={Lightbulb} title="Things worth knowing" subtitle="Quick, practical tips based on what actually happens in this area.">
                    <SafetyTips tips={intel.safety_tips} />
                </Section>
            ),
        })
    }

    contentSections.push({
        key: 'guildford-attractions',
        weight: 1.4,
        content: (
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 sm:p-6">
                <GuildfordAttractions />
            </div>
        ),
    })

    const [leftColumnSections, rightColumnSections] = splitIntoBalancedColumns(contentSections)

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
                        <button onClick={() => navigate('/safety')} className="flex items-center gap-1.5 text-sm text-primary font-medium hover:text-primary/80 mx-auto">
                            <ArrowLeft size={14} /> Go back
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    {/* ── Full-width hero ── */}
                    <SafetyHero
                        sector={sector}
                        decodedPostcode={decodedPostcode}
                        safetyScore={safetyScore}
                        overallStars={overallStars}
                        sectorTotal={intel?.compared_to_average?.sector_total}
                    />

                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20">
                        <button
                            onClick={() => navigate('/safety')}
                            className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-slate-500 transition-colors hover:border-primary/20 hover:text-primary"
                        >
                            <ArrowLeft size={13} />
                            All Guildford areas
                        </button>

                        {/* ── City overview strip ── */}
                        <SafetyCityOverview />

                        <ReadMoreCard
                            title="How to read this page"
                            intro="This gives you a real local picture, not just a raw number, but what actually happens here and what it means if you're a student."
                        >
                            <p>{methodology.summary}</p>
                            <p>{methodology.why_counts_look_lower}</p>
                            <p>Use this to see how this area compares to the rest of Guildford, understand what types of incidents show up, and get a student-specific read on what it's actually like to live here.</p>
                        </ReadMoreCard>

                        <div className="space-y-5 mb-6 lg:hidden">
                            {contentSections.map((section) => (
                                <div key={section.key}>{section.content}</div>
                            ))}
                        </div>

                        <div className="hidden lg:grid lg:grid-cols-2 gap-5 mb-6 items-start">
                            <div className="space-y-5">
                                {leftColumnSections.map((section) => (
                                    <div key={section.key}>{section.content}</div>
                                ))}
                            </div>

                            <div className="space-y-5">
                                {rightColumnSections.map((section) => (
                                    <div key={section.key}>{section.content}</div>
                                ))}
                            </div>
                        </div>

                        {/* ── Data source ── */}
                        <div className="text-center text-xs text-slate-400 py-8">
                            <p>Crime data from <span className="font-medium">police.uk</span> · Covers 12 months up to <span className="font-medium">{methodology.latest_month_label || 'the latest available month'}</span> · Showing: <span className="font-medium">{sector}</span></p>
                            <p className="mt-1">This page exists to help you compare areas honestly. Open the note at the top to see exactly how we put these numbers together.</p>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
