/**
 * Score API — safety scores and rent fairness.
 *
 * Endpoints:
 *   GET /api/scores/safety?postcode=
 *   GET /api/scores/rent-fairness?uprn=&weekly_rent=
 */
import api from './api'

/**
 * Get safety score for a postcode.
 * Returns a 0-100 score (higher = safer) with crime category breakdown.
 * @param {string} postcode - UK postcode, e.g. "GU2 7XH"
 * @returns {Promise<{ score: number, label: string, crime_breakdown: Object }>}
 */
export async function getSafetyScore(postcode) {
    const res = await api.get('/api/scores/safety', {
        params: { postcode },
    })
    return res.data
}

/**
 * Get rent fairness score for a property.
 * Compares actual rent against ML model prediction.
 * @param {string} uprn - Property UPRN
 * @param {number} weeklyRent - Actual weekly rent in £
 * @returns {Promise<{ score: number, label: string, colour: string, ratio: number,
 *   predicted_rent: number, actual_rent: number, difference_pounds: number, difference_percent: number }>}
 */
export async function getRentFairness(uprn, weeklyRent) {
    const res = await api.get('/api/scores/rent-fairness', {
        params: { uprn, weekly_rent: weeklyRent },
    })
    return res.data
}
