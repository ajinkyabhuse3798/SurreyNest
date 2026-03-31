import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import Footer from '../Footer'

describe('Footer', () => {
    it('does not advertise the removed best streets page', () => {
        render(
            <MemoryRouter>
                <Footer />
            </MemoryRouter>
        )

        expect(screen.getByText('Search Listings')).toBeInTheDocument()
        expect(screen.getByText('Student Rights Guide')).toBeInTheDocument()
        expect(screen.queryByText('Street Ratings')).not.toBeInTheDocument()
        expect(screen.queryByText('Guildford Rent Index')).not.toBeInTheDocument()
    })
})
