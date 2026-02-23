/**
 * Axios API client with JWT auth interceptor.
 * All API calls go through this instance — never use fetch() directly.
 */
import axios from 'axios'

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '',
    headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token to every request if available
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token')
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

// On 401 response, clear token and redirect to login
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token')
            // Only redirect if not already on login/register page
            if (
                !window.location.pathname.includes('/login') &&
                !window.location.pathname.includes('/register')
            ) {
                window.location.href = '/login'
            }
        }
        return Promise.reject(error)
    }
)

export default api
