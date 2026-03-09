/**
 * SafetyHero — Gradient banner with safety gauge, star rating, and crime count.
 */
import { Shield, Star } from 'lucide-react'
import ScoreGauge from '../ScoreGauge'

const starLabels = { 5: 'Very Safe Area', 4: 'Safer Than Most', 3: 'Average Safety', 2: 'Below Average', 1: 'Higher Crime Area' }
const starColors = { 5: 'text-emerald-500', 4: 'text-emerald-400', 3: 'text-amber-400', 2: 'text-orange-400', 1: 'text-red-400' }

export default function SafetyHero({ sector, decodedPostcode, safetyScore, overallStars, sectorTotal }) {
    return (
        <div className="relative bg-gradient-to-br from-indigo-800 via-indigo-900 to-violet-900 rounded-3xl p-6 sm:p-10 text-white shadow-[0_8px_30px_-4px_rgba(49,46,129,0.5)] overflow-hidden">
            {/* Ambient Background Glows */}
            <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-violet-500 rounded-full mix-blend-screen filter blur-[80px] opacity-40 pointer-events-none" />
            <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-64 h-64 bg-indigo-500 rounded-full mix-blend-screen filter blur-[60px] opacity-30 pointer-events-none" />

            <div className="relative z-10 flex items-center gap-2 text-indigo-300 text-xs font-bold tracking-widest uppercase mb-4">
                <Shield size={14} className="text-emerald-400" />
                SAFETY REPORT
            </div>
            <h1 className="relative z-10 text-3xl sm:text-4xl font-black mb-2 tracking-tight">
                {sector || decodedPostcode}
            </h1>
            <p className="relative z-10 text-indigo-200 text-sm mb-8 font-medium">
                Full crime analysis for this postcode sector • Based on police.uk data
            </p>

            <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6">
                {safetyScore != null && (
                    <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5 flex-shrink-0 shadow-inner">
                        <ScoreGauge score={safetyScore} size="lg" showLabel label="Safety" />
                    </div>
                )}
                <div className="flex-1 text-center sm:text-left">
                    <div className="flex items-center gap-1 justify-center sm:justify-start mb-3">
                        {[1, 2, 3, 4, 5].map((n) => (
                            <Star key={n} size={24} className={n <= overallStars ? 'text-amber-400 drop-shadow-md' : 'text-white/20'} fill={n <= overallStars ? 'currentColor' : 'none'} />
                        ))}
                    </div>
                    <p className="text-xl font-bold tracking-tight text-white mb-1">{starLabels[overallStars]}</p>
                    <p className="text-sm text-indigo-200/80 font-medium">
                        {sectorTotal || 0} crimes reported in 12 months
                    </p>
                </div>
            </div>
        </div>
    )
}
