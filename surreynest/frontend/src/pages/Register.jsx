/**
 * Register page — centred form, email + password + confirm.
 * Per design-system.md: max-w-sm, white bg, border inputs.
 */
import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Navbar from '../components/Navbar'

export default function Register() {
    const { register, login } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()
    const returnTo = location.state?.from?.pathname || '/'
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [error, setError] = useState(null)
    const [loading, setLoading] = useState(false)

    async function handleSubmit(e) {
        e.preventDefault()
        setError(null)

        if (password !== confirm) {
            setError('Passwords do not match.')
            return
        }
        if (password.length < 8) {
            setError('Password must be at least 8 characters.')
            return
        }

        setLoading(true)
        try {
            await register(email, password)
            // Auto-login after registration
            await login(email, password)
            navigate(returnTo, { replace: true })
            // Do not setLoading(false) here — navigate() unmounts this component
        } catch (err) {
            setError(err.response?.data?.detail || 'Registration failed. Please try again.')
            setLoading(false)
        }
    }

    return (
        <main className="min-h-screen bg-white">
            <Navbar />
            <div className="max-w-sm mx-auto px-4 py-12">
                <h1 className="text-2xl font-semibold text-[#0A0A0A] mb-6">
                    Create account
                </h1>

                {error && (
                    <div className="border border-red-200 bg-red-50 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-gray-700">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoComplete="email"
                            placeholder="you@surrey.ac.uk"
                            className="border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary-600 transition-colors"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-gray-700">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            autoComplete="new-password"
                            placeholder="At least 8 characters"
                            className="border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary-600 transition-colors"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-gray-700">
                            Confirm password
                        </label>
                        <input
                            type="password"
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                            required
                            autoComplete="new-password"
                            placeholder="••••••••"
                            className="border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary-600 transition-colors"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-primary text-white rounded-lg px-6 py-3 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                        {loading ? 'Creating account...' : 'Register'}
                    </button>
                </form>

                <p className="text-sm text-gray-500 mt-6 text-center">
                    Already have an account?{' '}
                    <Link to="/login" className="text-primary font-medium">
                        Sign in
                    </Link>
                </p>
            </div>
        </main>
    )
}
