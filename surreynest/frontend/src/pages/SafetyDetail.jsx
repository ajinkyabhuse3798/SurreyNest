/**
 * SafetyDetail v2 — Thin orchestrator for the safety analytics page.
 *
 * Route: /safety/:postcode
 *
 * All visual sections are extracted into focused sub-components
 * under components/safety/. This file retains only state, fetch,
 * derived values, and section composition.
 */
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
    Shield, ArrowLeft, TrendingUp, MapPin, Award, Train,
    GraduationCap, Home, Lightbulb, AlertCircle,
} from 'lucide-react'
import Navbar from '../components/Navbar'
import Section from '../components/ui/Section'
import { getSafetyIntelligence, getSafetyRankings } from '../services/safetyApi'
import api from '../services/api'

// ── Sub-components ───────────────────────────────────────────────────────────
import SafetyHero from '../components/safety/SafetyHero'
import CrimeDonut from '../components/safety/CrimeDonut'
import MonthlyChart from '../components/safety/MonthlyChart'
import GuildfordComparison from '../components/safety/GuildfordComparison'
import AreaRankings from '../components/safety/AreaRankings'
import TrainStations from '../components/safety/TrainStations'
import StudentSafety from '../components/safety/StudentSafety'
import HolidayAlert from '../components/safety/HolidayAlert'
import SafetyTips from '../components/safety/SafetyTips'


// ── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
    return (
        <div className="space-y-6 animate-pulse">
            <div className="h-44 bg-slate-100 rounded-2xl" />
            <div className="h-64 bg-slate-100 rounded-2xl" />
            <div className="h-48 bg-slate-100 rounded-2xl" />
            <div className="h-32 bg-slate-100 rounded-2xl" />
        </div>
    )
}


// ── Main component ───────────────────────────────────────────────────────────

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
            // Geocode postcode directly via Postcodes.io (always works for valid postcodes).
            // Old approach used property search (radius=250m) which returns 0 results
            // for many postcodes, hiding TrainStations entirely. (B6 lesson)
            fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(decodedPostcode)}`)
                .then(r => r.json())
                .then(d => {
                    if (d.status === 200 && d.result) {
                        return { lat: d.result.latitude, lng: d.result.longitude }
                    }
                    return null
                })
                .catch(() => null),
        ]).then(([intelData, rankData, scoreData, coordData]) => {
            setIntel(intelData)
            setRankings(rankData)
            setSafetyScore(scoreData?.score ?? null)
            setCoords(coordData)

            if (!intelData) setError('No safety data available for this area.')
        }).finally(() => setLoading(false))
    }, [decodedPostcode])

    // ── Derived values ───────────────────────────────────────────────
    const sector = intel?.postcode_sector || ''
    const diff = intel?.compared_to_average?.difference_percent ?? 0
    let overallStars = 3
    if (diff <= -60) overallStars = 5
    else if (diff <= -30) overallStars = 4
    else if (diff <= 10) overallStars = 3
    else if (diff <= 50) overallStars = 2
    else overallStars = 1

    // ── Render ───────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-[#f8f9fc]">
            <Navbar />

            <div className="max-w-3xl mx-auto px-4 pt-4 pb-20">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 transition-colors mb-4 group"
                >
                    <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                    Back to property
                </button>

                {loading ? (
                    <PageSkeleton />
                ) : error ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-8 text-center">
                        <AlertCircle size={48} className="text-slate-300 mx-auto mb-4" />
                        <h2 className="text-lg font-bold text-slate-700 mb-2">No Data Available</h2>
                        <p className="text-sm text-slate-500">{error}</p>
                        <button onClick={() => navigate(-1)} className="mt-4 text-sm text-indigo-600 font-medium hover:text-indigo-700">
                            ← Go back
                        </button>
                    </div>
                ) : (
                    <div className="space-y-5">
                        {/* 1. Hero */}
                        <SafetyHero
                            sector={sector}
                            decodedPostcode={decodedPostcode}
                            safetyScore={safetyScore}
                            overallStars={overallStars}
                            sectorTotal={intel?.compared_to_average?.sector_total}
                        />

                        {/* 2. Crime Breakdown */}
                        {intel?.crime_breakdown?.length > 0 && (
                            <Section icon={Shield} title="What type of crime happens here?" subtitle="Breakdown of all reported crimes in the last 12 months">
                                <CrimeDonut breakdown={intel.crime_breakdown} />
                            </Section>
                        )}

                        {/* 3. Monthly Trend */}
                        {intel?.crime_trend && (
                            <Section icon={TrendingUp} title="Crime trend over time" subtitle="Monthly crime count — is it getting better or worse?">
                                <MonthlyChart data={intel.crime_trend.monthly_data} trend={intel.crime_trend} />
                            </Section>
                        )}

                        {/* 4. Guildford Comparison */}
                        <Section icon={MapPin} title="How does this compare to the rest of Guildford?" subtitle="This area vs the Guildford average">
                            <GuildfordComparison comparison={intel?.compared_to_average} />
                        </Section>

                        {/* 5. Area Rankings */}
                        <Section icon={Award} title="Area rankings in Guildford" subtitle="Top 5 safest areas and top 5 crime hotspots">
                            <AreaRankings rankings={rankings} currentSector={sector} />
                        </Section>

                        {/* 6. Train Stations */}
                        {coords && (
                            <Section icon={Train} title="Nearest train stations" subtitle="Walking distance from this area">
                                <TrainStations lat={coords.lat} lng={coords.lng} />
                            </Section>
                        )}

                        {/* 7. Student Safety */}
                        <Section icon={GraduationCap} title="Is this area good for students?" subtitle="Safety analysis focused on student-relevant crime">
                            <StudentSafety data={intel?.student_vulnerability} />
                        </Section>

                        {/* 8. Holiday Risk */}
                        {intel?.holiday_burglary_risk && intel.holiday_burglary_risk.risk_level !== 'low' && (
                            <Section icon={Home} title="Holiday break-in risk" subtitle="What happens when students go home for holidays?">
                                <HolidayAlert risk={intel.holiday_burglary_risk} />
                            </Section>
                        )}

                        {/* 9. Safety Tips */}
                        {intel?.safety_tips?.length > 0 && (
                            <Section icon={Lightbulb} title="What we know about this area" subtitle="Data-driven tips based on actual crime patterns">
                                <SafetyTips tips={intel.safety_tips} />
                            </Section>
                        )}

                        {/* Data source */}
                        <div className="text-center text-xs text-slate-400 pt-4 pb-8">
                            <p>Data source: <span className="font-medium">police.uk</span> • Updated monthly • Covers postcode sector <span className="font-medium">{sector}</span></p>
                            <p className="mt-1">Crime data reflects the whole postcode sector, not an individual street or building.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
