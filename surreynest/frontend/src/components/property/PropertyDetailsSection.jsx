/**
 * PropertyDetailsSection — Specs grid (type, rooms, area, built form) + EPC band.
 *
 * Props:
 *   property — needs property_type, num_rooms, floor_area_m2, built_form, energy_rating
 *   areaCtx  — floor area context string (or null)
 *   epcCtx   — { text, colour } from epcImpact() (or null)
 */
import { Home, Bed, Ruler, Building2, Info as InfoIcon } from 'lucide-react'
import EpcBand from '../EpcBand'
import InfoTip from '../InfoTip'

export default function PropertyDetailsSection({ property: p, areaCtx, epcCtx }) {
    return (
        <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2">
                {[
                    { icon: Home, label: 'Type', value: p.property_type },
                    { icon: Bed, label: 'Habitable rooms', value: p.num_rooms },
                    { icon: Ruler, label: 'Floor area', value: p.floor_area_m2 ? `${p.floor_area_m2} m²` : null },
                    { icon: Building2, label: 'Built form', value: p.built_form },
                ].filter(d => d.value).map(d => (
                    <div key={d.label} className="relative overflow-hidden flex items-center justify-between bg-white/60 backdrop-blur-sm border border-slate-200/60 rounded-2xl px-5 py-4 hover:bg-white hover:shadow-sm transition-all duration-300">
                        {/* Subtle left border accent */}
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary-300 to-primary-100 opacity-50" />

                        <span className="flex items-center gap-3 text-xs text-slate-500 font-bold uppercase tracking-wider pl-1">
                            <d.icon size={16} className="text-primary-400" />{d.label}
                        </span>
                        <span className="text-[15px] font-extrabold text-slate-900">{d.value}</span>
                    </div>
                ))}
            </div>

            {areaCtx && (
                <div className="flex items-start gap-2.5 bg-slate-50/80 border border-slate-100/80 rounded-xl px-4 py-3">
                    <InfoIcon size={16} className="text-primary-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                        {areaCtx}
                    </p>
                </div>
            )}

            {p.energy_rating && (
                <div className="space-y-4 pt-2 border-t border-slate-100/80">
                    <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
                        Energy rating (EPC)
                        <InfoTip text="Energy Performance Certificate — rates how energy-efficient the property is. A is best (cheapest to heat), G is worst (most expensive)." />
                    </h3>
                    <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100/60">
                        <EpcBand rating={p.energy_rating} />
                    </div>
                    {epcCtx && (
                        <p className={`text-xs font-bold px-1 ${epcCtx.colour}`}>{epcCtx.text}</p>
                    )}
                </div>
            )}
        </div>
    )
}

