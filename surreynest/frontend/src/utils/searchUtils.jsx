/**
 * Search utilities, constants, sort functions, and helpers.
 */

export const EPC_ORDER = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7 }

export const SORT_OPTIONS = [
    { value: 'distance', label: 'Nearest first' },
    { value: 'rooms', label: 'Most rooms' },
    { value: 'area', label: 'Largest' },
    { value: 'epc', label: 'Best EPC' },
]

export function sortProperties(list, sortKey) {
    const sorted = [...list]
    switch (sortKey) {
        case 'distance':
            // The backend already returns properties optimally sorted (exact postcode first, 
            // then house number, then geographic distance). We preserve the backend order.
            return sorted
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

export function formatRadius(m) {
    if (m < 1000) return `${m}m`
    return `${(m / 1000).toFixed(m % 1000 === 0 ? 0 : 1)}km`
}

export function getPropertyTypes(properties) {
    const types = new Set()
    properties.forEach((p) => {
        if (p.property_type) types.add(p.property_type)
    })
    return Array.from(types).sort()
}

export function SkeletonCard() {
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
