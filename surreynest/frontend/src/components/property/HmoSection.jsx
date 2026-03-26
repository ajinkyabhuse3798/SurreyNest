/**
 * HmoSection, HMO explainer, licence status, and licence details grid.
 *
 * Props:
 *   hmoStatus , 'licensed' | 'expired' | 'not_found'
 *   hmoDetail , API response object (or null)
 *   hmoLoading, boolean
 *   property  , needs property.hmo fallback
 */
import { CheckCircle2, AlertTriangle, Info as InfoIcon } from 'lucide-react'

function SectionSkeleton({ lines = 3 }) {
    return (
        <div className="animate-pulse space-y-3 py-2">
            {Array.from({ length: lines }).map((_, i) => (
                <div key={i} className="h-4 bg-slate-100 rounded-lg" style={{ width: `${85 - i * 15}%` }} />
            ))}
        </div>
    )
}

export default function HmoSection({ hmoStatus, hmoDetail, hmoLoading, property: p }) {
    const hmo = hmoDetail?.record || p.hmo || {}

    return (
        <div className="space-y-5">
            <div className="bg-primary/10/50 border border-primary/10/80 rounded-2xl p-4 flex items-start gap-3">
                <InfoIcon size={18} className="text-primary/80 flex-shrink-0 mt-0.5 drop-shadow-sm" />
                <p className="text-xs text-primary-900 leading-relaxed font-medium">
                    An <strong>HMO</strong> (House in Multiple Occupation) is a property rented by 3+ people from different households, like a typical student house share.
                </p>
            </div>

            {hmoLoading && !p.hmo ? (
                <SectionSkeleton lines={3} />
            ) : hmoStatus === 'licensed' ? (
                <div className="space-y-3 pt-1">
                    <div className="flex items-start gap-3.5 bg-gradient-to-br from-emerald-50 to-white border border-emerald-200/80 rounded-2xl p-5 shadow-sm">
                        <CheckCircle2 size={24} className="text-emerald-500 flex-shrink-0 drop-shadow-sm" />
                        <div>
                            <p className="text-sm font-extrabold text-emerald-900">Licensed HMO ✓</p>
                            <p className="text-xs text-emerald-700/80 mt-1.5 leading-relaxed font-medium">
                                This property has a valid HMO licence, your landlord has met safety requirements including fire alarms, escape routes, and minimum room sizes.
                            </p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs mt-4">
                        {(hmo.licence_number || p.hmo?.licence_number) && (
                            <div className="bg-white border border-slate-200/60 rounded-xl px-4 py-3 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
                                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block mb-1">Licence #</span>
                                <p className="font-extrabold text-slate-800">{hmo.licence_number || p.hmo?.licence_number}</p>
                            </div>
                        )}
                        {(hmo.max_occupants || p.hmo?.max_occupants) && (
                            <div className="bg-white border border-slate-200/60 rounded-xl px-4 py-3 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
                                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block mb-1">Max occupants</span>
                                <p className="font-extrabold text-slate-800">{hmo.max_occupants || p.hmo?.max_occupants}</p>
                            </div>
                        )}
                        {(hmo.expiry_date || p.hmo?.expiry_date) && (
                            <div className="bg-white border border-slate-200/60 rounded-xl px-4 py-3 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
                                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block mb-1">Expires</span>
                                <p className="font-extrabold text-slate-800">
                                    {new Date(hmo.expiry_date || p.hmo?.expiry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            ) : hmoStatus === 'expired' ? (
                <div className="flex items-start gap-3.5 bg-gradient-to-br from-amber-50 to-white border border-amber-200/80 rounded-2xl p-5 shadow-sm">
                    <AlertTriangle size={24} className="text-amber-500 flex-shrink-0 drop-shadow-sm" />
                    <div>
                        <p className="text-sm font-extrabold text-amber-900">HMO licence expired ⚠</p>
                        <p className="text-xs text-amber-800/80 mt-1.5 leading-relaxed font-medium">
                            This property's HMO licence has expired. Contact the landlord or Guildford Borough Council before signing a tenancy.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="flex items-start gap-3.5 bg-gradient-to-br from-slate-50 to-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
                    <AlertTriangle size={22} className="text-slate-400 flex-shrink-0 drop-shadow-sm" />
                    <div>
                        <p className="text-sm font-extrabold text-slate-800">Not on the HMO register</p>
                        <p className="text-xs text-slate-500 mt-1.5 leading-relaxed font-medium">
                            If you're renting as a group of 3+, ask the landlord whether the property needs an HMO licence.
                        </p>
                    </div>
                </div>
            )}

            <p className="text-xs text-slate-400 leading-relaxed font-medium px-1">
                An HMO licence means the council has inspected the property for fire safety, escape routes, and living standards. It protects you as a tenant.
            </p>
        </div>
    )
}

