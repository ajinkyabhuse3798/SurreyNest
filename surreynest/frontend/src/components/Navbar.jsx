/**
 * Navbar — sticky top navigation bar.
 * Auth-aware: shows Sign in/Register or user links based on auth state.
 * Per design-system.md: sticky, white bg, border-b, no shadow, no hamburger.
 */
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Navbar() {
    const { user, logout } = useAuth()
    const navigate = useNavigate()

    function handleLogout() {
        logout()
        navigate('/')
    }

    return (
        <nav className="sticky top-0 z-50 bg-white border-b border-gray-200">
            <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between md:h-16">
                {/* Logo */}
                <Link to="/" className="text-xl font-semibold md:text-2xl">
                    <span className="text-[#0A0A0A]">Surrey</span>
                    <span className="text-indigo-600">Nest</span>
                </Link>

                {/* Desktop nav links — hidden on mobile */}
                <div className="hidden md:flex items-center gap-6 text-sm text-gray-600">
                    <Link to="/search" className="hover:text-gray-900 transition-colors">
                        Search
                    </Link>
                    <Link to="/rights" className="hover:text-gray-900 transition-colors">
                        Rights Guide
                    </Link>
                </div>

                {/* Auth actions */}
                <div className="flex items-center gap-2">
                    {user ? (
                        <>
                            {user.role === 'admin' && (
                                <Link
                                    to="/admin"
                                    className="hidden md:inline-block text-sm text-gray-600 hover:text-gray-900 px-3 py-2"
                                >
                                    Admin
                                </Link>
                            )}
                            <button
                                onClick={handleLogout}
                                className="text-sm text-gray-600 hover:text-gray-900 px-3 py-2"
                            >
                                Sign out
                            </button>
                        </>
                    ) : (
                        <>
                            <Link
                                to="/login"
                                className="text-sm text-gray-600 hover:text-gray-900 px-3 py-2"
                            >
                                Sign in
                            </Link>
                            <Link
                                to="/register"
                                className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                            >
                                Register
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </nav>
    )
}
