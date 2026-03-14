/**
 * API client for letting agent endpoints.
 */
import api from './api'

/**
 * Get list of agents sorted by score.
 * @param {{ sector?: string, limit?: number }} params
 */
export function listAgents({ sector, limit = 20 } = {}) {
    return api.get('/api/agents', { params: { sector, limit } }).then(r => r.data)
}

/**
 * Get full agent profile with recent reviews.
 * @param {string} agentName - Agent slug
 */
export function getAgent(agentName) {
    return api.get(`/api/agents/${encodeURIComponent(agentName)}`).then(r => r.data)
}

/**
 * Get agent name suggestions for autocomplete.
 * @param {string} q - Search query
 */
export function suggestAgents(q) {
    return api.get('/api/agents/suggest', { params: { q } }).then(r => r.data)
}
