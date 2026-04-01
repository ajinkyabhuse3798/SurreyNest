import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('../../services/clarity', () => ({
    applyClarityConsent: vi.fn(),
    ensureClarityLoaded: vi.fn(),
    readAnalyticsConsent: vi.fn(),
    setClarityRouteTag: vi.fn(),
}))

import ClarityAnalytics from '../ClarityAnalytics'
import {
    applyClarityConsent,
    ensureClarityLoaded,
    readAnalyticsConsent,
    setClarityRouteTag,
} from '../../services/clarity'

function TestShell() {
    return (
        <MemoryRouter initialEntries={['/']}>
            <ClarityAnalytics />
            <nav>
                <Link to="/about?tab=privacy">About</Link>
            </nav>
            <Routes>
                <Route path="/" element={<div>Home</div>} />
                <Route path="/about" element={<div>About Page</div>} />
            </Routes>
        </MemoryRouter>
    )
}

describe('ClarityAnalytics', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        readAnalyticsConsent.mockReturnValue(null)
    })

    it('loads Clarity, applies the saved consent state, and tags the initial route', async () => {
        render(<TestShell />)

        expect(await screen.findByText('Home')).toBeInTheDocument()
        expect(ensureClarityLoaded).toHaveBeenCalledTimes(1)
        expect(readAnalyticsConsent).toHaveBeenCalledTimes(1)
        expect(applyClarityConsent).toHaveBeenCalledWith(null)
        expect(setClarityRouteTag).toHaveBeenCalledWith('/')
    })

    it('updates the route tag on client-side navigation without breaking routing', async () => {
        const user = userEvent.setup()

        render(<TestShell />)
        await user.click(screen.getByRole('link', { name: 'About' }))

        expect(await screen.findByText('About Page')).toBeInTheDocument()
        expect(setClarityRouteTag).toHaveBeenLastCalledWith('/about?tab=privacy')
    })
})
