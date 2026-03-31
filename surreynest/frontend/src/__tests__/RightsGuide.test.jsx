import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../components/Navbar', () => ({
    default: () => <div>Navbar</div>,
}))

import RightsGuide from '../pages/RightsGuide'

function renderPage(initialEntry = '/rights') {
    return render(
        <MemoryRouter initialEntries={[initialEntry]}>
            <RightsGuide />
        </MemoryRouter>
    )
}

describe('RightsGuide', () => {
    it('does not show the legal help sidebar card', () => {
        renderPage()

        expect(screen.queryByText(/need legal help/i)).not.toBeInTheDocument()
        expect(screen.queryByRole('link', { name: /surrey advice centre/i })).not.toBeInTheDocument()
        expect(screen.queryByRole('link', { name: /citizens advice/i })).not.toBeInTheDocument()
        expect(screen.getByText(/verified information/i)).toBeInTheDocument()
    })
})
