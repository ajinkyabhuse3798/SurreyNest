/**
 * Section — Shared card-wrapper used across SafetyDetail, RentDetail, etc.
 *
 * Provides a consistent white-card layout with an icon + title header
 * and optional subtitle. Extracted to eliminate 3 duplicate definitions.
 */
export default function Section({ icon: Icon, title, subtitle, children, id }) {
    return (
        <section id={id} className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon size={16} className="text-primary" />
                </div>
                <div>
                    <h2 className="text-base font-bold text-slate-800">{title}</h2>
                    {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
                </div>
            </div>
            <div className="p-5">{children}</div>
        </section>
    )
}
