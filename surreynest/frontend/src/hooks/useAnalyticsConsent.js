import React from 'react'
import {
    ANALYTICS_CONSENT_EVENT,
    ANALYTICS_CONSENT_KEY,
    readAnalyticsConsent,
    updateAnalyticsConsent,
} from '../services/clarity'

export default function useAnalyticsConsent({
    storage = typeof window !== 'undefined' ? window.localStorage : null,
    win = typeof window !== 'undefined' ? window : null,
} = {}) {
    const [consent, setConsentState] = React.useState(() => readAnalyticsConsent(storage))

    React.useEffect(() => {
        if (!win?.addEventListener) {
            return undefined
        }

        const syncConsent = (event) => {
            const nextStatus = event?.detail?.status ?? readAnalyticsConsent(storage)
            setConsentState(nextStatus)
        }

        const syncFromStorage = (event) => {
            if (!event.key || event.key === ANALYTICS_CONSENT_KEY) {
                setConsentState(readAnalyticsConsent(storage))
            }
        }

        win.addEventListener(ANALYTICS_CONSENT_EVENT, syncConsent)
        win.addEventListener('storage', syncFromStorage)

        return () => {
            win.removeEventListener(ANALYTICS_CONSENT_EVENT, syncConsent)
            win.removeEventListener('storage', syncFromStorage)
        }
    }, [storage, win])

    function setConsent(status) {
        const nextStatus = updateAnalyticsConsent(status, { storage, win })
        setConsentState(nextStatus)
    }

    return {
        consent,
        setConsent,
    }
}
