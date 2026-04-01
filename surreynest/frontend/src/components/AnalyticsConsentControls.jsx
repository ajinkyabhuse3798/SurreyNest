import useAnalyticsConsent from '../hooks/useAnalyticsConsent'
import {
    ANALYTICS_CONSENT_ACCEPTED,
    ANALYTICS_CONSENT_DECLINED,
} from '../services/clarity'

export default function AnalyticsConsentControls() {
    const { consent, setConsent } = useAnalyticsConsent()
    const analyticsAllowed = consent === ANALYTICS_CONSENT_ACCEPTED

    return (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">
                {analyticsAllowed ? 'Analytics currently allowed.' : 'Analytics currently off.'}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
                You can change this choice at any time. SurreyNest only uses analytics
                storage for site improvement, not advertising.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                    type="button"
                    onClick={() => setConsent(ANALYTICS_CONSENT_ACCEPTED)}
                    className="min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                    Allow analytics
                </button>
                <button
                    type="button"
                    onClick={() => setConsent(ANALYTICS_CONSENT_DECLINED)}
                    className="min-h-11 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                    Turn off analytics
                </button>
            </div>
        </div>
    )
}
