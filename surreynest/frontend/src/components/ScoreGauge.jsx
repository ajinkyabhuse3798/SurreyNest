/**
 * ScoreGauge, circular SVG score gauge with animated arc.
 *
 * Displays a 0-100 score as a coloured circular progress arc with the number
 * centred. Colour transitions: red (0-40) → amber (40-70) → green (70-100).
 *
 * Sizes:
 *   - "sm"  (48px) , for PropertyCard in search results
 *   - "md"  (80px) , for list views
 *   - "lg"  (160px), for PropertyDetail header
 *
 * @param {{
 *   score: number | null,
 *   size?: 'sm' | 'md' | 'lg',
 *   showLabel?: boolean,
 *   label?: string,
 *   animated?: boolean,
 *   className?: string,
 * }} props
 */
import { useState, useEffect, useRef } from 'react'

// ── Size presets ──────────────────────────────────────────────────────────────
const SIZES = {
    sm: { px: 48, stroke: 4, fontSize: 'text-xs', labelSize: 'text-[8px]' },
    md: { px: 80, stroke: 5, fontSize: 'text-lg', labelSize: 'text-[10px]' },
    lg: { px: 160, stroke: 8, fontSize: 'text-4xl', labelSize: 'text-xs' },
}

// ── Score → colour ───────────────────────────────────────────────────────────
function scoreColour(score) {
    if (score === null || score === undefined) return '#D1D5DB' // gray-300
    if (score >= 70) return '#16A34A' // green-600
    if (score >= 40) return '#D97706' // amber-600
    return '#DC2626' // red-600
}

function scoreLabel(score) {
    if (score === null || score === undefined) return 'N/A'
    if (score >= 70) return 'Good'
    if (score >= 40) return 'Fair'
    return 'Poor'
}

// ── Component ────────────────────────────────────────────────────────────────
export default function ScoreGauge({
    score,
    size = 'md',
    showLabel = false,
    label,
    animated = true,
    className = '',
}) {
    const config = SIZES[size] || SIZES.md
    const { px, stroke, fontSize, labelSize } = config

    const radius = (px - stroke) / 2
    const circumference = 2 * Math.PI * radius
    const centre = px / 2

    // Null-safe score
    const safeScore = score !== null && score !== undefined ? Math.min(100, Math.max(0, score)) : null
    const targetOffset = safeScore !== null
        ? circumference - (safeScore / 100) * circumference
        : circumference

    // ── Animation state ──────────────────────────────────────────────────
    const [displayScore, setDisplayScore] = useState(animated ? 0 : (safeScore ?? 0))
    const [arcOffset, setArcOffset] = useState(animated ? circumference : targetOffset)
    const animRef = useRef(null)

    useEffect(() => {
        if (!animated || safeScore === null) {
            setDisplayScore(safeScore ?? 0)
            setArcOffset(targetOffset)
            return
        }

        // Trigger animation after mount
        const timeout = setTimeout(() => {
            setArcOffset(targetOffset)

            // Count-up number
            const duration = 800
            const startTime = performance.now()
            const startVal = 0

            function step(now) {
                const elapsed = now - startTime
                const progress = Math.min(elapsed / duration, 1)
                // Ease out cubic
                const eased = 1 - Math.pow(1 - progress, 3)
                setDisplayScore(Math.round(startVal + (safeScore - startVal) * eased))

                if (progress < 1) {
                    animRef.current = requestAnimationFrame(step)
                }
            }

            animRef.current = requestAnimationFrame(step)
        }, 100)

        return () => {
            clearTimeout(timeout)
            if (animRef.current) cancelAnimationFrame(animRef.current)
        }
    }, [animated, safeScore, targetOffset])

    const colour = scoreColour(safeScore)
    const ariaLabel = safeScore !== null
        ? `${label || 'Score'}: ${safeScore} out of 100, ${scoreLabel(safeScore)}`
        : `${label || 'Score'}: unavailable`

    return (
        <div
            className={`inline-flex flex-col items-center gap-1 relative ${className}`}
            role="img"
            aria-label={ariaLabel}
        >
            <svg
                width={px}
                height={px}
                viewBox={`0 0 ${px} ${px}`}
                className="transform -rotate-90"
            >
                {/* Background track */}
                <circle
                    cx={centre}
                    cy={centre}
                    r={radius}
                    fill="none"
                    stroke="#F3F4F6"
                    strokeWidth={stroke}
                />

                {/* Score arc */}
                <circle
                    cx={centre}
                    cy={centre}
                    r={radius}
                    fill="none"
                    stroke={colour}
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={arcOffset}
                    style={{
                        transition: animated ? 'stroke-dashoffset 0.8s cubic-bezier(0.22, 1, 0.36, 1)' : 'none',
                    }}
                />
            </svg>

            {/* Score number overlay */}
            <div
                className="absolute flex flex-col items-center justify-center"
                style={{ width: px, height: px }}
            >
                <span
                    className={`${fontSize} font-semibold leading-none`}
                    style={{ color: safeScore !== null ? colour : '#9CA3AF' }}
                >
                    {safeScore !== null ? displayScore : 'N/A'}
                </span>
                {showLabel && (
                    <span className={`${labelSize} text-gray-400 mt-0.5 leading-none`}>
                        {label || scoreLabel(safeScore)}
                    </span>
                )}
            </div>
        </div>
    )
}
