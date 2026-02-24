/**
 * MapView — reusable Leaflet map with score-coloured markers.
 *
 * Works in two modes:
 *   - Multi-marker (SearchResults): fitBounds to show all markers, click navigates
 *   - Single-marker (PropertyDetail): centered on one point, higher zoom
 *
 * @param {{
 *   markers: Array<{ id: string, lat: number, lng: number, label?: string, score?: number, popupContent?: React.ReactNode }>,
 *   centre?: [number, number],
 *   zoom?: number,
 *   selectedId?: string,
 *   onMarkerClick?: (id: string) => void,
 *   radiusCircle?: { lat: number, lng: number, radiusM: number },
 *   height?: string,
 *   className?: string,
 *   fitBounds?: boolean,
 *   singleMode?: boolean,
 * }} props
 */
import { useEffect, useMemo } from 'react'
import {
    MapContainer,
    TileLayer,
    CircleMarker,
    Circle,
    Popup,
    useMap,
} from 'react-leaflet'
import { Link } from 'react-router-dom'

/** Default centre: Guildford town centre */
const GUILDFORD = [51.2362, -0.5704]

// ── Score → colour mapping ───────────────────────────────────────────────────

function scoreColour(score) {
    if (score === null || score === undefined) return '#6B7280' // gray-500
    if (score >= 70) return '#16A34A' // green-600
    if (score >= 40) return '#D97706' // amber-600
    return '#DC2626' // red-600
}

// ── Internal: recentre / fitBounds when props change ─────────────────────────

function ChangeView({ centre, zoom, markers, fitBounds, singleMode }) {
    const map = useMap()

    useEffect(() => {
        if (singleMode && centre) {
            map.setView(centre, zoom, { animate: true })
            return
        }

        if (fitBounds && markers.length > 0) {
            const validMarkers = markers.filter((m) => m.lat && m.lng)
            if (validMarkers.length === 0) return

            if (validMarkers.length === 1) {
                map.setView([validMarkers[0].lat, validMarkers[0].lng], zoom, {
                    animate: true,
                })
            } else {
                const bounds = validMarkers.map((m) => [m.lat, m.lng])
                map.fitBounds(bounds, { padding: [40, 40], animate: true })
            }
        } else if (centre) {
            map.setView(centre, zoom, { animate: true })
        }
    }, [centre?.[0], centre?.[1], zoom, markers.length, fitBounds, singleMode])

    return null
}

// ── Internal: radius circle overlay ──────────────────────────────────────────

function RadiusOverlay({ radiusCircle }) {
    if (!radiusCircle) return null

    return (
        <Circle
            center={[radiusCircle.lat, radiusCircle.lng]}
            radius={radiusCircle.radiusM}
            pathOptions={{
                color: '#6366F1',
                fillColor: '#6366F1',
                fillOpacity: 0.05,
                weight: 1.5,
                dashArray: '6 4',
            }}
        />
    )
}

// ── Internal: single marker with popup ───────────────────────────────────────

function PropertyMarker({ marker, isSelected, onMarkerClick }) {
    const baseRadius = isSelected ? 11 : 8

    return (
        <CircleMarker
            center={[marker.lat, marker.lng]}
            radius={baseRadius}
            pathOptions={{
                fillColor: scoreColour(marker.score),
                fillOpacity: isSelected ? 1 : 0.85,
                color: isSelected ? '#4F46E5' : 'white',
                weight: isSelected ? 3 : 2,
            }}
            eventHandlers={{
                click: () => onMarkerClick?.(marker.id),
            }}
        >
            <Popup>
                {marker.popupContent || (
                    <div className="text-sm min-w-[160px]">
                        <p className="font-medium text-[#0A0A0A] leading-tight">
                            {marker.label || 'Property'}
                        </p>
                        {marker.score !== undefined && marker.score !== null && (
                            <p className="text-xs text-gray-500 mt-1">
                                Score:{' '}
                                <span
                                    className="font-semibold"
                                    style={{ color: scoreColour(marker.score) }}
                                >
                                    {marker.score}
                                </span>
                            </p>
                        )}
                        <Link
                            to={`/property/${marker.id}`}
                            className="text-indigo-600 text-xs font-medium mt-2 inline-block hover:text-indigo-800"
                        >
                            View details →
                        </Link>
                    </div>
                )}
            </Popup>
        </CircleMarker>
    )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function MapView({
    markers = [],
    centre,
    zoom = 13,
    selectedId = null,
    onMarkerClick,
    radiusCircle,
    height = 'h-full',
    className = '',
    fitBounds = false,
    singleMode = false,
}) {
    // Compute initial centre
    const initialCentre = useMemo(() => {
        if (centre) return centre
        const first = markers.find((m) => m.lat && m.lng)
        return first ? [first.lat, first.lng] : GUILDFORD
    }, [])

    const initialZoom = singleMode ? zoom : 13

    // Filter valid markers
    const validMarkers = useMemo(
        () => markers.filter((m) => m.lat && m.lng),
        [markers]
    )

    return (
        <div className={`${height} min-h-[250px] ${className}`}>
            <MapContainer
                center={initialCentre}
                zoom={initialZoom}
                className="w-full h-full rounded-lg"
                scrollWheelZoom={true}
                zoomControl={true}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <ChangeView
                    centre={centre || initialCentre}
                    zoom={zoom}
                    markers={validMarkers}
                    fitBounds={fitBounds}
                    singleMode={singleMode}
                />

                <RadiusOverlay radiusCircle={radiusCircle} />

                {validMarkers.map((marker) => (
                    <PropertyMarker
                        key={marker.id}
                        marker={marker}
                        isSelected={marker.id === selectedId}
                        onMarkerClick={onMarkerClick}
                    />
                ))}
            </MapContainer>
        </div>
    )
}
