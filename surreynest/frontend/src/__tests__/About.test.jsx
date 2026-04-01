import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../components/Navbar', () => ({
    default: () => <div>Navbar</div>,
}))

import About from '../pages/About'

describe('About', () => {
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
    })
})
