/**
 * Pure utility functions and constants for property detail pages.
 *
 * Extracted from PropertyDetail.jsx to enable reuse and independent testing.
 * All functions are pure — no React dependencies, no side effects.
 */
import {
    GraduationCap, TrainFront, ShoppingBag,
} from 'lucide-react'

// ── Key locations ────────────────────────────────────────────────────────────

export const UNI_SURREY = { lat: 51.2430, lng: -0.5890, label: 'University of Surrey', icon: GraduationCap }
export const TOWN_CENTRE = { lat: 51.2362, lng: -0.5704, label: 'Town Centre', icon: ShoppingBag }
export const TRAIN_STATION = { lat: 51.2372, lng: -0.5617, label: 'Train Station', icon: TrainFront }
export const KEY_LOCATIONS = [UNI_SURREY, TOWN_CENTRE, TRAIN_STATION]

export const GUILDFORD_TRANSIT_FACTS = [
    {
        icon: TrainFront,
        title: 'Guildford → London Waterloo',
        detail: 'Direct service ~35 min · every 15–30 min off-peak · no changes',
        colour: 'text-blue-700',
        bg: 'bg-blue-50',
    },
    {
        icon: GraduationCap,
        title: 'Bus to Surrey campus',
        detail: 'Arriva routes 5 and X1 — town centre to Stag Hill campus',
        colour: 'text-indigo-700',
        bg: 'bg-indigo-50',
    },
]

// ── Card styles ──────────────────────────────────────────────────────────────

export const CARD = 'bg-white rounded-2xl p-5 sm:p-6 shadow-[0_4px_20px_-2px_rgba(80,72,229,0.08)] border border-slate-100/80'
export const CARD_SM = 'bg-white rounded-xl p-4 shadow-[0_2px_10px_-2px_rgba(80,72,229,0.06)] border border-slate-100/60'

// ── Distance helpers ─────────────────────────────────────────────────────────

export function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function walkingTime(km) { return Math.round((km / 5) * 60) }
export function cyclingTime(km) { return Math.round((km / 15) * 60) }

export function proximityBadge(km, type) {
    const thresholds = {
        uni: { excellent: 0.8, good: 1.5, moderate: 3.0 },
        station: { excellent: 0.5, good: 1.2, moderate: 2.5 },
        town: { excellent: 0.6, good: 1.5, moderate: 3.0 },
    }
    const t = thresholds[type] || thresholds.town
    if (km <= t.excellent) return { label: 'Excellent', colour: 'bg-emerald-100 text-emerald-700' }
    if (km <= t.good) return { label: 'Good', colour: 'bg-blue-100 text-blue-700' }
    if (km <= t.moderate) return { label: 'Moderate', colour: 'bg-amber-100 text-amber-700' }
    return { label: 'Far', colour: 'bg-red-100 text-red-700' }
}

// ── Rent & property helpers ──────────────────────────────────────────────────

export function computeRentFactors(p, distances) {
    const factors = []
    if (!distances || distances.length === 0) return factors
    const stationDist = distances.find(d => d.label === 'Train Station')
    const uniDist = distances.find(d => d.label === 'University of Surrey')
    const epc = p.energy_rating?.toUpperCase()
    if (stationDist && stationDist.km <= 0.6) factors.push({ text: 'Right by the station', positive: true })
    else if (stationDist && stationDist.km >= 2.5) factors.push({ text: 'Far from the station', positive: false })
    if (uniDist && uniDist.km <= 1.2) factors.push({ text: 'Walking distance to Surrey', positive: true })
    else if (uniDist && uniDist.km >= 3.0) factors.push({ text: 'Long commute to campus', positive: false })
    if (epc === 'A' || epc === 'B') factors.push({ text: 'Excellent EPC — low bills', positive: true })
    else if (epc === 'F' || epc === 'G') factors.push({ text: 'Poor EPC — high bills', positive: false })
    if (p.safety_score != null && p.safety_score >= 75) factors.push({ text: 'Very safe area', positive: true })
    else if (p.safety_score != null && p.safety_score < 35) factors.push({ text: 'Higher crime area', positive: false })
    if (p.property_type === 'Detached') factors.push({ text: 'Detached — space premium', positive: true })
    else if (p.property_type === 'Flat') factors.push({ text: 'Flat — compact pricing', positive: false })
    const positive = factors.filter(f => f.positive).slice(0, 2)
    const negative = factors.filter(f => !f.positive).slice(0, 2)
    return [...positive, ...negative]
}

export function estimateEnergy(epc) {
    const map = { A: 35, B: 45, C: 55, D: 65, E: 80, F: 95, G: 120 }
    return map[epc?.toUpperCase()] || 65
}

export function epcImpact(epc) {
    const r = epc?.toUpperCase()
    if (r === 'A' || r === 'B') return { text: 'Great rating — expect low energy bills', colour: 'text-emerald-700' }
    if (r === 'C') return { text: 'Decent rating — average energy costs', colour: 'text-slate-600' }
    if (r === 'D') return { text: 'Below average — heating could be pricey in winter', colour: 'text-amber-700' }
    return { text: 'Poor rating — expect high energy bills', colour: 'text-red-700' }
}

export function safetyVerdict(score) {
    if (score == null) return null
    if (score >= 80) return { text: 'This area has very low crime — great for walking home at night', colour: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' }
    if (score >= 60) return { text: 'This area is above average for safety in Guildford', colour: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' }
    if (score >= 40) return { text: 'Average safety — stick to well-lit routes at night', colour: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' }
    return { text: 'Higher than average crime — walk in groups at night', colour: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' }
}

export function floorAreaContext(area, rooms) {
    if (!area || !rooms) return null
    const perRoom = area / rooms
    if (perRoom > 20) return 'Spacious for a student house'
    if (perRoom >= 15) return 'Good-sized rooms'
    if (perRoom >= 10) return 'Average size'
    return 'Compact — check room sizes before signing'
}
