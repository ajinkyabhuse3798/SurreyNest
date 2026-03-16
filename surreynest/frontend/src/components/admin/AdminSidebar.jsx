/**
 * AdminSidebar — dark slate left navigation for the admin portal.
 */
import { useNavigate } from 'react-router-dom'
import {
    LayoutDashboard,
    BarChart3,
    Users,
    CreditCard,
    MessageSquare,
    Activity,
    LogOut,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

const NAV_ITEMS = [
    { id: 'overview',      icon: LayoutDashboard, label: 'Overview' },
    { id: 'analytics',     icon: BarChart3,        label: 'Analytics' },
    { id: 'users',         icon: Users,            label: 'Users' },
    { id: 'subscriptions', icon: CreditCard,       label: 'Subscriptions' },
    { id: 'reviews',       icon: MessageSquare,    label: 'Reviews' },
    { id: 'pipelines',     icon: Activity,         label: 'Pipelines' },
]

export default function AdminSidebar({ activeTab, onTabChange, pendingReviews = 0 }) {
    const { user, logout } = useAuth()
    const navigate = useNavigate()

    async function handleLogout() {
        await logout()
        navigate('/')
    }

    return (
        <aside className="bg-slate-900 text-slate-100 flex flex-col h-full w-60 flex-shrink-0">
            {/* Logo */}
            <div className="px-5 py-5 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-black text-sm">S</span>
                    </div>
                    <div>
                        <span className="font-bold text-white text-sm">SurreyNest</span>
                        <span className="ml-1.5 text-xs font-semibold text-primary">Admin</span>
                    </div>
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                {NAV_ITEMS.map(({ id, icon: Icon, label }) => {
                    const isActive = activeTab === id
                    return (
                        <button
                            key={id}
                            onClick={() => onTabChange(id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                                isActive
                                    ? 'bg-primary/20 text-primary border-r-2 border-primary rounded-l-lg'
                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            <Icon size={16} className="flex-shrink-0" />
                            <span className="flex-1">{label}</span>
                            {id === 'reviews' && pendingReviews > 0 && (
                                <span className="bg-primary text-white text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                                    {pendingReviews}
                                </span>
                            )}
                        </button>
                    )
                })}
            </nav>

            {/* Footer */}
            <div className="px-4 py-4 border-t border-slate-800">
                <p className="text-xs text-slate-500 truncate mb-3">{user?.email}</p>
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors"
                >
                    <LogOut size={14} />
                    Sign out
                </button>
            </div>
        </aside>
    )
}
