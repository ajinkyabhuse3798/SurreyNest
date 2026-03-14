/**
 * API client for the AI tenancy agreement checker.
 * Uses 90s timeout override — AI analysis can take up to 60s.
 */
import axios from 'axios'
import api from './api'

// Override with longer timeout for AI calls
const contractApi = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '',
    timeout: 90_000,
    headers: { 'Content-Type': 'application/json' },
    withCredentials: true,
})

// Reuse the same response interceptor
contractApi.interceptors.response.use(
    (response) => response,
    (error) => {
        if (!error.response) {
            return Promise.reject(new Error('Network error — check your connection and try again.'))
        }
        return Promise.reject(error)
    }
)

/**
 * Analyse a tenancy agreement for problematic clauses.
 * @param {string} contractText
 */
export function checkContract(contractText) {
    return contractApi.post('/api/contract/check', { contract_text: contractText }).then(r => r.data)
}
