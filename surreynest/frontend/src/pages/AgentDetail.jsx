/**
 * AgentDetail page, full agent profile with reviews.
 * Route: /agent/:agentName
 */
import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import AgentHero from '../components/agent/AgentHero'
import AgentScoreCards from '../components/agent/AgentScoreCards'
import AgentReviewCard from '../components/agent/AgentReviewCard'
import { getAgent } from '../services/agentApi'
import { ArrowLeft, ExternalLink } from 'lucide-react'

export default function AgentDetail() {
    const { agentName } = useParams()
    const [agent, setAgent] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        setLoading(true)
        setError(null)
        getAgent(agentName)
            .then(setAgent)
            .catch(err => {
                if (err.status === 404) {
                    setError('Agent not found.')
                } else {
                    setError('Failed to load agent profile.')
                }
            })
            .finally(() => setLoading(false))
    }, [agentName])

    return (
        <main className="min-h-screen bg-[#f8f9fc]">
            <Navbar />
            <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
                <Link
                    to="/agent"
                    className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
                >
                    <ArrowLeft size={16} />
                    Agent Directory
                </Link>

                {loading && (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {agent && (
                    <>
                        <AgentHero agent={agent} />

                        {agent.website && (
                            <a
                                href={agent.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/90"
                            >
                                <ExternalLink size={14} />
                                Visit website
                            </a>
                        )}

                        <AgentScoreCards stats={agent.stats} />

                        <div className="space-y-3">
                            <h2 className="text-lg font-extrabold text-slate-900">
                                Recent Reviews
                            </h2>
                            {agent.recent_reviews.length === 0 ? (
                                <p className="text-sm text-slate-400">No reviews yet.</p>
                            ) : (
                                agent.recent_reviews.map(review => (
                                    <AgentReviewCard key={review.id} review={review} />
                                ))
                            )}
                        </div>
                    </>
                )}
            </div>
        </main>
    )
}
