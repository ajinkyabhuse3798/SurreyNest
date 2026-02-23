/**
 * Authentication hook and context provider.
 * Manages JWT token in localStorage, user state, and auth actions.
 *
 * Usage:
 *   Wrap app in <AuthProvider> then call useAuth() in any component.
 *   { user, token, loading, login, register, logout }
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { jwtDecode } from 'jwt-decode'
import api from '../services/api'

const AuthContext = createContext(null)

/**
 * Decode a JWT and return user info, or null if invalid/expired.
 * @param {string} token
 * @returns {{ id: string, role: string } | null}
 */
function decodeToken(token) {
    try {
        const decoded = jwtDecode(token)
        // Check expiry
        if (decoded.exp * 1000 < Date.now()) {
            return null
        }
        return { id: decoded.sub, role: decoded.role }
    } catch {
        return null
    }
}

/**
 * AuthProvider — wraps the app and provides auth state + actions.
 * @param {{ children: React.ReactNode }} props
 */
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [token, setToken] = useState(null)
    const [loading, setLoading] = useState(true)

    // On mount, restore session from localStorage
    useEffect(() => {
        const storedToken = localStorage.getItem('token')
        if (storedToken) {
            const decoded = decodeToken(storedToken)
            if (decoded) {
                setToken(storedToken)
                setUser(decoded)
            } else {
                localStorage.removeItem('token')
            }
        }
        setLoading(false)
    }, [])

    const login = useCallback(async (email, password) => {
        const formData = new URLSearchParams()
        formData.append('username', email)
        formData.append('password', password)

        const res = await api.post('/api/auth/login', formData, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })

        const newToken = res.data.access_token
        localStorage.setItem('token', newToken)
        setToken(newToken)
        setUser(decodeToken(newToken))
        return res.data
    }, [])

    const register = useCallback(async (email, password) => {
        const res = await api.post('/api/auth/register', { email, password })
        return res.data
    }, [])

    const logout = useCallback(() => {
        localStorage.removeItem('token')
        setToken(null)
        setUser(null)
    }, [])

    const value = { user, token, loading, login, register, logout }

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * Hook to access auth state and actions.
 * @returns {{ user: object|null, token: string|null, loading: boolean, login: Function, register: Function, logout: Function }}
 */
export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}

/**
 * Route guard — redirects to /login if not authenticated.
 * Usage: <RequireAuth><AdminDashboard /></RequireAuth>
 * @param {{ children: React.ReactNode, adminOnly?: boolean }} props
 */
export function RequireAuth({ children, adminOnly = false }) {
    const { user, loading } = useAuth()

    if (loading) {
        return (
            <div className="px-4 py-12 text-center text-sm text-gray-400">
                Loading...
            </div>
        )
    }

    if (!user) {
        window.location.href = '/login'
        return null
    }

    if (adminOnly && user.role !== 'admin') {
        return (
            <div className="px-4 py-12 text-center text-sm text-gray-500">
                You do not have permission to view this page.
            </div>
        )
    }

    return children
}
