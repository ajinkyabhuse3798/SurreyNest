import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import AdminLogin from '../AdminLogin'
import { useAuth } from '../../../hooks/useAuth'

vi.mock('../../../hooks/useAuth', () => ({
    useAuth: vi.fn(),
}))

describe('AdminLogin', () => {
    const login = vi.fn()
    const logout = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        useAuth.mockReturnValue({
            login,
            logout,
            user: null,
        })
    })

    it('logs a non-admin user back out after an admin-login attempt', async () => {
        login.mockResolvedValue({
            user: {
                id: 'student-1',
                email: 'student@example.com',
                role: 'student',
            },
        })

        render(
            <MemoryRouter initialEntries={['/admin/login']}>
                <Routes>
                    <Route path="/admin/login" element={<AdminLogin />} />
                    <Route path="/admin/dashboard" element={<div>Admin dashboard</div>} />
                </Routes>
            </MemoryRouter>
        )

        fireEvent.change(screen.getByPlaceholderText('admin@surreynest.co.uk'), {
            target: { value: 'student@example.com' },
        })
        fireEvent.change(screen.getByPlaceholderText('••••••••'), {
            target: { value: 'not-an-admin' },
        })
        fireEvent.click(screen.getByRole('button', { name: 'Sign in securely' }))

        await waitFor(() => {
            expect(logout).toHaveBeenCalledTimes(1)
        })
        expect(
            screen.getByText('Access denied. You do not have admin privileges.')
        ).toBeInTheDocument()
        expect(screen.queryByText('Admin dashboard')).not.toBeInTheDocument()
    })
})
