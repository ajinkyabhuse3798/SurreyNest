/**
 * Navbar — sticky top navigation bar with mobile hamburger menu.
 * Auth-aware: shows Sign in/Register or user links based on auth state.
 * Uses framer-motion for smooth mobile menu animation.
 */
import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

const NAV_LINKS = [
    { to: '/search', label: 'Search' },
    { to: '/compare', label: 'Compare' },
    { to: '/rights', label: 'Rights Guide' },
    { to: '/about', label: 'About' },
]

export default function Navbar() {
    const { user, logout } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()
    const [mobileOpen, setMobileOpen] = useState(false)

    function handleLogout() {
        logout()
        navigate('/')
        setMobileOpen(false)
    }

    function isActive(path) {
        return location.pathname === path
    }

    return (
        <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200">
            <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between md:h-16">
                {/* Logo */}
                <Link to="/" className="text-xl font-semibold md:text-2xl" onClick={() => setMobileOpen(false)}>
                    <span className="text-[#0A0A0A]">Surrey</span>
                    <span className="text-indigo-600">Nest</span>
                </Link>

                {/* Desktop nav links */}
                <div className="hidden md:flex items-center gap-1">
                    {NAV_LINKS.map(({ to, label }) => (
                        <Link
                            key={to}
                            to={to}
                            className={`text-sm px-3 py-2 rounded-lg transition-colors ${isActive(to)
                                    ? 'text-indigo-600 bg-indigo-50 font-medium'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                }`}
                        >
                            {label}
                        </Link>
                    ))}
                </div>

                {/* Desktop auth + mobile hamburger */}
                <div className="flex items-center gap-2">
                    {/* Auth (desktop) */}
                    <div className="hidden md:flex items-center gap-2">
                        {user ? (
                            <>
                                {user.role === 'admin' && (
                                    <Link
                                        to="/admin"
                                        className="text-sm text-gray-600 hover:text-gray-900 px-3 py-2"
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

                    {/* Hamburger (mobile) */}
                    <button
                        className="md:hidden p-2 text-gray-600 hover:text-gray-900"
                        onClick={() => setMobileOpen(!mobileOpen)}
                        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                    >
                        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>
            </div>

            {/* Mobile menu */}
            <AnimatePresence>
                {mobileOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="md:hidden overflow-hidden border-t border-gray-100 bg-white"
                    >
                        <div className="px-4 py-3 space-y-1">
                            {NAV_LINKS.map(({ to, label }) => (
                                <Link
                                    key={to}
                                    to={to}
                                    onClick={() => setMobileOpen(false)}
                                    className={`block text-sm px-3 py-2.5 rounded-lg transition-colors ${isActive(to)
                                            ? 'text-indigo-600 bg-indigo-50 font-medium'
                                            : 'text-gray-600 hover:bg-gray-50'
                                        }`}
                                >
                                    {label}
                                </Link>
                            ))}

                            <div className="border-t border-gray-100 pt-2 mt-2">
                                {user ? (
                                    <>
                                        {user.role === 'admin' && (
                                            <Link
                                                to="/admin"
                                                onClick={() => setMobileOpen(false)}
                                                className="block text-sm text-gray-600 px-3 py-2.5 hover:bg-gray-50 rounded-lg"
                                            >
                                                Admin Dashboard
                                            </Link>
                                        )}
                                        <button
                                            onClick={handleLogout}
                                            className="w-full text-left text-sm text-gray-600 px-3 py-2.5 hover:bg-gray-50 rounded-lg"
                                        >
                                            Sign out
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <Link
                                            to="/login"
                                            onClick={() => setMobileOpen(false)}
                                            className="block text-sm text-gray-600 px-3 py-2.5 hover:bg-gray-50 rounded-lg"
                                        >
                                            Sign in
                                        </Link>
                                        <Link
                                            to="/register"
                                            onClick={() => setMobileOpen(false)}
                                            className="block text-sm text-center bg-indigo-600 text-white px-3 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors mt-1"
                                        >
                                            Register
                                        </Link>
                                    </>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </nav>
    )
}
