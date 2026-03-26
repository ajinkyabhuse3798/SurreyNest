import { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Lock } from 'lucide-react'

export default function AdminLogin() {
    const { login, logout, user } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()
    const returnTo = location.state?.from?.pathname || '/admin/dashboard'
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (user?.role === 'admin') {
            navigate(returnTo, { replace: true })
        }
    }, [user, navigate, returnTo])

    async function handleSubmit(e) {
        e.preventDefault()
        setError(null)
        setLoading(true)
        
        try {
            const res = await login(email, password)
            if (res.user.role !== 'admin') {
                await logout()
                setError('Access denied. You do not have admin privileges.')
                setLoading(false)
                return
            }
            navigate(returnTo, { replace: true })
        } catch (err) {
            setError(err.detail || err.response?.data?.detail || 'Login failed. Check your credentials.')
            setLoading(false)
        }
    }

    return (
        <main className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="flex justify-center flex-col items-center">
                    <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/30 mb-4">
                        <Lock size={24} />
                    </div>
                    <h2 className="text-center text-3xl font-extrabold text-white tracking-tight">
                        SurreyNest Admin
                    </h2>
                    <p className="mt-2 text-center text-sm text-slate-400">
                        Secure Staff Portal
                    </p>
                </div>

                <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                    <div className="bg-slate-900 py-8 px-4 shadow-2xl sm:rounded-2xl sm:px-10 border border-slate-800">
                        
                        {error && (
                            <div className="mb-4 bg-red-950/50 border border-red-900 rounded-lg p-4">
                                <div className="flex">
                                    <div className="ml-3">
                                        <h3 className="text-sm font-medium text-red-500">
                                            {error}
                                        </h3>
                                    </div>
                                </div>
                            </div>
                        )}

                        <form className="space-y-6" onSubmit={handleSubmit}>
                            <div>
                                <label className="block text-sm font-medium text-slate-300">
                                    Admin Email
                                </label>
                                <div className="mt-1">
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="appearance-none block w-full px-3 py-3 border border-slate-700 rounded-lg shadow-sm placeholder-slate-500 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-slate-950 text-white"
                                        placeholder="admin@surreynest.co.uk"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300">
                                    Password
                                </label>
                                <div className="mt-1">
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="appearance-none block w-full px-3 py-3 border border-slate-700 rounded-lg shadow-sm placeholder-slate-500 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-slate-950 text-white"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="text-sm">
                                    <Link to="/" className="font-medium text-primary hover:text-primary/80 transition-colors">
                                        &larr; Back to public site
                                    </Link>
                                </div>
                            </div>

                            <div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-slate-900 bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary focus:ring-offset-slate-900 transition-colors disabled:opacity-50"
                                >
                                    {loading ? 'Authenticating...' : 'Sign in securely'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </main>
    )
}
