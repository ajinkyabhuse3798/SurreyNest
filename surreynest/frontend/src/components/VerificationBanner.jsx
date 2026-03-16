/**
 * VerificationBanner — amber banner shown when the logged-in user
 * has not yet verified their email address.
 * Rendered inside Navbar so it appears on every page automatically.
 */
import { useState } from 'react'
import { Mail, X, Loader2, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import api from '../services/api'

export default function VerificationBanner() {
    const { user } = useAuth()
    const [dismissed, setDismissed] = useState(false)
    const [sending, setSending] = useState(false)
    const [sent, setSent] = useState(false)
    const [error, setError] = useState('')

    // Only show for logged-in, unverified users who haven't dismissed
    if (!user || user.is_verified || dismissed) return null

    async function resend() {
        setSending(true)
        setError('')
        try {
            await api.post('/api/auth/resend-verification')
            setSent(true)
        } catch (err) {
            setError(err?.response?.data?.detail || 'Failed to send. Please try again.')
        } finally {
            setSending(false)
        }
    }

    return (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 text-sm text-amber-800">
                    <Mail size={15} className="flex-shrink-0 text-amber-600" />
                    {sent ? (
                        <span className="flex items-center gap-1.5 text-emerald-700">
                            <CheckCircle2 size={14} />
                            Verification email sent — check your inbox.
                        </span>
                    ) : (
                        <span>
                            Please verify your email address to unlock all features.
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    {error && <span className="text-xs text-red-600">{error}</span>}
                    {!sent && (
                        <button
                            onClick={resend}
                            disabled={sending}
                            className="text-xs font-semibold text-amber-700 hover:text-amber-900 underline disabled:opacity-50 flex items-center gap-1"
                        >
                            {sending && <Loader2 size={11} className="animate-spin" />}
                            {sending ? 'Sending…' : 'Resend email'}
                        </button>
                    )}
                    <button
                        onClick={() => setDismissed(true)}
                        className="text-amber-500 hover:text-amber-700 transition-colors"
                        aria-label="Dismiss"
                    >
                        <X size={15} />
                    </button>
                </div>
            </div>
        </div>
    )
}
