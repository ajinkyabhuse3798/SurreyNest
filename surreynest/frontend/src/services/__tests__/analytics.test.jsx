import { beforeEach, describe, expect, it } from 'vitest'
import {
    PAGEVIEW_ANALYTICS_SCRIPT_ID,
    ensurePageviewAnalyticsLoaded,
} from '../analytics'

describe('ensurePageviewAnalyticsLoaded', () => {
    beforeEach(() => {
        document.head.innerHTML = ''
        document.body.innerHTML = ''
    })

    it('does nothing when the analytics token is missing', () => {
        expect(
            ensurePageviewAnalyticsLoaded({
                token: '',
                hostname: 'surreynest.uk',
                doc: document,
            })
        ).toBe(false)

        expect(document.getElementById(PAGEVIEW_ANALYTICS_SCRIPT_ID)).not.toBeInTheDocument()
    })

    it('does nothing on localhost even when a token is provided', () => {
        expect(
            ensurePageviewAnalyticsLoaded({
                token: 'demo-token',
                hostname: 'localhost',
                doc: document,
            })
        ).toBe(false)

        expect(document.getElementById(PAGEVIEW_ANALYTICS_SCRIPT_ID)).not.toBeInTheDocument()
    })

    it('injects the Cloudflare beacon only once for an allowed host', () => {
        expect(
            ensurePageviewAnalyticsLoaded({
                token: 'demo-token',
                hostname: 'surreynest.uk',
                doc: document,
            })
        ).toBe(true)

        expect(
            ensurePageviewAnalyticsLoaded({
                token: 'demo-token',
                hostname: 'surreynest.uk',
                doc: document,
            })
        ).toBe(true)

        const scripts = document.querySelectorAll(`#${PAGEVIEW_ANALYTICS_SCRIPT_ID}`)

        expect(scripts).toHaveLength(1)
        expect(scripts[0].getAttribute('src')).toBe('https://static.cloudflareinsights.com/beacon.min.js')
        expect(scripts[0].getAttribute('data-cf-beacon')).toContain('"token":"demo-token"')
        expect(scripts[0].getAttribute('data-cf-beacon')).toContain('"spa":true')
    })
})
