import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CLARITY_SCRIPT_ID, ensureClarityLoaded, setClarityRouteTag } from '../clarity'

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
