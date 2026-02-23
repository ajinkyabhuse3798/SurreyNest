/**
 * MapView — Leaflet map with CircleMarkers for properties.
 * Per design-system.md: OSM tiles, circle colour from fairness score, popup with link.
 *
 * @param {{ properties: Array, centre?: [number, number], zoom?: number }} props
 */
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import { Link } from 'react-router-dom'

/** Default centre: Guildford town centre */
const GUILDFORD_CENTRE = [51.2362, -0.5704]

function scoreColour(score) {
    if (score === null || score === undefined) return '#6B7280' // gray-500
    if (score >= 70) return '#16A34A' // green-600
    if (score >= 40) return '#D97706' // amber-600
    return '#DC2626' // red-600
}

export default function MapView({
    properties = [],
    centre = GUILDFORD_CENTRE,
    zoom = 13,
}) {
    return (
        <MapContainer
            center={centre}
            zoom={zoom}
            className="w-full h-full min-h-[300px]"
            scrollWheelZoom={true}
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {properties.map((p) => {
                if (!p.lat || !p.lng) return null
                return (
                    <CircleMarker
                        key={p.uprn}
                        center={[p.lat, p.lng]}
                        radius={8}
                        pathOptions={{
                            fillColor: scoreColour(p.fairness_score),
                            fillOpacity: 0.9,
                            color: 'white',
                            weight: 2,
                        }}
                    >
                        <Popup>
                            <div className="text-sm">
                                <p className="font-medium">{p.address}</p>
                                <p className="text-gray-500 text-xs mt-1">{p.postcode}</p>
                                <Link
                                    to={`/property/${p.uprn}`}
                                    className="text-indigo-600 text-xs font-medium mt-2 inline-block"
                                >
                                    View property →
                                </Link>
                            </div>
                        </Popup>
                    </CircleMarker>
                )
            })}
        </MapContainer>
    )
}
