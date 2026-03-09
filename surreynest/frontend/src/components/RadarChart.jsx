/**
 * RadarChart — custom SVG radar/spider chart for property comparison.
 *
 * 5 axes: Safety, Value, Size, Energy, Rooms.
 * Overlays one polygon per property with translucent fills.
 * No external charting library required.
 *
 * @param {{ properties: Array<{label: string, values: number[]}>, className?: string }} props
 *   values: array of 5 numbers, each 0-100
 */

const AXES = ['Safety', 'Value', 'Size', 'Energy', 'Rooms']
const COLOURS = [
    { stroke: '#4F46E5', fill: 'rgba(79,70,229,0.15)' },   // indigo
    { stroke: '#059669', fill: 'rgba(5,150,105,0.15)' },    // emerald
    { stroke: '#D97706', fill: 'rgba(217,119,6,0.15)' },    // amber
    { stroke: '#E11D48', fill: 'rgba(225,29,72,0.15)' },    // rose
]

const SIZE = 280
const CX = SIZE / 2
const CY = SIZE / 2
const R = 110
const RINGS = [0.33, 0.66, 1.0]

function polarToXY(angleDeg, radius) {
    const rad = ((angleDeg - 90) * Math.PI) / 180
    return [CX + radius * Math.cos(rad), CY + radius * Math.sin(rad)]
}

function axisAngle(i) {
    return (360 / AXES.length) * i
}

export default function RadarChart({ properties = [], className = '' }) {
    if (properties.length === 0) return null

    return (
        <div className={`flex flex-col items-center ${className}`}>
            <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full max-w-[280px]">
                {/* Grid rings */}
                {RINGS.map((r) => (
                    <polygon
                        key={r}
                        points={AXES.map((_, i) => polarToXY(axisAngle(i), R * r).join(',')).join(' ')}
                        fill="none"
                        stroke="#CBD5E1" /* slate-300 */
                        strokeWidth={0.75}
                    />
                ))}

                {/* Axis lines */}
                {AXES.map((_, i) => {
                    const [x, y] = polarToXY(axisAngle(i), R)
                    return <line key={i} x1={CX} y1={CY} x2={x} y2={y} stroke="#E2E8F0" /* slate-200 */ strokeWidth={1} />
                })}

                {/* Data polygons */}
                {properties.map((prop, pi) => {
                    const colour = COLOURS[pi % COLOURS.length]
                    const points = prop.values
                        .map((v, i) => polarToXY(axisAngle(i), (Math.min(v, 100) / 100) * R).join(','))
                        .join(' ')
                    return (
                        <polygon
                            key={pi}
                            points={points}
                            fill={colour.fill}
                            stroke={colour.stroke}
                            strokeWidth={2.5}
                            strokeLinejoin="round"
                        />
                    )
                })}

                {/* Data points */}
                {properties.map((prop, pi) => {
                    const colour = COLOURS[pi % COLOURS.length]
                    return prop.values.map((v, i) => {
                        const [x, y] = polarToXY(axisAngle(i), (Math.min(v, 100) / 100) * R)
                        return <circle key={`${pi}-${i}`} cx={x} cy={y} r={3} fill={colour.stroke} />
                    })
                })}

                {/* Axis labels */}
                {AXES.map((label, i) => {
                    const [x, y] = polarToXY(axisAngle(i), R + 18)
                    return (
                        <text
                            key={label}
                            x={x}
                            y={y}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            className="text-[10px] fill-gray-500 font-medium"
                        >
                            {label}
                        </text>
                    )
                })}
            </svg>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-3 justify-center">
                {properties.map((prop, pi) => (
                    <div key={pi} className="flex items-center gap-1.5 text-xs text-gray-600">
                        <span
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: COLOURS[pi % COLOURS.length].stroke }}
                        />
                        <span className="truncate max-w-[120px]">{prop.label}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}
