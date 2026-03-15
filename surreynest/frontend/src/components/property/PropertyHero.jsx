/**
 * PropertyHero — address header, tenure badge, compare button, and stat cards.
 *
 * Props:
 *   property     — the full property object
 *   weeklyRent   — predicted weekly rent (or null)
 *   areaCtx      — floor area context string (or null)
 *   compared     — boolean, whether this property is in the compare list
 *   onToggleCompare — callback to add/remove from compare
 *   onGoBack     — callback for the back button
 */
import {
    PoundSterling, Shield, Bed, ArrowLeft, ArrowLeftRight, Maximize2,
} from 'lucide-react'

// ── stat card (local to hero) ────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, colour = 'text-primary' }) {
    return (
        <div className="flex-1 min-w-[130px] sm:min-w-[80px] bg-white/60 backdrop-blur-md rounded-2xl p-4 sm:p-5 text-center shadow-glass border border-white hover:shadow-primary-glow transition-all duration-300">
            <div className="w-10 h-10 rounded-xl bg-white/80 flex items-center justify-center mx-auto mb-3 shadow-sm border border-slate-100/50">
                <Icon size={18} className={colour} />
            </div>
            <p className={`text-xl sm:text-2xl font-extrabold ${colour} leading-tight`}>{value}</p>
            <p className="text-xs text-slate-500 mt-1.5 font-bold uppercase tracking-wider">{label}</p>
            {sub && <p className="text-[11px] text-slate-400 mt-0.5 font-medium">{sub}</p>}
        </div>
    )
}

// ── main component ───────────────────────────────────────────────────────────

export default function PropertyHero({ property: p, weeklyRent, areaCtx, compared, onToggleCompare, onGoBack }) {
    return (
        <div className="relative">
            {/* Ambient background glows for premium feel */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary-200/40 rounded-full blur-[80px] -z-10 pointer-events-none translate-x-1/3 -translate-y-1/3" />
            <div className="absolute top-10 left-10 w-48 h-48 bg-emerald-200/30 rounded-full blur-[60px] -z-10 pointer-events-none -translate-x-1/2" />

            <button onClick={onGoBack} className="text-sm text-slate-500 hover:text-primary transition-colors inline-flex items-center gap-1.5 font-bold bg-white/80 backdrop-blur-md rounded-xl px-4 py-2 border border-slate-100/80 hover:border-primary/20 hover:bg-primary/10/50 shadow-sm">
                <ArrowLeft size={16} /> Search Results
            </button>

            <div className="mt-6 flex flex-col lg:flex-row lg:items-start lg:justify-between lg:gap-6">
                <div className="flex-1">
                    <h1 className="text-3xl lg:text-4xl font-extrabold text-slate-900 leading-tight tracking-tight">
                        {p.address}
                    </h1>
                    <p className="text-base text-slate-500 mt-2.5 flex items-center gap-3 flex-wrap font-medium">
                        <span>{p.postcode}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                        <span>{p.property_type || 'Property'}{p.built_form ? ` · ${p.built_form}` : ''}</span>
                        {p.tenure && (
                            <span className={`inline-flex items-center text-xs font-bold rounded-full px-3 py-1 leading-none ${p.tenure.includes('rental') || p.tenure.includes('rented')
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-sm'
                                : p.tenure.includes('owner')
                                    ? 'bg-slate-100 text-slate-500'
                                    : 'bg-slate-50 text-slate-400'
                                }`}>
                                {p.tenure.includes('rental') || p.tenure.includes('rented') ? 'Rental' : p.tenure.includes('owner') ? 'Owner' : 'Unknown'}
                            </span>
                        )}
                    </p>
                </div>

                {/* Compare button */}
                <button
                    onClick={onToggleCompare}
                    className={`mt-5 lg:mt-0 flex items-center justify-center gap-2 text-sm font-bold py-3 px-6 rounded-xl border-2 transition-all duration-300 ${compared
                        ? 'bg-primary/10 border-primary-300 text-primary/90 hover:bg-primary-100 shadow-sm'
                        : 'bg-white/80 backdrop-blur-sm border-primary/20 text-primary hover:bg-primary/10 hover:border-primary-300 shadow-glass hover:shadow-primary-glow'
                        }`}
                >
                    <ArrowLeftRight size={16} />
                    {compared ? 'Added to Compare ✓' : 'Add to Compare'}
                </button>
            </div>

            {/* Stat cards - 2x2 grid on mobile, row on desktop */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mt-8">
                <StatCard
                    icon={PoundSterling}
                    label="Est. rent"
                    value={weeklyRent ? `£${Math.round(weeklyRent * 0.92)}–${Math.round(weeklyRent * 1.08)}` : '—'}
                    sub={weeklyRent ? '/wk range' : 'Not available'}
                />
                <StatCard
                    icon={Shield}
                    label="Safety"
                    value={p.safety_score != null ? Math.round(p.safety_score) : '—'}
                    sub={p.safety_score != null ? '/100' : 'No data'}
                    colour={p.safety_score >= 60 ? 'text-emerald-600' : p.safety_score >= 40 ? 'text-amber-600' : p.safety_score != null ? 'text-red-600' : 'text-slate-400'}
                />
                <StatCard
                    icon={Bed}
                    label="Rooms"
                    value={p.num_rooms || '—'}
                    sub={p.floor_area_m2 ? `${p.floor_area_m2}m²` : null}
                    colour="text-slate-800"
                />
                <StatCard
                    icon={Maximize2}
                    label="Floor area"
                    value={p.floor_area_m2 ? `${p.floor_area_m2}m²` : '—'}
                    sub={areaCtx || null}
                    colour="text-slate-800"
                />
            </div>
        </div>
    )
}
