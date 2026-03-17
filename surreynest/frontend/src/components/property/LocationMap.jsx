/**
 * LocationMap — Interactive Leaflet map for property detail pages.
 *
 * Features:
 *   - Real OpenStreetMap tiles
 *   - Property marker (orange)
 *   - 3 landmark markers: University, Town Centre, Train Station
 *   - Dashed polylines from property to each landmark
 *   - Click landmark to see walking/cycling times
 *   - Click anywhere on map to measure straight-line distance from property
 *
 * Props:
 *   lat       — property latitude
 *   lng       — property longitude
 *   postcode  — displayed in property popup
 *   distances — array of { label, km, walkMin, cycleMin, proximityType }
 */
import { useState, useCallback } from 'react'
import {
    MapContainer,
    TileLayer,
    CircleMarker,
    Marker,
    Polyline,
    Popup,
    useMapEvents,
} from 'react-leaflet'
import L from 'leaflet'

// ── Fixed landmark coordinates ────────────────────────────────────────────────
const LANDMARKS = [
    {
        id: 'uni',
        label: 'University of Surrey',
        lat: 51.2430,
        lng: -0.5890,
        color: '#4F46E5',       // indigo
        fillColor: '#818CF8',
        icon: '🎓',
    },
    {
        id: 'town',
        label: 'Town Centre',
        lat: 51.2362,
        lng: -0.5704,
        color: '#059669',       // emerald
        fillColor: '#34D399',
        icon: '🏪',
    },
    {
        id: 'station',
        label: 'Guildford Station',
        lat: 51.2364,
        lng: -0.5797,
        color: '#64748B',       // slate
        fillColor: '#94A3B8',
        icon: '🚂',
    },
]

// ── Haversine distance (km) ───────────────────────────────────────────────────
function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLng = ((lng2 - lng1) * Math.PI) / 180
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLng / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── Custom div icon factory ───────────────────────────────────────────────────
function makeDivIcon(emoji, bgColor) {
    return L.divIcon({
        html: `<div style="
            width:32px;height:32px;border-radius:50%;
            background:${bgColor};border:3px solid white;
            box-shadow:0 2px 8px rgba(0,0,0,0.25);
            display:flex;align-items:center;justify-content:center;
            font-size:14px;cursor:pointer;
        ">${emoji}</div>`,
        className: '',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -18],
    })
}

function makePropertyIcon() {
    return L.divIcon({
        html: `<div style="
            width:40px;height:40px;border-radius:50%;
            background:#ea871d;border:3px solid white;
            box-shadow:0 4px 12px rgba(234,135,29,0.4);
            display:flex;align-items:center;justify-content:center;
            font-size:18px;cursor:pointer;
        ">🏠</div>`,
        className: '',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -22],
    })
}

// ── Click-to-measure handler ──────────────────────────────────────────────────
function MeasureTool({ propLat, propLng, onMeasure }) {
    useMapEvents({
        click(e) {
            // Ignore clicks on markers/popups (target is not the map canvas)
            if (e.originalEvent.target.closest?.('.leaflet-marker-icon, .leaflet-popup')) return
            onMeasure(e.latlng.lat, e.latlng.lng)
        },
    })
    return null
}

// ── Measurement marker ────────────────────────────────────────────────────────
function MeasureMarker({ propLat, propLng, measureLat, measureLng, onClear }) {
    if (measureLat === null) return null

    const km = haversineKm(propLat, propLng, measureLat, measureLng)
    const walkMin = Math.round((km / 5) * 60)

    const icon = L.divIcon({
        html: `<div style="
            width:26px;height:26px;border-radius:50%;
            background:#ea871d;border:2px solid white;
            box-shadow:0 2px 6px rgba(0,0,0,0.3);
            display:flex;align-items:center;justify-content:center;
            font-size:11px;color:white;font-weight:700;
        ">📍</div>`,
        className: '',
        iconSize: [26, 26],
        iconAnchor: [13, 13],
        popupAnchor: [0, -16],
    })

    return (
        <>
            <Polyline
                positions={[[propLat, propLng], [measureLat, measureLng]]}
                pathOptions={{ color: '#ea871d', weight: 2, dashArray: '6 4', opacity: 0.8 }}
            />
            <Marker position={[measureLat, measureLng]} icon={icon}>
                <Popup>
                    <div className="min-w-[150px] text-xs">
                        <p className="font-bold text-slate-800 mb-1">📏 Distance Measured</p>
                        <p className="text-slate-600">{km.toFixed(2)} km straight line</p>
                        <p className="text-slate-600">~{walkMin} min walk</p>
                        <button
                            onClick={onClear}
                            className="mt-2 text-rose-500 font-semibold hover:text-rose-700"
                        >
                            Clear measurement
                        </button>
                    </div>
                </Popup>
            </Marker>
        </>
    )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function LocationMap({ lat, lng, postcode, distances = [] }) {
    const [measureLat, setMeasureLat] = useState(null)
    const [measureLng, setMeasureLng] = useState(null)
    const [measuring, setMeasuring] = useState(false)

    const handleMeasure = useCallback((mlat, mlng) => {
        if (!measuring) return
        setMeasureLat(mlat)
        setMeasureLng(mlng)
    }, [measuring])

    const clearMeasure = useCallback(() => {
        setMeasureLat(null)
        setMeasureLng(null)
    }, [])

    // Build distance lookup from prop
    const distByType = {}
    distances.forEach((d) => { distByType[d.proximityType] = d })

    const propertyIcon = makePropertyIcon()

    return (
        <div className="relative">
            {/* Measure toggle button */}
            <button
                onClick={() => {
                    setMeasuring((v) => !v)
                    if (measuring) clearMeasure()
                }}
                className={`absolute top-3 right-3 z-[500] flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shadow-md transition-all ${
                    measuring
                        ? 'bg-primary text-white'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                }`}
                title="Click on the map to measure distance from this property"
            >
                <span>📏</span>
                {measuring ? 'Click map to measure' : 'Measure distance'}
            </button>

            <MapContainer
                center={[lat, lng]}
                zoom={15}
                style={{ height: '256px', width: '100%' }}
                scrollWheelZoom={false}
                zoomControl={true}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <MeasureTool propLat={lat} propLng={lng} onMeasure={handleMeasure} />

                {/* Property marker */}
                <Marker position={[lat, lng]} icon={propertyIcon}>
                    <Popup>
                        <div className="text-xs min-w-[120px]">
                            <p className="font-bold text-slate-800">🏠 This Property</p>
                            <p className="text-slate-500 mt-0.5">{postcode}</p>
                        </div>
                    </Popup>
                </Marker>

                {/* Landmark markers + connecting lines */}
                {LANDMARKS.map((lm) => {
                    const dist = distByType[lm.id]
                    return (
                        <div key={lm.id}>
                            <Polyline
                                positions={[[lat, lng], [lm.lat, lm.lng]]}
                                pathOptions={{
                                    color: lm.color,
                                    weight: 2,
                                    dashArray: '8 5',
                                    opacity: 0.6,
                                }}
                            />
                            <Marker
                                position={[lm.lat, lm.lng]}
                                icon={makeDivIcon(lm.icon, lm.fillColor)}
                            >
                                <Popup>
                                    <div className="text-xs min-w-[160px]">
                                        <p className="font-bold text-slate-800 mb-1.5">
                                            {lm.icon} {lm.label}
                                        </p>
                                        {dist ? (
                                            <>
                                                <div className="flex justify-between text-slate-600">
                                                    <span>Distance:</span>
                                                    <span className="font-semibold">{dist.km.toFixed(1)} km</span>
                                                </div>
                                                <div className="flex justify-between text-slate-600 mt-0.5">
                                                    <span>🚶 Walk:</span>
                                                    <span className="font-semibold">~{dist.walkMin} min</span>
                                                </div>
                                                <div className="flex justify-between text-slate-600 mt-0.5">
                                                    <span>🚲 Cycle:</span>
                                                    <span className="font-semibold">~{dist.cycleMin} min</span>
                                                </div>
                                            </>
                                        ) : (
                                            <p className="text-slate-500">
                                                {haversineKm(lat, lng, lm.lat, lm.lng).toFixed(1)} km away
                                            </p>
                                        )}
                                    </div>
                                </Popup>
                            </Marker>
                        </div>
                    )
                })}

                {/* Measurement overlay */}
                <MeasureMarker
                    propLat={lat}
                    propLng={lng}
                    measureLat={measureLat}
                    measureLng={measureLng}
                    onClear={clearMeasure}
                />
            </MapContainer>

            {/* Measuring hint */}
            {measuring && measureLat === null && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[500] bg-slate-900/80 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm">
                    Click anywhere on the map to measure distance
                </div>
            )}
        </div>
    )
}
