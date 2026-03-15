/**
 * ProGate — wraps Pro-only content with a paywall overlay for free users.
 *
 * Usage:
 *   <ProGate feature="Full crime analytics">
 *     <MonthlyChart ... />
 *   </ProGate>
 *
 * - If user is Pro: renders children as-is.
 * - If user is free: renders a blurred preview of children + upgrade CTA overlay.
 * - If user is not logged in: prompts them to sign in first.
 */
import { Link, useLocation } from 'react-router-dom'
import { Crown, Lock } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

export default function ProGate({ children, feature = 'This feature' }) {
    const { user } = useAuth()
    const location = useLocation()

    if (user?.is_pro) return children

    return (
        <div className="relative rounded-2xl overflow-hidden">
            {/* Blurred preview of the actual content */}
            <div className="pointer-events-none select-none blur-sm opacity-40" aria-hidden="true">
                {children}
            </div>

            {/* Overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-[2px] rounded-2xl">
                <div className="text-center px-6 py-8 max-w-xs">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                        {user ? (
                            <Crown size={22} className="text-primary" />
                        ) : (
                            <Lock size={22} className="text-primary" />
                        )}
                    </div>

                    <h3 className="text-base font-extrabold text-slate-900 mb-1">
                        {user ? 'SurreyNest Pro' : 'Sign in required'}
                    </h3>
                    <p className="text-sm text-slate-500 mb-5">
                        {user
                            ? `${feature} is available on the Pro plan.`
                            : `Sign in to access ${feature.toLowerCase()}.`}
                    </p>

                    {user ? (
                        <Link
                            to="/pricing"
                            className="inline-flex items-center gap-2 bg-primary text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-primary/25 hover:opacity-90 transition-all"
                        >
                            <Crown size={14} />
                            Upgrade to Pro — £5.99/mo
                        </Link>
                    ) : (
                        <div className="flex flex-col gap-2">
                            <Link
                                to="/login"
                                state={{ from: location }}
                                className="inline-flex items-center justify-center gap-2 bg-primary text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-primary/25 hover:opacity-90 transition-all"
                            >
                                Sign in
                            </Link>
                            <Link
                                to="/register"
                                state={{ from: location }}
                                className="text-xs text-slate-500 hover:text-primary transition-colors"
                            >
                                No account? Register free
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
