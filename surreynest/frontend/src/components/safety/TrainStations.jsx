/**
 * TrainStations — Nearest train stations with walking distance.
 */
import { Train } from 'lucide-react'
import { TRAIN_STATIONS } from '../../utils/safetyConstants'
import { haversine } from '../../utils/propertyUtils'

export default function TrainStations({ lat, lng }) {
    if (!lat || !lng) return null

    const stations = TRAIN_STATIONS.map(s => ({
        ...s,
        km: haversine(lat, lng, s.lat, s.lng),
    })).sort((a, b) => a.km - b.km)

    return (
        <div className="space-y-2.5">
            {stations.map((s) => (
                <div key={s.name} className="flex items-start gap-3 bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <Train size={16} className="text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                            <h4 className="text-sm font-bold text-slate-800">{s.name}</h4>
                            <span className="text-xs font-bold text-slate-500 flex-shrink-0">{s.km.toFixed(1)} km</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{s.lines}</p>
                        <p className="text-xs text-slate-400 mt-0.5">~{Math.round((s.km / 5) * 60)} min walk</p>
                    </div>
                </div>
            ))}
        </div>
    )
}
