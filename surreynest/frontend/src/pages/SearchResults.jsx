/**
 * SearchResults page — split layout with sortable/filterable property list + map.
 *
 * Features:
 *   - Sort by distance, rooms, floor area, EPC
 *   - Filter by property type and EPC rating
 *   - Bidirectional hover highlighting (card ↔ map marker)
 *   - Skeleton loading placeholders
 *   - Radius circle overlay on map
 *   - Mobile map/list tab toggle
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, SlidersHorizontal, MapPin, List, Map as MapIcon, X } from 'lucide-react'
import Navbar from '../components/Navbar'
import PropertyCard from '../components/PropertyCard'
import MapView from '../components/MapView'
import api from '../services/api'

// ── EPC sort order ───────────────────────────────────────────────────────────
const EPC_ORDER = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7 }

// ── Sort functions ───────────────────────────────────────────────────────────
const SORT_OPTIONS = [
    { value: 'distance', label: 'Nearest first' },
    { value: 'rooms', label: 'Most rooms' },
    { value: 'area', label: 'Largest' },
    { value: 'epc', label: 'Best EPC' },
]

function sortProperties(list, sortKey) {
    const sorted = [...list]
    switch (sortKey) {
        case 'distance':
            return sorted.sort((a, b) => (a.distance_m ?? Infinity) - (b.distance_m ?? Infinity))
        case 'rooms':
            return sorted.sort((a, b) => (b.num_rooms ?? 0) - (a.num_rooms ?? 0))
        case 'area':
            return sorted.sort((a, b) => (b.floor_area_m2 ?? 0) - (a.floor_area_m2 ?? 0))
        case 'epc':
            return sorted.sort(
                (a, b) => (EPC_ORDER[a.energy_rating] ?? 99) - (EPC_ORDER[b.energy_rating] ?? 99)
            )
        default:
            return sorted
    }
}

// ── Skeleton card ────────────────────────────────────────────────────────────
function SkeletonCard() {
    return (
        <div className="border border-gray-100 rounded-xl p-4 animate-pulse">
            <div className="h-4 bg-gray-100 rounded w-3/4 mb-2" />
            <div className="h-3 bg-gray-100 rounded w-1/2 mb-4" />
            <div className="border-t border-gray-50 pt-3 flex gap-3">
                <div className="h-3 bg-gray-100 rounded w-16" />
                <div className="h-3 bg-gray-100 rounded w-16" />
            </div>
            <div className="border-t border-gray-50 mt-3 pt-3 flex justify-between">
                <div className="h-3 bg-gray-100 rounded w-32" />
                <div className="h-3 bg-gray-100 rounded w-12" />
            </div>
        </div>
    )
}

// ── Radius label helper ──────────────────────────────────────────────────────
function formatRadius(m) {
    if (m < 1000) return `${m}m`
    return `${(m / 1000).toFixed(m % 1000 === 0 ? 0 : 1)}km`
}

// ── Property type extraction ─────────────────────────────────────────────────
function getPropertyTypes(properties) {
    const types = new Set()
    properties.forEach((p) => {
        if (p.property_type) types.add(p.property_type)
    })
    return Array.from(types).sort()
}

// ── Main component ───────────────────────────────────────────────────────────
export default function SearchResults() {
    const [searchParams] = useSearchParams()
    const postcode = searchParams.get('postcode') || ''
    const radius = Number(searchParams.get('radius')) || 1000
    const pageParam = Number(searchParams.get('page')) || 1

    const [properties, setProperties] = useState([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(pageParam)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    // UI state
    const [showMap, setShowMap] = useState(false) // mobile toggle
    const [sortKey, setSortKey] = useState('distance')
    const [filterType, setFilterType] = useState('') // property type filter
    const [filterEpc, setFilterEpc] = useState('') // min EPC filter
    const [hoveredId, setHoveredId] = useState(null)
    const [showFilters, setShowFilters] = useState(false)

    // ── Fetch ────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!postcode) return
        setLoading(true)
        setError(null)
        api
            .get('/api/properties', {
                params: { postcode, radius, page, per_page: 20 },
            })
            .then((res) => {
                setProperties(res.data.results || [])
                setTotal(res.data.total || 0)
            })
            .catch((err) => {
                setError(
                    err.response?.data?.detail || 'Search failed. Please try again.'
                )
            })
            .finally(() => setLoading(false))
    }, [postcode, radius, page])

    const totalPages = Math.ceil(total / 20)

    // ── Derived data ─────────────────────────────────────────────────────
    const propertyTypes = useMemo(() => getPropertyTypes(properties), [properties])

    const filtered = useMemo(() => {
        let result = properties
        if (filterType) {
            result = result.filter((p) => p.property_type === filterType)
        }
        if (filterEpc) {
            const maxOrder = EPC_ORDER[filterEpc] ?? 99
            result = result.filter((p) => (EPC_ORDER[p.energy_rating] ?? 99) <= maxOrder)
        }
        return result
    }, [properties, filterType, filterEpc])

    const sorted = useMemo(() => sortProperties(filtered, sortKey), [filtered, sortKey])

    // Map centre from first result or fallback
    const mapCentre = useMemo(() => {
        const first = properties.find((p) => p.lat && p.lng)
        return first ? [first.lat, first.lng] : [51.2362, -0.5704]
    }, [properties])

    const markers = useMemo(
        () =>
            sorted
                .filter((p) => p.lat && p.lng)
                .map((p) => ({
                    id: p.uprn,
                    lat: p.lat,
                    lng: p.lng,
                    label: p.address,
                    score: p.fairness_score,
                })),
        [sorted]
    )

    const activeFilterCount = (filterType ? 1 : 0) + (filterEpc ? 1 : 0)

    const handleClearFilters = useCallback(() => {
        setFilterType('')
        setFilterEpc('')
    }, [])

    return (
        <main className="min-h-screen bg-white">
            <Navbar />

            {/* ── Search summary + controls ───────────────────────────────── */}
            <div className="border-b border-gray-200 px-4 py-3">
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                        <MapPin size={14} className="text-indigo-600 flex-shrink-0" />
                        <p className="text-sm text-gray-700 truncate">
                            {loading ? (
                                'Searching...'
                            ) : (
                                <>
                                    <span className="font-semibold">{sorted.length}</span>
                                    {sorted.length !== total && (
                                        <span className="text-gray-400"> of {total}</span>
                                    )}{' '}
                                    properties within{' '}
                                    <span className="font-medium">{formatRadius(radius)}</span> of{' '}
                                    <span className="font-medium">{postcode.toUpperCase()}</span>
                                </>
                            )}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Sort */}
                        <select
                            value={sortKey}
                            onChange={(e) => setSortKey(e.target.value)}
                            className="hidden sm:block border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-indigo-500"
                        >
                            {SORT_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                    {o.label}
                                </option>
                            ))}
                        </select>

                        {/* Filter toggle */}
                        <button
                            onClick={() => setShowFilters((s) => !s)}
                            className={`hidden sm:flex items-center gap-1.5 border rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${showFilters || activeFilterCount > 0
                                    ? 'border-indigo-200 text-indigo-600 bg-indigo-50'
                                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                                }`}
                        >
                            <SlidersHorizontal size={12} />
                            Filters
                            {activeFilterCount > 0 && (
                                <span className="bg-indigo-600 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                                    {activeFilterCount}
                                </span>
                            )}
                        </button>

                        {/* Mobile map/list toggle */}
                        <div className="flex md:hidden border border-gray-200 rounded-lg overflow-hidden">
                            <button
                                onClick={() => setShowMap(false)}
                                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium ${!showMap ? 'bg-indigo-600 text-white' : 'text-gray-600'
                                    }`}
                            >
                                <List size={12} />
                                List
                            </button>
                            <button
                                onClick={() => setShowMap(true)}
                                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium ${showMap ? 'bg-indigo-600 text-white' : 'text-gray-600'
                                    }`}
                            >
                                <MapIcon size={12} />
                                Map
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Filter bar (collapsible) ────────────────────────────────── */}
            {showFilters && (
                <div className="border-b border-gray-100 bg-gray-50/50 px-4 py-3">
                    <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-3">
                        <span className="text-xs text-gray-500 font-medium">Filter by:</span>

                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs bg-white focus:outline-none focus:border-indigo-500"
                        >
                            <option value="">All types</option>
                            {propertyTypes.map((t) => (
                                <option key={t} value={t}>
                                    {t}
                                </option>
                            ))}
                        </select>

                        <select
                            value={filterEpc}
                            onChange={(e) => setFilterEpc(e.target.value)}
                            className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs bg-white focus:outline-none focus:border-indigo-500"
                        >
                            <option value="">Any EPC</option>
                            {['A', 'B', 'C', 'D', 'E'].map((r) => (
                                <option key={r} value={r}>
                                    EPC {r} or better
                                </option>
                            ))}
                        </select>

                        {activeFilterCount > 0 && (
                            <button
                                onClick={handleClearFilters}
                                className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
                            >
                                <X size={12} />
                                Clear
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* ── Error ───────────────────────────────────────────────────── */}
            {error && (
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="border border-red-200 bg-red-50 rounded-lg px-4 py-3 text-sm text-red-700">
                        {error}
                    </div>
                </div>
            )}

            {/* ── Two-column layout ───────────────────────────────────────── */}
            <div className="max-w-7xl mx-auto md:flex md:h-[calc(100vh-64px-49px)]">
                {/* ── Property list ────────────────────────────────────────── */}
                <div
                    className={`${showMap ? 'hidden md:block' : ''
                        } md:w-5/12 md:overflow-y-auto md:border-r md:border-gray-200`}
                >
                    {/* Mobile sort (visible on mobile only) */}
                    <div className="sm:hidden border-b border-gray-100 px-4 py-2 flex items-center gap-2">
                        <select
                            value={sortKey}
                            onChange={(e) => setSortKey(e.target.value)}
                            className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-600"
                        >
                            {SORT_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                    {o.label}
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={() => setShowFilters((s) => !s)}
                            className="flex items-center gap-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-600"
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
                                <Search size={40} className="mx-auto text-gray-200 mb-3" />
                                <p className="text-sm font-medium text-gray-900 mb-1">
                                    {properties.length > 0
                                        ? 'No properties match your filters'
                                        : 'No properties found'}
                                </p>
                                <p className="text-sm text-gray-500">
                                    {properties.length > 0
                                        ? 'Try adjusting your filters or clearing them'
                                        : 'Try a different postcode or increase the search radius'}
                                </p>
                                {activeFilterCount > 0 && (
                                    <button
                                        onClick={handleClearFilters}
                                        className="mt-3 text-xs text-indigo-600 font-medium hover:text-indigo-800"
                                    >
                                        Clear all filters
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Property cards */}
                        {!loading &&
                            sorted.map((p) => (
                                <PropertyCard
                                    key={p.uprn}
                                    property={p}
                                    isHighlighted={p.uprn === hoveredId}
                                    onMouseEnter={() => setHoveredId(p.uprn)}
                                    onMouseLeave={() => setHoveredId(null)}
                                />
                            ))}

                        {/* Pagination */}
                        {totalPages > 1 && !loading && (
                            <div className="flex items-center justify-center gap-2 pt-4 pb-2">
                                <button
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="text-sm text-gray-600 hover:text-gray-900 px-3 py-2 disabled:opacity-50"
                                >
                                    ← Prev
                                </button>
                                <span className="text-xs text-gray-500">
                                    Page {page} of {totalPages}
                                </span>
                                <button
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="text-sm text-gray-600 hover:text-gray-900 px-3 py-2 disabled:opacity-50"
                                >
                                    Next →
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Map ──────────────────────────────────────────────────── */}
                <div
                    className={`${showMap ? 'block' : 'hidden'
                        } md:block md:w-7/12 md:sticky md:top-16 h-[50vh] md:h-auto`}
                >
                    <MapView
                        markers={markers}
                        centre={mapCentre}
                        fitBounds
                        selectedId={hoveredId}
                        onMarkerClick={(id) => setHoveredId(id)}
                        radiusCircle={
                            mapCentre[0] !== 51.2362
                                ? { lat: mapCentre[0], lng: mapCentre[1], radiusM: radius }
                                : undefined
                        }
                    />
                </div>
            </div>
        </main>
    )
}
