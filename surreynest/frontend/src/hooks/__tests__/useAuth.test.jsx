/**
 * Tests for useAuth hook and RequireAuth guard.
 */
import { useEffect } from 'react'
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

    it('stores the user immediately after login', async () => {
        api.get.mockRejectedValueOnce(new Error('No session'))
        api.post.mockResolvedValueOnce({
            data: {
                user: {
                    id: '123',
                    email: 'admin@test.com',
                    role: 'admin',
                },
            },
        })

        function Child() {
            const { user, loading, login } = useAuth()

            useEffect(() => {
                if (!loading && !user) {
                    login('admin@test.com', 'SecurePass123')
                }
            }, [loading, user, login])

            return <div>User: {user?.email || 'none'}</div>
        }

        render(
            <TestApp>
                <Child />
            </TestApp>
        )

        await waitFor(() => {
            expect(screen.getByText('User: admin@test.com')).toBeInTheDocument()
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

    it('redirects non-admin users to /admin/login for admin-only routes', async () => {
        api.get.mockResolvedValueOnce({
            data: { id: '123', email: 'test@test.com', role: 'student' },
        })

        render(
            <MemoryRouter initialEntries={['/admin']}>
                <AuthProvider>
                    <Routes>
                        <Route
                            path="/admin"
                            element={
                                <RequireAuth adminOnly>
                                    <div>Admin Secret</div>
                                </RequireAuth>
                            }
                        />
                        <Route path="/admin/login" element={<div>Admin Login Page</div>} />
                    </Routes>
                </AuthProvider>
            </MemoryRouter>
        )

        await waitFor(() => {
            expect(screen.getByText('Admin Login Page')).toBeInTheDocument()
        })
        expect(screen.queryByText('Admin Secret')).not.toBeInTheDocument()
    })
})
