/**
 * AgentDirectory page — browse all letting agents with scores.
 * Route: /agent
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { listAgents } from '../services/agentApi'
import { Building2, ShieldCheck, ChevronRight, Lock } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

function AgentCard({ agent, isPro }) {
    const score = agent.stats.agent_score
    const scoreColour =
        score >= 75 ? 'text-emerald-600' :
        score >= 50 ? 'text-amber-600' :
        'text-rose-600'

    return (
        <Link
            to={`/agent/${agent.name}`}
            className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md hover:border-primary/20 transition-all flex items-center gap-4"
        >
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Building2 size={22} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="font-extrabold text-slate-900 truncate">{agent.display_name}</h3>
                    {agent.is_verified && (
                        <ShieldCheck size={14} className="text-primary/80 flex-shrink-0" />
                    )}
                </div>
                <p className="text-xs text-slate-500">
                    {agent.stats.review_count} review{agent.stats.review_count !== 1 ? 's' : ''}
                    {agent.postcode_sectors?.length > 0 && ` · ${agent.postcode_sectors.slice(0, 2).join(', ')}`}
                </p>
            </div>
            <div className="text-right flex-shrink-0">
                {isPro ? (
                    <>
                        <p className={`text-2xl font-extrabold ${scoreColour}`}>{score}</p>
                        <p className="text-xs text-slate-400">/ 100</p>
                    </>
                ) : (
                    <div className="flex flex-col items-center gap-1">
                        <div className="w-10 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
                            <Lock size={13} className="text-slate-400" />
                        </div>
                        <p className="text-xs text-slate-400">Pro</p>
                    </div>
                )}
            </div>
            <ChevronRight size={18} className="text-slate-300 flex-shrink-0" />
        </Link>
    )
}

export default function AgentDirectory() {
    const { user } = useAuth()
    const isPro = user?.is_pro ?? false
    const [agents, setAgents] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        listAgents({ limit: 50 })
            .then(setAgents)
            .catch(() => setError('Failed to load agents.'))
            .finally(() => setLoading(false))
    }, [])

    return (
        <main className="min-h-screen bg-[#f8f9fc]">
            <Navbar />
            <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Agent Tracker</h1>
                    <p className="text-slate-500 text-sm">
                        Real tenant reviews of Guildford letting agents. Reputation built from verified reviews.
                    </p>
                </div>

                {loading && (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-sm text-red-700">{error}</div>
                )}

                {!loading && !error && agents.length === 0 && (
                    <div className="text-center py-16">
                        <Building2 size={40} className="mx-auto text-slate-300 mb-4" />
                        <p className="text-slate-500 font-medium">No agents yet.</p>
                        <p className="text-slate-400 text-sm mt-1">
                            Agent profiles appear when tenants mention an agent in their review.
                        </p>
                    </div>
                )}

                {!isPro && agents.length > 0 && (
                    <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                        <Lock size={15} className="text-amber-600 flex-shrink-0" />
                        <p className="text-sm text-amber-800">
                            Reputation scores are visible on <Link to="/pricing" className="font-bold underline underline-offset-2">Pro</Link>.
                        </p>
                    </div>
                )}
                <div className="space-y-3">
                    {agents.map(agent => (
                        <AgentCard key={agent.name} agent={agent} isPro={isPro} />
                    ))}
                </div>
            </div>
        </main>
    )
}
