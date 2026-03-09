/**
 * SearchHeader — Sticky header: summary, sort, filter toggle, mobile tabs.
 */
import {
    MapPin, SlidersHorizontal, List, Map as MapIcon, ChevronDown,
} from 'lucide-react'
import { SORT_OPTIONS, formatRadius } from '../../utils/searchUtils'

export default function SearchHeader({
    loading, sortedCount, total, radius, postcode,
    sortKey, setSortKey,
    showFilters, setShowFilters, activeFilterCount,
    showMap, setShowMap,
}) {
    return (
        <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 px-4 md:px-6 py-3">
            <div className="w-full flex items-center justify-between gap-3">
                {/* Left: Search summary */}
                <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0">
                        <MapPin size={14} className="text-indigo-600" />
                    </div>
                    <p className="text-sm text-slate-700 truncate font-medium">
                        {loading ? (
                            'Searching...'
                        ) : (
                            <>
                                <span className="font-extrabold text-slate-900">{sortedCount}</span>
                                {sortedCount !== total && (
                                    <span className="text-slate-400"> of {total}</span>
                                )}{' '}
                                properties within{' '}
                                <span className="font-bold">{formatRadius(radius)}</span> of{' '}
                                <span className="font-bold text-indigo-600">{postcode.toUpperCase()}</span>
                            </>
                        )}
                    </p>
                </div>

                {/* Right: Controls */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Sort — desktop */}
                    <div className="hidden sm:flex items-center relative">
                        <select
                            value={sortKey}
                            onChange={(e) => setSortKey(e.target.value)}
                            className="appearance-none bg-slate-50 border border-slate-200 rounded-xl pl-3 pr-8 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer"
                        >
                            {SORT_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                        <ChevronDown size={12} className="absolute right-2.5 text-slate-400 pointer-events-none" />
                    </div>

                    {/* Filter toggle — desktop */}
                    <button
                        onClick={() => setShowFilters((s) => !s)}
                        className={`hidden sm:flex items-center gap-1.5 border rounded-xl px-3 py-2 text-xs font-semibold transition-all ${showFilters || activeFilterCount > 0
                            ? 'border-indigo-200 text-indigo-600 bg-indigo-50'
                            : 'border-slate-200 text-slate-600 bg-slate-50 hover:border-slate-300'
                            }`}
                    >
                        <SlidersHorizontal size={12} />
                        Filters
                        {activeFilterCount > 0 && (
                            <span className="bg-indigo-600 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                                {activeFilterCount}
                            </span>
                        )}
                    </button>

                    {/* Mobile: List/Map pill toggle */}
                    <div className="flex md:hidden bg-slate-100 rounded-xl p-0.5">
                        <button
                            onClick={() => setShowMap(false)}
                            className={`flex items-center gap-1 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${!showMap
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <List size={12} />
                            List
                        </button>
                        <button
                            onClick={() => setShowMap(true)}
                            className={`flex items-center gap-1 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${showMap
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <MapIcon size={12} />
                            Map
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
