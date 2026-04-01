const ALLOWED_ANALYTICS_HOSTS = new Set(['surreynest.uk', 'www.surreynest.uk'])

export const PAGEVIEW_ANALYTICS_SCRIPT_ID = 'surreynest-cloudflare-analytics'

function getDefaultAnalyticsToken() {
    return import.meta.env.VITE_CLOUDFLARE_ANALYTICS_TOKEN?.trim() || ''
}

export function shouldEnablePageviewAnalytics({
    token = getDefaultAnalyticsToken(),
    hostname = typeof window !== 'undefined' ? window.location.hostname : '',
} = {}) {
    return Boolean(token) && ALLOWED_ANALYTICS_HOSTS.has(hostname)
}

export function ensurePageviewAnalyticsLoaded({
    token = getDefaultAnalyticsToken(),
    hostname = typeof window !== 'undefined' ? window.location.hostname : '',
    doc = typeof document !== 'undefined' ? document : null,
} = {}) {
    if (!doc || !shouldEnablePageviewAnalytics({ token, hostname })) {
        return false
    }

    if (doc.getElementById(PAGEVIEW_ANALYTICS_SCRIPT_ID)) {
        return true
    }

    const script = doc.createElement('script')
    script.id = PAGEVIEW_ANALYTICS_SCRIPT_ID
    script.defer = true
    script.src = 'https://static.cloudflareinsights.com/beacon.min.js'
    script.setAttribute('data-cf-beacon', JSON.stringify({ token, spa: true }))
    doc.head.appendChild(script)

    return true
}
