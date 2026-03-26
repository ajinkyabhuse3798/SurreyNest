/**
 * FloodRiskSection, Flood severity badge, nearest flood area, and EA attribution.
 *
 * Props:
 *   floodRisk, property.flood_risk object (or null/undefined)
 */
import { Droplets, AlertTriangle, CheckCircle2 } from 'lucide-react'

export default function FloodRiskSection({ floodRisk }) {
    if (!floodRisk) {
        return <p className="text-sm text-slate-400">No flood risk data available for this area.</p>
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-3">
                {floodRisk.current_severity ? (
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${floodRisk.current_severity === 1 ? 'bg-red-100 text-red-700 border border-red-200' :
                        floodRisk.current_severity === 2 ? 'bg-orange-100 text-orange-700 border border-orange-200' :
                            floodRisk.current_severity === 3 ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' :
                                'bg-emerald-100 text-emerald-700 border border-emerald-200'
                        }`}>
                        <AlertTriangle size={12} />
                        {floodRisk.severity_label}
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 size={12} />
                        No Active Warnings
                    </span>
                )}
            </div>

            <div className="bg-slate-50/80 border border-slate-100/80 rounded-xl p-4 space-y-2">
                <h4 className="text-sm font-bold text-slate-800">Nearest Flood Area</h4>
                <p className="text-sm text-slate-700">{floodRisk.label}</p>
                {floodRisk.description && (
                    <p className="text-xs text-slate-500">{floodRisk.description}</p>
                )}
                <div className="flex flex-wrap gap-3 pt-1">
                    {floodRisk.river_or_sea && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-2.5 py-1">
                            <Droplets size={12} />{floodRisk.river_or_sea}
                        </span>
                    )}
                    {floodRisk.distance_km != null && (
                        <span className="text-xs text-slate-500">{floodRisk.distance_km.toFixed(1)} km away</span>
                    )}
                </div>
            </div>

            {floodRisk.message && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <p className="text-xs text-amber-800">{floodRisk.message}</p>
                </div>
            )}

            <p className="text-[10px] text-slate-400">
                Data: Environment Agency flood and river level data (Open Government Licence v3)
            </p>
        </div>
    )
}
