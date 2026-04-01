import { Link, useLocation } from 'react-router-dom'
import useAnalyticsConsent from '../hooks/useAnalyticsConsent'
import {
    ANALYTICS_CONSENT_ACCEPTED,
    ANALYTICS_CONSENT_DECLINED,
    shouldEnableClarity,
} from '../services/clarity'

export default function CookieConsentBanner({ enabled = shouldEnableClarity() }) {
    const location = useLocation()
    const { consent, setConsent } = useAnalyticsConsent()

    if (!enabled || consent) {
        return null
    }

    const bottomOffset = location.pathname === '/search'
        ? 'bottom-24 md:bottom-6'
        : 'bottom-4 md:bottom-6'

    return (
        <aside
            aria-label="Analytics consent"
            className={`fixed inset-x-4 ${bottomOffset} z-50 mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-[0_18px_50px_-20px_rgba(15,23,42,0.45)] backdrop-blur-md`}
        >
            <p className="text-sm font-semibold text-slate-900">
                SurreyNest uses privacy-friendly analytics to understand visits,
                clicks, and scrolling.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Link
                    className="text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    to="/about#privacy"
                >
                    Privacy Policy
                </Link>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => setConsent(ANALYTICS_CONSENT_DECLINED)}
                        className="min-h-11 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    >
                        Decline
                    </button>
                    <button
                        type="button"
                        onClick={() => setConsent(ANALYTICS_CONSENT_ACCEPTED)}
                        className="min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    >
                        Accept
                    </button>
                </div>
            </div>
        </aside>
    )
}
