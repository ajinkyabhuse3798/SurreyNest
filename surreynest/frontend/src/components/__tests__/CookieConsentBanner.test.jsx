import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import CookieConsentBanner from '../CookieConsentBanner'
import {
    ANALYTICS_CONSENT_ACCEPTED,
    ANALYTICS_CONSENT_DECLINED,
    ANALYTICS_CONSENT_KEY,
} from '../../services/clarity'

describe('CookieConsentBanner', () => {
    beforeEach(() => {
        localStorage.clear()
        window.clarity = vi.fn()
    })

    it('appears on the first eligible visit and saves acceptance', async () => {
        const user = userEvent.setup()

        render(
            <MemoryRouter>
                <CookieConsentBanner enabled />
            </MemoryRouter>
        )

        expect(screen.getByText(/SurreyNest uses privacy-friendly analytics/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Accept' }))

        expect(localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBe(ANALYTICS_CONSENT_ACCEPTED)
        expect(window.clarity).toHaveBeenCalledWith('consentv2', {
            ad_Storage: 'denied',
            analytics_Storage: 'granted',
        })
        expect(screen.queryByText(/SurreyNest uses privacy-friendly analytics/i)).not.toBeInTheDocument()
    })

    it('persists refusal when the visitor declines', async () => {
        const user = userEvent.setup()

        render(
            <MemoryRouter>
                <CookieConsentBanner enabled />
            </MemoryRouter>
        )

        await user.click(screen.getByRole('button', { name: 'Decline' }))

        expect(localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBe(ANALYTICS_CONSENT_DECLINED)
        expect(window.clarity).toHaveBeenCalledWith('consentv2', {
            ad_Storage: 'denied',
            analytics_Storage: 'denied',
        })
        expect(screen.queryByText(/SurreyNest uses privacy-friendly analytics/i)).not.toBeInTheDocument()
    })

    it('does not render when Clarity is not enabled for the page', () => {
        render(
            <MemoryRouter>
                <CookieConsentBanner enabled={false} />
            </MemoryRouter>
        )

        expect(screen.queryByText(/SurreyNest uses privacy-friendly analytics/i)).not.toBeInTheDocument()
    })
})
