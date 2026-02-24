/**
 * CompareProperties — side-by-side property comparison.
 * Users select 2-3 properties to compare key metrics.
 */
import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import api from '../services/api'

export default function CompareProperties() {
    const [searchParams] = useSearchParams()
    const [properties, setProperties] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    // Read UPRNs from ?uprns=123,456,789
    const uprns = searchParams.get('uprns')?.split(',').filter(Boolean) || []

    useEffect(() => {
        if (uprns.length === 0) {
            setLoading(false)
            return
        }

        async function fetchProperties() {
            setLoading(true)
            try {
                const responses = await Promise.all(
                    uprns.map((uprn) => api.get(`/api/properties/${uprn}`))
                )
                setProperties(responses.map((r) => r.data))
            } catch (err) {
                setError('Failed to load properties for comparison')
            } finally {
                setLoading(false)
            }
        }

        fetchProperties()
    }, [searchParams.get('uprns')])

    return (
        <main className="min-h-screen bg-white">
            <Navbar />

            <section className="max-w-5xl mx-auto px-4 py-8 md:py-12">
                <h1 className="text-2xl font-semibold text-[#0A0A0A] mb-6 md:text-3xl">
                    Compare Properties
                </h1>

                {loading && (
                    <div className="text-center py-12">
                        <div className="inline-block w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm text-gray-400 mt-3">Loading properties…</p>
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">
                        {error}
                    </div>
                )}

                {!loading && uprns.length === 0 && (
                    <div className="text-center py-12">
                        <p className="text-gray-500 text-sm mb-4">
                            No properties selected for comparison.
                        </p>
                        <p className="text-xs text-gray-400 mb-6">
                            Search for properties and add them to compare side by side.
                        </p>
                        <Link
                            to="/search"
                            className="inline-block bg-indigo-600 text-white text-sm px-5 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                            Search Properties
                        </Link>
                    </div>
                )}

                {!loading && properties.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-200">
                                    <th className="text-left py-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        Feature
                                    </th>
                                    {properties.map((p) => (
                                        <th
                                            key={p.uprn}
                                            className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider"
                                        >
                                            <Link
                                                to={`/property/${p.uprn}`}
                                                className="text-indigo-600 hover:text-indigo-800"
                                            >
                                                {p.address?.split(',')[0] || p.uprn}
                                            </Link>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {[
                                    { label: 'Postcode', key: 'postcode' },
                                    { label: 'Type', key: 'property_type' },
                                    { label: 'Floor Area', key: 'floor_area_m2', fmt: (v) => v ? `${v} m²` : '—' },
                                    { label: 'Rooms', key: 'num_rooms' },
                                    { label: 'Energy Rating', key: 'energy_rating' },
                                    { label: 'HMO', key: 'is_hmo', fmt: (v) => v ? 'Yes' : 'No' },
                                ].map(({ label, key, fmt }) => (
                                    <tr key={key}>
                                        <td className="py-3 pr-4 font-medium text-gray-700">
                                            {label}
                                        </td>
                                        {properties.map((p) => (
                                            <td key={p.uprn} className="py-3 px-4 text-gray-500">
                                                {fmt ? fmt(p[key]) : (p[key] ?? '—')}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </main>
    )
}
