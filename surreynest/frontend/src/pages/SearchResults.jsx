/**
 * SearchResults page — Stitch-inspired split layout with property list + map.
 *
 * Features (all preserved from original):
 *   - Sort by distance, rooms, floor area, EPC
 *   - Filter by property type and EPC rating
 *   - Bidirectional hover highlighting (card ↔ map marker)
 *   - Skeleton loading placeholders
 *   - Radius circle overlay on map
 *   - Mobile map/list tab toggle
 *   - Floating compare bar
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
    Search, SlidersHorizontal, MapPin, List, Map as MapIcon, X,
    ArrowLeftRight, ChevronDown, Lightbulb, ArrowRight,
} from 'lucide-react'
import Navbar from '../components/Navbar'
import PropertyCard from '../components/PropertyCard'
import MapView from '../components/MapView'
import { useCompare } from '../hooks/useCompare'
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
        <div className="bg-white rounded-2xl border border-slate-100 p-5 animate-pulse shadow-sm">
            <div className="flex gap-2 mb-3">
                <div className="h-5 bg-slate-100 rounded-full w-14" />
                <div className="h-5 bg-slate-100 rounded-full w-14" />
            </div>
            <div className="h-4 bg-slate-100 rounded-lg w-3/4 mb-2" />
            <div className="h-3 bg-slate-100 rounded-lg w-1/2 mb-4" />
            <div className="h-px bg-slate-100 mb-3" />
            <div className="flex gap-2 mb-4">
                <div className="h-7 bg-slate-100 rounded-lg w-24" />
                <div className="h-7 bg-slate-100 rounded-lg w-20" />
                <div className="h-7 bg-slate-100 rounded-lg w-24" />
            </div>
            <div className="h-px bg-slate-100 mb-3" />
            <div className="flex justify-between">
                <div className="h-3 bg-slate-100 rounded-lg w-32" />
                <div className="h-3 bg-slate-100 rounded-lg w-20" />
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

    // Compare
    const navigate = useNavigate()
    const { compareList, addToCompare, removeFromCompare, clearCompare, isInCompare } = useCompare()
    const handleToggleCompare = useCallback((uprn) => {
        isInCompare(uprn) ? removeFromCompare(uprn) : addToCompare(uprn)
    }, [isInCompare, addToCompare, removeFromCompare])

    // ── Redirect if no postcode ───────────────────────────────────────
    useEffect(() => {
        if (!postcode) {
            navigate('/', { replace: true })
        }
    }, [postcode, navigate])

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
        <main className="min-h-screen bg-[#f8f9fc] font-[Manrope,sans-serif]">
            <Navbar />

            {/* ── Search summary header ─────────────────────────────────── */}
            <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-lg border-b border-slate-200 px-4 py-3">
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
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
                                    <span className="font-extrabold text-slate-900">{sorted.length}</span>
                                    {sorted.length !== total && (
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
                                    <option key={o.value} value={o.value}>
                                        {o.label}
                                    </option>
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

            {/* ── Filter bar (collapsible) ────────────────────────────────── */}
            {showFilters && (
                <div className="border-b border-slate-100 bg-slate-50/80 backdrop-blur-sm px-4 py-3">
                    <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-3">
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
                                onClick={handleClearFilters}
                                className="flex items-center gap-1 text-xs text-rose-500 font-bold hover:text-rose-700 transition-colors"
                            >
                                <X size={12} />
                                Clear all
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* ── Error ───────────────────────────────────────────────────── */}
            {error && (
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="border border-rose-200 bg-rose-50 rounded-2xl px-5 py-4 text-sm text-rose-700 font-medium">
                        {error}
                    </div>
                </div>
            )}

            {/* ── Two-column split layout ──────────────────────────────────── */}
            <div className="max-w-7xl mx-auto md:flex md:h-[calc(100vh-64px-53px)]">
                {/* ── Left: Property list ──────────────────────────────────── */}
                <div
                    className={`${showMap ? 'hidden md:block' : ''
                        } md:w-5/12 lg:w-[42%] md:overflow-y-auto md:border-r md:border-slate-200 bg-[#f8f9fc]`}
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

                {/* ── Right: Map ───────────────────────────────────────────── */}
                <div
                    className={`${showMap ? 'block' : 'hidden'
                        } md:block md:w-7/12 lg:w-[58%] md:sticky md:top-16 h-[60vh] md:h-auto`}
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

            {/* ── Floating compare bar ──────────────────────────────── */}
            {compareList.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200 shadow-[0_-4px_24px_-4px_rgba(0,0,0,0.1)] px-4 py-3">
                    <div className="max-w-7xl mx-auto flex items-center justify-between">
                        <div className="flex items-center gap-2.5 text-sm text-slate-700 font-medium">
                            <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center">
                                <ArrowLeftRight size={14} className="text-indigo-600" />
                            </div>
                            <span>
                                <span className="font-extrabold text-slate-900">{compareList.length}</span>{' '}
                                propert{compareList.length === 1 ? 'y' : 'ies'} selected
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => clearCompare()}
                                className="text-xs text-slate-400 hover:text-rose-500 font-semibold px-3 py-2 transition-colors"
                            >
                                Clear selection
                            </button>
                            <button
                                onClick={() => navigate(`/compare?uprns=${compareList.join(',')}`)}
                                disabled={compareList.length < 2}
                                className="bg-indigo-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-1.5"
                            >
                                Compare Now
                                <ArrowRight size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    )
}
