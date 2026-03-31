/**
 * Home, Landing page orchestrator (Stitch-aligned).
 * Composes all home sub-components and manages search state.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import MarketPulse from '../components/MarketPulse'

import HeroSection from '../components/home/HeroSection'
import TrustBar from '../components/home/TrustBar'
import ExploreSection from '../components/home/ExploreSection'
import FeaturesSection from '../components/home/FeaturesSection'
import HowItWorks from '../components/home/HowItWorks'
import GuildfordSafetySection from '../components/home/GuildfordSafetySection'
import CtaSection from '../components/home/CtaSection'

// Accepts full postcodes (GU2 7XH) and area/district codes (GU2, GU1 1)
const POSTCODE_RE = /^[A-Za-z]{1,2}\d[A-Za-z\d]?(\s*\d[A-Za-z]{2})?$/

export default function Home() {
    const navigate = useNavigate()
    const [postcode, setPostcode] = useState('')
    const [radius, setRadius] = useState(1000)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    function handleSearch(directPostcode) {
        const pc = (directPostcode || postcode).trim()
        if (!pc) { setError('Please enter a postcode'); return }
        if (!POSTCODE_RE.test(pc)) { setError('Enter a valid UK postcode (e.g. GU2 7XH)'); return }
        setError('')
        setLoading(true)
        navigate(`/search?postcode=${encodeURIComponent(pc)}&radius=${radius}`)
    }

    return (
        <main className="min-h-screen bg-background-light">
            <Navbar />

            {/* Hero */}
            <HeroSection
                postcode={postcode}
                setPostcode={setPostcode}
                radius={radius}
                setRadius={setRadius}
                error={error}
                loading={loading}
                handleSearch={handleSearch}
            />

            {/* Trust badges */}
            <TrustBar />

            {/* Features, "Everything you need" */}
            <FeaturesSection />

            {/* Explore Guildford safety */}
            <ExploreSection />

            {/* Market timing */}
            <div className="px-4 py-6 lg:py-10 max-w-lg lg:max-w-3xl mx-auto">
                <MarketPulse />
            </div>

            {/* How It Works */}
            <HowItWorks />

            {/* Guildford Safety teaser */}
            <GuildfordSafetySection />

            {/* CTA */}
            <CtaSection />
        </main>
    )
}
