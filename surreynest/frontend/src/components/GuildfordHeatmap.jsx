/**
 * GuildfordHeatmap — NeighbourhoodPulse interactive heatmap component.
 *
 * Shows a full-width Leaflet map of Guildford with coloured circles for each
 * postcode sector. Users toggle between 3 layers: Rent, Safety, HMO.
 * Each circle is sized by property count and coloured by the active metric.
 *
 * Used on the Home page between the Hero and the Features sections.
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import {
    MapContainer,
    TileLayer,
    CircleMarker,
    Popup,
    useMap,
} from 'react-leaflet'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Map, PoundSterling, Shield, Home as HomeIcon, Loader2 } from 'lucide-react'
import { fetchHeatmapSectors } from '../services/heatmapApi'

// ── Constants ────────────────────────────────────────────────────────────────

const GUILDFORD = [51.2362, -0.5704]

const LAYERS = [
    { id: 'rent', label: 'Rent', icon: PoundSterling, desc: 'Average weekly rent' },
    { id: 'safety', label: 'Safety', icon: Shield, desc: 'Crime-based safety score' },
    { id: 'hmo', label: 'HMO', icon: HomeIcon, desc: 'HMO licence density' },
]

// ── Colour scales ────────────────────────────────────────────────────────────

function rentColour(rent) {
    if (rent === null || rent === undefined) return '#9CA3AF'
    if (rent <= 150) return '#16A34A'  // affordable → green
    if (rent <= 250) return '#D97706'  // moderate → amber
    return '#DC2626'                    // expensive → red
}

function safetyColour(score) {
    if (score === null || score === undefined) return '#9CA3AF'
    if (score >= 70) return '#16A34A'   // safe → green
    if (score >= 40) return '#D97706'   // moderate → amber
    return '#DC2626'                    // risky → red
}

function hmoColour(pct) {
    if (pct === null || pct === undefined) return '#9CA3AF'
    if (pct >= 5) return '#16A34A'      // student-friendly → green
    if (pct >= 2) return '#D97706'      // some HMOs → amber
    return '#6366F1'                    // few HMOs → primary
}

function getColour(layer, sector) {
    if (layer === 'rent') return rentColour(sector.avg_weekly_rent)
    if (layer === 'safety') return safetyColour(sector.safety_score)
    return hmoColour(sector.hmo_density_pct)
}

function getMetricLabel(layer, sector) {
    if (layer === 'rent') {
        return sector.avg_weekly_rent != null
            ? `£${Math.round(sector.avg_weekly_rent)}/wk`
            : 'No data'
    }
    if (layer === 'safety') {
        return sector.safety_score != null
            ? `${sector.safety_score}/100`
            : 'No data'
    }
    return `${sector.hmo_count} HMOs (${sector.hmo_density_pct}%)`
}

// ── Circle sizing ────────────────────────────────────────────────────────────

function circleRadius(propertyCount) {
    return Math.max(12, Math.min(35, Math.sqrt(propertyCount) * 1.8))
}

// ── Map auto-fit ─────────────────────────────────────────────────────────────

function FitBounds({ bounds }) {
    const map = useMap()
    useEffect(() => {
        if (bounds) {
            map.fitBounds(
                [
                    [bounds.min_lat, bounds.min_lng],
                    [bounds.max_lat, bounds.max_lng],
                ],
                { padding: [30, 30], animate: true }
            )
        }
    }, [bounds])
    return null
}

// ── Sector circle ────────────────────────────────────────────────────────────

function SectorCircle({ sector, layer, isHovered, onHover, onLeave }) {
    const colour = getColour(layer, sector)
    const radius = circleRadius(sector.property_count)

    return (
        <CircleMarker
            center={[sector.centre_lat, sector.centre_lng]}
            radius={isHovered ? radius + 4 : radius}
            pathOptions={{
                fillColor: colour,
                fillOpacity: isHovered ? 0.95 : 0.75,
                color: 'white',
                weight: isHovered ? 3 : 2,
            }}
            eventHandlers={{
                mouseover: () => onHover(sector.postcode_sector),
                mouseout: onLeave,
            }}
        >
            <Popup>
                <div className="min-w-[180px]">
                    <p className="font-semibold text-[#0A0A0A] text-base mb-1">
                        {sector.postcode_sector}
                    </p>
                    <div className="space-y-1 text-sm text-gray-600">
                        <p>🏠 {sector.property_count.toLocaleString()} properties</p>
                        <p>
                            💰{' '}
                            {sector.avg_weekly_rent != null
                                ? `£${Math.round(sector.avg_weekly_rent)}/wk avg rent`
                                : 'Rent data unavailable'}
                        </p>
                        <p>
                            🛡️{' '}
                            {sector.safety_score != null
                                ? `Safety: ${sector.safety_score}/100`
                                : 'Safety data unavailable'}
                        </p>
                        <p>📋 {sector.hmo_count} HMO licences ({sector.hmo_density_pct}%)</p>
                    </div>
                    <Link
                        to={`/search?postcode=${encodeURIComponent(sector.postcode_sector + '0AA')}&radius=2000`}
                        className="text-primary text-xs font-medium mt-3 inline-block hover:text-primary-800"
                    >
                        Search this area →
                    </Link>
                </div>
            </Popup>
        </CircleMarker>
    )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function GuildfordHeatmap() {
    const [sectors, setSectors] = useState([])
    const [bounds, setBounds] = useState(null)
    const [activeLayer, setActiveLayer] = useState('rent')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [hoveredSector, setHoveredSector] = useState(null)

    // Fetch data on mount
    useEffect(() => {
        let cancelled = false
        setLoading(true)
        fetchHeatmapSectors()
            .then((res) => {
                if (!cancelled) {
                    setSectors(res.data.sectors || [])
                    setBounds(res.data.bounds || null)
                }
            })
            .catch((err) => {
                if (!cancelled) setError(err.message || 'Failed to load heatmap data')
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })
        return () => { cancelled = true }
    }, [])

    const totalProperties = useMemo(
        () => sectors.reduce((sum, s) => sum + s.property_count, 0),
        [sectors]
    )

    const handleHover = useCallback((sectorName) => setHoveredSector(sectorName), [])
    const handleLeave = useCallback(() => setHoveredSector(null), [])

    // ── Loading state ────────────────────────────────────────────────────
    if (loading) {
        return (
            <section className="px-4 py-16 md:py-20">
                <div className="max-w-6xl mx-auto text-center">
                    <Loader2 size={24} className="animate-spin text-primary/80 mx-auto mb-3" />
                    <p className="text-sm text-gray-400">Loading NeighbourhoodPulse map...</p>
                </div>
            </section>
        )
    }

    if (error || sectors.length === 0) return null

    // ── Render ───────────────────────────────────────────────────────────
    return (
        <section className="px-3 py-10 md:px-4 md:py-20 bg-gray-50/50">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-40px' }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    className="text-center mb-5 md:mb-8"
                >
                    <div className="inline-flex items-center gap-2 bg-primary/10 rounded-full px-4 py-1.5 mb-4">
                        <Map size={14} className="text-primary" />
                        <span className="text-xs font-semibold text-primary/90 uppercase tracking-wider">
                            NeighbourhoodPulse
                        </span>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 md:text-3xl mb-1 md:mb-2">
                        Explore Guildford's rental landscape
                    </h2>
                    <p className="text-sm md:text-base text-gray-500 max-w-lg mx-auto">
                        Toggle between rent, safety, and HMO layers to discover the best areas for students.
                    </p>
                </motion.div>

                {/* Layer toggle */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.15 }}
                    className="flex justify-center mb-3 md:mb-5"
                >
                    <div className="inline-flex bg-white/80 backdrop-blur-md border border-gray-200 rounded-xl p-0.5 md:p-1 shadow-sm">
                        {LAYERS.map((layer) => (
                            <button
                                key={layer.id}
                                onClick={() => setActiveLayer(layer.id)}
                                className={`flex items-center gap-1 md:gap-1.5 px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-all duration-200 ${activeLayer === layer.id
                                    ? 'bg-primary text-white shadow-md shadow-primary-500/20'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                    }`}
                            >
                                <layer.icon size={12} className="md:w-3.5 md:h-3.5" />
                                {layer.label}
                            </button>
                        ))}
                    </div>
                </motion.div>

                {/* Layer description */}
                <AnimatePresence mode="wait">
                    <motion.p
                        key={activeLayer}
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        transition={{ duration: 0.2 }}
                        className="text-center text-xs text-gray-400 mb-2 md:mb-4 hidden sm:block"
                    >
                        {LAYERS.find((l) => l.id === activeLayer)?.desc}
                    </motion.p>
                </AnimatePresence>

                {/* Map */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.7, delay: 0.2 }}
                    className="rounded-xl md:rounded-2xl overflow-hidden border border-gray-200 shadow-xl shadow-gray-200/50 h-[320px] md:h-[480px]"
                >
                    <MapContainer
                        center={GUILDFORD}
                        zoom={12}
                        className="w-full h-full"
                        scrollWheelZoom={true}
                        zoomControl={true}
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />

                        {bounds && <FitBounds bounds={bounds} />}

                        {sectors.map((sector) => (
                            <SectorCircle
                                key={sector.postcode_sector}
                                sector={sector}
                                layer={activeLayer}
                                isHovered={hoveredSector === sector.postcode_sector}
                                onHover={handleHover}
                                onLeave={handleLeave}
                            />
                        ))}
                    </MapContainer>
                </motion.div>

                {/* Legend + stats strip */}
                <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.4, duration: 0.6 }}
                    className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-4"
                >
                    {/* Colour legend */}
                    <div className="flex items-center gap-2 md:gap-3 text-[10px] md:text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-green-500" />
                            {activeLayer === 'rent' ? 'Affordable' : activeLayer === 'safety' ? 'Safe' : 'Student-friendly'}
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-amber-500" />
                            Moderate
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full" style={{ backgroundColor: activeLayer === 'hmo' ? '#6366F1' : '#DC2626' }} />
                            {activeLayer === 'rent' ? 'Expensive' : activeLayer === 'safety' ? 'Higher risk' : 'Few HMOs'}
                        </span>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-2 md:gap-3 text-[10px] md:text-xs text-gray-400">
                        <span>{sectors.length} sectors</span>
                        <span className="w-1 h-1 rounded-full bg-gray-300" />
                        <span>{totalProperties.toLocaleString()} properties</span>
                        <span className="w-1 h-1 rounded-full bg-gray-300" />
                        <span>Updated weekly</span>
                    </div>
                </motion.div>
            </div>
        </section>
    )
}
