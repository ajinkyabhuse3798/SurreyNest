/**
 * HMO API — check HMO licensing status.
 *
 * Endpoint:
 *   GET /api/hmo/check?uprn=&postcode=
 */
import api from './api'

/**
 * Check HMO licensing status for a property or postcode.
 * At least one of uprn or postcode is required.
 * @param {{ uprn?: string, postcode?: string }} params
 * @returns {Promise<{ status: 'licensed'|'expired'|'not_found', record: Object|null }>}
 */
export async function checkHmoStatus({ uprn, postcode } = {}) {
    const params = {}
    if (uprn) params.uprn = uprn
    if (postcode) params.postcode = postcode

    const res = await api.get('/api/hmo/check', { params })
    return res.data
}
