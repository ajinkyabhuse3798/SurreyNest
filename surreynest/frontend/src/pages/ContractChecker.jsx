/**
 * ContractChecker page — AI tenancy agreement analysis.
 * Route: /check-contract
 */
import { useState } from 'react'
import Navbar from '../components/Navbar'
import ContractInput from '../components/contract/ContractInput'
import OverallRiskBadge from '../components/contract/OverallRiskBadge'
import ClauseCard from '../components/contract/ClauseCard'
import ContractSummary from '../components/contract/ContractSummary'
import { checkContract } from '../services/contractApi'
import { FileSearch } from 'lucide-react'

export default function ContractChecker() {
    const [contractText, setContractText] = useState('')
    const [result, setResult] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    async function handleAnalyse() {
        if (contractText.trim().length < 100) {
            setError('Please enter at least 100 characters of contract text.')
            return
        }
        setLoading(true)
        setError(null)
        setResult(null)
        try {
            const data = await checkContract(contractText)
            setResult(data)
        } catch (err) {
            if (err.response?.status === 429) {
                setError('You have used your 5 free checks this hour. Please try again later.')
            } else if (err.response?.status === 503) {
                setError(err.response?.data?.detail || 'AI service unavailable. Please try again shortly.')
            } else {
                setError('Analysis failed. Please try again.')
            }
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
                    <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                        <FileSearch size={20} className="text-violet-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-extrabold text-slate-900">Contract Checker</h1>
                        <p className="text-sm text-slate-500">
                            AI analysis for UK tenancy agreements — spots illegal and unfair clauses
                        </p>
                    </div>
                </div>

                <ContractInput text={contractText} onChange={setContractText} />

                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-sm text-red-700">
                        {error}
                    </div>
                )}

                <button
                    onClick={handleAnalyse}
                    disabled={loading || contractText.trim().length < 100}
                    className="w-full bg-violet-600 text-white rounded-xl px-6 py-3.5 text-sm font-semibold hover:bg-violet-700 transition-colors disabled:opacity-50"
                >
                    {loading ? 'Analysing your contract... this takes ~15 seconds' : 'Analyse Contract'}
                </button>

                {result && (
                    <div className="space-y-5">
                        <OverallRiskBadge result={result} />
                        <ContractSummary clauses={result.clauses} />

                        <div className="space-y-3">
                            <h3 className="text-base font-extrabold text-slate-900">Clause Analysis</h3>
                            {result.clauses.map((clause, i) => (
                                <ClauseCard key={i} clause={clause} />
                            ))}
                        </div>
                    </div>
                )}

                {/* Disclaimer */}
                <p className="text-xs text-slate-400 text-center border-t border-slate-100 pt-4">
                    This is <strong>not legal advice</strong>. For specific legal issues,
                    contact a solicitor or{' '}
                    <a href="https://www.citizensadvice.org.uk" target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline">
                        Citizens Advice
                    </a>.
                </p>
            </div>
        </main>
    )
}
