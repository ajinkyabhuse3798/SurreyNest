/**
 * SafetyScorePanel, crime breakdown for a postcode.
 * Fetches from GET /api/scores/safety?postcode=...
 *
 * @param {{ postcode: string }} props
 */
import { useState, useEffect } from 'react'
import ScoreBadge from './ScoreBadge'
import api from '../services/api'

export default function SafetyScorePanel({ postcode }) {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (!postcode) return
        setLoading(true)
        setError(null)
        api
            .get('/api/scores/safety', { params: { postcode } })
            .then((res) => setData(res.data))
            .catch(() => setError('Safety score unavailable for this area.'))
            .finally(() => setLoading(false))
    }, [postcode])

    if (loading) {
        return <p className="text-xs text-gray-400">Calculating safety score...</p>
    }

    if (error) {
        return (
            <div className="border border-red-200 bg-red-50 rounded-lg px-4 py-3 text-sm text-red-700">
                {error}
            </div>
        )
    }

    if (!data) return null

    return (
        <div className="space-y-4">
            {/* Overall score */}
            <div className="flex items-center gap-3">
                <ScoreBadge score={data.safety_score} label="" />
                <span className="text-sm font-medium text-[#0A0A0A]">
                    {data.label}
                </span>
            </div>

            <p className="text-xs text-gray-500">
                Based on {data.total_incidents} incidents in the {data.postcode_sector}{' '}
                area over the last 12 months.
            </p>

            {/* Crime breakdown */}
            {data.breakdown && data.breakdown.length > 0 && (
                <div className="space-y-2">
                    <h4 className="text-xs font-medium text-gray-700">
                        Crime breakdown
                    </h4>
                    {data.breakdown.map((item) => (
                        <div key={item.category} className="flex items-center justify-between">
                            <span className="text-xs text-gray-600 capitalize">
                                {item.category.replace(/-/g, ' ')}
                            </span>
                            <span className="text-xs text-gray-500">{item.count}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
