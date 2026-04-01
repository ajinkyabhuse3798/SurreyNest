import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('../../services/clarity', () => ({
    ensureClarityLoaded: vi.fn(),
    setClarityRouteTag: vi.fn(),
}))

import ClarityAnalytics from '../ClarityAnalytics'
import { ensureClarityLoaded, setClarityRouteTag } from '../../services/clarity'

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
    })

    it('loads Clarity and tags the initial route', async () => {
        render(<TestShell />)

        expect(await screen.findByText('Home')).toBeInTheDocument()
        expect(ensureClarityLoaded).toHaveBeenCalledTimes(1)
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
