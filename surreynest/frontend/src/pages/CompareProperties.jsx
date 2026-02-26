/**
 * CompareProperties — side-by-side property comparison page.
 *
 * Reads UPRNs from CompareContext (or ?uprns= URL params as fallback).
 * Parallel-fetches PropertyDetail for each, displays:
 *   - Radar chart overlay (custom SVG, 5 axes)
 *   - Comparison table: 9 attributes with best/worst highlighting
 *   - Remove property + Add property (search modal)
 *   - Mobile: horizontal scroll with sticky first column
 *   - Empty state: "Add at least 2 properties to compare"
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
    ArrowLeftRight, Plus, X, Search, ArrowLeft,
    PoundSterling, Shield, Bed, Ruler, Zap, Home,
    GraduationCap, MapPin, CheckCircle2, AlertTriangle,
} from 'lucide-react'
import Navbar from '../components/Navbar'
import RadarChart from '../components/RadarChart'
import { useCompare } from '../hooks/useCompare'
import api from '../services/api'

// ── constants ────────────────────────────────────────────────────────────────

const UNI_LAT = 51.2430, UNI_LNG = -0.5890
const EPC_SCORE = { A: 100, B: 86, C: 71, D: 57, E: 43, F: 29, G: 14 }

function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function distToUni(p) {
    if (!p.lat || !p.lng) return null
    return haversine(p.lat, p.lng, UNI_LAT, UNI_LNG)
}

function shortAddress(addr) {
    return addr?.split(',')[0] || 'Unknown'
}

// ── attribute definitions ────────────────────────────────────────────────────

const EPC_ORDER = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7 }

const ATTRIBUTES = [
    {
        key: 'rent', label: 'Rent (weekly)', icon: PoundSterling,
        extract: (p) => p.rent_prediction?.predicted_weekly_rent,
        format: (v) => v != null ? `£${Math.round(v)}` : '—',
        best: 'lowest',
    },
    {
        key: 'safety', label: 'Safety score', icon: Shield,
        extract: (p) => p.safety_score,
        format: (v) => v != null ? `${Math.round(v)}/100` : '—',
        best: 'highest',
    },
    {
        key: 'rooms', label: 'Bedrooms', icon: Bed,
        extract: (p) => p.num_rooms,
        format: (v) => v ?? '—',
        best: 'highest',
    },
    {
        key: 'area', label: 'Floor area', icon: Ruler,
        extract: (p) => p.floor_area_m2,
        format: (v) => v ? `${v} m²` : '—',
        best: 'highest',
    },
    {
        key: 'epc', label: 'Energy rating', icon: Zap,
        extract: (p) => p.energy_rating,
        format: (v) => v || '—',
        best: 'epc',
    },
    {
        key: 'hmo', label: 'HMO status', icon: Home,
        extract: (p) => p.hmo,
        format: (v) => {
            if (!v) return '—'
            if (v.is_hmo && v.is_active) return 'Licensed ✓'
            if (v.is_hmo && !v.is_active) return 'Expired ⚠'
            return 'Not found'
        },
        best: 'hmo',
    },
    {
        key: 'type', label: 'Property type', icon: Home,
        extract: (p) => p.property_type,
        format: (v) => v || '—',
        best: null,
    },
    {
        key: 'postcode', label: 'Postcode', icon: MapPin,
        extract: (p) => p.postcode,
        format: (v) => v || '—',
        best: null,
    },
    {
        key: 'distance', label: 'Distance to uni', icon: GraduationCap,
        extract: (p) => distToUni(p),
        format: (v) => v != null ? `${v.toFixed(1)} km` : '—',
        best: 'lowest',
    },
]

function findBest(values, bestType) {
    const valid = values.map((v, i) => ({ v, i })).filter(({ v }) => v != null)
    if (valid.length < 2) return { bestIdx: -1, worstIdx: -1 }

    if (bestType === 'highest') {
        const sorted = [...valid].sort((a, b) => b.v - a.v)
        return { bestIdx: sorted[0].i, worstIdx: sorted[sorted.length - 1].i }
    }
    if (bestType === 'lowest') {
        const sorted = [...valid].sort((a, b) => a.v - b.v)
        return { bestIdx: sorted[0].i, worstIdx: sorted[sorted.length - 1].i }
    }
    if (bestType === 'epc') {
        const scored = valid.map(({ v, i }) => ({ v: EPC_ORDER[v?.toUpperCase()] ?? 99, i }))
        const sorted = [...scored].sort((a, b) => a.v - b.v)
        return { bestIdx: sorted[0].i, worstIdx: sorted[sorted.length - 1].i }
    }
    if (bestType === 'hmo') {
        const scores = values.map((v) => {
            if (v?.is_hmo && v?.is_active) return 2
            if (v?.is_hmo) return 1
            return 0
        })
        const max = Math.max(...scores)
        const min = Math.min(...scores)
        if (max === min) return { bestIdx: -1, worstIdx: -1 }
        return { bestIdx: scores.indexOf(max), worstIdx: scores.indexOf(min) }
    }
    return { bestIdx: -1, worstIdx: -1 }
}

// ── search modal ─────────────────────────────────────────────────────────────

function SearchModal({ onSelect, onClose, existingUprns }) {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState([])
    const [searching, setSearching] = useState(false)

    const doSearch = useCallback(async () => {
        if (!query.trim()) return
        setSearching(true)
        try {
            const res = await api.get('/api/properties', {
                params: { postcode: query.trim(), radius: 2000, per_page: 20 }
            })
            setResults(res.data.results || [])
        } catch {
            setResults([])
        } finally {
            setSearching(false)
        }
    }, [query])

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col animate-[fadeIn_150ms_ease-out]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-900">Add a property</h3>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600"><X size={16} /></button>
                </div>

                <div className="px-4 py-3 border-b border-gray-100">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && doSearch()}
                            placeholder="Enter postcode (e.g. GU2 7XH)"
                            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            autoFocus
                        />
                        <button
                            onClick={doSearch}
                            disabled={searching}
                            className="bg-indigo-600 text-white rounded-lg px-3 py-2 text-sm hover:bg-indigo-700 disabled:opacity-50"
                        >
                            <Search size={16} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-2">
                    {searching && (
                        <div className="text-center py-8">
                            <div className="inline-block w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                    )}
                    {!searching && results.length === 0 && query && (
                        <p className="text-xs text-gray-400 text-center py-8">No properties found. Try a different postcode.</p>
                    )}
                    {results.map((p) => {
                        const already = existingUprns.includes(p.uprn)
                        return (
                            <button
                                key={p.uprn}
                                onClick={() => !already && onSelect(p.uprn)}
                                disabled={already}
                                className={`w-full text-left p-3 rounded-lg mb-1 transition-colors ${already
                                        ? 'bg-gray-50 opacity-50 cursor-not-allowed'
                                        : 'hover:bg-indigo-50 cursor-pointer'
                                    }`}
                            >
                                <p className="text-sm font-medium text-gray-900 truncate">{p.address}</p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    {p.postcode} · {p.property_type || 'Property'} · {p.num_rooms || '?'} bed
                                    {already && <span className="ml-2 text-indigo-500 font-medium">Already added</span>}
                                </p>
                            </button>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

// ── main component ───────────────────────────────────────────────────────────

export default function CompareProperties() {
    const [searchParams, setSearchParams] = useSearchParams()
    const { compareList, addToCompare, removeFromCompare, clearCompare } = useCompare()

    const [properties, setProperties] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [showModal, setShowModal] = useState(false)

    // Seed context from URL params on first mount (for shared links)
    useEffect(() => {
        const urlUprns = searchParams.get('uprns')?.split(',').filter(Boolean) || []
        if (urlUprns.length > 0 && compareList.length === 0) {
            urlUprns.forEach((u) => addToCompare(u))
        }
    }, [])

    // Fetch property data whenever compareList changes
    useEffect(() => {
        if (compareList.length === 0) {
            setProperties([])
            setLoading(false)
            return
        }

        setLoading(true)
        setError(null)
        Promise.all(compareList.map((uprn) => api.get(`/api/properties/${uprn}`).then(r => r.data).catch(() => null)))
            .then((data) => {
                const valid = data.filter(Boolean)
                setProperties(valid)
                // Sync URL
                setSearchParams({ uprns: valid.map(p => p.uprn).join(',') }, { replace: true })
            })
            .catch(() => setError('Failed to load properties'))
            .finally(() => setLoading(false))
    }, [compareList])

    // Handle add from modal
    const handleAddProperty = useCallback((uprn) => {
        addToCompare(uprn)
        setShowModal(false)
    }, [addToCompare])

    // Handle remove
    const handleRemove = useCallback((uprn) => {
        removeFromCompare(uprn)
    }, [removeFromCompare])

    // ── Radar chart data ─────────────────────────────────────────────
    const radarData = useMemo(() => {
        if (properties.length < 2) return []

        // Normalise: find min/max for rent, area, rooms across properties
        const rents = properties.map(p => p.rent_prediction?.predicted_weekly_rent).filter(v => v != null)
        const areas = properties.map(p => p.floor_area_m2).filter(v => v != null)
        const rooms = properties.map(p => p.num_rooms).filter(v => v != null)
        const maxRent = Math.max(...rents, 1)
        const maxArea = Math.max(...areas, 1)
        const maxRooms = Math.max(...rooms, 1)

        return properties.map((p) => ({
            label: shortAddress(p.address),
            values: [
                p.safety_score ?? 0,                                             // Safety (already 0-100)
                rents.length > 0 ? 100 - ((p.rent_prediction?.predicted_weekly_rent ?? maxRent) / maxRent * 100) + 10 : 50, // Value (inverted: lower rent = higher score)
                (p.floor_area_m2 ?? 0) / maxArea * 100,                          // Size
                EPC_SCORE[p.energy_rating?.toUpperCase()] ?? 50,                 // Energy
                (p.num_rooms ?? 0) / maxRooms * 100,                             // Rooms
            ],
        }))
    }, [properties])

    // ── Loading ──────────────────────────────────────────────────────
    if (loading && properties.length === 0) {
        return (
            <main className="min-h-screen bg-white">
                <Navbar />
                <div className="max-w-5xl mx-auto px-4 py-12 text-center">
                    <div className="inline-block w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-gray-400 mt-3">Loading properties…</p>
                </div>
            </main>
        )
    }

    // ── Empty state ──────────────────────────────────────────────────
    if (!loading && properties.length < 2) {
        return (
            <main className="min-h-screen bg-white">
                <Navbar />
                <div className="max-w-5xl mx-auto px-4 py-12">
                    <div className="text-center max-w-md mx-auto">
                        <ArrowLeftRight size={40} className="mx-auto text-indigo-300 mb-4" />
                        <h1 className="text-xl font-semibold text-gray-900 mb-2">Compare Properties</h1>
                        <p className="text-sm text-gray-500 mb-6">
                            Add at least 2 properties to compare side by side.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <Link
                                to="/search"
                                className="inline-flex items-center justify-center gap-2 bg-indigo-600 text-white text-sm px-5 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors"
                            >
                                <Search size={16} /> Search Properties
                            </Link>
                            <button
                                onClick={() => setShowModal(true)}
                                className="inline-flex items-center justify-center gap-2 border border-gray-200 text-gray-700 text-sm px-5 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                <Plus size={16} /> Add Property
                            </button>
                        </div>

                        {/* Show any already-added property */}
                        {properties.length === 1 && (
                            <div className="mt-6 bg-gray-50 rounded-xl p-4 text-left">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">{properties[0].address}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">{properties[0].postcode} · {properties[0].property_type}</p>
                                    </div>
                                    <button onClick={() => handleRemove(properties[0].uprn)} className="p-1 text-gray-400 hover:text-red-500">
                                        <X size={16} />
                                    </button>
                                </div>
                                <p className="text-xs text-gray-400 mt-2">Add one more property to start comparing.</p>
                            </div>
                        )}
                    </div>
                </div>

                {showModal && (
                    <SearchModal
                        onSelect={handleAddProperty}
                        onClose={() => setShowModal(false)}
                        existingUprns={compareList}
                    />
                )}
            </main>
        )
    }

    // ── Main comparison view ─────────────────────────────────────────
    return (
        <main className="min-h-screen bg-white pb-16">
            <Navbar />

            <div className="max-w-5xl mx-auto px-4 py-6 md:py-10">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <Link to="/search" className="text-xs text-gray-400 hover:text-gray-700 inline-flex items-center gap-1 mb-1">
                            <ArrowLeft size={12} /> Back to Search
                        </Link>
                        <h1 className="text-xl font-semibold text-gray-900 md:text-2xl flex items-center gap-2">
                            <ArrowLeftRight size={20} className="text-indigo-600" />
                            Compare Properties
                        </h1>
                    </div>
                    <button
                        onClick={() => { clearCompare(); setProperties([]) }}
                        className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                    >
                        Clear all
                    </button>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600 mb-6">{error}</div>
                )}

                {/* ── Radar chart ──────────────────────────────────── */}
                {radarData.length >= 2 && (
                    <div className="mb-8 bg-gray-50 rounded-2xl p-6">
                        <h2 className="text-sm font-semibold text-gray-700 mb-4 text-center">Visual comparison</h2>
                        <RadarChart properties={radarData} />
                    </div>
                )}

                {/* ── Comparison table ─────────────────────────────── */}
                <div className="overflow-x-auto -mx-4 px-4">
                    <table className="w-full text-sm min-w-[600px]">
                        {/* Header: property columns */}
                        <thead>
                            <tr className="border-b-2 border-gray-100">
                                <th className="sticky left-0 bg-white z-10 text-left py-4 pr-4 text-xs font-semibold text-gray-400 uppercase tracking-wider w-[140px] min-w-[140px]">
                                    Feature
                                </th>
                                {properties.map((p) => (
                                    <th key={p.uprn} className="text-left py-4 px-4 min-w-[180px]">
                                        <Link
                                            to={`/property/${p.uprn}`}
                                            className="text-sm font-semibold text-indigo-600 hover:text-indigo-800"
                                        >
                                            {shortAddress(p.address)}
                                        </Link>
                                        <p className="text-[10px] text-gray-400 mt-0.5 font-normal">{p.postcode}</p>
                                        <button
                                            onClick={() => handleRemove(p.uprn)}
                                            className="mt-1 text-[10px] text-gray-400 hover:text-red-500 flex items-center gap-0.5 font-normal"
                                        >
                                            <X size={10} /> Remove
                                        </button>
                                    </th>
                                ))}
                                {/* Add column */}
                                {properties.length < 4 && (
                                    <th className="text-center py-4 px-4 min-w-[120px]">
                                        <button
                                            onClick={() => setShowModal(true)}
                                            className="inline-flex flex-col items-center gap-1 text-gray-400 hover:text-indigo-600 transition-colors group"
                                        >
                                            <span className="w-10 h-10 rounded-full border-2 border-dashed border-gray-300 group-hover:border-indigo-400 flex items-center justify-center transition-colors">
                                                <Plus size={16} />
                                            </span>
                                            <span className="text-[10px] font-medium">Add property</span>
                                        </button>
                                    </th>
                                )}
                            </tr>
                        </thead>

                        {/* Body: attribute rows */}
                        <tbody className="divide-y divide-gray-50">
                            {ATTRIBUTES.map((attr) => {
                                const values = properties.map(attr.extract)
                                const { bestIdx, worstIdx } = attr.best ? findBest(values, attr.best) : { bestIdx: -1, worstIdx: -1 }

                                return (
                                    <tr key={attr.key} className="group hover:bg-gray-50/50">
                                        <td className="sticky left-0 bg-white group-hover:bg-gray-50/50 z-10 py-3 pr-4 transition-colors">
                                            <span className="flex items-center gap-2 text-xs font-medium text-gray-600">
                                                <attr.icon size={13} className="text-gray-400" />
                                                {attr.label}
                                            </span>
                                        </td>
                                        {properties.map((p, i) => {
                                            const val = values[i]
                                            const formatted = attr.format(val)
                                            const isBest = i === bestIdx && bestIdx !== worstIdx
                                            const isWorst = i === worstIdx && bestIdx !== worstIdx

                                            return (
                                                <td
                                                    key={p.uprn}
                                                    className={`py-3 px-4 text-sm transition-colors ${isBest
                                                            ? 'bg-green-50 text-green-700 font-semibold rounded-lg'
                                                            : isWorst
                                                                ? 'bg-red-50/50 text-red-400'
                                                                : 'text-gray-700'
                                                        }`}
                                                >
                                                    {formatted}
                                                    {isBest && <span className="ml-1 text-[10px]">✓</span>}
                                                </td>
                                            )
                                        })}
                                        {properties.length < 4 && <td />}
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Search modal */}
            {showModal && (
                <SearchModal
                    onSelect={handleAddProperty}
                    onClose={() => setShowModal(false)}
                    existingUprns={compareList}
                />
            )}
        </main>
    )
}
