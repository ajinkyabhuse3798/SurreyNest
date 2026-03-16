/**
 * AdminLogin — standalone dark-themed admin portal login.
 * No public Navbar/Footer. Redirects non-admin accounts after login.
 */
import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Shield } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

export default function AdminLogin() {
    const { user, login, logout } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [submitting, setSubmitting] = useState(false)

    // Already authenticated as admin → go straight to dashboard
    useEffect(() => {
        if (user && user.role === 'admin') {
            navigate(location.state?.from?.pathname || '/admin', { replace: true })
        }
    }, [user, navigate, location.state])

    async function handleSubmit(e) {
        e.preventDefault()
        setError('')
        setSubmitting(true)
        try {
            const data = await login(email, password)
            if (data.user.role !== 'admin') {
                await logout()
                setError('This account does not have admin access.')
                return
            }
            navigate(location.state?.from?.pathname || '/admin', { replace: true })
        } catch (err) {
            setError(err.message || 'Login failed. Please try again.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
            <div className="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-sm">
                {/* Header */}
                <div className="flex flex-col items-center mb-8">
                    <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                        <Shield size={28} className="text-primary" />
                    </div>
                    <h1 className="text-xl font-black text-slate-900">Admin Portal</h1>
                    <p className="text-sm text-slate-500 mt-1">SurreyNest Admin Access</p>
                </div>

                {error && (
                    <div className="mb-5 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 text-sm text-rose-700">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                            Email
                        </label>
                        <input
                            type="email"
                            autoComplete="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                            placeholder="admin@example.com"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                            Password
                        </label>
                        <input
                            type="password"
                            autoComplete="current-password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                            placeholder="••••••••"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full bg-primary text-white font-semibold rounded-xl py-2.5 text-sm hover:bg-primary/90 transition-colors disabled:opacity-60 mt-2"
                    >
                        {submitting ? 'Signing in…' : 'Sign in to Admin'}
                    </button>
                </form>
            </div>
        </div>
    )
}
