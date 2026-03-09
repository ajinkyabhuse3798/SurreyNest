/**
 * Tests for useAuth hook and RequireAuth guard.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider, RequireAuth, useAuth } from '../../hooks/useAuth'

// Mock the api module
vi.mock('../../services/api', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        interceptors: {
            request: { use: vi.fn() },
            response: { use: vi.fn() },
        },
    },
}))

import api from '../../services/api'

function TestApp({ children }) {
    return (
        <MemoryRouter>
            <AuthProvider>{children}</AuthProvider>
        </MemoryRouter>
    )
}

describe('AuthProvider', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders children and provides context', async () => {
        api.get.mockRejectedValueOnce(new Error('No session'))

        function Child() {
            const { user, loading } = useAuth()
            if (loading) return <div>Loading...</div>
            return <div>Logged out: {user === null ? 'yes' : 'no'}</div>
        }

        render(
            <TestApp>
                <Child />
            </TestApp>
        )

        await waitFor(() => {
            expect(screen.getByText('Logged out: yes')).toBeInTheDocument()
        })
    })

    it('restores session from /api/auth/me cookie', async () => {
        api.get.mockResolvedValueOnce({
            data: { id: '123', email: 'test@test.com', role: 'student' },
        })

        function Child() {
            const { user, loading } = useAuth()
            if (loading) return <div>Loading...</div>
            return <div>User: {user?.email || 'none'}</div>
        }

        render(
            <TestApp>
                <Child />
            </TestApp>
        )

        await waitFor(() => {
            expect(screen.getByText('User: test@test.com')).toBeInTheDocument()
        })
    })
})

describe('RequireAuth', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('redirects to /login when not authenticated', async () => {
        api.get.mockRejectedValueOnce(new Error('No session'))

        render(
            <MemoryRouter initialEntries={['/protected']}>
                <AuthProvider>
                    <Routes>
                        <Route
                            path="/protected"
                            element={
                                <RequireAuth>
                                    <div>Secret Page</div>
                                </RequireAuth>
                            }
                        />
                        <Route path="/login" element={<div>Login Page</div>} />
                    </Routes>
                </AuthProvider>
            </MemoryRouter>
        )

        await waitFor(() => {
            expect(screen.getByText('Login Page')).toBeInTheDocument()
        })
        expect(screen.queryByText('Secret Page')).not.toBeInTheDocument()
    })

    it('renders children when authenticated', async () => {
        api.get.mockResolvedValueOnce({
            data: { id: '123', email: 'test@test.com', role: 'student' },
        })

        render(
            <MemoryRouter initialEntries={['/protected']}>
                <AuthProvider>
                    <Routes>
                        <Route
                            path="/protected"
                            element={
                                <RequireAuth>
                                    <div>Secret Page</div>
                                </RequireAuth>
                            }
                        />
                        <Route path="/login" element={<div>Login Page</div>} />
                    </Routes>
                </AuthProvider>
            </MemoryRouter>
        )

        await waitFor(() => {
            expect(screen.getByText('Secret Page')).toBeInTheDocument()
        })
    })
})
