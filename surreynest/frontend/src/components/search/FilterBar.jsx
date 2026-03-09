/**
 * FilterBar — Collapsible filter dropdowns.
 */
import { ChevronDown, X } from 'lucide-react'

export default function FilterBar({
    propertyTypes, filterType, setFilterType,
    filterEpc, setFilterEpc,
    activeFilterCount, onClearFilters,
}) {
    return (
        <div className="border-b border-slate-200/50 bg-white/50 backdrop-blur-md px-4 md:px-6 py-3">
            <div className="w-full flex flex-wrap items-center gap-3">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Filter:</span>

                <div className="relative">
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="appearance-none bg-white border border-slate-200 rounded-xl pl-3 pr-8 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                        <option value="">All types</option>
                        {propertyTypes.map((t) => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>
                    <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>

                <div className="relative">
                    <select
                        value={filterEpc}
                        onChange={(e) => setFilterEpc(e.target.value)}
                        className="appearance-none bg-white border border-slate-200 rounded-xl pl-3 pr-8 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                        <option value="">Any EPC</option>
                        {['A', 'B', 'C', 'D', 'E'].map((r) => (
                            <option key={r} value={r}>EPC {r} or better</option>
                        ))}
                    </select>
                    <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>

                {activeFilterCount > 0 && (
                    <button
                        onClick={onClearFilters}
                        className="flex items-center gap-1 text-xs text-rose-500 font-bold hover:text-rose-700 transition-colors"
                    >
                        <X size={12} />
                        Clear all
                    </button>
                )}
            </div>
        </div>
    )
}
