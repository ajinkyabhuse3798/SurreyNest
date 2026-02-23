/**
 * Home page — hero section with search + feature cards + how-it-works.
 * Per design-system.md: bg-gray-50 hero, floating white search card, no house photo.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'

export default function Home() {
    const navigate = useNavigate()
    const [postcode, setPostcode] = useState('')
    const [radius, setRadius] = useState(1000)

    function handleSearch(e) {
        e.preventDefault()
        if (!postcode.trim()) return
        navigate(`/search?postcode=${encodeURIComponent(postcode.trim())}&radius=${radius}`)
    }

    return (
        <main className="min-h-screen bg-white">
            <Navbar />

            {/* Hero — bg-gray-50 ONLY here */}
            <section className="bg-gray-50 px-4 py-12 md:py-20">
                <div className="max-w-2xl mx-auto">
                    <h1 className="text-2xl font-semibold text-[#0A0A0A] mb-2 md:text-4xl md:text-center">
                        Find fair rent in Guildford
                    </h1>
                    <p className="text-sm text-gray-500 mb-8 md:text-base md:text-center">
                        Check if your rent is fair, verify HMO licensing and see safety
                        scores — all free.
                    </p>

                    {/* Floating search card */}
                    <form
                        onSubmit={handleSearch}
                        className="bg-white rounded-2xl border border-gray-200 p-5 md:p-6"
                    >
                        <div className="flex flex-col gap-3 md:flex-row">
                            <input
                                type="text"
                                value={postcode}
                                onChange={(e) => setPostcode(e.target.value)}
                                placeholder="Enter a Guildford postcode e.g. GU2 7XH"
                                className="flex-1 border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-indigo-600 transition-colors"
                            />
                            <select
                                value={radius}
                                onChange={(e) => setRadius(Number(e.target.value))}
                                className="border border-gray-200 rounded-lg px-3 py-3 text-sm text-gray-600 focus:outline-none focus:border-indigo-600 md:w-36"
                            >
                                <option value={250}>Within 250m</option>
                                <option value={500}>Within 0.5km</option>
                                <option value={1000}>Within 1km</option>
                                <option value={2000}>Within 2km</option>
                            </select>
                            <button
                                type="submit"
                                className="bg-indigo-600 text-white rounded-lg px-6 py-3 text-sm font-medium hover:bg-indigo-700 transition-colors"
                            >
                                Search
                            </button>
                        </div>
                    </form>

                    {/* Trust strip */}
                    <p className="text-xs text-gray-400 mt-4 text-center">
                        12,000+ Guildford properties · Updated monthly · Completely free
                    </p>
                </div>
            </section>

            {/* Feature cards */}
            <section className="max-w-2xl mx-auto px-4 py-8 md:py-12">
                <div className="grid gap-4 md:grid-cols-3">
                    <div className="border border-gray-200 rounded-xl p-4">
                        <h3 className="text-base font-semibold text-[#0A0A0A] mb-1">
                            Rent Fairness
                        </h3>
                        <p className="text-sm text-gray-500 leading-relaxed">
                            See how your rent compares to similar properties using our ML
                            model trained on Guildford data.
                        </p>
                    </div>
                    <div className="border border-gray-200 rounded-xl p-4">
                        <h3 className="text-base font-semibold text-[#0A0A0A] mb-1">
                            Safety Scores
                        </h3>
                        <p className="text-sm text-gray-500 leading-relaxed">
                            Crime-weighted safety scores for every postcode sector, updated
                            monthly from police.uk data.
                        </p>
                    </div>
                    <div className="border border-gray-200 rounded-xl p-4">
                        <h3 className="text-base font-semibold text-[#0A0A0A] mb-1">
                            HMO Check
                        </h3>
                        <p className="text-sm text-gray-500 leading-relaxed">
                            Instantly check if a property has a valid HMO licence from
                            Guildford Borough Council.
                        </p>
                    </div>
                </div>
            </section>

            {/* How it works */}
            <section className="max-w-2xl mx-auto px-4 pb-12 md:pb-16">
                <div className="border-t border-gray-100 pt-8">
                    <h2 className="text-xl font-semibold text-[#0A0A0A] mb-6 md:text-2xl md:text-center">
                        How it works
                    </h2>
                    <div className="grid gap-6 md:grid-cols-3 text-center">
                        <div>
                            <p className="text-2xl mb-2">1</p>
                            <p className="text-sm font-medium text-[#0A0A0A]">
                                Search a postcode
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                                Enter any Guildford postcode to find nearby properties.
                            </p>
                        </div>
                        <div>
                            <p className="text-2xl mb-2">2</p>
                            <p className="text-sm font-medium text-[#0A0A0A]">
                                Compare scores
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                                See rent fairness, safety and HMO status for each property.
                            </p>
                        </div>
                        <div>
                            <p className="text-2xl mb-2">3</p>
                            <p className="text-sm font-medium text-[#0A0A0A]">
                                Know your rights
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                                Read our tenant rights guide and leave reviews for others.
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    )
}
