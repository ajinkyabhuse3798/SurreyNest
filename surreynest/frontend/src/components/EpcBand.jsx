/**
 * EpcBand — UK Energy Performance Certificate colour band A→G.
 * Highlights the property's rating with an arrow marker.
 *
 * @param {{ rating: string | null, className?: string }} props
 */

const BANDS = [
    { letter: 'A', colour: '#009036', width: '100%', label: '92+' },
    { letter: 'B', colour: '#19b459', width: '90%', label: '81-91' },
    { letter: 'C', colour: '#8dce46', width: '80%', label: '69-80' },
    { letter: 'D', colour: '#ffd500', width: '70%', label: '55-68' },
    { letter: 'E', colour: '#fcaa65', width: '60%', label: '39-54' },
    { letter: 'F', colour: '#ef8023', width: '50%', label: '21-38' },
    { letter: 'G', colour: '#e9153b', width: '40%', label: '1-20' },
]

export default function EpcBand({ rating, className = '' }) {
    const active = rating?.toUpperCase() || null

    return (
        <div className={`space-y-1 ${className}`}>
            {BANDS.map((band) => {
                const isActive = band.letter === active
                return (
                    <div key={band.letter} className="flex items-center gap-2">
                        {/* Arrow marker */}
                        <div className="w-5 flex justify-end">
                            {isActive && (
                                <span className="text-gray-900 text-xs font-bold animate-[slideIn_400ms_ease-out]">
                                    ▶
                                </span>
                            )}
                        </div>

                        {/* Band bar */}
                        <div
                            className={`h-6 rounded-sm flex items-center justify-between px-2 transition-all ${isActive ? 'ring-2 ring-gray-900 ring-offset-1' : ''
                                }`}
                            style={{
                                width: band.width,
                                backgroundColor: band.colour,
                                opacity: isActive ? 1 : 0.7,
                            }}
                        >
                            <span className="text-xs font-bold text-white drop-shadow-sm">
                                {band.letter}
                            </span>
                            <span className="text-[10px] font-medium text-white/80 drop-shadow-sm">
                                {band.label}
                            </span>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
