import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    ANALYTICS_CONSENT_ACCEPTED,
    ANALYTICS_CONSENT_DECLINED,
    ANALYTICS_CONSENT_EVENT,
    ANALYTICS_CONSENT_KEY,
    CLARITY_SCRIPT_ID,
    applyClarityConsent,
    ensureClarityLoaded,
    readAnalyticsConsent,
    setClarityRouteTag,
    updateAnalyticsConsent,
} from '../clarity'

describe('ensureClarityLoaded', () => {
    let mockWindow

    beforeEach(() => {
        document.head.innerHTML = ''
        document.body.innerHTML = ''
        mockWindow = { location: { hostname: 'surreynest.uk' } }
    })

    it('does nothing when the Clarity project id is missing', () => {
        expect(
            ensureClarityLoaded({
                projectId: '',
                hostname: 'surreynest.uk',
                doc: document,
                win: mockWindow,
            })
        ).toBe(false)

        expect(document.getElementById(CLARITY_SCRIPT_ID)).not.toBeInTheDocument()
    })

    it('does nothing on localhost even when a project id is provided', () => {
        expect(
            ensureClarityLoaded({
                projectId: 'demo-project',
                hostname: 'localhost',
                doc: document,
                win: mockWindow,
            })
        ).toBe(false)

        expect(document.getElementById(CLARITY_SCRIPT_ID)).not.toBeInTheDocument()
    })

    it('injects the Clarity tag only once when tracking is enabled', () => {
        expect(
            ensureClarityLoaded({
                projectId: 'demo-project',
                hostname: 'surreynest.uk',
                doc: document,
                win: mockWindow,
            })
        ).toBe(true)

        expect(
            ensureClarityLoaded({
                projectId: 'demo-project',
                hostname: 'surreynest.uk',
                doc: document,
                win: mockWindow,
            })
        ).toBe(true)

        const clarityScripts = document.querySelectorAll(`#${CLARITY_SCRIPT_ID}`)

        expect(clarityScripts).toHaveLength(1)
        expect(clarityScripts[0].getAttribute('src')).toBe('https://www.clarity.ms/tag/demo-project')
        expect(typeof mockWindow.clarity).toBe('function')
    })
})

describe('setClarityRouteTag', () => {
    it('sends the current route to the Clarity custom tags API', () => {
        const clarity = vi.fn()

        setClarityRouteTag('/search?postcode=GU1+1AA', { clarity })

        expect(clarity).toHaveBeenCalledWith('set', 'route', '/search?postcode=GU1+1AA')
    })
})

describe('analytics consent helpers', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('returns no stored consent choice when analytics consent is unset', () => {
        expect(readAnalyticsConsent(localStorage)).toBeNull()
    })

    it('sends denied consent to Clarity when there is no stored choice yet', () => {
        const clarity = vi.fn()

        expect(applyClarityConsent(null, { clarity })).toBe(true)
        expect(clarity).toHaveBeenCalledWith('consentv2', {
            ad_Storage: 'denied',
            analytics_Storage: 'denied',
        })
    })

    it('grants analytics storage while keeping ad storage denied when accepted', () => {
        const clarity = vi.fn()

        expect(applyClarityConsent(ANALYTICS_CONSENT_ACCEPTED, { clarity })).toBe(true)
        expect(clarity).toHaveBeenCalledWith('consentv2', {
            ad_Storage: 'denied',
            analytics_Storage: 'granted',
        })
    })

    it('stores the consent choice, applies it, and notifies listeners', () => {
        const clarity = vi.fn()
        const dispatchEvent = vi.fn()
        const win = { clarity, dispatchEvent, CustomEvent }

        expect(
            updateAnalyticsConsent(ANALYTICS_CONSENT_DECLINED, {
                storage: localStorage,
                win,
            })
        ).toBe(ANALYTICS_CONSENT_DECLINED)

        expect(localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBe(ANALYTICS_CONSENT_DECLINED)
        expect(clarity).toHaveBeenCalledWith('consentv2', {
            ad_Storage: 'denied',
            analytics_Storage: 'denied',
        })
        expect(dispatchEvent).toHaveBeenCalledTimes(1)
        expect(dispatchEvent.mock.calls[0][0].type).toBe(ANALYTICS_CONSENT_EVENT)
        expect(dispatchEvent.mock.calls[0][0].detail.status).toBe(ANALYTICS_CONSENT_DECLINED)
    })
})
