import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Eye, EyeOff, KeyRound, XCircle } from 'lucide-react'

import Navbar from '../components/Navbar'
import api from '../services/api'

export default function ResetPassword() {
    const [searchParams] = useSearchParams()
    const token = searchParams.get('token') || ''
    const navigate = useNavigate()

    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState('')

    if (!token) {
        return (
            <main className="min-h-screen bg-white">
                <Navbar />
                <div className="max-w-sm mx-auto px-4 py-16 text-center">
                    <XCircle size={40} className="text-red-400 mx-auto mb-4" />
                    <h1 className="text-xl font-bold text-slate-800 mb-2">Invalid link</h1>
                    <p className="text-sm text-slate-500 mb-6">
                        This reset link is missing or malformed. Please request a new one.
                    </p>
                    <Link to="/forgot-password" className="text-primary font-semibold text-sm hover:underline">
                        Request new reset link
                    </Link>
                </div>
            </main>
        )
    }

    async function handleSubmit(event) {
        event.preventDefault()
        setError('')

        if (password !== confirmPassword) {
            setError('Passwords do not match.')
            return
        }

        if (password.length < 8) {
            setError('Password must be at least 8 characters.')
            return
        }

        setLoading(true)

        try {
            await api.post('/api/auth/reset-password', { token, new_password: password })
            setSuccess(true)
            setTimeout(() => navigate('/login'), 3000)
        } catch (err) {
            setError(err.detail || err.response?.data?.detail || 'Something went wrong. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <main className="min-h-screen bg-white">
            <Navbar />
            <div className="max-w-sm mx-auto px-4 py-12">
                {success ? (
                    <div className="text-center py-6">
                        <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
                            <CheckCircle2 size={28} className="text-emerald-500" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900 mb-2">Password updated!</h1>
                        <p className="text-sm text-slate-500 mb-6">Your password has been changed. Redirecting you to sign in…</p>
                        <Link to="/login" className="text-primary font-semibold text-sm hover:underline">
                            Sign in now
                        </Link>
                    </div>
                ) : (
                    <>
                        <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-5">
                            <KeyRound size={22} className="text-primary" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900 mb-1">Set new password</h1>
                        <p className="text-sm text-slate-500 mb-7">Choose a strong password for your SurreyNest account.</p>

                        {error && (
                            <div className="border border-red-200 bg-red-50 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-medium text-gray-700">New password</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(event) => setPassword(event.target.value)}
                                        required
                                        autoComplete="new-password"
                                        placeholder="Min 8 chars, 1 letter, 1 number"
                                        className="w-full border border-gray-200 rounded-lg pl-4 pr-10 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((value) => !value)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                        tabIndex={-1}
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-medium text-gray-700">Confirm password</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(event) => setConfirmPassword(event.target.value)}
                                    required
                                    autoComplete="new-password"
                                    placeholder="••••••••"
                                    className="border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-primary text-white rounded-lg px-6 py-3 text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                            >
                                {loading ? 'Updating…' : 'Update password'}
                            </button>
                        </form>
                    </>
                )}
            </div>
        </main>
    )
}
