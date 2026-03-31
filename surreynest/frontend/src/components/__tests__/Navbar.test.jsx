import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import Navbar from '../Navbar'

describe('Navbar', () => {
    it('keeps public navigation but removes auth and admin CTAs', () => {
        render(
            <MemoryRouter>
                <Navbar />
            </MemoryRouter>
        )

        expect(screen.getByText('Search')).toBeInTheDocument()
        expect(screen.getByText('Rights Guide')).toBeInTheDocument()
        expect(screen.getByText('About')).toBeInTheDocument()
        expect(screen.getByText('Tools')).toBeInTheDocument()

        expect(screen.queryByText('Best Streets')).not.toBeInTheDocument()
        expect(screen.queryByText('Sign in')).not.toBeInTheDocument()
        expect(screen.queryByText('Create Account')).not.toBeInTheDocument()
        expect(screen.queryByText('Admin')).not.toBeInTheDocument()
        expect(screen.queryByText('Admin Dashboard')).not.toBeInTheDocument()
    })
})
