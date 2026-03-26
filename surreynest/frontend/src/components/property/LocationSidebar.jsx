/**
 * LocationSidebar, Map, distance cards with proximity badges, and transit facts.
 *
 * Props:
 *   property , needs uprn, lat, lng, address, safety_score
 *   distances, array of { label, icon, km, walkMin, cycleMin, proximityType }
 */
import MapView from '../MapView'
import { proximityBadge, GUILDFORD_TRANSIT_FACTS } from '../../utils/propertyUtils'

export default function LocationSidebar({ property: p, distances }) {
    return (
        <>
            <MapView
                markers={[{ id: p.uprn, lat: p.lat, lng: p.lng, label: p.address, score: p.safety_score }]}
                singleMode
                zoom={15}
                height="h-[250px] lg:h-[300px]"
                className="rounded-xl overflow-hidden border-2 border-slate-100 shadow-sm"
            />

            {distances.length > 0 && (
                <div className="mt-4 space-y-2">
                    {distances.map((d) => {
                        const badge = proximityBadge(d.km, d.proximityType)
                        return (
                            <div key={d.label} className="bg-slate-50/80 border border-slate-100/80 rounded-xl px-4 py-3 hover:bg-slate-50 transition-colors">
                                <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-2.5 text-sm text-slate-700 font-semibold">
                                        <d.icon size={16} className="text-primary/80" />
                                        {d.label}
                                    </span>
                                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full shadow-sm ${badge.colour}`}>
                                        {badge.label}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 mt-1.5 pl-[26px] font-medium">
                                    {d.km.toFixed(1)} km · ~{d.walkMin} min walk · ~{d.cycleMin} min cycle
                                </p>
                            </div>
                        )
                    })}
                </div>
            )}

            <div className="mt-4 border border-slate-100/80 rounded-xl p-4 space-y-2.5 bg-slate-50/30">
                <h3 className="text-sm font-bold text-slate-700">Getting Around Guildford</h3>
                {GUILDFORD_TRANSIT_FACTS.map((fact) => (
                    <div key={fact.title} className={`flex items-start gap-3 ${fact.bg} rounded-xl px-3.5 py-3 border border-slate-50 shadow-sm`}>
                        <fact.icon size={15} className={`${fact.colour} flex-shrink-0 mt-0.5`} />
                        <div>
                            <p className={`text-xs font-bold ${fact.colour}`}>{fact.title}</p>
                            <p className="text-xs text-slate-600 mt-0.5 font-medium">{fact.detail}</p>
                        </div>
                    </div>
                ))}
            </div>
        </>
    )
}
