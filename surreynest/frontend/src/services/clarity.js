const ALLOWED_CLARITY_HOSTS = new Set(['surreynest.uk', 'www.surreynest.uk'])

export const CLARITY_SCRIPT_ID = 'surreynest-clarity-tag'
export const ANALYTICS_CONSENT_KEY = 'surreynest.analyticsConsent'
export const ANALYTICS_CONSENT_EVENT = 'surreynest:analytics-consent-change'
export const ANALYTICS_CONSENT_ACCEPTED = 'accepted'
export const ANALYTICS_CONSENT_DECLINED = 'declined'

function getDefaultProjectId() {
    return import.meta.env.VITE_CLARITY_PROJECT_ID?.trim() || ''
}

export function shouldEnableClarity({ projectId = getDefaultProjectId(), hostname = '' } = {}) {
    return Boolean(projectId) && ALLOWED_CLARITY_HOSTS.has(hostname)
}

export function ensureClarityLoaded({
    projectId = getDefaultProjectId(),
    hostname = typeof window !== 'undefined' ? window.location.hostname : '',
    doc = typeof document !== 'undefined' ? document : null,
    win = typeof window !== 'undefined' ? window : null,
} = {}) {
    if (!doc || !win || !shouldEnableClarity({ projectId, hostname })) {
        return false
    }

    if (typeof win.clarity !== 'function') {
        const clarity = (...args) => {
            clarity.q = clarity.q || []
            clarity.q.push(args)
        }

        clarity.q = []
        win.clarity = clarity
    }

    if (!doc.getElementById(CLARITY_SCRIPT_ID)) {
        const script = doc.createElement('script')
        script.id = CLARITY_SCRIPT_ID
        script.async = true
        script.src = `https://www.clarity.ms/tag/${projectId}`

        const firstScript = doc.getElementsByTagName('script')[0]

        if (firstScript?.parentNode) {
            firstScript.parentNode.insertBefore(script, firstScript)
        } else {
            doc.head.appendChild(script)
        }
    }

    return true
}

export function readAnalyticsConsent(storage = typeof window !== 'undefined' ? window.localStorage : null) {
    try {
        const storedValue = storage?.getItem(ANALYTICS_CONSENT_KEY)

        if (
            storedValue === ANALYTICS_CONSENT_ACCEPTED
            || storedValue === ANALYTICS_CONSENT_DECLINED
        ) {
            return storedValue
        }
    } catch {
        return null
    }

    return null
}

export function applyClarityConsent(status, win = typeof window !== 'undefined' ? window : null) {
    if (!win || typeof win.clarity !== 'function') {
        return false
    }

    win.clarity('consentv2', {
        ad_Storage: 'denied',
        analytics_Storage:
            status === ANALYTICS_CONSENT_ACCEPTED ? 'granted' : 'denied',
    })

    return true
}

export function updateAnalyticsConsent(
    status,
    {
        storage = typeof window !== 'undefined' ? window.localStorage : null,
        win = typeof window !== 'undefined' ? window : null,
    } = {}
) {
    try {
        storage?.setItem(ANALYTICS_CONSENT_KEY, status)
    } catch {
        // Ignore storage failures and still apply runtime consent if possible.
    }

    applyClarityConsent(status, win)

    if (win?.dispatchEvent && typeof win.CustomEvent === 'function') {
        win.dispatchEvent(
            new win.CustomEvent(ANALYTICS_CONSENT_EVENT, {
                detail: { status },
            })
        )
    }

    return status
}

export function setClarityRouteTag(route, win = typeof window !== 'undefined' ? window : null) {
    if (!route || !win || typeof win.clarity !== 'function') {
        return false
    }

    win.clarity('set', 'route', route)
    return true
}
