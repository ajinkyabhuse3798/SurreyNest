import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../hooks/useCompare', () => ({
    CompareProvider: ({ children }) => children,
}))

vi.mock('../components/Footer', () => ({
    default: () => <div>Footer</div>,
}))

vi.mock('../pages/Home', () => ({
    default: () => <div>Home Page</div>,
}))

vi.mock('../pages/NotFound', () => ({
    default: () => <div>Not Found</div>,
}))

vi.mock('../pages/SafetyOverview', () => ({
    default: () => <div>Safety Overview Page</div>,
}))

import App from '../App'

describe('App', () => {
    beforeEach(() => {
        window.scrollTo = vi.fn()
    })

    it.each([
        ['/login', 'Login Page'],
        ['/register', 'Register Page'],
        ['/forgot-password', 'Forgot Password Page'],
        ['/reset-password', 'Reset Password Page'],
        ['/verify-email', 'Verify Email Page'],
        ['/admin/login', 'Admin Login Page'],
        ['/admin', 'Admin Layout'],
    ])('redirects legacy auth route %s back to home', async (path, unwantedPage) => {
        window.history.pushState({}, '', path)

        render(<App />)

        expect(await screen.findByText('Home Page')).toBeInTheDocument()
        expect(screen.queryByText(unwantedPage)).not.toBeInTheDocument()
    })

    it('redirects /best-streets to /safety', async () => {
        window.history.pushState({}, '', '/best-streets')

        render(<App />)

        expect(await screen.findByText('Safety Overview Page')).toBeInTheDocument()
        expect(window.location.pathname).toBe('/safety')
    })
})
