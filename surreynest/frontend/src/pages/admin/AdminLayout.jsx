import { useState } from 'react'
import { Link, useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { LayoutDashboard, Users, CreditCard, Flag, Activity, LogOut, Menu, X } from 'lucide-react'

const NAV_ITEMS = [
    { label: 'Overview', to: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Users', to: '/admin/users', icon: Users },
    { label: 'Subscriptions', to: '/admin/subscriptions', icon: CreditCard },
    { label: 'Reviews', to: '/admin/reviews', icon: Flag },
    { label: 'Pipelines', to: '/admin/pipelines', icon: Activity },
]

export default function AdminLayout() {
    const { user, logout, loading } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()
    const [sidebarOpen, setSidebarOpen] = useState(false)

    // Security check: must be admin
    if (loading) {
        return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Loading...</div>
    }

    if (!user || user.role !== 'admin') {
        navigate('/admin/login', { replace: true, state: { from: location } })
        return null
    }

    function handleLogout() {
        logout()
        navigate('/')
    }

    return (
        <div className="min-h-screen bg-slate-50 flex">
            {/* Mobile sidebar backdrop */}
            {sidebarOpen && (
                <div 
                    className="fixed inset-0 z-20 bg-slate-900/50 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                fixed inset-y-0 left-0 z-30 w-64 bg-slate-900 text-slate-300 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-auto lg:h-screen lg:flex lg:flex-col
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <div className="flex-1 flex flex-col min-h-0 bg-slate-900">
                    <div className="flex items-center justify-between h-16 shrink-0 px-6 bg-slate-950">
                        <Link to="/" className="flex items-center gap-2 group">
                            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white">
                                <span className="material-symbols-outlined text-[20px]">nest_eco_leaf</span>
                            </div>
                            <span className="text-lg font-bold text-white tracking-tight group-hover:text-primary transition-colors">
                                AdminPortal
                            </span>
                        </Link>
                        <button className="lg:hidden text-slate-400 hover:text-white" onClick={() => setSidebarOpen(false)}>
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
                        <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                            Dashboard
                        </p>
                        {NAV_ITEMS.map((item) => {
                            const active = location.pathname.startsWith(item.to)
                            return (
                                <Link
                                    key={item.to}
                                    to={item.to}
                                    onClick={() => setSidebarOpen(false)}
                                    className={`
                                        group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors
                                        ${active ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}
                                    `}
                                >
                                    <item.icon 
                                        className={`mr-3 flex-shrink-0 h-5 w-5 ${active ? 'text-primary' : 'text-slate-500 group-hover:text-slate-300'}`} 
                                    />
                                    {item.label}
                                </Link>
                            )
                        })}
                    </div>
                </div>

                {/* User Info / Logout */}
                <div className="shrink-0 flex flex-col p-4 bg-slate-950 border-t border-slate-800">
                    <div className="flex items-center gap-3 px-3 py-2">
                        <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold">
                            {user.email.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                                {user.email}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                                Administrator
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="mt-2 group flex w-full items-center px-3 py-2.5 text-sm font-medium text-slate-400 rounded-lg hover:bg-slate-800 hover:text-red-400 transition-colors"
                    >
                        <LogOut className="mr-3 h-5 w-5 text-slate-500 group-hover:text-red-400" />
                        Log out
                    </button>
                </div>
            </aside>

            {/* Main content area */}
            <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
                {/* Mobile top bar */}
                <div className="lg:hidden flex items-center justify-between h-16 bg-white border-b border-slate-200 px-4 sm:px-6">
                    <button
                        className="text-slate-500 hover:text-slate-700 focus:outline-none"
                        onClick={() => setSidebarOpen(true)}
                    >
                        <Menu size={24} />
                    </button>
                    <span className="text-sm font-bold text-slate-900 tracking-tight">
                        SurreyNest Admin
                    </span>
                    <div className="w-6" /> {/* Spacer */}
                </div>

                <main className="flex-1 relative overflow-y-auto focus:outline-none px-4 sm:px-6 md:px-8 py-8">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}
