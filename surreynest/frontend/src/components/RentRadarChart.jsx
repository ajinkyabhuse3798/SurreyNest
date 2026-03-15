/**
 * RentRadarChart — Interactive rent trend chart with historical data + forecast.
 *
 * Shows a Recharts AreaChart with:
 *   - Solid gradient fill for historical data (2021–2025)
 *   - Dashed line for 2-year forecast using IPHRP growth
 *   - Tooltips, trend badge, and source attribution
 *
 * Props:
 *   @param {string} postcodeSector — e.g. "GU2 7"
 */
import { useState, useEffect } from 'react'
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react'
import api from '../services/api'

// ── Custom tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }) {
    if (!active || !payload || !payload.length) return null

    const data = payload[0]?.payload
    if (!data) return null

    const isForecast = data.type === 'forecast'

    return (
        <div className="bg-white/95 backdrop-blur-md border border-gray-200 rounded-xl px-4 py-3 shadow-lg">
            <p className="text-xs font-semibold text-gray-900 mb-1">
                {label}
                {isForecast && (
                    <span className="text-primary/80 ml-1.5 font-normal">(forecast)</span>
                )}
            </p>
            <p className="text-lg font-bold text-primary">
                £{Math.round(data.rent)}/wk
            </p>
            {data.transactions && (
                <p className="text-[10px] text-gray-400 mt-0.5">
                    {data.transactions} transactions
                </p>
            )}
        </div>
    )
}

// ── Trend badge ─────────────────────────────────────────────────────────────

function TrendBadge({ changePct }) {
    if (changePct === null || changePct === undefined) return null

    const isUp = changePct > 0
    const isFlat = Math.abs(changePct) < 1
    const Icon = isFlat ? Minus : isUp ? TrendingUp : TrendingDown
    const colour = isFlat
        ? 'bg-gray-100 text-gray-600'
        : isUp
            ? 'bg-red-50 text-red-700'
            : 'bg-green-50 text-green-700'

    return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${colour}`}>
            <Icon size={12} />
            {isUp ? '+' : ''}{changePct}% since 2021
        </span>
    )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function RentRadarChart({ postcodeSector }) {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (!postcodeSector) return

        let cancelled = false
        setLoading(true)
        setError(null)

        api.get(`/api/rent-trends/${encodeURIComponent(postcodeSector)}`)
            .then((res) => {
                if (!cancelled) setData(res.data)
            })
            .catch((err) => {
                if (!cancelled) {
                    // Silently fail — not all sectors have data
                    if (err.response?.status === 404) {
                        setData(null)
                    } else {
                        setError(err.message)
                    }
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })

        return () => { cancelled = true }
    }, [postcodeSector])

    // Don't render if no data or loading
    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="animate-spin text-primary-400" />
                <span className="text-sm text-gray-400 ml-2">Loading rent trends...</span>
            </div>
        )
    }

    if (error || !data || (!data.historical?.length)) return null

    // Build unified chart data with separate keys for historical/forecast
    // The overlap point (last historical year) has BOTH keys so lines connect
    const lastHistoricalYear = data.historical[data.historical.length - 1]?.year
    const lastHistoricalRent = data.historical[data.historical.length - 1]?.median_weekly_rent

    const chartData = [
        ...data.historical.map((h) => ({
            year: h.year,
            historicalRent: h.median_weekly_rent,
            forecastRent: h.year === lastHistoricalYear ? h.median_weekly_rent : undefined,
            rent: h.median_weekly_rent,
            transactions: h.transaction_count,
            type: 'historical',
        })),
        ...data.forecast.map((f) => ({
            year: f.year,
            forecastRent: f.median_weekly_rent,
            rent: f.median_weekly_rent,
            type: 'forecast',
        })),
    ]

    const allRents = chartData.map((d) => d.rent)
    const minRent = Math.floor(Math.min(...allRents) / 20) * 20 - 20
    const maxRent = Math.ceil(Math.max(...allRents) / 20) * 20 + 20

    return (
        <div>
            {/* Header row */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                <div>
                    <p className="text-sm text-gray-500">
                        How rents are moving in <span className="font-semibold text-gray-700">{postcodeSector}</span>
                    </p>
                </div>
                <TrendBadge changePct={data.total_change_pct} />
            </div>

            {/* Chart */}
            <div className="bg-white rounded-xl border border-gray-100 p-3 sm:p-5">
                <ResponsiveContainer width="100%" height={240}>
                    <AreaChart
                        data={chartData}
                        margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
                    >
                        <defs>
                            <linearGradient id="rentGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366F1" stopOpacity={0.15} />
                                <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366F1" stopOpacity={0.06} />
                                <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                            </linearGradient>
                        </defs>

                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />

                        <XAxis
                            dataKey="year"
                            tick={{ fontSize: 12, fill: '#9CA3AF' }}
                            tickLine={false}
                            axisLine={{ stroke: '#E5E7EB' }}
                        />
                        <YAxis
                            domain={[minRent, maxRent]}
                            tick={{ fontSize: 11, fill: '#9CA3AF' }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v) => `£${v}`}
                            width={50}
                        />

                        <Tooltip content={<CustomTooltip />} />

                        {/* Historical area */}
                        <Area
                            type="monotone"
                            dataKey="historicalRent"
                            stroke="#6366F1"
                            strokeWidth={2.5}
                            fill="url(#rentGradient)"
                            dot={{ r: 4, fill: '#6366F1', stroke: 'white', strokeWidth: 2 }}
                            activeDot={{ r: 6, fill: '#6366F1', stroke: 'white', strokeWidth: 2 }}
                            connectNulls={false}
                        />

                        {/* Forecast area (dashed) */}
                        <Area
                            type="monotone"
                            dataKey="forecastRent"
                            stroke="#818CF8"
                            strokeWidth={2}
                            strokeDasharray="6 4"
                            fill="url(#forecastGradient)"
                            dot={{ r: 3, fill: 'white', stroke: '#818CF8', strokeWidth: 2 }}
                            activeDot={{ r: 5, fill: '#818CF8', stroke: 'white', strokeWidth: 2 }}
                            connectNulls={false}
                        />

                        {/* Divider line between historical and forecast */}
                        {lastHistoricalYear && (
                            <ReferenceLine
                                x={lastHistoricalYear}
                                stroke="#D1D5DB"
                                strokeDasharray="4 4"
                                strokeWidth={1}
                            />
                        )}
                    </AreaChart>
                </ResponsiveContainer>

                {/* Legend */}
                <div className="flex items-center justify-center gap-4 mt-3 text-[10px] sm:text-xs text-gray-400">
                    <span className="flex items-center gap-1.5">
                        <span className="w-5 h-0.5 bg-primary/100 rounded" />
                        Historical
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-5 h-0.5 bg-primary-300 rounded" style={{
                            backgroundImage: 'repeating-linear-gradient(90deg, #818CF8 0, #818CF8 4px, transparent 4px, transparent 8px)',
                        }} />
                        Forecast (IPHRP {data.iphrp_growth_pct}%)
                    </span>
                </div>
            </div>

            {/* Source */}
            <p className="text-[10px] sm:text-xs text-gray-400 mt-2 text-center">
                Based on {data.total_transactions.toLocaleString()} Land Registry transactions · Forecast uses ONS IPHRP South East
            </p>
        </div>
    )
}
