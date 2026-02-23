/**
 * Login page — centred form, email + password.
 * Per design-system.md: max-w-sm, white bg, border inputs.
 */
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Navbar from '../components/Navbar'

export default function Login() {
    const { login } = useAuth()
    const navigate = useNavigate()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState(null)
    const [loading, setLoading] = useState(false)

    async function handleSubmit(e) {
        e.preventDefault()
        setError(null)
        setLoading(true)
        try {
            await login(email, password)
            navigate('/')
        } catch (err) {
            setError(err.response?.data?.detail || 'Login failed. Check your credentials.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <main className="min-h-screen bg-white">
            <Navbar />
            <div className="max-w-sm mx-auto px-4 py-12">
                <h1 className="text-2xl font-semibold text-[#0A0A0A] mb-6">Sign in</h1>

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
                            placeholder="you@surrey.ac.uk"
                            className="border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-indigo-600 transition-colors"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-gray-700">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="••••••••"
                            className="border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-indigo-600 transition-colors"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-indigo-600 text-white rounded-lg px-6 py-3 text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    >
                        {loading ? 'Signing in...' : 'Sign in'}
                    </button>
                </form>

                <p className="text-sm text-gray-500 mt-6 text-center">
                    Don't have an account?{' '}
                    <Link to="/register" className="text-indigo-600 font-medium">
                        Register
                    </Link>
                </p>
            </div>
        </main>
    )
}
