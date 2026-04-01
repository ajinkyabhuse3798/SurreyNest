const ALLOWED_CLARITY_HOSTS = new Set(['surreynest.uk', 'www.surreynest.uk'])

export const CLARITY_SCRIPT_ID = 'surreynest-clarity-tag'

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

export function setClarityRouteTag(route, win = typeof window !== 'undefined' ? window : null) {
    if (!route || !win || typeof win.clarity !== 'function') {
        return false
    }

    win.clarity('set', 'route', route)
    return true
}
