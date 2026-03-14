/**
 * API client for the rent increase challenger.
 */
import api from './api'

/**
 * Analyse a proposed rent increase.
 * @param {{ uprn?: string, postcode?: string, current_weekly_rent: number, proposed_weekly_rent: number, property_type?: string, bedrooms?: number }} data
 */
export function analyseRentIncrease(data) {
    return api.post('/api/rent/challenge-increase', data).then(r => r.data)
}
