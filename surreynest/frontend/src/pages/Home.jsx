/**
 * Home v3 — Premium landing page orchestrator.
 *
 * All 8 visual sections are extracted into focused sub-components
 * under components/home/. This file retains only state and handleSearch.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import MarketPulse from '../components/MarketPulse'
import { AnimatedSection, fadeUp, POSTCODE_RE } from '../utils/homeData'
import { motion } from 'framer-motion'

// ── Sub-components ───────────────────────────────────────────────────────────
import HeroSection from '../components/home/HeroSection'
import TrustBar from '../components/home/TrustBar'
import ExploreSection from '../components/home/ExploreSection'
import FeaturesSection from '../components/home/FeaturesSection'
import HowItWorks from '../components/home/HowItWorks'
import StreetSmartsTeaser from '../components/home/StreetSmartsTeaser'
import CtaSection from '../components/home/CtaSection'


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
        <main className="min-h-screen bg-[#f8f9fc]">
            <Navbar />

            {/* 1. Hero */}
            <HeroSection
                postcode={postcode}
                setPostcode={setPostcode}
                radius={radius}
                setRadius={setRadius}
                error={error}
                loading={loading}
                handleSearch={handleSearch}
            />

            {/* 2. Trust */}
            <TrustBar />

            {/* 3. Explore Map */}
            <ExploreSection />

            {/* 4. Market Pulse */}
            <AnimatedSection className="px-4 py-6 lg:py-10 max-w-lg lg:max-w-3xl mx-auto">
                <motion.div variants={fadeUp}>
                    <MarketPulse />
                </motion.div>
            </AnimatedSection>

            {/* 5. Features */}
            <FeaturesSection />

            {/* 6. How It Works */}
            <HowItWorks />

            {/* 7. StreetSmarts */}
            <StreetSmartsTeaser />

            {/* 8. CTA */}
            <CtaSection />
        </main>
    )
}

