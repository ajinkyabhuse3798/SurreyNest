import { useState, useEffect, useCallback } from 'react'
import { Search, Calendar, LogIn, ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { adminApi } from '../../services/adminApi'

export default function AdminUsers() {
    const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(true)
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [pages, setPages] = useState(1)
    
    // Filters
    const [search, setSearch] = useState('')
    const [role, setRole] = useState('')

    // Debounce search state
    const [debouncedSearch, setDebouncedSearch] = useState('')

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 500)
        return () => clearTimeout(timer)
    }, [search])

    const fetchUsers = useCallback(async () => {
        setLoading(true)
        try {
            const params = {
                page,
                per_page: 20,
            }
            if (debouncedSearch) params.search = debouncedSearch
            if (role) params.role = role

            const res = await adminApi.getUsers(params)
            setUsers(res.users)
            setTotal(res.total)
            setPages(res.pages)
        } catch (err) {
            console.error('Failed to load users', err)
        } finally {
            setLoading(false)
        }
    }, [page, debouncedSearch, role])

    useEffect(() => {
        fetchUsers()
    }, [fetchUsers])

    // Reset page on filter change
    useEffect(() => {
        setPage(1)
    }, [debouncedSearch, role])

    async function handleRoleChange(userId, newRole) {
        if (!confirm(`Change user role to ${newRole}?`)) return
        try {
            await adminApi.updateUser(userId, { role: newRole })
            fetchUsers()
        } catch (err) {
            alert('Failed to update role')
        }
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Users</h1>
                    <p className="text-sm text-slate-500 mt-1">Manage all {total} tracked user accounts.</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search by email..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                    />
                </div>
                
                <div className="flex w-full md:w-auto gap-4">
                    <select
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="flex-1 md:w-40 border border-slate-300 rounded-lg text-sm py-2 pl-3 pr-8 focus:ring-2 focus:ring-primary outline-none"
                    >
                        <option value="">All Roles</option>
                        <option value="student">Student</option>
                        <option value="landlord">Landlord</option>
                        <option value="admin">Admin</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4">User</th>
                                <th className="px-6 py-4">Status & Role</th>
                                <th className="px-6 py-4">Dates</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-12 text-center text-slate-500">
                                        Loading users...
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-12 text-center text-slate-500">
                                        No users found matching your filters.
                                    </td>
                                </tr>
                            ) : (
                                users.map((u) => (
                                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-600">
                                                    {u.email.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-slate-900 flex items-center gap-2">
                                                        {u.email}
                                                        {u.is_verified && <Check size={14} className="text-blue-500" title="Verified" />}
                                                    </p>
                                                    <p className="text-xs text-slate-400 mt-0.5 font-mono">{u.id.split('-')[0]}...</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col items-start gap-2">
                                                <span className={`inline-flex px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md border
                                                    ${u.role === 'admin' ? 'bg-red-50 text-red-700 border-red-200' : 
                                                      u.role === 'guest' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                      u.role === 'landlord' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 
                                                      'bg-slate-100 text-slate-600 border-slate-200'}`}
                                                >
                                                    {u.role}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-xs space-y-1">
                                            <div className="flex items-center text-slate-500">
                                                <Calendar size={14} className="mr-2 text-slate-400" />
                                                Joined: {new Date(u.created_at).toLocaleDateString()}
                                            </div>
                                            <div className="flex items-center text-slate-500">
                                                <LogIn size={14} className="mr-2 text-slate-400" />
                                                Logged: {u.last_login ? new Date(u.last_login).toLocaleDateString() : 'Never'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right space-x-2">
                                            <select
                                                onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                                value={u.role}
                                                className="text-xs border border-slate-200 bg-white rounded-md px-2 py-1 focus:outline-none focus:border-primary"
                                            >
                                                <option value="student">Student</option>
                                                <option value="landlord">Landlord</option>
                                                <option value="admin">Admin</option>
                                            </select>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                
                {/* Pagination */}
                {!loading && pages > 1 && (
                    <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                        <span className="text-sm text-slate-500">
                            Showing page <span className="font-medium text-slate-900">{page}</span> of <span className="font-medium text-slate-900">{pages}</span>
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                disabled={page === 1}
                                onClick={() => setPage(p => p - 1)}
                                className="p-1 border border-slate-200 rounded-md text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <button
                                disabled={page === pages}
                                onClick={() => setPage(p => p + 1)}
                                className="p-1 border border-slate-200 rounded-md text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
