import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import {
    ANALYTICS_CONSENT_ACCEPTED,
    ANALYTICS_CONSENT_DECLINED,
    ANALYTICS_CONSENT_KEY,
} from '../services/clarity'

vi.mock('../components/Navbar', () => ({
    default: () => <div>Navbar</div>,
}))

import About from '../pages/About'

describe('About', () => {
    beforeEach(() => {
        localStorage.clear()
        window.clarity = vi.fn()
    })

    it('exposes professional anchored sections for footer navigation', () => {
        const { container } = render(
            <MemoryRouter>
                <About />
            </MemoryRouter>
        )

        expect(screen.getByText('About SurreyNest')).toBeInTheDocument()
        expect(screen.queryByText(/final year MSc project/i)).not.toBeInTheDocument()

        expect(container.querySelector('#overview')).toBeInTheDocument()
        expect(container.querySelector('#what-we-offer')).toBeInTheDocument()
        expect(container.querySelector('#data-sources')).toBeInTheDocument()
        expect(container.querySelector('#faq')).toBeInTheDocument()
        expect(container.querySelector('#contact')).toBeInTheDocument()
        expect(container.querySelector('#privacy')).toBeInTheDocument()
        expect(container.querySelector('#terms')).toBeInTheDocument()
        expect(screen.getByText(/Microsoft Clarity/i)).toBeInTheDocument()
        expect(screen.getByText(/Analytics currently off/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Allow analytics' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Turn off analytics' })).toBeInTheDocument()
    })

    it('lets people change the analytics choice from the privacy section', async () => {
        const user = userEvent.setup()

        render(
            <MemoryRouter>
                <About />
            </MemoryRouter>
        )

        await user.click(screen.getByRole('button', { name: 'Allow analytics' }))

        expect(localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBe(ANALYTICS_CONSENT_ACCEPTED)
        expect(screen.getByText(/Analytics currently allowed/i)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Turn off analytics' }))

        expect(localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBe(ANALYTICS_CONSENT_DECLINED)
        expect(screen.getByText(/Analytics currently off/i)).toBeInTheDocument()
    })
})
