/**
 * Property API — search and detail endpoints.
 *
 * Endpoints:
 *   GET /api/properties?postcode=&radius=&page=&per_page=
 *   GET /api/properties/{uprn}
 */
import api from './api'

/**
 * Search properties near a postcode.
 * @param {string} postcode - UK postcode, e.g. "GU2 7XH"
 * @param {number} [radius=1000] - Search radius in metres (250|500|1000|2000)
 * @param {number} [page=1] - Page number
 * @param {number} [perPage=20] - Results per page (max 50)
 * @returns {Promise<{ properties: Array, total: number, page: number, pages: number }>}
 */
export async function searchProperties(postcode, radius = 1000, page = 1, perPage = 20) {
    const res = await api.get('/api/properties', {
        params: { postcode, radius, page, per_page: perPage },
    })
    return res.data
}

/**
 * Get full property detail by UPRN.
 * Includes HMO status, review summary, safety score, and rent prediction.
 * @param {string} uprn - Unique Property Reference Number
 * @returns {Promise<Object>} PropertyDetail
 */
export async function getPropertyDetail(uprn) {
    const res = await api.get(`/api/properties/${uprn}`)
    return res.data
}
