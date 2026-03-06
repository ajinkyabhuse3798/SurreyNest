/**
 * Safety Intelligence API — advanced crime analytics.
 *
 * Endpoints:
 *   GET /api/safety/intelligence?postcode=  → full sector analysis
 *   GET /api/safety/rankings                → safest/hotspot areas
 */
import api from './api'

/**
 * Get comprehensive safety intelligence for a postcode sector.
 * Returns crime breakdown, trend, comparison, holiday burglary risk,
 * student vulnerability index, and contextual tips.
 *
 * @param {string} postcode - UK postcode, e.g. "GU2 7XH"
 * @returns {Promise<Object>} Full safety intelligence data
 */
export async function getSafetyIntelligence(postcode) {
    const res = await api.get('/api/safety/intelligence', {
        params: { postcode },
    })
    return res.data
}

/**
 * Get safest and hotspot area rankings across Guildford.
 * @returns {Promise<{ safest: Array, hotspots: Array, guildford_average: number }>}
 */
export async function getSafetyRankings() {
    const res = await api.get('/api/safety/rankings')
    return res.data
}
