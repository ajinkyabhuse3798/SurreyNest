/**
 * VerifyEmail — auto-verifies on page load using token from the URL.
 * Route: /verify-email?token=xxx
 *
 * On success, updates auth state so the verification banner disappears
 * without requiring a fresh login.
 */
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import Navbar from '../components/Navbar'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'

export default function VerifyEmail() {
    const [searchParams] = useSearchParams()
    const token = searchParams.get('token') || ''
    const { refreshUser } = useAuth()

    const [status, setStatus] = useState('loading') // 'loading' | 'success' | 'error'
    const [message, setMessage] = useState('')

    useEffect(() => {
        if (!token) {
            setStatus('error')
            setMessage('Invalid verification link. Please request a new one.')
            return
        }

        api.post('/api/auth/verify-email', { token })
            .then(() => {
                setStatus('success')
                // Refresh auth state so is_verified flips without re-login
                refreshUser?.()
            })
            .catch((err) => {
                setStatus('error')
                setMessage(
                    err?.response?.data?.detail ||
                    'Verification failed. The link may have expired.'
                )
            })
    }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <main className="min-h-screen bg-white">
            <Navbar />
            <div className="max-w-sm mx-auto px-4 py-16 text-center">
                {status === 'loading' && (
                    <>
                        <Loader2 size={36} className="text-primary animate-spin mx-auto mb-4" />
                        <h1 className="text-xl font-bold text-slate-800 mb-2">Verifying your email…</h1>
                        <p className="text-sm text-slate-500">Just a moment.</p>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
                            <CheckCircle2 size={32} className="text-emerald-500" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900 mb-2">Email verified!</h1>
                        <p className="text-sm text-slate-500 mb-8">
                            Your SurreyNest account is now fully active.
                        </p>
                        <Link
                            to="/"
                            className="inline-block bg-primary text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
                        >
                            Go to home
                        </Link>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
                            <XCircle size={32} className="text-red-400" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900 mb-2">Verification failed</h1>
                        <p className="text-sm text-slate-500 mb-6">{message}</p>
                        <Link
                            to="/"
                            className="text-primary font-semibold text-sm hover:underline"
                        >
                            Go to home
                        </Link>
                        <span className="text-slate-300 mx-3">·</span>
                        <Link
                            to="/login"
                            className="text-slate-500 text-sm hover:text-primary"
                        >
                            Sign in to resend
                        </Link>
                    </>
                )}
            </div>
        </main>
    )
}
