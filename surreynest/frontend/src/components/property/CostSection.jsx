/**
 * CostSection — Rent band, XAI CTA, bills estimate, total/per-person, RentRadar.
 *
 * Props:
 *   property       — needs uprn, postcode, num_rooms
 *   weeklyRent     — predicted weekly rent (or null)
 *   monthlyRent    — monthly equivalent (or null)
 *   energyCost     — estimated monthly energy cost
 *   totalMonthly   — rent + bills total (or null)
 *   perPerson      — per-room cost (or null)
 *   annualCost     — 12-month total (or null)
 */
import { Link } from 'react-router-dom'
import {
    Zap, Droplets, Wifi, Landmark, BarChart3, ChevronRight, TrendingUp, Info as InfoIcon, Scale
} from 'lucide-react'
import InfoTip from '../InfoTip'
import RentRadarChart from '../RentRadarChart'

// ── Inline Section wrapper (avoids circular dep with parent) ─────────────────
import { CARD } from '../../utils/propertyUtils'

function SubSection({ id, icon: Icon, title, infoTip, children }) {
    return (
        <section id={id} className={`${CARD} shadow-sm border-slate-100/60`}>
            <div className="flex items-center gap-3 mb-6">
                {Icon && (
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 border border-primary/10/50">
                        <Icon size={17} className="text-primary" />
                    </div>
                )}
                <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">{title}</h2>
                {infoTip && <InfoTip text={infoTip} />}
            </div>
            {children}
        </section>
    )
}

export default function CostSection({ property: p, weeklyRent, monthlyRent, energyCost, totalMonthly, perPerson, annualCost }) {
    const waterCost = 30
    const internetCost = 25

    // RentRadar sector extraction
    const postcodeSector = (() => {
        if (!p.postcode) return null
        const parts = p.postcode.trim().toUpperCase().split(/\s+/)
        return parts.length === 2 && parts[1].length >= 1
            ? `${parts[0]} ${parts[1][0]}`
            : null
    })()

    // Area-based market rent premium — varies by postcode district
    // GU1/GU2: high student demand, premium landlords charge more
    // GU3–GU5: family suburbs, moderate premium
    // GU7: Godalming, lower demand premium
    const marketRentMultiplier = (() => {
        const district = (p.postcode || '').trim().toUpperCase().split(/\s+/)[0]
        if (district === 'GU1') return 1.18
        if (district === 'GU2') return 1.15
        if (district === 'GU3' || district === 'GU4') return 1.10
        if (district === 'GU5' || district === 'GU7') return 1.08
        return 1.10
    })()

    return (
        <>
            {/* Main cost content */}
            {weeklyRent ? (
                <div className="space-y-6">
                    {/* Rent confidence band */}
                    <div className="rounded-2xl border border-slate-100/80 p-5 bg-white/60 backdrop-blur-md shadow-sm">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                            Typical rent range · {p.postcode}
                        </p>
                        <div className="flex rounded-xl overflow-hidden h-16 text-xs font-semibold shadow-inner">
                            <div className="flex-1 flex flex-col items-center justify-center bg-emerald-50/80 text-emerald-800 border-r border-white/50 backdrop-blur-sm">
                                <span className="text-[10px] font-medium opacity-80">Below market</span>
                                <span className="font-extrabold">£{Math.round(weeklyRent)}/wk</span>
                            </div>
                            <div className="flex-[2] flex flex-col items-center justify-center bg-primary text-white border-r border-white/30 backdrop-blur-sm">
                                <span className="text-[10px] font-medium opacity-80">Median estimate</span>
                                <span className="font-extrabold text-base tracking-tight">
                                    £{Math.round(weeklyRent * 1.08)}/wk
                                </span>
                            </div>
                            <div className="flex-1 flex flex-col items-center justify-center bg-amber-50/80 text-amber-800 backdrop-blur-sm">
                                <span className="text-[10px] font-medium opacity-80">Market premium</span>
                                <span className="font-extrabold">£{Math.round(weeklyRent * marketRentMultiplier)}/wk</span>
                            </div>
                        </div>
                        <p className="text-sm text-slate-500 mt-4 font-medium flex items-center gap-2">
                            ≈ <span className="font-extrabold text-slate-800 text-lg">
                                £{Math.round(weeklyRent * 1.08 * 52 / 12)}
                            </span> <span className="text-slate-400 text-xs mt-1">/month median · area premium up to £{Math.round(weeklyRent * marketRentMultiplier * 52 / 12)}/mo</span>
                        </p>
                        <div className="mt-3 flex items-start gap-2 text-xs text-slate-400 bg-slate-50/50 p-2.5 rounded-lg border border-slate-100/50">
                            <InfoIcon size={14} className="text-slate-400 flex-shrink-0 mt-0.5" />
                            <p>Below market = ML fair-value estimate. Median estimate = typical market rate. Market premium reflects landlord asking prices in this area.</p>
                        </div>
                    </div>

                    {/* CTA to full rent explainability page */}
                    <Link
                        to={`/rent/${p.uprn}`}
                        className="group relative overflow-hidden flex items-center gap-4 bg-gradient-to-br from-emerald-800 via-teal-800 to-emerald-900 hover:from-emerald-700 hover:to-teal-700 rounded-2xl px-5 py-4 lg:py-5 border border-emerald-700/50 transition-all duration-300 shadow-[0_8px_30px_-4px_rgba(6,95,70,0.3)] hover:shadow-[0_12px_40px_-4px_rgba(6,95,70,0.4)]"
                    >
                        {/* Glow accent */}
                        <div className="absolute -right-12 -top-12 w-32 h-32 bg-teal-400/20 rounded-full blur-2xl group-hover:bg-teal-400/30 transition-colors" />

                        <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0 border border-white/10 backdrop-blur-sm">
                            <BarChart3 size={20} className="text-emerald-100 drop-shadow-md" />
                        </div>
                        <div className="flex-1 min-w-0 z-10">
                            <p className="text-[15px] font-bold text-white tracking-wide">See how this rent was calculated</p>
                            <p className="text-xs text-emerald-200 mt-1 font-medium">Feature contributions, AI explanation & market comparison</p>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-sm group-hover:bg-white/20 transition-colors z-10">
                            <ChevronRight size={18} className="text-white group-hover:translate-x-0.5 transition-transform" />
                        </div>
                    </Link>

                    {/* Challenge rent increase CTA */}
                    <Link
                        to={`/challenge-rent-increase?postcode=${encodeURIComponent(p.postcode || '')}&uprn=${encodeURIComponent(p.uprn || '')}`}
                        className="group relative overflow-hidden flex items-center gap-4 bg-gradient-to-br from-amber-600 via-amber-700 to-orange-700 hover:from-amber-500 hover:to-orange-600 rounded-2xl px-5 py-4 border border-amber-600/50 transition-all duration-300 shadow-[0_4px_20px_-2px_rgba(180,83,9,0.3)] hover:shadow-[0_8px_30px_-4px_rgba(180,83,9,0.4)]"
                    >
                        <div className="absolute -right-12 -top-12 w-32 h-32 bg-orange-400/20 rounded-full blur-2xl group-hover:bg-orange-400/30 transition-colors" />
                        <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0 border border-white/10 backdrop-blur-sm">
                            <Scale size={20} className="text-amber-100" />
                        </div>
                        <div className="flex-1 min-w-0 z-10">
                            <p className="text-[15px] font-bold text-white tracking-wide">Challenge a rent increase</p>
                            <p className="text-xs text-amber-200 mt-1 font-medium">Section 13 analysis + tribunal brief · Renters' Rights Act 2025</p>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-sm group-hover:bg-white/20 transition-colors z-10">
                            <ChevronRight size={18} className="text-white group-hover:translate-x-0.5 transition-transform" />
                        </div>
                    </Link>

                    {/* Bills estimate */}
                    <div className="border border-slate-100/80 rounded-2xl p-5 space-y-4 bg-slate-50/30 shadow-[inset_0_2px_10px_-2px_rgba(0,0,0,0.02)]">
                        <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5 border-b border-slate-200/60 pb-3">
                            Estimated monthly bills
                            <InfoTip text="These are rough estimates for a Guildford student property. Your actual costs will vary depending on usage and provider." />
                        </h3>
                        <div className="space-y-3.5 pt-1">
                            {[
                                { icon: Zap, colour: 'text-amber-500 bg-amber-50 border-amber-100', label: 'Energy', value: `~£${energyCost}/mo` },
                                { icon: Droplets, colour: 'text-blue-500 bg-blue-50 border-blue-100', label: 'Water', value: `~£${waterCost}/mo` },
                                { icon: Wifi, colour: 'text-primary/80 bg-primary/10 border-primary/10', label: 'Internet', value: `~£${internetCost}/mo` },
                            ].map(b => (
                                <div key={b.label} className="flex items-center justify-between text-sm group">
                                    <span className="flex items-center gap-3 text-slate-600 font-medium">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${b.colour}`}>
                                            <b.icon size={14} />
                                        </div>
                                        {b.label}
                                    </span>
                                    <span className="font-bold text-slate-900">{b.value}</span>
                                </div>
                            ))}
                            <div className="flex items-center justify-between text-sm mt-4 pt-4 border-t border-slate-200/60">
                                <span className="flex items-center gap-3 text-slate-600 font-medium">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center border border-emerald-100 bg-emerald-50 text-emerald-600">
                                        <Landmark size={14} />
                                    </div>
                                    Council tax
                                    <InfoTip text="Full-time students are exempt from council tax. You don't pay this! Register your exemption with Guildford council." />
                                </span>
                                <span className="font-extrabold text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-full text-xs border border-emerald-200 shadow-sm">£0 — Exempt ✓</span>
                            </div>
                        </div>
                    </div>

                    {/* Total + per-person */}
                    {totalMonthly && (
                        <div className="relative overflow-hidden bg-gradient-to-br from-primary-50 to-white rounded-2xl p-6 border border-primary/10/60 shadow-glass">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary-200/30 rounded-full blur-[40px] pointer-events-none translate-x-1/2 -translate-y-1/2" />

                            <div className="flex items-end justify-between relative z-10">
                                <div className="space-y-1">
                                    <span className="text-xs font-bold text-primary/80 uppercase tracking-widest">Total Estimated</span>
                                    <h4 className="text-3xl font-extrabold text-slate-900">~£{totalMonthly}<span className="text-base text-slate-400 font-medium tracking-normal">/mo</span></h4>
                                </div>
                                {perPerson && (
                                    <div className="text-right">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Per Room</p>
                                        <p className="text-lg text-primary/90 font-extrabold bg-white/60 backdrop-blur-sm rounded-xl px-3 py-1.5 border border-primary/10 shadow-sm">
                                            ~£{perPerson}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {annualCost && (
                                <div className="border-t border-primary/10/80 mt-5 pt-4 space-y-2 relative z-10">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-500 font-medium">12-month contract:</span>
                                        <span className="font-extrabold text-slate-800 bg-white/80 px-2 py-1 rounded-md border border-slate-100">~£{annualCost.toLocaleString()}</span>
                                    </div>
                                    <p className="text-[10px] text-slate-400/80 font-medium flex justify-end">
                                        💡 Avg student loan: ~£9,978/yr
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <p className="text-sm text-slate-400 bg-slate-50 rounded-xl p-4 border border-slate-100">Rent prediction is not available for this property yet.</p>
            )}

            {/* RentRadar (separate visual section) */}
            {postcodeSector && (
                <SubSection id="rent-trends" icon={TrendingUp} title="RentRadar"
                    infoTip="Shows how median implied rents have changed in this postcode sector over the last 5 years, plus a 2-year forecast based on ONS house price growth.">
                    <RentRadarChart postcodeSector={postcodeSector} />
                </SubSection>
            )}
        </>
    )
}

