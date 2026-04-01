import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import Footer from '../Footer'

describe('Footer', () => {
    it('uses working footer links and professional brand copy', () => {
        const { container } = render(
            <MemoryRouter>
                <Footer />
            </MemoryRouter>
        )

        expect(screen.getByText('Search Listings')).toBeInTheDocument()
        expect(screen.getByText('Student Rights Guide')).toBeInTheDocument()
        expect(screen.queryByText('Street Ratings')).not.toBeInTheDocument()
        expect(screen.queryByText('Guildford Rent Index')).not.toBeInTheDocument()

        expect(screen.getByRole('link', { name: 'FAQ' })).toHaveAttribute('href', '/about#faq')
        expect(screen.getByRole('link', { name: 'About Us' })).toHaveAttribute('href', '/about#overview')
        expect(screen.getByRole('link', { name: 'Contact Support' })).toHaveAttribute('href', '/about#contact')
        expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/about#privacy')
        expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/about#terms')

        expect(container.querySelectorAll('a[href="#"]')).toHaveLength(0)
        expect(screen.queryByText(/Built for students, by students/i)).not.toBeInTheDocument()
    })
})
