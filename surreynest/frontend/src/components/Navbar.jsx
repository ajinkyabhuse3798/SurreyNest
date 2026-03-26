/**
 * Navbar, Stitch-aligned sticky navigation with glass morphism.
 * Keeps the public site open while preserving admin session controls.
 * Uses framer-motion for smooth mobile menu animation.
 */
import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../hooks/useAuth'

const NAV_LINKS = [
    { to: '/search', label: 'Search' },
    { to: '/best-streets', label: 'Best Streets' },
    { to: '/compare', label: 'Compare' },
    { to: '/rights', label: 'Rights Guide' },
    { to: '/about', label: 'About' },
]

const TOOLS_LINKS = [
    { to: '/check-listing', label: 'Check Listing' },
    { to: '/agent', label: 'Agent Tracker' },
    { to: '/challenge-rent-increase', label: 'Challenge Rent Increase' },
]

export default function Navbar() {
    const { user, logout } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()
    const [mobileOpen, setMobileOpen] = useState(false)
    const [toolsOpen, setToolsOpen] = useState(false)
    const [logoutLoading, setLogoutLoading] = useState(false)
    const [authError, setAuthError] = useState('')
    const dropdownRef = useRef(null)

    useEffect(() => {
        function handleClickOutside(e) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setToolsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    useEffect(() => {
        setAuthError('')
    }, [location.pathname, location.search, location.hash])

    async function handleLogout() {
        setAuthError('')
        setLogoutLoading(true)
        try {
            await logout()
            navigate('/', { replace: true })
            setMobileOpen(false)
        } catch (err) {
            setAuthError(err?.detail || err?.message || 'Could not sign you out just now.')
        } finally {
            setLogoutLoading(false)
        }
    }

    function isActive(path) {
        return location.pathname === path
    }

    return (
        <>
        <nav className="sticky top-0 z-50 px-4 md:px-6 py-3">
            <div className="max-w-7xl mx-auto glass rounded-xl px-4 md:px-6 py-3 flex items-center justify-between shadow-sm">
                {/* Logo */}
                <Link to="/" className="flex items-center gap-2 group" onClick={() => setMobileOpen(false)}>
                    <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-white shadow-lg shadow-primary/30">
                        <span className="material-symbols-outlined">nest_eco_leaf</span>
                    </div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-900">
                        Surrey<span className="text-primary">Nest</span>
                    </h1>
                </Link>

                {/* Desktop nav links */}
                <div className="hidden lg:flex items-center gap-1">
                    {NAV_LINKS.map(({ to, label }) => (
                        <Link
                            key={to}
                            to={to}
                            className={`text-sm font-medium px-3 py-2 rounded-lg transition-colors ${isActive(to)
                                ? 'text-primary bg-primary/10 font-semibold'
                                : 'text-slate-700 hover:text-primary'
                                }`}
                        >
                            {label}
                        </Link>
                    ))}

                    {/* Tools dropdown */}
                    <div className="relative" ref={dropdownRef}>
                        <button
                            onClick={() => setToolsOpen(o => !o)}
                            className={`flex items-center gap-1 text-sm font-medium px-3 py-2 rounded-lg transition-colors ${
                                toolsOpen ? 'text-primary bg-primary/10 font-semibold' : 'text-slate-700 hover:text-primary'
                            }`}
                        >
                            Tools
                            <span className={`material-symbols-outlined text-sm transition-transform ${toolsOpen ? 'rotate-180' : ''}`}>
                                expand_more
                            </span>
                        </button>
                        <AnimatePresence>
                            {toolsOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: -8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -8 }}
                                    transition={{ duration: 0.15 }}
                                    className="absolute top-full right-0 mt-2 w-56 bg-white rounded-xl border border-slate-200 shadow-lg py-1 z-50"
                                >
                                    {TOOLS_LINKS.map(({ to, label }) => (
                                        <Link
                                            key={to}
                                            to={to}
                                            onClick={() => setToolsOpen(false)}
                                            className={`block text-sm px-4 py-2.5 transition-colors ${
                                                isActive(to) ? 'text-primary bg-primary/10 font-semibold' : 'text-slate-600 hover:bg-slate-50 hover:text-primary'
                                            }`}
                                        >
                                            {label}
                                        </Link>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Desktop auth + mobile hamburger */}
                <div className="flex items-center gap-3">
                    {/* Primary actions (desktop) */}
                    <div className="hidden lg:flex items-center gap-3">
                        {user?.role === 'admin' ? (
                            <>
                                <Link
                                    to="/admin"
                                    className="text-sm font-medium text-slate-700 hover:text-primary px-3 py-2 transition-colors"
                                >
                                    Admin
                                </Link>
                                <button
                                    onClick={handleLogout}
                                    disabled={logoutLoading}
                                    className="px-5 py-2 text-sm font-semibold text-slate-700 hover:text-primary transition-colors"
                                >
                                    {logoutLoading ? 'Signing out...' : 'Sign out'}
                                </button>
                            </>
                        ) : user ? (
                            <>
                                <span className="text-sm font-medium text-slate-500 max-w-[180px] truncate">
                                    {user.email}
                                </span>
                                <button
                                    onClick={handleLogout}
                                    disabled={logoutLoading}
                                    className="px-5 py-2 text-sm font-semibold text-slate-700 hover:text-primary transition-colors"
                                >
                                    {logoutLoading ? 'Signing out...' : 'Sign out'}
                                </button>
                            </>
                        ) : (
                            <>
                                <Link
                                    to="/login"
                                    className="text-sm font-medium text-slate-700 hover:text-primary px-3 py-2 transition-colors"
                                >
                                    Sign in
                                </Link>
                                <Link
                                    to="/register"
                                    className="bg-primary text-white px-6 py-2 rounded-lg text-sm font-semibold shadow-lg shadow-primary/25 hover:opacity-90 transition-all active:scale-95"
                                >
                                    Create Account
                                </Link>
                            </>
                        )}
                    </div>

                    {/* Hamburger (mobile) */}
                    <button
                        className="lg:hidden p-2 text-slate-700 hover:text-primary transition-colors"
                        onClick={() => setMobileOpen(!mobileOpen)}
                        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                    >
                        <span className="material-symbols-outlined text-2xl">
                            {mobileOpen ? 'close' : 'menu'}
                        </span>
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
                        className="lg:hidden overflow-hidden mt-2 mx-0 glass rounded-xl shadow-sm"
                    >
                        <div className="px-4 py-3 space-y-1">
                            {NAV_LINKS.map(({ to, label }) => (
                                <Link
                                    key={to}
                                    to={to}
                                    onClick={() => setMobileOpen(false)}
                                    className={`block text-sm font-medium px-3 py-2.5 rounded-lg transition-colors ${isActive(to)
                                        ? 'text-primary bg-primary/10 font-semibold'
                                        : 'text-slate-700 hover:bg-slate-50 hover:text-primary'
                                        }`}
                                >
                                    {label}
                                </Link>
                            ))}

                            <div className="border-t border-slate-200/60 pt-2 mt-1">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-3 py-1.5">
                                    Tools
                                </p>
                                {TOOLS_LINKS.map(({ to, label }) => (
                                    <Link
                                        key={to}
                                        to={to}
                                        onClick={() => setMobileOpen(false)}
                                        className={`block text-sm font-medium px-3 py-2.5 rounded-lg transition-colors ${
                                            isActive(to) ? 'text-primary bg-primary/10 font-semibold' : 'text-slate-700 hover:bg-slate-50 hover:text-primary'
                                        }`}
                                    >
                                        {label}
                                    </Link>
                                ))}
                            </div>

                            <div className="border-t border-slate-200/60 pt-2 mt-2">
                                {user?.role === 'admin' ? (
                                    <>
                                        <Link
                                            to="/admin"
                                            onClick={() => setMobileOpen(false)}
                                            className="block text-sm font-medium text-slate-700 px-3 py-2.5 hover:bg-slate-50 hover:text-primary rounded-lg"
                                        >
                                            Admin Dashboard
                                        </Link>
                                        <button
                                            onClick={handleLogout}
                                            disabled={logoutLoading}
                                            className="w-full text-left text-sm font-medium text-slate-700 px-3 py-2.5 hover:bg-slate-50 hover:text-primary rounded-lg"
                                        >
                                            {logoutLoading ? 'Signing out...' : 'Sign out'}
                                        </button>
                                    </>
                                ) : user ? (
                                    <>
                                        <div className="px-3 py-2 text-sm text-slate-500 truncate">
                                            {user.email}
                                        </div>
                                        <button
                                            onClick={handleLogout}
                                            disabled={logoutLoading}
                                            className="w-full text-left text-sm font-medium text-slate-700 px-3 py-2.5 hover:bg-slate-50 hover:text-primary rounded-lg"
                                        >
                                            {logoutLoading ? 'Signing out...' : 'Sign out'}
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <Link
                                            to="/login"
                                            onClick={() => setMobileOpen(false)}
                                            className="block text-sm font-medium text-slate-700 px-3 py-2.5 hover:bg-slate-50 hover:text-primary rounded-lg"
                                        >
                                            Sign in
                                        </Link>
                                        <Link
                                            to="/register"
                                            onClick={() => setMobileOpen(false)}
                                            className="block text-sm text-center bg-primary text-white px-3 py-2.5 rounded-lg font-semibold shadow-lg shadow-primary/25 hover:opacity-90 transition-all mt-1"
                                        >
                                            Create Account
                                        </Link>
                                    </>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {authError && (
                <div className="max-w-7xl mx-auto mt-2 border border-red-200 bg-red-50 rounded-xl px-4 py-3 text-sm text-red-700 shadow-sm">
                    {authError}
                </div>
            )}
        </nav>
        </>
    )
}
