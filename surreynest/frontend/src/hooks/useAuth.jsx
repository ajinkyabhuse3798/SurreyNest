/**
 * Authentication hook and context provider.
 * Uses httpOnly cookies for JWT auth, no token in localStorage.
 *
 * On mount, calls GET /api/auth/me to restore session from cookie.
 * Login sets the cookie server-side; frontend only stores user info in state.
 *
 * Usage:
 *   Wrap app in <AuthProvider> then call useAuth() in any component.
 *   { user, loading, login, logout }
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import api from '../services/api'

const AuthContext = createContext(null)

/**
 * AuthProvider, wraps the app and provides auth state + actions.
 * @param {{ children: React.ReactNode }} props
 */
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)

    const refreshUser = useCallback(async () => {
        try {
            const res = await api.get('/api/auth/me')
            setUser(res.data)
            return res.data
        } catch {
            setUser(null)
            return null
        }
    }, [])

    // On mount, restore session from httpOnly cookie via /api/auth/me
    useEffect(() => {
        let cancelled = false

        api.get('/api/auth/me')
            .then((res) => {
                if (!cancelled) setUser(res.data)
            })
            .catch(() => {
                // Not authenticated or cookie expired, that's fine
                if (!cancelled) setUser(null)
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })

        return () => { cancelled = true }
    }, [])

    const login = useCallback(async (email, password) => {
        const formData = new URLSearchParams()
        formData.append('username', email.trim().toLowerCase())
        formData.append('password', password)

        const res = await api.post('/api/auth/login', formData, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })

        // Server sets httpOnly cookie, we only store user info in React state
        setUser(res.data.user)
        return res.data
    }, [])

    const register = useCallback(async (email, password) => {
        const res = await api.post('/api/auth/register', {
            email: email.trim().toLowerCase(),
            password,
        })

        if (res.data?.requires_verification === false && res.data?.user) {
            setUser(res.data.user)
        }

        return res.data
    }, [])

    const logout = useCallback(async () => {
        try {
            await api.post('/api/auth/logout')
        } catch {
            // If server is unreachable, still clear local state
        }
        setUser(null)
    }, [])

    const value = {
        user,
        loading,
        login,
        register,
        logout,
        refreshUser,
    }

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * Hook to access auth state and actions.
 * @returns {{ user: object|null, loading: boolean, login: Function, logout: Function }}
 */
export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}

/**
 * Route guard, redirects to the admin login if not authenticated.
 * Preserves the attempted URL in state so admin login can redirect back.
 * @param {{ children: React.ReactNode, adminOnly?: boolean }} props
 */
export function RequireAuth({ children, adminOnly = false }) {
    const { user, loading } = useAuth()
    const location = useLocation()

    if (loading) {
        return (
            <div className="px-4 py-12 text-center text-sm text-gray-400">
                Loading...
            </div>
        )
    }

    if (!user) {
        // Declarative redirect, preserves React state, passes return URL
        const loginPath = adminOnly ? '/admin/login' : '/login'
        return <Navigate to={loginPath} state={{ from: location }} replace />
    }

    if (adminOnly && user.role !== 'admin') {
        return <Navigate to="/admin/login" state={{ from: location }} replace />
    }

    return children
}
