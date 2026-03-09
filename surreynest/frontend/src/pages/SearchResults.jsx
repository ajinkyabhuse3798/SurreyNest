/**
 * SearchResults v2 — Thin orchestrator for the search results page.
 *
 * Route: /search?postcode=...&radius=...
 *
 * All visual sections are extracted into focused sub-components
 * under components/search/. This file retains state management,
 * fetch, derived data, and the 2-column layout grid.
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import MapView from '../components/MapView'
import { useCompare } from '../hooks/useCompare'
import api from '../services/api'

// ── Utilities ────────────────────────────────────────────────────────────────
import { EPC_ORDER, sortProperties, getPropertyTypes } from '../utils/searchUtils'

// ── Sub-components ───────────────────────────────────────────────────────────
import SearchHeader from '../components/search/SearchHeader'
import FilterBar from '../components/search/FilterBar'
import PropertyList from '../components/search/PropertyList'
import CompareBar from '../components/search/CompareBar'


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
    const [showMap, setShowMap] = useState(false)
    const [sortKey, setSortKey] = useState('distance')
    const [filterType, setFilterType] = useState('')
    const [filterEpc, setFilterEpc] = useState('')
    const [hoveredId, setHoveredId] = useState(null)
    const [showFilters, setShowFilters] = useState(false)

    // Compare
    const navigate = useNavigate()
    const { compareList, addToCompare, removeFromCompare, clearCompare, isInCompare } = useCompare()
    const handleToggleCompare = useCallback((uprn) => {
        isInCompare(uprn) ? removeFromCompare(uprn) : addToCompare(uprn)
    }, [isInCompare, addToCompare, removeFromCompare])

    // ── Redirect if no postcode ──────────────────────────────────────
    useEffect(() => {
        if (!postcode) navigate('/', { replace: true })
    }, [postcode, navigate])

    // ── Fetch ────────────────────────────────────────────────────────
    useEffect(() => {
        if (!postcode) return
        setLoading(true)
        setError(null)
        api
            .get('/api/properties', { params: { postcode, radius, page, per_page: 20 } })
            .then((res) => {
                setProperties(res.data.results || [])
                setTotal(res.data.total || 0)
            })
            .catch((err) => {
                setError(err.response?.data?.detail || 'Search failed. Please try again.')
            })
            .finally(() => setLoading(false))
    }, [postcode, radius, page])

    const totalPages = Math.ceil(total / 20)

    // ── Derived data ─────────────────────────────────────────────────
    const propertyTypes = useMemo(() => getPropertyTypes(properties), [properties])

    const filtered = useMemo(() => {
        let result = properties
        if (filterType) result = result.filter((p) => p.property_type === filterType)
        if (filterEpc) {
            const maxOrder = EPC_ORDER[filterEpc] ?? 99
            result = result.filter((p) => (EPC_ORDER[p.energy_rating] ?? 99) <= maxOrder)
        }
        return result
    }, [properties, filterType, filterEpc])

    const sorted = useMemo(() => sortProperties(filtered, sortKey), [filtered, sortKey])

    const mapCentre = useMemo(() => {
        const first = properties.find((p) => p.lat && p.lng)
        return first ? [first.lat, first.lng] : [51.2362, -0.5704]
    }, [properties])

    const markers = useMemo(
        () => sorted.filter((p) => p.lat && p.lng).map((p) => ({
            id: p.uprn, lat: p.lat, lng: p.lng, label: p.address, score: p.fairness_score,
        })),
        [sorted]
    )

    const activeFilterCount = (filterType ? 1 : 0) + (filterEpc ? 1 : 0)
    const handleClearFilters = useCallback(() => {
        setFilterType('')
        setFilterEpc('')
    }, [])

    // ── Render ───────────────────────────────────────────────────────
    return (
        <main className="min-h-screen bg-[#f8f9fc] font-[Manrope,sans-serif]">
            <Navbar />

            {/* Header */}
            <SearchHeader
                loading={loading}
                sortedCount={sorted.length}
                total={total}
                radius={radius}
                postcode={postcode}
                sortKey={sortKey}
                setSortKey={setSortKey}
                showFilters={showFilters}
                setShowFilters={setShowFilters}
                activeFilterCount={activeFilterCount}
                showMap={showMap}
                setShowMap={setShowMap}
            />

            {/* Filters */}
            {showFilters && (
                <FilterBar
                    propertyTypes={propertyTypes}
                    filterType={filterType}
                    setFilterType={setFilterType}
                    filterEpc={filterEpc}
                    setFilterEpc={setFilterEpc}
                    activeFilterCount={activeFilterCount}
                    onClearFilters={handleClearFilters}
                />
            )}

            {/* Error */}
            {error && (
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="border border-rose-200 bg-rose-50 rounded-2xl px-5 py-4 text-sm text-rose-700 font-medium">
                        {error}
                    </div>
                </div>
            )}

            {/* Two-column split layout */}
            <div className="mx-auto flex flex-col md:flex-row md:h-[calc(100vh-64px-53px)]">
                {/* Left: Property list */}
                <PropertyList
                    loading={loading}
                    sorted={sorted}
                    error={error}
                    properties={properties}
                    hoveredId={hoveredId}
                    setHoveredId={setHoveredId}
                    isInCompare={isInCompare}
                    handleToggleCompare={handleToggleCompare}
                    activeFilterCount={activeFilterCount}
                    handleClearFilters={handleClearFilters}
                    page={page}
                    setPage={setPage}
                    totalPages={totalPages}
                    sortKey={sortKey}
                    setSortKey={setSortKey}
                    showFilters={showFilters}
                    setShowFilters={setShowFilters}
                    showMap={showMap}
                />

                {/* Right: Map */}
                <div className={`${showMap ? 'block' : 'hidden'} md:block md:w-[60%] md:sticky md:top-16 h-[60vh] md:h-auto`}>
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

            {/* Floating compare bar */}
            <CompareBar compareList={compareList} clearCompare={clearCompare} />
        </main>
    )
}
