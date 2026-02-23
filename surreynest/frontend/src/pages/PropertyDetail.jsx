/**
 * PropertyDetail page — 4 tabs: Overview | Reviews | Safety | Rights.
 * Per design-system.md: tab bar, score row header, max-w-2xl layout.
 */
import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import ScoreBadge from '../components/ScoreBadge'
import HMOBadge from '../components/HMOBadge'
import ReviewList from '../components/ReviewList'
import ReviewForm from '../components/ReviewForm'
import SafetyScorePanel from '../components/SafetyScorePanel'
import api from '../services/api'

const TABS = ['Overview', 'Reviews', 'Safety', 'Rights']

export default function PropertyDetail() {
    const { uprn } = useParams()
    const [property, setProperty] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [activeTab, setActiveTab] = useState('Overview')

    useEffect(() => {
        setLoading(true)
        setError(null)
        api
            .get(`/api/properties/${uprn}`)
            .then((res) => setProperty(res.data))
            .catch(() => setError('Property not found.'))
            .finally(() => setLoading(false))
    }, [uprn])

    if (loading) {
        return (
            <main className="min-h-screen bg-white">
                <Navbar />
                <div className="px-4 py-12 text-center text-sm text-gray-400">
                    Loading property...
                </div>
            </main>
        )
    }

    if (error || !property) {
        return (
            <main className="min-h-screen bg-white">
                <Navbar />
                <div className="max-w-2xl mx-auto px-4 py-12">
                    <div className="border border-red-200 bg-red-50 rounded-lg px-4 py-3 text-sm text-red-700">
                        {error || 'Property not found.'}
                    </div>
                    <Link
                        to="/search"
                        className="text-sm text-indigo-600 font-medium mt-4 inline-block"
                    >
                        ← Back to search
                    </Link>
                </div>
            </main>
        )
    }

    return (
        <main className="min-h-screen bg-white">
            <Navbar />

            <div className="max-w-2xl mx-auto px-4 py-8 md:py-12">
                {/* Back link */}
                <Link
                    to="/search"
                    className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
                >
                    ← Back to results
                </Link>

                {/* Header */}
                <h1 className="text-2xl font-semibold text-[#0A0A0A] mt-4 md:text-4xl">
                    {property.address}
                </h1>
                <p className="text-sm text-gray-500 mt-1">{property.postcode}</p>

                {/* Score row */}
                <div className="flex flex-wrap gap-3 mt-4">
                    <ScoreBadge
                        score={property.rent_prediction?.fairness_score}
                        label="Fair Rent"
                    />
                    <ScoreBadge
                        score={property.safety_score}
                        label="Safety"
                    />
                    <HMOBadge status={property.hmo?.status || 'not_found'} />
                </div>

                {/* Tab bar */}
                <div className="flex gap-0 border-b border-gray-200 mt-6 overflow-x-auto">
                    {TABS.map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === tab
                                ? 'border-indigo-600 text-indigo-600'
                                : 'border-transparent text-gray-500 hover:text-gray-900'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Tab content */}
                <div className="mt-6">
                    {activeTab === 'Overview' && (
                        <OverviewTab property={property} />
                    )}
                    {activeTab === 'Reviews' && (
                        <div className="space-y-6">
                            <ReviewList uprn={uprn} />
                            <div className="border-t border-gray-100 pt-6">
                                <ReviewForm uprn={uprn} />
                            </div>
                        </div>
                    )}
                    {activeTab === 'Safety' && (
                        <SafetyScorePanel postcode={property.postcode} />
                    )}
                    {activeTab === 'Rights' && <RightsTab />}
                </div>
            </div>
        </main>
    )
}

/** Overview tab — property details */
function OverviewTab({ property }) {
    const details = [
        { label: 'Property type', value: property.property_type },
        { label: 'Rooms', value: property.num_rooms },
        { label: 'Floor area', value: property.floor_area_m2 ? `${property.floor_area_m2} m²` : null },
        { label: 'EPC rating', value: property.energy_rating },
        { label: 'Potential rating', value: property.potential_rating },
        { label: 'Tenure', value: property.tenure },
        { label: 'Built form', value: property.built_form },
    ].filter((d) => d.value)

    return (
        <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
                {details.map((d) => (
                    <div key={d.label} className="flex justify-between border-b border-gray-100 pb-2">
                        <span className="text-xs text-gray-500">{d.label}</span>
                        <span className="text-sm text-[#0A0A0A] font-medium">{d.value}</span>
                    </div>
                ))}
            </div>

            {/* Rent prediction */}
            {property.rent_prediction && (
                <div className="border border-gray-200 rounded-xl p-4 mt-4">
                    <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">
                        Predicted weekly rent
                    </h3>
                    <p className="text-2xl font-semibold text-indigo-600">
                        £{property.rent_prediction.predicted_weekly_rent?.toFixed(0)}
                        <span className="text-sm text-gray-500 font-normal"> /week</span>
                    </p>
                    {property.rent_prediction.confidence_low &&
                        property.rent_prediction.confidence_high && (
                            <p className="text-xs text-gray-500 mt-1">
                                80% confidence: £{property.rent_prediction.confidence_low?.toFixed(0)} –
                                £{property.rent_prediction.confidence_high?.toFixed(0)}/wk
                            </p>
                        )}
                </div>
            )}
        </div>
    )
}

/** Rights tab — inline tenant info */
function RightsTab() {
    return (
        <div className="space-y-4">
            <p className="text-sm text-gray-700 leading-relaxed">
                As a student renting in Guildford, you have specific legal protections.
                Here are the key areas to know about:
            </p>

            <div className="space-y-3">
                {[
                    {
                        title: 'Deposit protection',
                        text: "Your landlord must protect your deposit in a government-approved scheme within 30 days. If they don\u2019t, you can claim up to 3\u00d7 the deposit.",
                    },
                    {
                        title: 'Repairs',
                        text: "Your landlord must keep the property in good repair. If they refuse, contact Guildford Borough Council\u2019s housing team.",
                    },
                    {
                        title: 'HMO licensing',
                        text: 'A property with 3+ tenants from 2+ households needs an HMO licence. Check the HMO tab to verify.',
                    },
                    {
                        title: 'Eviction notice',
                        text: "Your landlord must give at least 2 months' notice (Section 21) or follow Section 8 grounds for eviction.",
                    },
                ].map((item) => (
                    <div key={item.title} className="border border-gray-200 rounded-xl p-4">
                        <h4 className="text-sm font-semibold text-[#0A0A0A]">{item.title}</h4>
                        <p className="text-sm text-gray-500 mt-1 leading-relaxed">{item.text}</p>
                    </div>
                ))}
            </div>

            <Link
                to="/rights"
                className="text-sm text-indigo-600 font-medium inline-block mt-2"
            >
                Read full Rights Guide →
            </Link>
        </div>
    )
}
