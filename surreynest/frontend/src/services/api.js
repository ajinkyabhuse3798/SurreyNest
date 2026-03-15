/**
 * Axios API client with cookie-based auth, error handling, and dev logging.
 *
 * All API calls go through this instance — never use fetch() directly.
 * Domain-specific wrappers live in propertyApi.js, scoreApi.js, etc.
 *
 * Auth: Uses httpOnly cookies (withCredentials: true) — no localStorage tokens.
 */
import axios from 'axios'

// ── Custom error class ───────────────────────────────────────────────────────

/**
 * Application-level API error with user-friendly message.
 * @param {string} message - User-facing error message
 * @param {number} status - HTTP status code
 * @param {string} detail - Server-provided detail (if any)
 */
export class AppError extends Error {
    constructor(message, status = 0, detail = '') {
        super(message)
        this.name = 'AppError'
        this.status = status
        this.detail = detail
    }
}

// ── User-friendly error messages by status ───────────────────────────────────
const ERROR_MESSAGES = {
    400: 'Invalid request — please check your input.',
    401: 'Session expired — please sign in again.',
    403: "You don't have permission to do that.",
    404: 'The requested resource was not found.',
    429: 'Too many requests — please wait a moment.',
    500: 'Something went wrong on our end. Please try again.',
    503: 'Service temporarily unavailable — please try again shortly.',
}

// ── Axios instance ───────────────────────────────────────────────────────────
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '',
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
    withCredentials: true,  // Send httpOnly cookies with every request
})

// ── Request interceptor: dev logging ─────────────────────────────────────────
api.interceptors.request.use((config) => {
    if (import.meta.env.DEV) {
        console.debug(`→ ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`, config.params || '')
    }

    return config
})

// ── Response interceptor: error handling + dev logging ───────────────────────
api.interceptors.response.use(
    (response) => {
        if (import.meta.env.DEV) {
            console.debug(`← ${response.status} ${response.config.url}`, response.data)
        }
        return response
    },
    (error) => {
        // Network error (no response)
        if (!error.response) {
            return Promise.reject(
                new AppError(
                    'Network error — check your connection and try again.',
                    0,
                    error.message,
                )
            )
        }

        const { status, data } = error.response
        const detail = data?.detail || ''

        // Suppress the expected 401 from the session-restore probe — not an error
        const isAuthProbe = error.config?.url === '/api/auth/me' && status === 401
        if (import.meta.env.DEV && !isAuthProbe) {
            console.warn(`← ${status} ${error.config?.url}`, detail)
        }

        // 401 — cookie expired or cleared; React auth guards handle the redirect
        // No localStorage cleanup needed — auth is cookie-based

        const message = ERROR_MESSAGES[status] || `Request failed (${status}).`
        return Promise.reject(new AppError(message, status, detail))
    }
)

export default api
