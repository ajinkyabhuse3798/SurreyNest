/**
 * SearchResults page — two-panel layout: property list + Leaflet map.
 * Per design-system.md: mobile stacked, desktop side-by-side (45/55 split).
 */
import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import Navbar from '../components/Navbar'
import PropertyCard from '../components/PropertyCard'
import MapView from '../components/MapView'
import api from '../services/api'

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
    const [showMap, setShowMap] = useState(false)

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

    // Compute map centre from results or fallback to Guildford
    const mapCentre =
        properties.length > 0 && properties[0].lat && properties[0].lng
            ? [properties[0].lat, properties[0].lng]
            : [51.2362, -0.5704]

    return (
        <main className="min-h-screen bg-white">
            <Navbar />

            {/* Search summary */}
            <div className="border-b border-gray-200 px-4 py-3">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <p className="text-sm text-gray-700">
                        {loading ? 'Searching...' : `${total} properties near `}
                        <span className="font-medium">{postcode.toUpperCase()}</span>
                    </p>
                    {/* Mobile map toggle */}
                    <button
                        onClick={() => setShowMap((s) => !s)}
                        className="md:hidden text-sm text-indigo-600 font-medium"
                    >
                        {showMap ? 'Show list' : 'Show map'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="max-w-6xl mx-auto px-4 py-4">
                    <div className="border border-red-200 bg-red-50 rounded-lg px-4 py-3 text-sm text-red-700">
                        {error}
                    </div>
                </div>
            )}

            {/* Two-column layout */}
            <div className="max-w-6xl mx-auto md:flex md:h-[calc(100vh-64px-49px)]">
                {/* Property list */}
                <div
                    className={`${showMap ? 'hidden md:block' : ''} md:w-5/12 md:overflow-y-auto md:border-r md:border-gray-200`}
                >
                    <div className="p-4 space-y-3">
                        {loading && (
                            <p className="text-sm text-gray-400 text-center py-12">
                                Loading properties...
                            </p>
                        )}

                        {!loading && properties.length === 0 && !error && (
                            <div className="py-16 text-center">
                                <p className="text-sm font-medium text-gray-900 mb-1">
                                    No properties found
                                </p>
                                <p className="text-sm text-gray-500">
                                    Try a different postcode or increase the search radius
                                </p>
                            </div>
                        )}

                        {properties.map((p) => (
                            <PropertyCard key={p.uprn} property={p} />
                        ))}

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-2 pt-4">
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

                {/* Map — hidden on mobile by default, shown via toggle */}
                <div
                    className={`${showMap ? 'block' : 'hidden'} md:block md:w-7/12 md:sticky md:top-16 h-[50vh] md:h-auto`}
                >
                    <MapView properties={properties} centre={mapCentre} />
                </div>
            </div>
        </main>
    )
}
