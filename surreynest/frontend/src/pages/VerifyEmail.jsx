import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Loader2, MailCheck, RefreshCw } from 'lucide-react'

import Navbar from '../components/Navbar'
import { useAuth } from '../hooks/useAuth'
import api from '../services/api'

export default function VerifyEmail() {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const { refreshUser } = useAuth()

    const [email, setEmail] = useState(searchParams.get('email') || '')
    const [code, setCode] = useState(searchParams.get('code') || searchParams.get('token') || '')
    const [loading, setLoading] = useState(false)
    const [resending, setResending] = useState(false)
    const [status, setStatus] = useState('form')
    const [message, setMessage] = useState('')

    useEffect(() => {
        if (!email || !code) return

        let cancelled = false
        setLoading(true)

        api.post('/api/auth/verify-email', {
            email: email.trim().toLowerCase(),
            token: code.trim(),
        })
            .then(async (res) => {
                if (cancelled) return
                setStatus('success')
                setMessage(res.data?.message || 'Email verified successfully!')
                await refreshUser?.()
            })
            .catch((err) => {
                if (!cancelled) {
                    setStatus('form')
                    setMessage(err.detail || err.response?.data?.detail || 'Verification failed. The code may have expired.')
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })

        return () => {
            cancelled = true
        }
    }, [email, code, refreshUser])

    async function handleSubmit(event) {
        event.preventDefault()
        setMessage('')
        setLoading(true)

        try {
            const res = await api.post('/api/auth/verify-email', {
                email: email.trim().toLowerCase(),
                token: code.trim(),
            })
            setStatus('success')
            setMessage(res.data?.message || 'Email verified successfully!')
            await refreshUser?.()
        } catch (err) {
            setStatus('form')
            setMessage(err.detail || err.response?.data?.detail || 'Verification failed. The code may have expired.')
        } finally {
            setLoading(false)
        }
    }

    async function handleResend() {
        if (!email.trim()) {
            setMessage('Enter your email address first so we know where to resend the code.')
            return
        }

        setResending(true)

        try {
            const res = await api.post('/api/auth/resend-verification', {
                email: email.trim().toLowerCase(),
            })
            setMessage(res.data?.message || 'Verification email sent. Please check your inbox.')
        } catch (err) {
            setMessage(err.detail || err.response?.data?.detail || 'Could not resend the verification code right now.')
        } finally {
            setResending(false)
        }
    }

    if (status === 'success') {
        return (
            <main className="min-h-screen bg-white">
                <Navbar />
                <div className="max-w-sm mx-auto px-4 py-16 text-center">
                    <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
                        <CheckCircle2 size={32} className="text-emerald-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">Email verified!</h1>
                    <p className="text-sm text-slate-500 mb-6">{message}</p>
                    <button
                        onClick={() => navigate('/')}
                        className="inline-block bg-primary text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
                    >
                        Continue to SurreyNest
                    </button>
                </div>
            </main>
        )
    }

    return (
        <main className="min-h-screen bg-white">
            <Navbar />
            <div className="max-w-sm mx-auto px-4 py-12">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-5">
                    {loading ? <Loader2 size={22} className="text-primary animate-spin" /> : <MailCheck size={22} className="text-primary" />}
                </div>
                <h1 className="text-2xl font-bold text-slate-900 mb-1">Verify your email</h1>
                <p className="text-sm text-slate-500 mb-7">
                    Enter the email address you used and the 6-digit code from SurreyNest.
                </p>

                {message && (
                    <div className={`rounded-lg px-4 py-3 text-sm mb-4 ${message.toLowerCase().includes('success') || message.toLowerCase().includes('sent')
                        ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border border-red-200 bg-red-50 text-red-700'
                        }`}>
                        {message}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-gray-700">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            required
                            autoComplete="email"
                            placeholder="you@surrey.ac.uk"
                            className="border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-gray-700">Verification code</label>
                        <input
                            type="text"
                            value={code}
                            onChange={(event) => setCode(event.target.value.replace(/\s+/g, ''))}
                            required
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            placeholder="123456"
                            className="border border-gray-200 rounded-lg px-4 py-3 text-sm tracking-[0.35em] focus:outline-none focus:border-primary transition-colors"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-primary text-white rounded-lg px-6 py-3 text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                        {loading ? 'Verifying…' : 'Verify email'}
                    </button>
                </form>

                <button
                    type="button"
                    onClick={handleResend}
                    disabled={resending}
                    className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                >
                    <RefreshCw size={14} className={resending ? 'animate-spin' : ''} />
                    {resending ? 'Resending…' : 'Resend code'}
                </button>

                <p className="text-sm text-slate-500 mt-6">
                    Already verified?{' '}
                    <Link to="/login" className="text-primary font-medium hover:underline">
                        Sign in
                    </Link>
                </p>
            </div>
        </main>
    )
}
