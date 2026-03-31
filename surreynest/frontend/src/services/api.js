/**
 * Shared Axios API client with error handling and dev logging.
 *
 * All API calls go through this instance, never use fetch() directly.
 * Domain-specific wrappers live in propertyApi.js, scoreApi.js, etc.
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
        this.response = status
            ? {
                status,
                data: { detail },
            }
            : undefined
    }
}

// ── User-friendly error messages by status ───────────────────────────────────
const ERROR_MESSAGES = {
    400: 'Invalid request, please check your input.',
    401: 'This action is not available.',
    403: "You don't have permission to do that.",
    404: 'The requested resource was not found.',
    429: 'Too many requests, please wait a moment.',
    500: 'Something went wrong on our end. Please try again.',
    503: 'Service temporarily unavailable, please try again shortly.',
}

// ── Axios instance ───────────────────────────────────────────────────────────
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '',
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
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
                    'Network error, check your connection and try again.',
                    0,
                    error.message,
                )
            )
        }

        const { status, data } = error.response
        const detail = data?.detail || ''

        if (import.meta.env.DEV) {
            console.warn(`← ${status} ${error.config?.url}`, detail)
        }

        const message = ERROR_MESSAGES[status] || `Request failed (${status}).`
        return Promise.reject(new AppError(message, status, detail))
    }
)

export default api
