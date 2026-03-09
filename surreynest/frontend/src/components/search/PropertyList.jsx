/**
 * PropertyList — Property cards + skeleton + empty state + pagination.
 */
import { Search, SlidersHorizontal, Lightbulb, ChevronDown } from 'lucide-react'
import PropertyCard from '../PropertyCard'
import { SkeletonCard, SORT_OPTIONS } from '../../utils/searchUtils'

export default function PropertyList({
    loading, sorted, error, properties,
    hoveredId, setHoveredId,
    isInCompare, handleToggleCompare,
    activeFilterCount, handleClearFilters,
    page, setPage, totalPages,
    // Mobile sort controls
    sortKey, setSortKey, showFilters, setShowFilters,
    showMap,
}) {
    return (
        <div
            className={`${showMap ? 'hidden md:block' : ''
                } md:w-[40%] md:overflow-y-auto md:border-r md:border-slate-200/60 bg-gradient-to-b from-[#f8f9fc] to-[#f1f3f9]`}
        >
            {/* Mobile sort (visible on mobile only) */}
            <div className="sm:hidden border-b border-slate-100 bg-white px-4 py-2.5 flex items-center gap-2">
                <div className="relative flex-1">
                    <select
                        value={sortKey}
                        onChange={(e) => setSortKey(e.target.value)}
                        className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl pl-3 pr-8 py-2 text-xs font-semibold text-slate-700"
                    >
                        {SORT_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>
                    <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
                <button
                    onClick={() => setShowFilters((s) => !s)}
                    className={`flex items-center gap-1 border rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${activeFilterCount > 0
                        ? 'border-indigo-200 text-indigo-600 bg-indigo-50'
                        : 'border-slate-200 text-slate-600 bg-slate-50'
                        }`}
                >
                    <SlidersHorizontal size={12} />
                    {activeFilterCount > 0 ? `(${activeFilterCount})` : 'Filter'}
                </button>
            </div>

            <div className="p-4 space-y-3">
                {/* Loading skeletons */}
                {loading && (
                    <>
                        <SkeletonCard />
                        <SkeletonCard />
                        <SkeletonCard />
                        <SkeletonCard />
                    </>
                )}

                {/* Empty state */}
                {!loading && sorted.length === 0 && !error && (
                    <div className="py-16 text-center">
                        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                            <Search size={28} className="text-slate-300" />
                        </div>
                        <p className="text-sm font-bold text-slate-900 mb-1">
                            {properties.length > 0
                                ? 'No properties match your filters'
                                : 'No properties found'}
                        </p>
                        <p className="text-sm text-slate-500 font-medium">
                            {properties.length > 0
                                ? 'Try adjusting your filters or clearing them'
                                : 'Try a different postcode or increase the search radius'}
                        </p>
                        {activeFilterCount > 0 && (
                            <button
                                onClick={handleClearFilters}
                                className="mt-3 text-xs text-indigo-600 font-bold hover:text-indigo-800 transition-colors"
                            >
                                Clear all filters
                            </button>
                        )}
                    </div>
                )}

                {/* Property cards */}
                {!loading &&
                    sorted.map((p, idx) => (
                        <div key={p.uprn}>
                            <PropertyCard
                                property={p}
                                isHighlighted={p.uprn === hoveredId}
                                onMouseEnter={() => setHoveredId(p.uprn)}
                                onMouseLeave={() => setHoveredId(null)}
                                showCompare
                                isCompared={isInCompare(p.uprn)}
                                onToggleCompare={handleToggleCompare}
                            />

                            {/* Tip banner after 2nd card */}
                            {idx === 1 && sorted.length > 2 && (
                                <div className="flex items-center gap-2.5 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 mt-3">
                                    <Lightbulb size={16} className="text-indigo-500 flex-shrink-0" />
                                    <p className="text-xs text-indigo-700 font-medium">
                                        <span className="font-bold">Tip:</span> Select properties using the checkbox to compare them side-by-side.
                                    </p>
                                </div>
                            )}
                        </div>
                    ))}

                {/* Pagination */}
                {totalPages > 1 && !loading && (
                    <div className="flex items-center justify-center gap-2 pt-4 pb-2">
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="text-sm text-slate-600 hover:text-slate-900 font-semibold px-4 py-2 rounded-xl bg-white border border-slate-200 disabled:opacity-40 transition-colors"
                        >
                            ← Prev
                        </button>
                        <span className="text-xs text-slate-500 font-bold px-2">
                            {page} / {totalPages}
                        </span>
                        <button
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="text-sm text-slate-600 hover:text-slate-900 font-semibold px-4 py-2 rounded-xl bg-white border border-slate-200 disabled:opacity-40 transition-colors"
                        >
                            Next →
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
