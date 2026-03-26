/**
 * ScoreBadge, small coloured dot (8px) + numeric score + label.
 * Per design-system.md: green ≥70, amber 40-69, red <40.
 * No rings, no gauges, just a dot.
 *
 * @param {{ score: number|null, label: string }} props
 */
export default function ScoreBadge({ score, label }) {
    if (score === null || score === undefined) {
        return <span className="text-xs text-gray-400">Score unavailable</span>
    }

    const colour =
        score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-amber-500' : 'bg-red-500'

    return (
        <span className="flex items-center gap-1.5 text-xs text-gray-700">
            <span className={`w-2 h-2 rounded-full ${colour} flex-shrink-0`} />
            {score} {label}
        </span>
    )
}
