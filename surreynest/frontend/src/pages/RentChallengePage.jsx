/**
 * RentChallengePage — Section 13 rent increase challenge tool.
 * Route: /challenge-rent-increase
 */
import { useState, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import Navbar from '../components/Navbar'
import ChallengeForm from '../components/rent_challenge/ChallengeForm'
import VerdictCard from '../components/rent_challenge/VerdictCard'
import ComparablesTable from '../components/rent_challenge/ComparablesTable'
import TribunalBrief from '../components/rent_challenge/TribunalBrief'
import { analyseRentIncrease } from '../services/rentChallengeApi'
import { Scale } from 'lucide-react'

export default function RentChallengePage() {
    const [searchParams] = useSearchParams()
    const initialPostcode = searchParams.get('postcode') || ''
    const initialUprn = searchParams.get('uprn') || ''

    const [result, setResult] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const resultsRef = useRef(null)

    async function handleSubmit(data) {
        setLoading(true)
        setError(null)
        setResult(null)
        try {
            const res = await analyseRentIncrease(data)
            setResult(res)
            setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
        } catch (err) {
            const detail = err.response?.data?.detail || err.message || 'Analysis failed. Please try again.'
            setError(detail)
        } finally {
            setLoading(false)
        }
    }

    return (
        <main className="min-h-screen bg-[#f8f9fc]">
            <Navbar />
            <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                        <Scale size={20} className="text-indigo-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-extrabold text-slate-900">Challenge a Rent Increase</h1>
                        <p className="text-sm text-slate-500">
                            Section 13 analysis — Renters' Rights Act 2025
                        </p>
                    </div>
                </div>

                <ChallengeForm
                    onSubmit={handleSubmit}
                    loading={loading}
                    initialPostcode={initialPostcode}
                    initialUprn={initialUprn}
                />

                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {result && (
                    <div ref={resultsRef} className="space-y-5">
                        <VerdictCard result={result} />

                        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                            <ComparablesTable comparables={result.comparables} />
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                            <TribunalBrief brief={result.tribunal_brief} />
                        </div>
                    </div>
                )}

                {/* Disclaimer */}
                <p className="text-xs text-slate-400 text-center border-t border-slate-100 pt-4">
                    This analysis is based on ML predictions and public Land Registry data.
                    It is <strong>not legal advice</strong>. For legal guidance, contact{' '}
                    <a href="https://www.citizensadvice.org.uk" target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline">
                        Citizens Advice
                    </a>{' '}
                    or{' '}
                    <a href="https://england.shelter.org.uk" target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline">
                        Shelter
                    </a>.
                </p>
            </div>
        </main>
    )
}
