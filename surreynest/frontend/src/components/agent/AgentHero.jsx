/**
 * AgentHero — gradient hero section for an agent's profile page.
 * Shows display name, verified badge, sector pills, and composite score.
 *
 * @param {{ agent: import('../../services/agentApi').AgentDetail }} props
 */
import { ShieldCheck } from 'lucide-react'

export default function AgentHero({ agent }) {
    const score = agent.stats.agent_score
    const scoreColour =
        score >= 75 ? 'text-emerald-300' :
        score >= 50 ? 'text-amber-300' :
        'text-rose-300'

    return (
        <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-6 md:p-8 text-white shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                            {agent.display_name}
                        </h1>
                        {agent.is_verified && (
                            <span className="flex items-center gap-1 bg-indigo-500/50 text-white text-xs font-semibold px-3 py-1 rounded-full border border-indigo-400/50">
                                <ShieldCheck size={12} />
                                Verified
                            </span>
                        )}
                    </div>
                    <p className="text-indigo-200 text-sm">
                        {agent.stats.review_count} review{agent.stats.review_count !== 1 ? 's' : ''}
                    </p>

                    {agent.postcode_sectors?.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                            {agent.postcode_sectors.map(sector => (
                                <span
                                    key={sector}
                                    className="bg-white/10 text-white text-xs px-3 py-1 rounded-full border border-white/20"
                                >
                                    {sector}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Composite score */}
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 text-center border border-white/20 min-w-[120px]">
                    <p className="text-xs font-semibold text-indigo-200 uppercase tracking-widest mb-1">
                        Agent Score
                    </p>
                    <p className={`text-4xl font-extrabold ${scoreColour}`}>
                        {score}
                    </p>
                    <p className="text-xs text-indigo-200 mt-1">out of 100</p>
                </div>
            </div>
        </div>
    )
}
