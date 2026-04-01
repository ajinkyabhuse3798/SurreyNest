import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('../../services/analytics', () => ({
    ensurePageviewAnalyticsLoaded: vi.fn(),
}))

import PageviewAnalytics from '../PageviewAnalytics'
import { ensurePageviewAnalyticsLoaded } from '../../services/analytics'

function TestShell() {
    return (
        <MemoryRouter initialEntries={['/']}>
            <PageviewAnalytics />
            <nav>
                <Link to="/about">About</Link>
            </nav>
            <Routes>
                <Route path="/" element={<div>Home</div>} />
                <Route path="/about" element={<div>About Page</div>} />
            </Routes>
        </MemoryRouter>
    )
}

describe('PageviewAnalytics', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('loads pageview analytics on the initial route', async () => {
        render(<TestShell />)

        expect(await screen.findByText('Home')).toBeInTheDocument()
        expect(ensurePageviewAnalyticsLoaded).toHaveBeenCalledTimes(1)
    })

    it('survives client-side navigation and rechecks analytics loading', async () => {
        const user = userEvent.setup()

        render(<TestShell />)
        await user.click(screen.getByRole('link', { name: 'About' }))

        expect(await screen.findByText('About Page')).toBeInTheDocument()
        expect(ensurePageviewAnalyticsLoaded).toHaveBeenCalledTimes(2)
    })
})
