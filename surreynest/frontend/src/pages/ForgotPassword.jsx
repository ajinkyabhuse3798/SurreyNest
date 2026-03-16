/**
 * ForgotPassword — request a password reset email.
 * Route: /forgot-password
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react'
import Navbar from '../components/Navbar'
import api from '../services/api'

export default function ForgotPassword() {
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [sent, setSent] = useState(false)
    const [error, setError] = useState('')

    async function handleSubmit(e) {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            await api.post('/api/auth/forgot-password', { email: email.trim().toLowerCase() })
            setSent(true)
        } catch (err) {
            setError(err?.response?.data?.detail || 'Something went wrong. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <main className="min-h-screen bg-white">
            <Navbar />
            <div className="max-w-sm mx-auto px-4 py-12">
                <Link
                    to="/login"
                    className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary mb-8 transition-colors"
                >
                    <ArrowLeft size={14} />
                    Back to sign in
                </Link>

                {sent ? (
                    <div className="text-center py-6">
                        <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
                            <CheckCircle2 size={28} className="text-emerald-500" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900 mb-2">Check your inbox</h1>
                        <p className="text-sm text-slate-500 leading-relaxed mb-6">
                            If <span className="font-semibold text-slate-700">{email}</span> is registered,
                            we've sent a reset link. It expires in <strong>15 minutes</strong>.
                        </p>
                        <p className="text-xs text-slate-400">
                            Didn't receive it? Check your spam folder, or{' '}
                            <button
                                onClick={() => { setSent(false); setEmail('') }}
                                className="text-primary font-medium hover:underline"
                            >
                                try again
                            </button>
                            .
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-5">
                            <Mail size={22} className="text-primary" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900 mb-1">Forgot password?</h1>
                        <p className="text-sm text-slate-500 mb-7">
                            Enter your email and we'll send you a reset link.
                        </p>

                        {error && (
                            <div className="border border-red-200 bg-red-50 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-medium text-gray-700">Email address</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    autoComplete="email"
                                    placeholder="you@surrey.ac.uk"
                                    className="border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading || !email.trim()}
                                className="w-full bg-primary text-white rounded-lg px-6 py-3 text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                            >
                                {loading ? 'Sending…' : 'Send reset link'}
                            </button>
                        </form>
                    </>
                )}
            </div>
        </main>
    )
}
