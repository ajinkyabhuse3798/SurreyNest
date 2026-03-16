/**
 * SignupChart — Recharts AreaChart for daily signup trends.
 */
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
} from 'recharts'
import { TrendingUp } from 'lucide-react'
import Section from '../../ui/Section'

const DAY_OPTIONS = [7, 30, 90]

function formatDate(d) {
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function SignupChart({ data = [], days, onDaysChange }) {
    return (
        <Section icon={TrendingUp} title="Signup Trend" subtitle={`Last ${days} days`}>
            {/* Day selector pills */}
            <div className="flex gap-2 mb-4">
                {DAY_OPTIONS.map((d) => (
                    <button
                        key={d}
                        onClick={() => onDaysChange(d)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                            days === d
                                ? 'bg-primary text-white'
                                : 'bg-white border border-slate-200 text-slate-600 hover:border-primary/40'
                        }`}
                    >
                        {d}d
                    </button>
                ))}
            </div>

            <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                    <defs>
                        <linearGradient id="signupGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ea871d" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="#ea871d" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                        dataKey="date"
                        tickFormatter={formatDate}
                        tick={{ fontSize: 11, fill: '#94a3b8' }}
                        tickLine={false}
                        axisLine={false}
                        interval={Math.floor(data.length / 6)}
                    />
                    <YAxis
                        tick={{ fontSize: 11, fill: '#94a3b8' }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                    />
                    <Tooltip
                        formatter={(value) => [`${value} signups`, 'Signups']}
                        labelFormatter={formatDate}
                        contentStyle={{
                            borderRadius: '12px',
                            border: '1px solid #e2e8f0',
                            fontSize: '12px',
                            boxShadow: '0 4px 12px -2px rgba(0,0,0,0.08)',
                        }}
                    />
                    <Area
                        type="monotone"
                        dataKey="count"
                        stroke="#ea871d"
                        strokeWidth={2}
                        fill="url(#signupGradient)"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </Section>
    )
}
